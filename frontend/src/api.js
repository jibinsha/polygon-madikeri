import { supabase } from "./supabase";
import { offlineGet, offlinePut } from "./offlineStore";

const API =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8787";

// Keep the current access token in memory so ordinary API calls do not
// repeatedly ask Supabase for the session from storage.
let cachedAccessToken = "";
let cachedUserId = "";
let syncInProgress = false;
let groupSyncInProgress = false;
let refreshPromise = null;
const OFFLINE_MASTER_KEY = "farmers-master";
const OFFLINE_QUEUE_KEY = "completion-queue";
const OFFLINE_GROUPS_KEY = "farmer-groups";
const OFFLINE_GROUP_QUEUE_KEY = "farmer-group-queue";
const OFFLINE_API_PREFIX = "api:";
const userScopedKey = (base) => `${base}:${cachedUserId || "unknown-user"}`;
const memoryGetCache = new Map();
const MEMORY_CACHE_TTL_MS = 15000;

function memoryCacheTtl(path) {
  if (path.startsWith("/api/team-locations")) return 3000;
  if (path.startsWith("/api/farmer-groups")) return 30000;
  if (path.startsWith("/api/open-map")) return 15000;
  if (path.startsWith("/api/dashboard")) return 10000;
  if (path.startsWith("/api/farmers")) return 10000;
  return MEMORY_CACHE_TTL_MS;
}

function invalidateMemoryCache(prefixes = []) {
  if (!prefixes.length) {
    memoryGetCache.clear();
    return;
  }
  for (const key of memoryGetCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) memoryGetCache.delete(key);
  }
}

const isNetworkError = (error) => {
  if (!navigator.onLine) return true;
  return error instanceof TypeError || /network|failed to fetch|load failed|offline/i.test(error?.message || "");
};

const notifyOfflineChange = () => {
  window.dispatchEvent(new CustomEvent("polygon-offline-change"));
};

async function queueCompletion(bp, completed, remarks) {
  const queue = (await offlineGet(userScopedKey(OFFLINE_QUEUE_KEY))) || [];
  const queueId =
    (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `completion-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const next = {
    id: queueId,
    bp: String(bp),
    completed: Boolean(completed),
    remarks: remarks || "",
    queuedAt: new Date().toISOString(),
  };
  // Keep only the newest queued action for a BP. The unique id lets an older
  // in-flight request finish without deleting a newer Complete/Reopen action.
  const filtered = queue.filter((item) => String(item.bp) !== String(bp));
  filtered.push(next);
  await offlinePut(userScopedKey(OFFLINE_QUEUE_KEY), filtered);
  notifyOfflineChange();
  return {
    ok: true,
    bp,
    completed: Boolean(completed),
    remarks: remarks || "",
    offlineQueued: true,
    queueId,
  };
}

async function removeQueuedCompletion(queueId, bp, queuedAt) {
  const queue = (await offlineGet(userScopedKey(OFFLINE_QUEUE_KEY))) || [];
  const next = queue.filter((item) => {
    if (queueId) return String(item.id || "") !== String(queueId);
    return !(
      String(item.bp) === String(bp) &&
      (!queuedAt || String(item.queuedAt || "") === String(queuedAt))
    );
  });
  if (next.length !== queue.length) {
    await offlinePut(userScopedKey(OFFLINE_QUEUE_KEY), next);
    notifyOfflineChange();
  }
}

async function applyPendingCompletionQueue(payload) {
  if (!payload || !Array.isArray(payload.farmers)) return payload;
  const queue = (await offlineGet(userScopedKey(OFFLINE_QUEUE_KEY))) || [];
  if (!queue.length) return payload;

  const byBp = new Map(queue.map((item) => [String(item.bp), item]));
  const farmers = payload.farmers.map((farmer) => {
    const item = byBp.get(String(farmer.bp));
    if (!item) return farmer;
    return {
      ...farmer,
      status: item.completed ? "Completed" : "Pending",
      completion_date: item.completed
        ? (item.completedAt || item.queuedAt || farmer.completion_date)
        : null,
      remarks: item.remarks || farmer.remarks || "",
    };
  });

  const completed = farmers.filter((f) => f.status === "Completed").length;
  return {
    ...payload,
    farmers,
    statusCounts: payload.statusCounts
      ? {
          ...payload.statusCounts,
          completed,
          pending: farmers.length - completed,
        }
      : payload.statusCounts,
  };
}

async function readCachedApi(path) {
  return offlineGet(userScopedKey(OFFLINE_API_PREFIX + path));
}

async function cacheApi(path, data) {
  await offlinePut(userScopedKey(OFFLINE_API_PREFIX + path), data);
}

async function readOfflineMaster() {
  return offlineGet(userScopedKey(OFFLINE_MASTER_KEY));
}

async function writeOfflineMaster(data) {
  await offlinePut(userScopedKey(OFFLINE_MASTER_KEY), { ...data, cachedAt: Date.now() });
}

async function updateOfflineCompletion(bp, completed, remarks = "") {
  const master = await readOfflineMaster();
  if (!master || !Array.isArray(master.farmers)) return;
  const at = completed ? new Date().toISOString() : null;
  const farmers = master.farmers.map((farmer) => {
    if (String(farmer.bp) !== String(bp)) return farmer;
    return {
      ...farmer,
      status: completed ? "Completed" : "Pending",
      completion_date: at,
      remarks: remarks || farmer.remarks || "",
    };
  });
  const nextMaster = { ...master, farmers };
  await writeOfflineMaster(nextMaster);

  const dashboard = await readCachedApi("/api/dashboard?");
  if (dashboard?.totals) {
    const total = farmers.length;
    const completedCount = farmers.filter((item) => item.status === "Completed").length;
    const countsByTrader = new Map();
    for (const item of farmers) {
      const trader = item.trader || "Unknown";
      const entry = countsByTrader.get(trader) || { total: 0, completed: 0 };
      entry.total += 1;
      if (item.status === "Completed") entry.completed += 1;
      countsByTrader.set(trader, entry);
    }
    await cacheApi("/api/dashboard?", {
      ...dashboard,
      totals: {
        ...dashboard.totals,
        farmers: total,
        completed: completedCount,
        pending: total - completedCount,
        progress: total ? Math.round((completedCount / total) * 100) : 0,
      },
      traders: (dashboard.traders || []).map((item) => {
        const next = countsByTrader.get(item.trader);
        return next ? { ...item, completed: next.completed, pending: next.total - next.completed, progress: next.total ? Math.round((next.completed / next.total) * 100) : 0 } : item;
      }),
    });
  }

  const openMap = await readCachedApi("/api/open-map");
  if (openMap?.farmers) {
    await cacheApi("/api/open-map", {
      ...openMap,
      farmers: openMap.farmers.map((farmer) => String(farmer.bp) === String(bp)
        ? { ...farmer, status: completed ? "Completed" : "Pending", completion_date: at }
        : farmer),
    });
  }
}


async function readOfflineGroups() {
  return (await offlineGet(userScopedKey(OFFLINE_GROUPS_KEY))) || [];
}

async function writeOfflineGroups(groups) {
  await offlinePut(userScopedKey(OFFLINE_GROUPS_KEY), groups || []);
}

async function queueGroupAction(action) {
  const queue = (await offlineGet(userScopedKey(OFFLINE_GROUP_QUEUE_KEY))) || [];
  queue.push({ ...action, queuedAt: new Date().toISOString() });
  await offlinePut(userScopedKey(OFFLINE_GROUP_QUEUE_KEY), queue);
  notifyOfflineChange();
}

async function flushGroupQueue() {
  if (groupSyncInProgress || !navigator.onLine) return;
  const queue = (await offlineGet(userScopedKey(OFFLINE_GROUP_QUEUE_KEY))) || [];
  if (!queue.length) return;

  groupSyncInProgress = true;
  try {
    const remaining = [];
    const groups = await readOfflineGroups();

    for (const item of queue) {
      try {
        if (item.type === "create") {
          const result = await request("/api/farmer-groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: item.name, farmer_bps: item.farmer_bps }),
          });
          const created = result.group;
          const nextGroups = groups.filter((g) => String(g.id) !== String(item.localId));
          nextGroups.push(created);
          groups.splice(0, groups.length, ...nextGroups);
        } else if (item.type === "delete") {
          if (!String(item.id).startsWith("local-")) {
            await request(`/api/farmer-groups/${encodeURIComponent(item.id)}`, { method: "DELETE" });
          }
          const nextGroups = groups.filter((g) => String(g.id) !== String(item.id));
          groups.splice(0, groups.length, ...nextGroups);
        }
      } catch (error) {
        remaining.push(item);
        if (isNetworkError(error)) break;
      }
    }

    await writeOfflineGroups(groups);
    await offlinePut(userScopedKey(OFFLINE_GROUP_QUEUE_KEY), remaining);
    if (!remaining.length) notifyOfflineChange();
  } finally {
    groupSyncInProgress = false;
  }
}

function applyOfflineGroupFilter(groups, groupId) {
  if (!groupId) return null;
  const group = (groups || []).find((g) => String(g.id) === String(groupId));
  return group ? new Set((group.farmer_bps || []).map(String)) : null;
}

function applyOfflineOpenMapFilters(payload, params = {}, groups = []) {
  if (!payload) return payload;
  let farmers = Array.isArray(payload.farmers) ? payload.farmers : [];
  const groupBps = applyOfflineGroupFilter(groups, params.group_id);
  const bp = String(params.bp || params.q || "").trim().toLowerCase();
  const trader = String(params.trader || "").trim().toUpperCase();

  if (groupBps) farmers = farmers.filter((f) => groupBps.has(String(f.bp)));
  if (bp) farmers = farmers.filter((f) => String(f.bp || "").toLowerCase().includes(bp));
  if (trader) farmers = farmers.filter((f) => String(f.trader || traderFromBpClient(f.bp)).toUpperCase() === trader);

  return {
    ...payload,
    farmers,
    totals: {
      ...(payload.totals || {}),
      farmers: farmers.length,
      completed: farmers.filter((f) => f.status === "Completed").length,
      pending: farmers.filter((f) => f.status !== "Completed").length,
    },
    offline: true,
  };
}

function traderFromBpClient(bp) {
  const parts = String(bp || "").split("-");
  if (parts.length < 3) return "";
  const m = parts[2].match(/^([A-Za-z]+)\d+$/);
  return (m ? m[1] : parts[2]).toUpperCase();
}

function applyOfflineFarmerFilters(master, params = {}, groups = []) {
  const all = Array.isArray(master?.farmers) ? master.farmers : [];
  const q = String(params.q || "").trim().toLowerCase();
  const team = String(params.team || "");
  const day = String(params.day || "");
  const trader = String(params.trader || "");
  const status = String(params.status || "").toLowerCase();
  const completionDate = String(params.completion_date || "");
  const completionFrom = String(params.completion_from || "");
  const completionTo = String(params.completion_to || "");
  const groupBps = applyOfflineGroupFilter(groups, params.group_id);

  const matches = all.filter((r) => {
    if (groupBps && !groupBps.has(String(r.bp))) return false;
    if (trader && String(r.trader || "") !== trader) return false;
    if (team && String(r.team || "") !== team) return false;
    if (day && String(r.day || "") !== day) return false;
    if (status && String(r.status || "").toLowerCase() !== status) return false;
    const completedDate = r.completion_date ? String(r.completion_date).slice(0, 10) : "";
    if (completionDate && completedDate !== completionDate) return false;
    if (completionFrom && (!completedDate || completedDate < completionFrom)) return false;
    if (completionTo && (!completedDate || completedDate > completionTo)) return false;
    if (q) {
      const haystack = [r.bp, r.name, r.phone, r.village, r.estate, r.trader, r.cluster, r.team, r.day, r.route_group, r.name_in_bpm, r.farm_name]
        .map((x) => String(x ?? "").toLowerCase()).join(" ");
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const completed = all.filter((r) => r.status === "Completed").length;
  const pending = all.length - completed;
  const filteredCompleted = matches.filter((r) => r.status === "Completed").length;
  const filteredPending = matches.length - filteredCompleted;
  const pageSize = Math.min(Math.max(Number.parseInt(params.page_size, 10) || 40, 1), 100);
  const page = Math.max(Number.parseInt(params.page, 10) || 1, 1);
  const start = (page - 1) * pageSize;

  return {
    farmers: matches.slice(start, start + pageSize),
    total: matches.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(matches.length / pageSize)),
    statusCounts: { all: all.length, completed, pending, filteredCompleted, filteredPending },
    options: master.options || {},
    allTotal: all.length,
    offline: true,
  };
}

async function flushCompletionQueue() {
  if (syncInProgress || !navigator.onLine) return;
  const queue = (await offlineGet(userScopedKey(OFFLINE_QUEUE_KEY))) || [];
  if (!queue.length) return;

  syncInProgress = true;
  try {
    // Process the snapshot, but remove successful items by their unique id.
    // Never overwrite the whole queue at the end: a new Complete/Reopen action
    // may have been added while an older request was in flight.
    for (const item of queue) {
      try {
        await request(`/api/farmers/${encodeURIComponent(item.bp)}/completion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: item.completed, remarks: item.remarks || "" }),
        });
        await updateOfflineCompletion(item.bp, item.completed, item.remarks || "");
        await removeQueuedCompletion(item.id, item.bp, item.queuedAt);
        window.dispatchEvent(new CustomEvent("polygon-completion-confirmed", {
          detail: {
            bp: String(item.bp),
            completed: Boolean(item.completed),
            action: item.completed ? "completed" : "reopened",
          },
        }));
      } catch (error) {
        if (!isNetworkError(error)) {
          await removeQueuedCompletion(item.id, item.bp, item.queuedAt).catch(() => {});
        } else {
          break;
        }
      }
    }
  } finally {
    syncInProgress = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushGroupQueue().catch(() => {}).finally(() => {
      flushCompletionQueue().catch(() => {}).finally(() => {
      // Reconcile the complete offline snapshot after signal returns.
      setTimeout(() => api?.primeOfflineData?.().catch(() => {}), 1200);
      });
    });
  });
  setInterval(() => flushGroupQueue().catch(() => {}), 10000);
  setInterval(() => flushCompletionQueue().catch(() => {}), 15000);
}

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    const nextUserId = session?.user?.id || "";
    if (nextUserId !== cachedUserId) memoryGetCache.clear();
    cachedAccessToken = session?.access_token || "";
    cachedUserId = nextUserId;
  });
}

/* ======================================================
   Common API request
====================================================== */

export async function refreshSessionOnce() {
  if (!supabase) return null;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      const session = data?.session || null;
      if (session?.access_token) {
        cachedAccessToken = session.access_token;
        cachedUserId = session.user?.id || cachedUserId;
      }
      return session;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request(path, options = {}, tokenOverride, allowRefresh = true) {
  const { skipCache = false, ...fetchOptions } = options || {};
  const headers = new Headers(fetchOptions.headers || {});
  const method = String(fetchOptions.method || "GET").toUpperCase();
  let token = tokenOverride || cachedAccessToken;

  if (!token && supabase) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token || "";
    cachedAccessToken = token;
    cachedUserId = data.session?.user?.id || cachedUserId;
  }

  if (token) headers.set("Authorization", `Bearer ${token}`);

  const cacheKey = `${cachedUserId || "unknown-user"}:${path}`;
  if (method === "GET" && !skipCache) {
    const hit = memoryGetCache.get(cacheKey);
    if (hit && Date.now() - hit.at < memoryCacheTtl(path)) return hit.data;
  }

  try {
    let response = await fetch(`${API}${path}`, { ...fetchOptions, headers });

    if (response.status === 401 && supabase && allowRefresh) {
      try {
        const refreshed = await refreshSessionOnce();
        const freshToken = refreshed?.access_token;
        if (freshToken) {
          headers.set("Authorization", `Bearer ${freshToken}`);
          cachedAccessToken = freshToken;
          cachedUserId = refreshed.user?.id || cachedUserId;
          response = await fetch(`${API}${path}`, { ...fetchOptions, headers });
        }
      } catch {
        // Let the original 401 surface. AuthProvider will decide whether
        // the session can be recovered or the user must sign in again.
      }
    }

    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }

    if (!response.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    if (method === "GET" && !skipCache) {
      memoryGetCache.set(cacheKey, { at: Date.now(), data });
      cacheApi(path, data).catch(() => {});
    } else {
      invalidateMemoryCache([
        "/api/farmers",
        "/api/dashboard",
        "/api/open-map",
        "/api/team-locations",
      ]);
    }
    return data;
  } catch (error) {
    if (method === "GET" && isNetworkError(error)) {
      const cached = await readCachedApi(path);
      if (cached != null) return { ...cached, offline: true };
    }
    throw error;
  }
}

/* ======================================================
   Query builder
====================================================== */

function query(params = {}) {
  const q =
    new URLSearchParams();

  Object.entries(params).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim()
      ) {
        q.set(
          key,
          value
        );
      }
    }
  );

  return q.toString();
}

/* ======================================================
   API
====================================================== */

export const api = {

  base: API,

  /* ----------------------------------------------------
     Private farmer groups
  ---------------------------------------------------- */

  farmerGroups: async () => {
    if (!navigator.onLine) return { groups: await readOfflineGroups(), offline: true };
    try {
      const result = await request("/api/farmer-groups");
      await writeOfflineGroups(result.groups || []);
      return result;
    } catch (error) {
      if (isNetworkError(error)) return { groups: await readOfflineGroups(), offline: true };
      throw error;
    }
  },

  createFarmerGroup: async (name, farmerBps) => {
    const cleanName = String(name || "").trim();
    const bps = [...new Set((farmerBps || []).map((x) => String(x).trim()).filter(Boolean))];
    if (!cleanName) throw new Error("Group name is required.");
    if (!bps.length) throw new Error("Select at least one farmer.");

    if (!navigator.onLine) {
      const groups = await readOfflineGroups();
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const group = { id: localId, name: cleanName, farmer_bps: bps, count: bps.length, created_at: new Date().toISOString(), local: true };
      await writeOfflineGroups([...groups, group]);
      await queueGroupAction({ type: "create", localId, name: cleanName, farmer_bps: bps });
      return { ok: true, group, offlineQueued: true };
    }

    try {
      const result = await request("/api/farmer-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName, farmer_bps: bps }),
      });
      const groups = await readOfflineGroups();
      await writeOfflineGroups([...groups.filter((g) => String(g.id) !== String(result.group.id)), result.group]);
      return result;
    } catch (error) {
      if (isNetworkError(error)) {
        const groups = await readOfflineGroups();
        const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const group = { id: localId, name: cleanName, farmer_bps: bps, count: bps.length, created_at: new Date().toISOString(), local: true };
        await writeOfflineGroups([...groups, group]);
        await queueGroupAction({ type: "create", localId, name: cleanName, farmer_bps: bps });
        return { ok: true, group, offlineQueued: true };
      }
      throw error;
    }
  },

  deleteFarmerGroup: async (id) => {
    const groups = await readOfflineGroups();
    const target = groups.find((g) => String(g.id) === String(id));
    if (!target) throw new Error("Group not found.");

    await writeOfflineGroups(groups.filter((g) => String(g.id) !== String(id)));

    if (!navigator.onLine || String(id).startsWith("local-")) {
      const queue = (await offlineGet(userScopedKey(OFFLINE_GROUP_QUEUE_KEY))) || [];
      const remaining = String(id).startsWith("local-")
        ? queue.filter((item) => !(item.type === "create" && String(item.localId) === String(id)))
        : [...queue, { type: "delete", id, queuedAt: new Date().toISOString() }];
      await offlinePut(userScopedKey(OFFLINE_GROUP_QUEUE_KEY), remaining);
      notifyOfflineChange();
      return { ok: true, offlineQueued: true };
    }

    try {
      const result = await request(`/api/farmer-groups/${encodeURIComponent(id)}`, { method: "DELETE" });
      return result;
    } catch (error) {
      if (isNetworkError(error)) {
        const queue = (await offlineGet(userScopedKey(OFFLINE_GROUP_QUEUE_KEY))) || [];
        await offlinePut(userScopedKey(OFFLINE_GROUP_QUEUE_KEY), [...queue, { type: "delete", id, queuedAt: new Date().toISOString() }]);
        return { ok: true, offlineQueued: true };
      }
      throw error;
    }
  },

  /* ----------------------------------------------------
     Dashboard
  ---------------------------------------------------- */

  dashboard: (params = {}) =>
    request(
      `/api/dashboard?${query(params)}`
    ),

  dashboardFresh: async () =>
    request(`/api/dashboard?_sync=${Date.now()}`, { skipCache: true, cache: "no-store" }),

  /* ----------------------------------------------------
     Farmers
  ---------------------------------------------------- */

  farmersFresh: async (params = {}) => {
    const freshParams = { ...params, _sync: Date.now() };
    const result = await request(`/api/farmers?${query(freshParams)}`, { skipCache: true, cache: "no-store" });
    return applyPendingCompletionQueue(result);
  },

  farmers: async (params = {}) => {
    if (!navigator.onLine) {
      const cached = applyOfflineFarmerFilters(await readOfflineMaster(), params, await readOfflineGroups());
      return applyPendingCompletionQueue(cached);
    }
    try {
      const result = await request(`/api/farmers?${query(params)}`);
      return applyPendingCompletionQueue(result);
    } catch (error) {
      if (isNetworkError(error)) {
        const cached = applyOfflineFarmerFilters(await readOfflineMaster(), params, await readOfflineGroups());
        return applyPendingCompletionQueue(cached);
      }
      throw error;
    }
  },

  /* ----------------------------------------------------
     Cross-device completion sync
  ---------------------------------------------------- */

  completionChanges: (sinceId = 0, sinceTime = "") =>
    request(
      `/api/completion-changes?since_id=${encodeURIComponent(Number(sinceId) || 0)}&limit=500${sinceTime ? `&since_time=${encodeURIComponent(sinceTime)}` : ""}`,
      { skipCache: true, cache: "no-store" }
    ),

  hasPendingCompletion: async (bp) => {
    const queue = (await offlineGet(userScopedKey(OFFLINE_QUEUE_KEY))) || [];
    return queue.some((item) => String(item.bp) === String(bp));
  },

  setCompleted: async (bp, completed, remarks = "") => {
    // Always persist the user's action first. This makes Complete/Reopen
    // durable even if the page is refreshed while the network write is pending.
    const queued = await queueCompletion(bp, completed, remarks);
    updateOfflineCompletion(bp, completed, remarks).catch(() => {});

    if (!navigator.onLine) return queued;

    // Do not make the field UI wait for the network/database round trip.
    // The durable queue remains until this exact action is confirmed by the server.
    void (async () => {
      try {
        await request(
          `/api/farmers/${encodeURIComponent(bp)}/completion`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed, remarks }),
          }
        );
        await updateOfflineCompletion(bp, completed, remarks);
        await removeQueuedCompletion(queued.queueId, bp, queued.queuedAt);
        // The server has now committed the mutation. Notify the dashboard
        // immediately instead of waiting for the next 3-second poll. This is
        // a confirmation event only; the existing queue/optimistic workflow
        // remains unchanged.
        window.dispatchEvent(new CustomEvent("polygon-completion-confirmed", {
          detail: {
            bp: String(bp),
            completed: Boolean(completed),
            action: completed ? "completed" : "reopened",
          },
        }));
      } catch (error) {
        // Network/auth interruption: keep the durable action for the normal
        // sync loop. A later retry will reconcile it with the server.
        // A non-network HTTP rejection is a real server rejection, so do not
        // keep retrying it forever.
        if (!isNetworkError(error)) {
          await removeQueuedCompletion(queued.queueId, bp, queued.queuedAt).catch(() => {});
          window.dispatchEvent(new CustomEvent("polygon-completion-error", {
            detail: { bp: String(bp), message: error?.message || "Could not update visit status" },
          }));
        }
      }
    })();

    return { ...queued, pendingSync: true };
  },

  /* ----------------------------------------------------
     Open Map
  ---------------------------------------------------- */

  openMap: async (params = {}) => {
    const qs = query(params);
    const path = qs ? `/api/open-map?${qs}` : "/api/open-map";
    if (!navigator.onLine) {
      const cached = applyOfflineOpenMapFilters(await readCachedApi("/api/open-map"), params, await readOfflineGroups());
      return applyPendingCompletionQueue(cached);
    }
    try {
      const result = await request(path);
      return applyPendingCompletionQueue(result);
    } catch (error) {
      if (isNetworkError(error)) {
        const cached = applyOfflineOpenMapFilters(await readCachedApi("/api/open-map"), params, await readOfflineGroups());
        return applyPendingCompletionQueue(cached);
      }
      throw error;
    }
  },

  /* ----------------------------------------------------
     Cluster Map
  ---------------------------------------------------- */

  clusterMap: (params = {}) =>
    request(
      `/api/cluster-map?${query(params)}`
    ),

  /* ----------------------------------------------------
     Team Location
  ---------------------------------------------------- */

  teamLocations: () =>
    request(
      "/api/team-locations"
    ),

  updateTeamLocation: async (location) => {
    if (!navigator.onLine) return { ok: true, offline: true };
    return request(
      "/api/team-location",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy ?? null,
        }),
      }
    );
  },

  /* ----------------------------------------------------
     Admin / Master Data
  ---------------------------------------------------- */

  importCsv: (file) => {
    const fd =
      new FormData();

    fd.append(
      "file",
      file
    );

    return request(
      "/api/import",
      {
        method: "POST",
        body: fd,
      }
    );
  },

  importClusterHtml: (file) => {
    const fd =
      new FormData();

    fd.append(
      "file",
      file
    );

    return request(
      "/api/import-cluster-html",
      {
        method: "POST",
        body: fd,
      }
    );
  },

  clearClusterHtml: () =>
    request(
      "/api/cluster-points",
      {
        method: "DELETE",
      }
    ),

  /* ----------------------------------------------------
     Offline field-data cache
  ---------------------------------------------------- */

  primeOfflineData: async () => {
    if (!navigator.onLine) return { offline: true };
    try {
      const [farmers, openMap, groups] = await Promise.all([
        request(`/api/farmers?${query({ page: 1, page_size: 2500 })}`),
        request("/api/open-map"),
        request("/api/farmer-groups"),
      ]);
      await writeOfflineMaster(farmers);
      await cacheApi(`/api/open-map`, openMap);
      await writeOfflineGroups(groups.groups || []);
      return { ok: true };
    } catch (error) {
      console.warn("Offline data preparation skipped:", error?.message || error);
      return { ok: false };
    }
  },

  offlineFarmers: async (params = {}) => {
    const master = await readOfflineMaster();
    if (!master) return null;
    return applyOfflineFarmerFilters(master, params, await readOfflineGroups());
  },

  /* ----------------------------------------------------
     Health
  ---------------------------------------------------- */

  health: () =>
    request(
      "/api/health"
    ),

  /* ----------------------------------------------------
     Export
  ---------------------------------------------------- */

  exportUrl: (params = {}) =>
    `${API}/api/farmers/export.csv?${query(
      params
    )}`,

  /* ----------------------------------------------------
     Admin report download
  ---------------------------------------------------- */

  downloadReport: async (params = {}) => {
    let token = cachedAccessToken;
    if (!token && supabase) {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token || "";
      cachedAccessToken = token;
    }
    const response = await fetch(`${API}/api/farmers/export.csv?${query(params)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      let message = `Report download failed: ${response.status}`;
      try { const body = await response.json(); message = body.error || message; } catch {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "polygon-madikeri-farmer-report.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /* ----------------------------------------------------
     Authentication
  ---------------------------------------------------- */

  authMe: (token) =>
    request(
      "/api/auth/me",
      {},
      token,
      false
    ),

  authLogin: () =>
    request(
      "/api/auth/login",
      {
        method: "POST",
      }
    ),

  authLogout: () =>
    request(
      "/api/auth/logout",
      {
        method: "POST",
      }
    ),

  /* ----------------------------------------------------
     Admin
  ---------------------------------------------------- */

  adminOverview: () =>
    request(
      "/api/admin/overview"
    ),

  adminUsers: () =>
    request(
      "/api/admin/users"
    ),

  adminCreateUser: (
    payload
  ) =>
    request(
      "/api/admin/users",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          payload
        ),
      }
    ),

  adminUpdateUser: (
    id,
    payload
  ) =>
    request(
      `/api/admin/users/${id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          payload
        ),
      }
    ),

  adminAudit: (
    params = {}
  ) =>
    request(
      `/api/admin/audit?${query(
        params
      )}`
    ),
};
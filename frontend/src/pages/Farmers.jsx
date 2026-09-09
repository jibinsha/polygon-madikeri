import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Edit3, MapPin, Phone, RefreshCw, RotateCcw, Search, CalendarDays, Users, Plus, Trash2, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { PageHead, Loading, ErrorCard, Empty, pct } from "../components";

const blank = {
  q: "",
  trader: "",
  team: "",
  day: "",
  status: "",
  completion_date: "",
  completion_from: "",
  completion_to: "",
  group_id: "",
};

const mapsUrl = (lat, lon) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;

function formatCompletion(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Farmers() {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(() =>
    Object.fromEntries(Object.keys(blank).map((k) => [k, params.get(k) || ""]))
  );
  const [data, setData] = useState({ farmers: [], options: {}, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [busyBp, setBusyBp] = useState("");
  const [page, setPage] = useState(1);
  const requestSeq = useRef(0);
  const responseCache = useRef(new Map());
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupError, setGroupError] = useState("");
  const [selectedBps, setSelectedBps] = useState(() => new Set());
  const [groupName, setGroupName] = useState("");
  const [groupModal, setGroupModal] = useState(false);
  const [groupBusy, setGroupBusy] = useState(false);

  const set = (key, value) => setFilters((x) => ({ ...x, [key]: value }));

  const loadGroups = async () => {
    try {
      setGroupsLoading(true);
      setGroupError("");
      const result = await api.farmerGroups();
      setGroups(result.groups || []);
    } catch (e) {
      setGroupError(e.message || "Unable to load groups");
    } finally {
      setGroupsLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const toggleSelected = (bp) => {
    setSelectedBps((current) => {
      const next = new Set(current);
      if (next.has(bp)) next.delete(bp);
      else next.add(bp);
      return next;
    });
  };

  const createGroup = async () => {
    const name = groupName.trim();
    if (!name) return setGroupError("Enter a group name.");
    if (!selectedBps.size) return setGroupError("Select at least one farmer.");
    setGroupBusy(true);
    setGroupError("");
    try {
      const result = await api.createFarmerGroup(name, [...selectedBps]);
      setGroups((current) => [...current.filter((g) => String(g.id) !== String(result.group.id)), result.group]);
      setGroupName("");
      setSelectedBps(new Set());
      setGroupModal(false);
    } catch (e) {
      setGroupError(e.message || "Unable to create group");
    } finally {
      setGroupBusy(false);
    }
  };

  const deleteGroup = async (group) => {
    if (!window.confirm(`Delete group "${group.name}"? Farmers will not be deleted.`)) return;
    setGroupError("");
    try {
      await api.deleteFarmerGroup(group.id);
      setGroups((current) => current.filter((g) => String(g.id) !== String(group.id)));
      if (String(filters.group_id) === String(group.id)) set("group_id", "");
    } catch (e) {
      setGroupError(e.message || "Unable to delete group");
    }
  };

  const load = async (pageOverride = page, { silent = false } = {}) => {
    const currentSeq = ++requestSeq.current;
    const params = { ...filters, page: pageOverride, page_size: 40 };
    const cacheKey = JSON.stringify(params);
    const cached = responseCache.current.get(cacheKey);

    if (cached) {
      setData(cached);
      setError("");
      setLoading(false);
      // Cached filter results are shown immediately. Refresh in the
      // background only when they are older than two minutes.
      if (Date.now() - cached.__cachedAt < 120000) return;
    }

    if (!silent && !cached) setLoading(true);
    setError("");

    try {
      const result = await api.farmers(params);
      if (currentSeq !== requestSeq.current) return;
      responseCache.current.set(cacheKey, { ...result, __cachedAt: Date.now() });

      // Keep the old list visible while the new filter result arrives.
      setData(result);
    } catch (e) {
      if (currentSeq === requestSeq.current && e?.name !== "AbortError") {
        setError(e.message || "Unable to load farmers");
      }
    } finally {
      if (currentSeq === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    const timer = setTimeout(() => load(1), 220);
    return () => clearTimeout(timer);
  }, [filters.q, filters.team, filters.day, filters.status, filters.completion_date, filters.completion_from, filters.completion_to, filters.trader, filters.group_id]);

  useEffect(() => {
    if (page > 1) load(page);
  }, [page]);

  useEffect(() => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => v && (p[k] = v));
    setParams(p, { replace: true });
  }, [filters, setParams]);

  const shown = useMemo(() => data.farmers || [], [data.farmers]);
  const pages = Math.max(1, data.totalPages || Math.ceil((data.total || 0) / 40));

  const counts = data.statusCounts || {
    all: data.farmers.length,
    completed: data.farmers.filter((f) => f.status === "Completed").length,
    pending: data.farmers.filter((f) => f.status === "Pending").length,
  };

  const toggle = async (farmer) => {
    const completing = farmer.status !== "Completed";
    const previousData = data;
    const nextStatus = completing ? "Completed" : "Pending";
    const nextCompletionDate = completing ? new Date().toISOString() : null;

    setBusyBp(farmer.bp);
    setError("");

    // Update the visible card immediately. The server remains the source of
    // truth; a background refresh below reconciles the list and counts.
    setData((current) => {
      const nextFarmers = (current.farmers || [])
        .map((f) =>
          f.bp === farmer.bp
            ? {
                ...f,
                status: nextStatus,
                completion_date: nextCompletionDate,
              }
            : f
        )
        .filter((f) => {
          if (filters.status === "Pending" && completing && f.bp === farmer.bp) return false;
          if (filters.status === "Completed" && !completing && f.bp === farmer.bp) return false;
          return true;
        });

      const statusCounts = current.statusCounts
        ? {
            ...current.statusCounts,
            all: current.statusCounts.all + (nextFarmers.length === (current.farmers || []).length ? 0 : -1),
            completed: Math.max(
              0,
              current.statusCounts.completed + (completing ? 1 : -1)
            ),
            pending: Math.max(
              0,
              current.statusCounts.pending + (completing ? -1 : 1)
            ),
          }
        : current.statusCounts;

      return {
        ...current,
        farmers: nextFarmers,
        total: current.total + (nextFarmers.length === (current.farmers || []).length ? 0 : -1),
        statusCounts,
      };
    });

    // The card has already been updated optimistically above. Do not keep
    // the button disabled while the network/database request is running.
    // This is especially important in low-network field conditions.
    setBusyBp("");

    // Persist in the background. The user does not need to wait for Supabase
    // (or IndexedDB when offline) before continuing to the next farmer.
    api.setCompleted(farmer.bp, completing, completing ? farmer.remarks || "" : "")
      .then(() => {
        responseCache.current.clear();
        // Reconcile silently after the server confirms the change.
        load(page, { silent: true });
      })
      .catch((e) => {
        // Restore only if this farmer has not been changed again since this
        // request started. This prevents an older failed request from
        // overwriting a newer Complete/Reopen action.
        setData((current) => {
          const currentFarmer = (current.farmers || []).find((f) => f.bp === farmer.bp);
          const stillSameAction = currentFarmer && currentFarmer.status === nextStatus;
          return stillSameAction ? previousData : current;
        });
        setError(e.message || "Could not update visit status");
      });
  };

  const saveRemarks = async () => {
    if (!editing) return;
    const previousData = data;
    setBusyBp(editing.bp);
    setError("");

    // Save the edited remark in the visible card immediately.
    setData((current) => ({
      ...current,
      farmers: (current.farmers || []).map((f) =>
        f.bp === editing.bp ? { ...f, remarks } : f
      ),
    }));

    try {
      await api.setCompleted(editing.bp, editing.status === "Completed", remarks);
      setEditing(null);
      responseCache.current.clear();
      load(page, { silent: true });
    } catch (e) {
      setData(previousData);
      setError(e.message || "Could not save remarks");
    } finally {
      setBusyBp("");
    }
  };

  const clearFilters = () => setFilters({ ...blank });

  return (
    <div className="page farmers-page">
      <PageHead
        eyebrow="FIELD DATABASE"
        title="Farmers"
        description={`${data.total || 0} farmers match the current filters.`}
        actions={<button className="icon-btn" onClick={() => { responseCache.current.clear(); load(page, { silent: true }); }} title="Refresh"><RefreshCw size={16} /></button>}
      />

      <div className="farmer-groups-card card">
        <div className="farmer-groups-head">
          <div>
            <div className="eyebrow">PRIVATE GROUPS</div>
            <h2><Users size={16} /> My farmer groups</h2>
            <p>Only you can see and manage these groups.</p>
          </div>
          <button className="primary-btn" type="button" onClick={() => { setGroupError(""); setGroupModal(true); }}>
            <Plus size={15} /> Create group
          </button>
        </div>

        {groupError && <div className="group-error">{groupError}</div>}

        <div className="farmer-group-list">
          <button
            type="button"
            className={`farmer-group-chip ${!filters.group_id ? "active" : ""}`}
            onClick={() => set("group_id", "")}
          >
            All farmers
          </button>
          {groupsLoading && <span className="group-muted">Loading groups…</span>}
          {!groupsLoading && !groups.length && <span className="group-muted">No groups yet.</span>}
          {groups.map((g) => (
            <div className={`farmer-group-chip-wrap ${String(filters.group_id) === String(g.id) ? "active" : ""}`} key={g.id}>
              <button type="button" className="farmer-group-chip" onClick={() => set("group_id", g.id)}>
                {g.name} <b>{g.count || g.farmer_bps?.length || 0}</b>
              </button>
              <button type="button" className="farmer-group-delete" title={`Delete ${g.name}`} onClick={() => deleteGroup(g)}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="farmer-filter-card card">
        <div className="farmer-filter-row">
          <div className="farmer-search">
            <Search size={17} />
            <input
              value={filters.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Search farmer name or BP number"
            />
          </div>
          <select value={filters.team} onChange={(e) => set("team", e.target.value)} aria-label="Team">
            <option value="">All Teams</option>
            {(data.options?.teams || []).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={filters.day} onChange={(e) => set("day", e.target.value)} aria-label="Day">
            <option value="">All Days</option>
            {(data.options?.days || []).map((x) => <option key={x} value={x}>Day {x}</option>)}
          </select>
          <select value={filters.group_id} onChange={(e) => set("group_id", e.target.value)} aria-label="Farmer Group">
            <option value="">All Groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.count || g.farmer_bps?.length || 0})</option>)}
          </select>
          <button className="clear-filter" onClick={clearFilters}>Clear</button>
        </div>

        <div className="status-filter-row">
          <button className={filters.status === "" ? "status-filter active" : "status-filter"} onClick={() => set("status", "")}>
            <span>All</span><b>{counts.all}</b>
          </button>
          <button className={filters.status === "Completed" ? "status-filter done active" : "status-filter done"} onClick={() => set("status", "Completed")}>
            <span>Completed</span><b>{counts.completed}</b>
          </button>
          <button className={filters.status === "Pending" ? "status-filter pending active" : "status-filter pending"} onClick={() => set("status", "Pending")}>
            <span>Pending</span><b>{counts.pending}</b>
          </button>
        </div>

        <div className="completion-filter">
          <div className="completion-filter-title"><CalendarDays size={15} /><b>Completion date</b><span>Filter by the date the visit was actually completed.</span></div>
          <div className="completion-filter-actions">
            <button className={!filters.completion_date && !filters.completion_from ? "date-chip active" : "date-chip"} onClick={() => setFilters((x) => ({ ...x, completion_date: "", completion_from: "", completion_to: "" }))}>All dates</button>
            <button className={filters.completion_date === new Date().toISOString().slice(0,10) ? "date-chip active" : "date-chip"} onClick={() => setFilters((x) => ({ ...x, completion_date: new Date().toISOString().slice(0,10), completion_from: "", completion_to: "" }))}>Today</button>
            <label>From <input type="date" value={filters.completion_from} onChange={(e) => setFilters((x) => ({ ...x, completion_from: e.target.value, completion_date: "" }))} /></label>
            <label>To <input type="date" value={filters.completion_to} onChange={(e) => setFilters((x) => ({ ...x, completion_to: e.target.value, completion_date: "" }))} /></label>
          </div>
        </div>
      </div>

      {error && <ErrorCard message={error} onRetry={load} />}

      <div className="farmer-list-head">
        <b>{data.total || 0} farmers</b>
        <span>{loading ? "Updating…" : `Page ${page} of ${pages}`}</span>
      </div>

      {selectedBps.size > 0 && (
        <div className="farmer-selection-bar">
          <span><b>{selectedBps.size}</b> farmers selected</span>
          <button type="button" className="primary-btn" onClick={() => { setGroupError(""); setGroupModal(true); }}>
            <Users size={14} /> Save as group
          </button>
          <button type="button" className="secondary-btn" onClick={() => setSelectedBps(new Set())}>Clear selection</button>
        </div>
      )}

      <div className="farmer-cards">
        {shown.map((f) => {
          const completed = f.status === "Completed";
          const hasGps = Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lon));
          const busy = busyBp === f.bp;
          return (
            <article key={f.bp} className={`farmer-card ${completed ? "farmer-completed" : "farmer-pending"}`}>
              <div className="farmer-card-top">
                <div className="farmer-card-select">
                  <input
                    type="checkbox"
                    checked={selectedBps.has(f.bp)}
                    onChange={() => toggleSelected(f.bp)}
                    aria-label={`Select ${f.bp}`}
                  />
                  <div>
                    <div className="farmer-name-title">{f.name || "Farmer"}</div>
                  <div className="farmer-bp">BP: {f.bp || "—"}</div>
                  </div>
                </div>
                <span className={`farmer-status ${completed ? "completed" : "pending"}`}>
                  {completed ? <><CheckCircle2 size={14} /> Completed</> : "Pending"}
                </span>
              </div>

              <div className="farmer-details-grid">
                <div><span>Farmer Name</span><b>{f.name || "—"}</b></div>
                <div><span>Name in BPM</span><b>{f.name_in_bpm || "—"}</b></div>
                <div><span>Farm Name</span><b>{f.farm_name || "—"}</b></div>
                <div><span>Area under rejuvenation</span><b>{f.area_under_rejuvenation || "—"}</b></div>
              </div>

              <div className="farmer-actions">
                {f.phone ? (
                  <a className="farmer-action phone" href={`tel:${f.phone}`}><Phone size={16} /> {f.phone}</a>
                ) : <span className="farmer-action disabled">No phone</span>}
                {hasGps ? (
                  <a className="farmer-action maps" href={mapsUrl(f.lat, f.lon)} target="_blank" rel="noreferrer"><MapPin size={16} /> Open Google Maps</a>
                ) : <span className="farmer-action disabled">No location</span>}
                <button className={`complete-btn ${completed ? "reopen" : ""}`} disabled={busy} onClick={() => toggle(f)}>
                  {completed ? <><RotateCcw size={16} /> Reopen</> : <><CheckCircle2 size={16} /> Complete</>}
                </button>
                <button className="remarks-btn" onClick={() => { setEditing(f); setRemarks(f.remarks || ""); }} title="Edit remarks"><Edit3 size={16} /></button>
              </div>

              {completed && f.completion_date && (
                <div className="completion-stamp">
                  <CheckCircle2 size={14} />
                  <span>
                    Completed by{" "}
                    <b>{f.completion_by_name || f.completion_by_email || "User"}</b>
                    {" · "}
                    {formatCompletion(f.completion_date)}
                  </span>
                </div>
              )}
              {f.remarks && (
                <div className="farmer-remarks">
                  <b>Remarks:</b> {f.remarks}
                </div>
              )}
            </article>
          );
        })}
        {loading && <Loading />}
        {!loading && !shown.length && <Empty text="No farmers match these filters." />}
      </div>

      {pages > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span>{page} / {pages}</span><button disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Next</button></div>}

      {groupModal && (
        <div className="modal-backdrop">
          <div className="modal-card farmer-group-modal">
            <button className="group-modal-close" type="button" onClick={() => setGroupModal(false)}><X size={18} /></button>
            <div className="eyebrow">PRIVATE FARMER GROUP</div>
            <h2>Save selected farmers</h2>
            <p><b>{selectedBps.size}</b> farmer BP numbers will be saved to your private group.</p>
            <input
              className="group-name-input"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              maxLength={100}
              autoFocus
            />
            <div className="modal-actions">
              <button className="secondary-btn" type="button" onClick={() => setGroupModal(false)}>Cancel</button>
              <button className="primary-btn" type="button" disabled={groupBusy} onClick={createGroup}>
                {groupBusy ? "Saving…" : "Save group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="eyebrow">VISIT NOTES</div>
            <h2>{editing.name || editing.bp}</h2>
            <p>{editing.bp} · {editing.status}</p>
            <textarea rows="5" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Enter remarks…" />
            <div className="modal-actions"><button className="secondary-btn" onClick={() => setEditing(null)}>Cancel</button><button className="primary-btn" disabled={busyBp === editing.bp} onClick={saveRemarks}>Save remarks</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

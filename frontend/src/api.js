import { supabase } from "./supabase";

const API =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8787";

/* ======================================================
   Common API request
====================================================== */

async function request(path, options = {}, tokenOverride) {
  const headers = new Headers(
    options.headers || {}
  );

  let token = tokenOverride;

  if (!token && supabase) {
    const { data } =
      await supabase.auth.getSession();

    token =
      data.session?.access_token;
  }

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  const response = await fetch(
    `${API}${path}`,
    {
      ...options,
      headers,
    }
  );

  const text =
    await response.text();

  let data = {};

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    data = {
      error: text,
    };
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      `Request failed: ${response.status}`
    );
  }

  return data;
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
     Dashboard
  ---------------------------------------------------- */

  dashboard: (params = {}) =>
    request(
      `/api/dashboard?${query(params)}`
    ),

  /* ----------------------------------------------------
     Farmers
  ---------------------------------------------------- */

  farmers: (params = {}) =>
    request(
      `/api/farmers?${query(params)}`
    ),

  setCompleted: (
    bp,
    completed,
    remarks = ""
  ) =>
    request(
      `/api/farmers/${encodeURIComponent(
        bp
      )}/completion`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          completed,
          remarks,
        }),
      }
    ),

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

  updateTeamLocation: (
    location
  ) =>
    request(
      "/api/team-location",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          latitude:
            location.latitude,
          longitude:
            location.longitude,
          accuracy:
            location.accuracy ??
            null,
        }),
      }
    ),

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
    let token = "";
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token || "";
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
      token
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
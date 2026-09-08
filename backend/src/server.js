import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const app = express();

const port = Number(process.env.PORT || 8787);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

const hasDb = Boolean(
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabase = hasDb
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  : null;

app.use(
  cors({
    origin:
      process.env.FRONTEND_ORIGIN
        ?.split(",")
        .map((x) => x.trim()) || true,
  })
);

app.use(
  express.json({
    limit: "4mb",
  })
);

/* =======================================================
   CONSTANTS
======================================================= */

const COLORS = [
  "#2f7d5b",
  "#7656a8",
  "#d16b42",
  "#3976a8",
  "#9b6b24",
  "#3d8b79",
  "#a94b68",
  "#59666f",
  "#6d7fb2",
  "#8c5d48",
  "#0391b3",
  "#ca5ffe",
  "#d4071c",
  "#4db68c",
  "#57d0c6",
  "#8bc835",
];

const OFFICE = {
  lat: 13.137,
  lon: 75.606,
  name: "Office/Base",
};

/*
  Supabase/PostgREST commonly limits a single response
  to 1000 rows.

  We therefore ALWAYS fetch in pages.
*/
const DB_PAGE_SIZE = 1000;

// Short-lived in-memory caches keep the existing workflow/UI intact while
// avoiding repeated Supabase reads for every filter/search request.
const DATA_CACHE_TTL_MS = 60000;
let farmersCache = { at: 0, data: null };
let openMapFarmersCache = { at: 0, data: null };
let clusterPointsCache = { at: 0, data: null };
let masterFieldsCache = null;
const authCache = new Map();
const AUTH_CACHE_TTL_MS = 60000;
const PROFILE_LIST_CACHE_TTL_MS = 60000;
const TEAM_LOCATION_CACHE_TTL_MS = 5000;
const OPEN_MAP_FARMER_TTL_MS = 15000;
let profileListCache = { at: 0, data: null };
let teamLocationCache = { at: 0, data: null };

function invalidateDataCache() {
  farmersCache = { at: 0, data: null };
  openMapFarmersCache = { at: 0, data: null };
  clusterPointsCache = { at: 0, data: null };
}


/* =======================================================
   DEMO DATA
======================================================= */

const demoFarmers = [
  [
    "IN4C5-BP1000-VC1000",
    "Ravi Kumar",
    "9876543210",
    "Madikeri",
    "Estate A",
    "C01",
    "Team 1",
    "1",
    "Route A",
    "2026-09-07",
    12.4245,
    75.738,
  ],
  [
    "IN4C5-BP1001-VC1001",
    "Suresh P",
    "9876543211",
    "Madikeri",
    "Estate A",
    "C01",
    "Team 1",
    "1",
    "Route A",
    "2026-09-07",
    12.428,
    75.742,
  ],
  [
    "IN4C5-BP1002-VC1002",
    "Manoj K",
    "9876543212",
    "Madikeri",
    "Estate B",
    "C01",
    "Team 1",
    "1",
    "Route A",
    "2026-09-07",
    12.4215,
    75.744,
  ],
  [
    "IN4C5-BP1003-VC1003",
    "Kiran B",
    "9876543213",
    "Madikeri",
    "Estate B",
    "C01",
    "Team 2",
    "2",
    "Route B",
    "2026-09-08",
    12.416,
    75.736,
  ],
  [
    "IN4C5-BP1004-VC1004",
    "Ramesh M",
    "9876543214",
    "Madikeri",
    "Estate C",
    "C02",
    "Team 2",
    "2",
    "Route B",
    "2026-09-08",
    12.447,
    75.766,
  ],
  [
    "IN4C5-BP1005-VC1005",
    "Ajith N",
    "9876543215",
    "Madikeri",
    "Estate C",
    "C02",
    "Team 2",
    "2",
    "Route B",
    "2026-09-08",
    12.451,
    75.771,
  ],
  [
    "IN4C5-BP1006-ABC1006",
    "Anil S",
    "9876543216",
    "Madikeri",
    "Estate D",
    "C02",
    "Team 3",
    "3",
    "Route C",
    "2026-09-09",
    12.443,
    75.776,
  ],
  [
    "IN4C5-BP1007-ABC1007",
    "Prakash R",
    "9876543217",
    "Madikeri",
    "Estate D",
    "C03",
    "Team 3",
    "3",
    "Route C",
    "2026-09-09",
    12.389,
    75.7,
  ],
  [
    "IN4C5-BP1008-ABC1008",
    "Dinesh G",
    "9876543218",
    "Madikeri",
    "Estate E",
    "C03",
    "Team 3",
    "3",
    "Route C",
    "2026-09-09",
    12.394,
    75.707,
  ],
  [
    "IN4C5-BP1009-ABC1009",
    "Naveen C",
    "9876543219",
    "Madikeri",
    "Estate E",
    "C03",
    "Team 4",
    "4",
    "Route D",
    "2026-09-10",
    12.4,
    75.712,
  ],
  [
    "IN4C5-BP1010-VC1010",
    "Sunil V",
    "9876543220",
    "Madikeri",
    "Estate F",
    "C04",
    "Team 4",
    "4",
    "Route D",
    "2026-09-10",
    12.47,
    75.7,
  ],
  [
    "IN4C5-BP1011-VC1011",
    "Harish K",
    "9876543221",
    "Madikeri",
    "Estate F",
    "C04",
    "Team 4",
    "4",
    "Route D",
    "2026-09-10",
    12.476,
    75.706,
  ],
].map((x) => ({
  bp: x[0],
  name: x[1],
  phone: x[2],
  village: x[3],
  estate: x[4],
  cluster: x[5],
  team: x[6],
  day: x[7],
  route_group: x[8],
  visit_date: x[9],
  lat: x[10],
  lon: x[11],
  remarks: "",
}));

const demoDone = new Map([
  ["IN4C5-BP1000-VC1000", "Demo completed"],
  ["IN4C5-BP1002-VC1002", "Demo completed"],
  ["IN4C5-BP1006-ABC1006", "Demo completed"],
  ["IN4C5-BP1010-VC1010", "Demo completed"],
]);

const demoClusterPoints = [
  ["12", "Team 1", "1", 12.741449, 75.761295, "#4db68c"],
  ["12", "Team 1", "1", 12.729926, 75.745699, "#4db68c"],
  ["21", "Team 2", "29", 13.13043, 75.64172, "#f28410"],
  ["77", "Team 2", "6", 13.326186, 75.319776, "#d4071c"],
  ["77", "Team 2", "6", 13.326337, 75.320174, "#d4071c"],
  ["77", "Team 2", "6", 13.3328499, 75.3119227, "#d4071c"],
  ["10", "Team 2", "31", 13.118041, 75.640476, "#816060"],
  ["10", "Team 2", "31", 13.1202, 75.638548, "#816060"],
  ["67", "Team 2", "35", 13.113353, 75.577573, "#281422"],
  ["67", "Team 2", "35", 13.12147, 75.580403, "#281422"],
  ["39", "Team 1", "43", 13.077648, 75.553618, "#ca5ffe"],
  ["53", "Team 1", "27", 13.0182634, 75.7376211, "#d1e96b"],
  ["53", "Team 1", "27", 13.0275381, 75.7303486, "#d1e96b"],
  ["55", "Team 2", "42", 13.0933999, 75.6790226, "#8bc835"],
  ["55", "Team 2", "42", 13.091532, 75.68004, "#8bc835"],
  ["44", "Team 1", "34", 13.0443386, 75.7062252, "#6fdc93"],
  ["44", "Team 1", "34", 13.065061, 75.70048, "#6fdc93"],
  ["72", "Team 1", "7", 12.817387, 75.784564, "#966c58"],
  ["72", "Team 1", "7", 12.815559, 75.785298, "#966c58"],
  ["18", "Team 1", "35", 13.0589507, 75.6089224, "#1fecfa"],
  ["18", "Team 1", "35", 13.0534947, 75.6081039, "#1fecfa"],
  ["30", "Team 1", "19", 12.9914321, 75.7089765, "#5485c5"],
  ["30", "Team 1", "19", 12.963478, 75.689442, "#5485c5"],
  ["15", "Team 1", "18", 12.9719761, 75.8848656, "#0391b3"],
  ["15", "Team 1", "18", 12.977055, 75.852148, "#0391b3"],
  ["5", "Team 1", "26", 13.015703, 75.766609, "#516fb5"],
  ["5", "Team 1", "26", 13.037473, 75.765521, "#516fb5"],
  ["81", "Team 2", "27", 13.142567, 75.654546, "#a3f6ae"],
  ["81", "Team 2", "27", 13.149227, 75.665135, "#a3f6ae"],
  ["23", "Team 2", "18", 13.177912, 75.720573, "#57d0c6"],
  ["23", "Team 2", "18", 13.18334, 75.72799, "#57d0c6"],
  ["8", "Team 2", "26", 13.14142, 75.43457, "#4dbe43"],
  ["8", "Team 2", "26", 13.15073, 75.42603, "#4dbe43"],
  ["19", "Team 2", "19", 13.193296, 75.614339, "#77e38a"],
  ["19", "Team 2", "19", 13.192745, 75.611999, "#77e38a"],
  ["17", "Team 2", "17", 13.194078, 75.472568, "#e37a7d"],
  ["17", "Team 2", "17", 13.194954, 75.472467, "#e37a7d"],
  ["45", "Team 2", "34", 13.11684, 75.662101, "#6c19b8"],
  ["45", "Team 2", "34", 13.116226, 75.659626, "#6c19b8"],
  ["42", "Team 2", "10", 13.245886, 75.541244, "#c485c4"],
  ["42", "Team 2", "10", 13.2477171, 75.5415922, "#c485c4"],
].map((x, i) => ({
  id: `demo-${i}`,
  cluster: x[0],
  team: x[1],
  day: x[2],
  lat: x[3],
  lon: x[4],
  color: x[5],
}));

/* =======================================================
   BASIC HELPERS
======================================================= */

const clean = (v) => {
  if (v === null || v === undefined) return "";
  return String(v).trim();
};

const num = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const date = (v) => {
  const s = clean(v);

  return /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? s
    : null;
};

/* =======================================================
   TRADER FROM BP
======================================================= */

function traderFromBp(bp) {
  const parts = clean(bp)
    .split("-")
    .filter(Boolean);

  if (parts.length >= 3) {
    const token = parts[2];

    const m = token.match(/^([A-Za-z]+)\d+$/);

    return (
      m ? m[1] : token
    ).toUpperCase();
  }

  return "";
}

/* =======================================================
   VALUE FROM MULTIPLE POSSIBLE COLUMN NAMES
======================================================= */

function normalizeKey(value) {
  return clean(value)
    .replace(/^\\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/*
  Read a value from a row using tolerant header matching.

  The CSV parser normalizes headers (for example:
  "Name in BPM" -> "name_in_bpm"), while older imports and
  some spreadsheet exports may use slightly different spellings.
  This helper therefore compares both the original key and its
  normalized form.
*/
function val(row, names) {
  const keys = Object.keys(row || {});

  for (const n of names) {
    const direct = row?.[n];

    if (
      direct !== undefined &&
      direct !== null &&
      clean(direct) !== ""
    ) {
      return direct;
    }

    const wanted = normalizeKey(n);

    const matchedKey = keys.find(
      (key) =>
        key !== "__cells" &&
        key !== "__headers" &&
        normalizeKey(key) === wanted &&
        clean(row[key]) !== ""
    );

    if (matchedKey) {
      return row[matchedKey];
    }
  }

  return "";
}

/*
  Positional fallback for the master sheet supplied for this project.

  In that sheet:
    C = Farmer Name
    D = Name in BPM
    E = Farm Name
    N = Core area - Plot rea (Area under rejuvenation)

  Header matching remains the primary method. These positions are
  only used when the source export has damaged/missing headers.
*/
function cellAt(row, index) {
  const cells = Array.isArray(row?.__cells)
    ? row.__cells
    : [];

  return clean(cells[index]);
}

/* =======================================================
   NORMALIZE FARMER
======================================================= */

function normalize(row, done) {
  const bp = clean(
    val(row, [
      "bp_number",
      "Bp Number",
      "BP Number",
      "bp",
      "BP",
    ])
  );

  const completion = done.get(bp) || null;
  const isDone = Boolean(completion);

  return {
    id: row.id,

    bp,

    name: clean(
      val(row, [
        "farmer_name",
        "Farmer Name",
        "name",
        "Name",
      ])
    ),

    name_in_bpm: clean(
      val(row, [
        "name_in_bpm",
        "Name in BPM",
        "bpm_name",
        "bp_name",
        "bpm",
      ])
    ),

    farm_name: clean(
      val(row, [
        "farm_name",
        "Farm Name",
        "farm",
        "farmname",
      ])
    ),

    area_under_rejuvenation: clean(
      val(row, [
        "area_under_rejuvenation",
        "Core area - Plot rea (Area under rejuvenation)",
        "Core area - Plot rea (Area under rejuvenation",
        "core_area_plot_rea_area_under_rejuvenation",
        "core_area_plot_rea_area_under_rejuvenation_",
        "core_area_plot_rea_(area_under_rejuvenation)",
        "core_area_plot_rea",
        "core_area",
        "area",
      ])
    ),

    phone: clean(
      val(row, [
        "phone",
        "Phone",
        "mobile",
        "Mobile",
        "phone_number",
        "phone number",
      ])
    ),

    village: clean(
      val(row, [
        "village",
        "Village",
        "village_name",
      ])
    ),

    estate: clean(
      val(row, [
        "estate",
        "Estate",
        "estate_name",
      ])
    ),

    employee: clean(
      val(row, [
        "employee",
        "Employee",
        "employee_name",
        "Employee Name",
      ])
    ),

    cluster: clean(
      val(row, [
        "cluster",
        "Cluster",
        "cluster_id",
        "Cluster ID",
      ])
    ),

    team: clean(
      val(row, [
        "team",
        "Team",
        "team_name",
      ])
    ),

    day: clean(
      val(row, [
        "day",
        "Day",
        "day_number",
      ])
    ),

    route_group: clean(
      val(row, [
        "route_group",
        "Route Group",
        "route",
        "route_name",
      ])
    ),

    visit_date: clean(
      val(row, [
        "visit_date",
        "Visit Date",
        "date",
      ])
    ),

    lat: num(
      val(row, [
        "latitude",
        "Latitude",
        "lat",
        "Lat",
      ])
    ),

    lon: num(
      val(row, [
        "longitude",
        "Longitude",
        "lon",
        "Long",
        "lng",
      ])
    ),

    remarks:
      completion?.remarks ||
      clean(
        val(row, [
          "remarks",
          "Remarks",
          "remark",
        ])
      ),

    completion_date: completion?.completed_at || null,

    completion_by_name:
      clean(completion?.completed_by_name) ||
      clean(completion?.completed_by_email) ||
      "",

    completion_by_email:
      clean(completion?.completed_by_email) ||
      "",

    trader: traderFromBp(bp),

    status: isDone
      ? "Completed"
      : "Pending",
  };
}

/* =======================================================
   IMPORTANT:
   FETCH ALL SUPABASE ROWS IN BATCHES
======================================================= */

async function fetchAllRows(
  table,
  select = "*",
  orderColumn = "id"
) {
  if (!hasDb) {
    return [];
  }

  const all = [];
  let from = 0;

  while (true) {
    const to = from + DB_PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderColumn, {
        ascending: true,
      })
      .range(from, to);

    if (error) {
      throw new Error(
        `Failed to fetch ${table}: ${error.message}`
      );
    }

    const batch = data || [];

    all.push(...batch);

    /*
      If fewer than 1000 rows came back,
      we have reached the end.
    */
    if (batch.length < DB_PAGE_SIZE) {
      break;
    }

    from += DB_PAGE_SIZE;
  }

  return all;
}

/* =======================================================
   ALL FARMERS
======================================================= */


/* =======================================================
   MASTER-SHEET FALLBACK FOR DISPLAY

   Keep the existing UI/database behavior unchanged. If the
   three source fields are missing in an older Supabase row,
   read the bundled master CSV by BP number and supply only
   those missing values to the API response.
======================================================= */

function bundledMasterFields() {
  if (masterFieldsCache) return masterFieldsCache;
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(here, "../../frontend/public/Final_Field_Plan.csv"),
      path.resolve(process.cwd(), "../frontend/public/Final_Field_Plan.csv"),
    ];

    const file = candidates.find((p) => fs.existsSync(p));
    if (!file) return new Map();

    const rows = parseCsv(fs.readFileSync(file, "utf8"));
    const byBp = new Map();

    rows.forEach((row) => {
      const bp = clean(val(row, [
        "bp_number",
        "Bp Number",
        "BP Number",
        "bp",
      ]));
      if (!bp) return;

      byBp.set(bp, {
        name_in_bpm: clean(val(row, [
          "name_in_bpm",
          "Name in BPM",
          "bpm_name",
          "bp_name",
          "bpm",
        ]) || cellAt(row, 3)),
        farm_name: clean(val(row, [
          "farm_name",
          "Farm Name",
          "farm",
          "farmname",
        ]) || cellAt(row, 4)),
        area_under_rejuvenation: clean(val(row, [
          "core_area_plot_rea_area_under_rejuvenation",
          "core_area_plot_rea_area_under_rejuvenation_",
          "core_area_plot_rea_(area_under_rejuvenation)",
          "core_area_plot_rea",
          "area_under_rejuvenation",
          "area",
        ]) || cellAt(row, 13)),
      });
    });

    masterFieldsCache = byBp;
    return byBp;
  } catch (error) {
    console.warn("Master-sheet display fallback unavailable:", error.message);
    return new Map();
  }
}

async function allProfiles() {
  const now = Date.now();
  if (profileListCache.data && now - profileListCache.at < PROFILE_LIST_CACHE_TTL_MS) {
    return profileListCache.data;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,email,full_name,team,role,is_active,last_login_at,last_seen_at");

  if (error) throw new Error(`Failed to fetch profiles: ${error.message}`);

  profileListCache = { at: now, data: data || [] };
  return profileListCache.data;
}

async function allFarmersFromDb() {
  /* -------------------------------
     DEMO MODE
  ------------------------------- */

  if (!hasDb) {
    return demoFarmers.map((r) => ({
      ...r,
      trader: traderFromBp(r.bp),
      status: demoDone.has(r.bp)
        ? "Completed"
        : "Pending",
      remarks:
        demoDone.get(r.bp) ||
        r.remarks ||
        "",
    }));
  }

  /* -------------------------------
     FETCH ALL FARMERS
     NOT JUST FIRST 1000
  ------------------------------- */

  // These datasets are independent, so fetch them concurrently.
  const [data, done] = await Promise.all([
    fetchAllRows("farmers", "*", "id"),
    fetchAllRows(
      "completed_farmers",
      "bp_number,remarks,completed_at,completed_by,completed_by_email",
      "bp_number"
    ),
  ]);

  /*
    Resolve the enumerator/admin name from profiles.
    We intentionally do this at read time so existing completed
    records (created before this feature) also show the user's name.
  */
  let profiles = [];

  if (done.length) {
    profiles = await allProfiles();
  }

  const profileById = new Map(
    profiles.map((p) => [
      String(p.user_id),
      {
        name: clean(p.full_name),
        email: clean(p.email).toLowerCase(),
      },
    ])
  );

  const profileByEmail = new Map(
    profiles.map((p) => [
      clean(p.email).toLowerCase(),
      {
        name: clean(p.full_name),
        email: clean(p.email).toLowerCase(),
      },
    ])
  );

  const map = new Map(
    done.map((x) => {
      const byId =
        x.completed_by
          ? profileById.get(String(x.completed_by))
          : null;

      const byEmail =
        x.completed_by_email
          ? profileByEmail.get(
              clean(x.completed_by_email).toLowerCase()
            )
          : null;

      const person = byId || byEmail;

      return [
        clean(x.bp_number),
        {
          remarks: clean(x.remarks),
          completed_at:
            x.completed_at || null,
          completed_by_name:
            clean(person?.name) ||
            clean(x.completed_by_email),
          completed_by_email:
            clean(x.completed_by_email) ||
            clean(person?.email),
        },
      ];
    })
  );

  const masterFields = bundledMasterFields();

  return data.map((r) => {
    const normalized = normalize(r, map);
    const fallback = masterFields.get(clean(normalized.bp));

    if (fallback) {
      if (!clean(normalized.name_in_bpm) && fallback.name_in_bpm) {
        normalized.name_in_bpm = fallback.name_in_bpm;
      }
      if (!clean(normalized.farm_name) && fallback.farm_name) {
        normalized.farm_name = fallback.farm_name;
      }
      if (!clean(normalized.area_under_rejuvenation) && fallback.area_under_rejuvenation) {
        normalized.area_under_rejuvenation = fallback.area_under_rejuvenation;
      }
    }

    return normalized;
  });
}

/* Cached farmer dataset. Filters are still applied exactly as before,
   but repeated requests within 60 seconds do not hit Supabase. */
async function allFarmers() {
  const now = Date.now();
  if (farmersCache.data && now - farmersCache.at < DATA_CACHE_TTL_MS) {
    return farmersCache.data;
  }
  const data = await allFarmersFromDb();
  farmersCache = { at: now, data };
  return data;
}

/* =======================================================
   ALL CLUSTER POINTS
======================================================= */

async function allClusterPointsFromDb() {
  if (!hasDb) {
    return demoClusterPoints;
  }

  const data = await fetchAllRows(
    "cluster_points",
    "*",
    "id"
  );

  return data.map((x) => ({
    id: x.id,

    cluster: clean(x.cluster),

    team: clean(x.team),

    day: clean(x.day),

    lat: num(x.latitude),

    lon: num(x.longitude),

    color: clean(x.color),
  }));
}

async function allClusterPoints() {
  const now = Date.now();
  if (clusterPointsCache.data && now - clusterPointsCache.at < DATA_CACHE_TTL_MS) {
    return clusterPointsCache.data;
  }
  const data = await allClusterPointsFromDb();
  clusterPointsCache = { at: now, data };
  return data;
}

/* =======================================================
   UNIQUE
======================================================= */

function unique(a) {
  return [
    ...new Set(
      a
        .map(clean)
        .filter(Boolean)
    ),
  ].sort(
    (x, y) =>
      x.localeCompare(
        y,
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        }
      )
  );
}

/* =======================================================
   FILTER FARMERS
======================================================= */

function applyFilters(rows, q = {}) {
  const trader = clean(q.trader).toUpperCase();
  const team = clean(q.team);
  const day = clean(q.day);
  const cluster = clean(q.cluster);
  const route = clean(
    q.route_group || q.route
  );
  const visit = clean(
    q.visit_date || q.date
  );
  const status = clean(q.status).toLowerCase();
  const completionDate = clean(q.completion_date || q.completed_date);
  const completionFrom = clean(q.completion_from);
  const completionTo = clean(q.completion_to);
  const search = clean(q.q).toLowerCase();

  return rows.filter((r) => {
    if (
      trader &&
      r.trader !== trader
    ) {
      return false;
    }

    if (
      team &&
      r.team !== team
    ) {
      return false;
    }

    if (
      day &&
      r.day !== day
    ) {
      return false;
    }

    if (
      cluster &&
      r.cluster !== cluster
    ) {
      return false;
    }

    if (
      route &&
      r.route_group !== route
    ) {
      return false;
    }

    if (
      visit &&
      r.visit_date !== visit
    ) {
      return false;
    }

    if (
      status &&
      r.status.toLowerCase() !== status
    ) {
      return false;
    }

    const completedDate = r.completion_date
      ? String(r.completion_date).slice(0, 10)
      : "";

    if (completionDate && completedDate !== completionDate) {
      return false;
    }

    if (completionFrom && (!completedDate || completedDate < completionFrom)) {
      return false;
    }

    if (completionTo && (!completedDate || completedDate > completionTo)) {
      return false;
    }

    if (
      search &&
      !`
        ${r.bp}
        ${r.name}
        ${r.phone}
        ${r.village}
        ${r.estate}
        ${r.trader}
        ${r.cluster}
        ${r.team}
        ${r.day}
        ${r.route_group}
      `
        .toLowerCase()
        .includes(search)
    ) {
      return false;
    }

    return true;
  });
}

/* =======================================================
   CLUSTER SUMMARY
======================================================= */

function clusterSummary(rows) {
  const m = new Map();

  rows.forEach((r) => {
    if (!r.cluster) return;

    if (!m.has(r.cluster)) {
      m.set(r.cluster, []);
    }

    m.get(r.cluster).push(r);
  });

  return [...m.entries()]
    .sort((a, b) =>
      a[0].localeCompare(
        b[0],
        undefined,
        {
          numeric: true,
        }
      )
    )
    .map(
      ([cluster, rs], i) => {
        const completed =
          rs.filter(
            (r) =>
              r.status === "Completed"
          ).length;

        return {
          cluster,

          total: rs.length,

          completed,

          pending:
            rs.length - completed,

          progress: rs.length
            ? Math.round(
                (completed /
                  rs.length) *
                  100
              )
            : 0,

          teams: unique(
            rs.map((r) => r.team)
          ),

          traders: unique(
            rs.map(
              (r) => r.trader
            )
          ),

          days: unique(
            rs.map((r) => r.day)
          ),

          color:
            COLORS[
              i % COLORS.length
            ],
        };
      }
    );
}

/* =======================================================
   TEAM SUMMARY
======================================================= */

function teamSummary(rows) {
  return unique(
    rows.map((r) => r.team)
  ).map((team) => {
    const rs = rows.filter(
      (r) => r.team === team
    );

    const completed =
      rs.filter(
        (r) =>
          r.status === "Completed"
      ).length;

    return {
      team:
        team || "Unknown",

      total: rs.length,

      completed,

      pending:
        rs.length - completed,

      progress: rs.length
        ? Math.round(
            (completed /
              rs.length) *
              100
          )
        : 0,

      traders: unique(
        rs.map(
          (r) => r.trader
        )
      ),

      clusters: unique(
        rs.map(
          (r) => r.cluster
        )
      ),

      employees: unique(
        rs.map(
          (r) => r.employee
        )
      ),
    };
  });
}

/* =======================================================
   TRADER SUMMARY
======================================================= */

function traderSummary(rows) {
  const m = new Map();

  for (const r of rows) {
    const trader = r.trader || "Unknown";
    if (!m.has(trader)) {
      m.set(trader, {
        trader,
        total: 0,
        completed: 0,
        clusters: new Set(),
        teams: new Set(),
      });
    }

    const item = m.get(trader);
    item.total += 1;
    if (r.status === "Completed") item.completed += 1;
    if (r.cluster) item.clusters.add(r.cluster);
    if (r.team) item.teams.add(r.team);
  }

  return [...m.values()]
    .sort((a, b) => a.trader.localeCompare(b.trader, undefined, { numeric: true }))
    .map((item) => ({
      trader: item.trader,
      total: item.total,
      completed: item.completed,
      pending: item.total - item.completed,
      progress: item.total ? Math.round((item.completed / item.total) * 100) : 0,
      clusters: [...item.clusters].sort(),
      teams: [...item.teams].sort(),
    }));
}

/* =======================================================
   TOTALS
======================================================= */

function completionTotals(rows) {
  let completed = 0;
  for (const r of rows) {
    if (r.status === "Completed") completed++;
  }

  return {
    farmers: rows.length,
    completed,
    pending: rows.length - completed,
    progress: rows.length ? Math.round((completed / rows.length) * 100) : 0,
  };
}

function totals(rows) {
  const completed =
    rows.filter(
      (r) =>
        r.status === "Completed"
    ).length;

  return {
    farmers: rows.length,

    completed,

    pending:
      rows.length - completed,

    clusters:
      clusterSummary(rows).length,

    traders:
      traderSummary(rows).length,

    progress: rows.length
      ? Math.round(
          (completed /
            rows.length) *
            100
        )
      : 0,
  };
}

/* =======================================================
   OPTIONS
======================================================= */

function options(rows) {
  return {
    traders: unique(
      rows.map(
        (r) => r.trader
      )
    ),

    teams: unique(
      rows.map(
        (r) => r.team
      )
    ),

    days: unique(
      rows.map(
        (r) => r.day
      )
    ),

    clusters: unique(
      rows.map(
        (r) => r.cluster
      )
    ),

    routes: unique(
      rows.map(
        (r) => r.route_group
      )
    ),

    dates: unique(
      rows.map(
        (r) => r.visit_date
      )
    ),

    completion_dates: unique(
      rows
        .map((r) => r.completion_date ? String(r.completion_date).slice(0, 10) : "")
        .filter(Boolean)
    ),

    employees: unique(
      rows.map(
        (r) => r.employee
      )
    ),
  };
}

/* =======================================================
   CSV
======================================================= */

function csvEscape(v) {
  const s = String(v ?? "");

  return /[",\n\r]/.test(s)
    ? `"${s.replace(
        /"/g,
        '""'
      )}"`
    : s;
}

function farmersCsv(rows) {
  const headers = [
    "BP Number",
    "Farmer Name",
    "Name in BPM",
    "Farm Name",
    "Core area - Plot rea (Area under rejuvenation)",
    "Phone",
    "Village",
    "Estate",
    "Trader",
    "Cluster",
    "Team",
    "Employee",
    "Day",
    "Route Group",
    "Visit Date",
    "Latitude",
    "Longitude",
    "Status",
    "Completion Date",
    "Remarks",
  ];

  const lines = [
    headers.join(","),
  ];

  for (const r of rows) {
    lines.push(
      [
        r.bp,
        r.name,
        r.name_in_bpm,
        r.farm_name,
        r.area_under_rejuvenation,
        r.phone,
        r.village,
        r.estate,
        r.trader,
        r.cluster,
        r.team,
        r.employee,
        r.day,
        r.route_group,
        r.visit_date,
        r.lat,
        r.lon,
        r.status,
        r.completion_date,
        r.remarks,
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  return lines.join("\r\n");
}

/* =======================================================
   CSV PARSER
======================================================= */

function parseCsv(text) {
  const source = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  if (!source.trim()) return [];

  /*
    CSVs exported from Excel can use comma, semicolon or tab
    delimiters. Detect the delimiter from the header line while
    respecting quoted text.
  */
  const firstLine = source.split("\n").find((line) => line.trim()) || "";

  const countDelimiter = (line, delimiter) => {
    let count = 0;
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (ch === delimiter && !quoted) {
        count++;
      }
    }

    return count;
  };

  const candidates = [",", ";", "\t"];
  const delimiter = candidates
    .map((d) => ({
      d,
      count: countDelimiter(firstLine, d),
    }))
    .sort((a, b) => b.count - a.count)[0].d;

  const parseLine = (line) => {
    const out = [];
    let cur = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (ch === delimiter && !quoted) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }

    out.push(cur);
    return out;
  };

  /*
    This parser also handles quoted fields containing commas,
    which is important for Address fields such as:
    "Byagadahalli, Vanagur, Sakleshpur".
  */
  const lines = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];

    if (ch === '"') {
      if (quoted && source[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        quoted = !quoted;
        current += ch;
      }
    } else if (ch === "\n" && !quoted) {
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  if (current.length) lines.push(current);

  if (!lines.length) return [];

  const rawHeaders = parseLine(lines[0]).map((h) =>
    String(h ?? "")
      .replace(/^\uFEFF/, "")
      .trim()
  );

  const headers = rawHeaders.map(normalizeKey);

  return lines
    .slice(1)
    .map((line) => {
      const cells = parseLine(line);
      const row = {};

      headers.forEach((header, index) => {
        if (!header) return;
        row[header] = cells[index] ?? "";
      });

      Object.defineProperty(row, "__cells", {
        value: cells,
        enumerable: false,
      });

      Object.defineProperty(row, "__headers", {
        value: headers,
        enumerable: false,
      });

      return row;
    })
    .filter((row) =>
      row.__cells.some(
        (value) => clean(value) !== ""
      )
    );
}

/* =======================================================
   CLUSTER HTML PARSER
======================================================= */

function parseClusterHtml(text) {
  const points = [];

  const blocks = text
    .split(
      /var\s+circle_marker_[\w]+\s*=\s*L\.circleMarker\(/
    )
    .slice(1);

  for (const block of blocks) {
    const coord =
      block.match(
        /^\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/
      );

    if (!coord) {
      continue;
    }

    const head =
      block.slice(0, 7000);

    const cm =
      head.match(
        /<b>Cluster:<\/b>\s*([^<\r\n]+)/i
      );

    const tm =
      head.match(
        /<b>Team:<\/b>\s*([^<\r\n]+)/i
      );

    const dy =
      head.match(
        /<b>Day:<\/b>\s*([^<\r\n]+)/i
      );

    const color =
      (
        head.match(
          /"color":\s*"([^"]+)"/i
        ) || []
      )[1] || "";

    if (cm) {
      points.push({
        cluster: clean(
          cm[1]
        ),

        team: clean(
          tm?.[1]
        ),

        day: clean(
          dy?.[1]
        ),

        latitude:
          Number(coord[1]),

        longitude:
          Number(coord[2]),

        color,
      });
    }
  }

  const base =
    text.match(
      /L\.marker\(\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\][\s\S]{0,1200}?Office\/Base/i
    );

  return {
    points,

    office: base
      ? {
          lat: Number(
            base[1]
          ),
          lon: Number(
            base[2]
          ),
          name: "Office/Base",
        }
      : OFFICE,
  };
}

/* =======================================================
   HEALTH
======================================================= */


/* =======================================================
   AUTHENTICATION / ROLES / AUDIT
======================================================= */

const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || "jibinsha45@gmail.com")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
);

async function getProfile(user) {
  if (!hasDb || !user) return null;

  const email = clean(user.email).toLowerCase();
  const forcedRole = ADMIN_EMAILS.has(email) ? "admin" : "enumerator";

  const { data, error } = await supabase
    .from("profiles")
    .select("id,user_id,email,full_name,team,role,is_active,last_login_at,last_seen_at,created_at,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert({
        user_id: user.id,
        email,
        full_name: clean(user.user_metadata?.full_name || user.user_metadata?.name),
        team: clean(user.user_metadata?.team),
        role: forcedRole,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      })
      .select("id,user_id,email,full_name,team,role,is_active,last_login_at,last_seen_at,created_at,updated_at")
      .single();

    if (createError) throw new Error(createError.message);
    return created;
  }

  /* The configured admin email is always an admin. */
  if (ADMIN_EMAILS.has(email) && data.role !== "admin") {
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ role: "admin", email, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .select("id,user_id,email,full_name,team,role,is_active,last_login_at,last_seen_at,created_at,updated_at")
      .single();
    if (updateError) throw new Error(updateError.message);
    return updated;
  }

  return data;
}

async function audit(user, action, details = {}) {
  if (!hasDb || !user) return;

  const profile = user.profile || (await getProfile(user));

  const { error } = await supabase.from("audit_logs").insert({
    user_id: user.id,
    user_email: clean(user.email).toLowerCase(),
    user_name: clean(profile?.full_name),
    action,
    entity_type: clean(details.entity_type),
    entity_id: clean(details.entity_id),
    details: details.payload || details,
  });

  if (error) console.error("Audit log error:", error.message);
}

async function requireAuth(req, res, next) {
  try {
    if (!hasDb) {
      return res.status(503).json({
        error: "Authentication requires Supabase configuration.",
      });
    }

    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const now = Date.now();
    const cached = authCache.get(token);
    let user = cached && cached.expiresAt > now ? cached.user : null;
    let profile = cached && cached.expiresAt > now ? cached.profile : null;

    if (!user || !profile) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        authCache.delete(token);
        return res.status(401).json({ error: "Invalid or expired login session." });
      }
      user = data.user;
      profile = await getProfile(user);
      authCache.set(token, { user, profile, expiresAt: Date.now() + AUTH_CACHE_TTL_MS, activityAt: 0 });
    }

    if (!profile || profile.is_active === false) {
      return res.status(403).json({ error: "This account is disabled." });
    }

    req.user = {
      ...user,
      profile,
    };

    /* Lightweight activity heartbeat, throttled so frequent map polling
       does not turn every read into a database write. */
    const entry = authCache.get(token);
    const shouldTouch = !entry || !entry.activityAt || now - entry.activityAt >= 120000;
    if (shouldTouch) {
      // Do not make every authenticated request wait for an activity write.
      supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) console.warn("Activity update failed:", error.message);
        });
      if (entry) entry.activityAt = now;
    }

    next();
  } catch (e) {
    console.error("Auth middleware error:", e);
    res.status(500).json({ error: e.message || "Authentication failed." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.profile?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      service:
        "polygon-madikeri-api",

      database: hasDb
        ? "supabase"
        : "demo",

      time:
        new Date().toISOString(),
    });
  }
);

app.use("/api", requireAuth);

/* =======================================================
   DASHBOARD
======================================================= */

app.get(
  "/api/dashboard",
  async (req, res) => {
    try {
      // Dashboard only needs completion totals and trader completion.
      // Do not build/download map or cluster data here.
      const all = await allFarmers();
      const rows = applyFilters(all, req.query);
      const payload = {
        totals: completionTotals(rows),
        traders: traderSummary(rows),
        allTotal: rows.length,
      };

      res.setHeader("Cache-Control", "private, max-age=20, stale-while-revalidate=40");
      res.json(payload);
    } catch (e) {
      console.error("Dashboard error:", e);
      res.status(500).json({ error: e.message || "Dashboard failed" });
    }
  }
);

/* =======================================================
   FARMERS
======================================================= */

app.get(
  "/api/farmers",
  async (req, res) => {
    try {
      const all = await allFarmers();
      const rows = applyFilters(all, req.query);
      const statusBase = applyFilters(all, { ...req.query, status: "" });
      const statusCounts = {
        all: statusBase.length,
        completed: statusBase.filter((r) => r.status === "Completed").length,
        pending: statusBase.filter((r) => r.status === "Pending").length,
      };

      const pageSize = Math.min(Math.max(Number.parseInt(req.query.page_size, 10) || 40, 1), 100);
      const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
      const start = (page - 1) * pageSize;

      res.json({
        farmers: rows.slice(start, start + pageSize),
        total: rows.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
        statusCounts,
        options: options(all),
        allTotal: all.length,
      });
    } catch (e) {
      console.error("Farmers error:", e);
      res.status(500).json({ error: e.message });
    }
  }
);

/* =======================================================
   FARMER CSV EXPORT
======================================================= */

app.get(
  "/api/farmers/export.csv",
  requireAdmin,
  async (req, res) => {
    try {
      const rows =
        applyFilters(
          await allFarmers(),
          req.query
        );

      res.setHeader(
        "Content-Type",
        "text/csv; charset=utf-8"
      );

      res.setHeader(
        "Content-Disposition",
        'attachment; filename="polygon-madikeri-farmers.csv"'
      );

      res.send(
        farmersCsv(rows)
      );
    } catch (e) {
      res
        .status(500)
        .send(e.message);
    }
  }
);

/* =======================================================
   CLUSTER MAP
======================================================= */

app.get(
  "/api/cluster-map",
  async (req, res) => {
    try {
      const all =
        await allFarmers();

      const rows =
        applyFilters(
          all,
          req.query
        );

      const mapPoints =
        await allClusterPoints();

      const q =
        clean(
          req.query.q
        ).toLowerCase();

      const trader =
        clean(
          req.query.trader
        ).toUpperCase();

      const team =
        clean(
          req.query.team
        );

      const day =
        clean(
          req.query.day
        );

      const cluster =
        clean(
          req.query.cluster
        );

      const filteredClusterPoints =
        mapPoints
          .filter((p) => {
            if (
              trader &&
              !rows.some(
                (r) =>
                  r.cluster ===
                    p.cluster &&
                  r.trader ===
                    trader
              )
            ) {
              return false;
            }

            if (
              team &&
              p.team !== team
            ) {
              return false;
            }

            if (
              day &&
              p.day !== day
            ) {
              return false;
            }

            if (
              cluster &&
              p.cluster !==
                cluster
            ) {
              return false;
            }

            if (
              q &&
              !`${p.cluster} ${p.team} ${p.day}`
                .toLowerCase()
                .includes(q) &&
              !rows.some(
                (r) =>
                  r.cluster ===
                    p.cluster &&
                  `${r.bp} ${r.name} ${r.village}`
                    .toLowerCase()
                    .includes(q)
              )
            ) {
              return false;
            }

            return true;
          })
          .map((p, i) => ({
            ...p,

            color:
              p.color ||
              COLORS[
                i %
                  COLORS.length
              ],
          }));

      const cs =
        clusterSummary(rows);

      const mapClusters =
        new Map(
          cs.map((c) => [
            c.cluster,
            c,
          ])
        );

      for (const p of filteredClusterPoints) {
        if (
          !mapClusters.has(
            p.cluster
          )
        ) {
          mapClusters.set(
            p.cluster,
            {
              cluster:
                p.cluster,

              total: 0,

              completed: 0,

              pending: 0,

              progress: 0,

              teams: unique([
                p.team,
              ]),

              traders: [],

              days: unique([
                p.day,
              ]),

              color:
                p.color,
            }
          );
        }
      }

      const clusters =
        [
          ...mapClusters.values(),
        ].filter(
          (c) =>
            !cluster ||
            String(
              c.cluster
            ) ===
              cluster
        );

      res.json({
        points: rows
          .filter(
            (r) =>
              r.lat !== null &&
              r.lon !== null &&
              r.cluster
          )
          .map((r, i) => ({
            ...r,

            color:
              mapClusters.get(
                r.cluster
              )?.color ||
              COLORS[
                i %
                  COLORS.length
              ],
          })),

        clusterPoints:
          filteredClusterPoints,

        clusters,

        totals:
          totals(rows),

        office: OFFICE,

        options:
          options(all),

        database:
          hasDb
            ? "supabase"
            : "demo",
      });
    } catch (e) {
      console.error(
        "Cluster map error:",
        e
      );

      res.status(500).json({
        error: e.message,
      });
    }
  }
);

/* =======================================================
   OPEN MAP FARMER DATA
======================================================= */

async function allOpenMapFarmers() {
  const now = Date.now();
  if (openMapFarmersCache.data && now - openMapFarmersCache.at < OPEN_MAP_FARMER_TTL_MS) {
    return openMapFarmersCache.data;
  }

  if (!hasDb) {
    const data = demoFarmers.map((r) => ({
      bp: r.bp,
      name: r.name,
      farm_name: r.farm_name || "",
      area_under_rejuvenation: r.area_under_rejuvenation || "",
      phone: r.phone,
      lat: r.lat,
      lon: r.lon,
      status: demoDone.has(r.bp) ? "Completed" : "Pending",
      completion_date: demoDone.has(r.bp) ? null : null,
      completion_by_name: "",
    }));
    openMapFarmersCache = { at: now, data };
    return data;
  }

  const [rows, done] = await Promise.all([
    // Keep the Open Map compatible with older Supabase databases where
    // the optional display columns may not have been added yet. The master
    // CSV below supplies farm name/area when those columns are unavailable.
    fetchAllRows(
      "farmers",
      "id,bp_number,farmer_name,phone,latitude,longitude",
      "id"
    ),
    fetchAllRows(
      "completed_farmers",
      "bp_number,completed_at,completed_by,completed_by_email",
      "bp_number"
    ),
  ]);

  let profiles = [];
  if (done.length) profiles = await allProfiles();

  const profileById = new Map(
    profiles.map((p) => [
      String(p.user_id),
      { name: clean(p.full_name), email: clean(p.email).toLowerCase() },
    ])
  );

  const profileByEmail = new Map(
    profiles.map((p) => [
      clean(p.email).toLowerCase(),
      { name: clean(p.full_name), email: clean(p.email).toLowerCase() },
    ])
  );

  const doneMap = new Map(
    done.map((x) => {
      const person =
        (x.completed_by && profileById.get(String(x.completed_by))) ||
        (x.completed_by_email && profileByEmail.get(clean(x.completed_by_email).toLowerCase()));

      return [
        clean(x.bp_number),
        {
          completed_at: x.completed_at || null,
          completed_by_name: clean(person?.name) || clean(x.completed_by_email),
        },
      ];
    })
  );

  const masterFields = bundledMasterFields();

  const data = rows
    .map((r) => {
      const bp = clean(r.bp_number);
      const fallback = masterFields.get(bp);
      const completed = doneMap.get(bp);

      return {
        bp,
        name: clean(r.farmer_name),
        farm_name: clean(r.farm_name) || clean(fallback?.farm_name),
        area_under_rejuvenation:
          clean(r.area_under_rejuvenation) || clean(fallback?.area_under_rejuvenation),
        phone: clean(r.phone),
        lat: num(r.latitude),
        lon: num(r.longitude),
        status: completed ? "Completed" : "Pending",
        completion_date: completed?.completed_at || null,
        completion_by_name: completed?.completed_by_name || "",
      };
    })
    .filter((r) => r.lat !== null && r.lon !== null);

  openMapFarmersCache = { at: now, data };
  return data;
}

/* =======================================================
   OPEN MAP

   Lightweight map payload: no cluster polygons, cluster lists or
   filter options. Farmer status is still resolved from the same
   existing dataset, while team positions are returned separately.
======================================================= */

async function getLiveTeamPayload() {
  const now = Date.now();
  if (teamLocationCache.data && now - teamLocationCache.at < TEAM_LOCATION_CACHE_TTL_MS) {
    return teamLocationCache.data;
  }

  const users = (await allProfiles())
    .filter((u) => u.is_active)
    .sort((a, b) => clean(a.full_name).localeCompare(clean(b.full_name)));

  const recentSince = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: locations, error: locError } = await supabase
    .from("team_locations")
    .select("id,user_id,latitude,longitude,accuracy,created_at")
    .gte("created_at", recentSince)
    .order("created_at", { ascending: false })
    .limit(500);

  if (locError) throw new Error(locError.message);

  const latest = new Map();
  (locations || []).forEach((x) => {
    if (!latest.has(x.user_id)) latest.set(x.user_id, x);
  });

  const payload = {
    users: (users || []).map((u) => ({
      id: u.id,
      user_id: u.user_id,
      email: u.email,
      full_name: u.full_name,
      team: u.team,
      role: u.role,
      last_seen_at: u.last_seen_at,
      location: latest.get(u.user_id) || null,
    })),
  };

  teamLocationCache = { at: now, data: payload };
  return payload;
}

app.get(
  "/api/open-map",
  async (req, res) => {
    try {
      const farmers = await allOpenMapFarmers();

      const payload = {
        farmers,
        office: OFFICE,
        totals: {
          farmers: farmers.length,
          completed: farmers.filter((r) => r.status === "Completed").length,
          pending: farmers.filter((r) => r.status !== "Completed").length,
        },
      };

      res.setHeader("Cache-Control", "private, max-age=10, stale-while-revalidate=20");
      res.json(payload);
    } catch (e) {
      console.error("Open map error:", e);
      res.status(500).json({ error: e.message || "Open map failed." });
    }
  }
);

/* =======================================================
   CLUSTER POINTS
======================================================= */

app.get(
  "/api/cluster-points",
  async (req, res) => {
    try {
      res.json({
        points:
          await allClusterPoints(),

        office: OFFICE,
      });
    } catch (e) {
      res.status(500).json({
        error: e.message,
      });
    }
  }
);

/* =======================================================
   COMPLETION
======================================================= */

app.post(
  "/api/farmers/:bp/completion",
  async (req, res) => {
    try {
      const bp =
        decodeURIComponent(
          req.params.bp
        );

      const completed =
        Boolean(
          req.body?.completed
        );

      const remarks =
        clean(
          req.body?.remarks
        );

      if (!bp) {
        return res
          .status(400)
          .json({
            error:
              "BP number is required",
          });
      }

      /* -------------------------
         DEMO MODE
      ------------------------- */

      if (!hasDb) {
        if (completed) {
          demoDone.set(
            bp,
            remarks
          );
        } else {
          demoDone.delete(bp);
        }

        return res.json({
          ok: true,
          bp,
          completed,
          remarks,
          database: "demo",
        });
      }

      /* -------------------------
         COMPLETED
      ------------------------- */

      if (completed) {
        const { error } =
          await supabase
            .from(
              "completed_farmers"
            )
            .upsert(
              {
                bp_number: bp,
                remarks,
                completed_at: new Date().toISOString(),
                completed_by: req.user?.id || null,
                completed_by_email: clean(req.user?.email).toLowerCase() || null,
              },
              {
                onConflict:
                  "bp_number",
              }
            );

        if (error) {
          throw new Error(
            error.message
          );
        }
      } else {
        /* -----------------------
           MARK PENDING
        ----------------------- */

        const { error } =
          await supabase
            .from(
              "completed_farmers"
            )
            .delete()
            .eq(
              "bp_number",
              bp
            );

        if (error) {
          throw new Error(
            error.message
          );
        }
      }

      invalidateDataCache();
      await audit(req.user, completed ? "visit_completed" : "visit_reopened", {
        entity_type: "farmer",
        entity_id: bp,
        payload: {
          bp_number: bp,
          completed,
          remarks,
          completed_by_email: clean(req.user?.email).toLowerCase() || null,
          completed_by_name: clean(req.user?.profile?.full_name) || clean(req.user?.email),
        },
      });

      res.json({
        ok: true,
        bp,
        completed,
        remarks,
      });
    } catch (e) {
      res.status(500).json({
        error: e.message,
      });
    }
  }
);

/* =======================================================
   IMPORT FARMER CSV
======================================================= */

app.post(
  "/api/import",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!hasDb) {
        return res.status(400).json({
          error:
            "CSV import requires Supabase configuration. Demo mode is read/write only for completion status.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error:
            "CSV file is required",
        });
      }

      const rows =
        parseCsv(
          req.file.buffer.toString(
            "utf8"
          )
        );

      /*
        Supports your actual sheet:
        
        Bp Number
        Farmer Name
        phone number
        Cluster
        Day
        Team
        Lat
        Long
      */

      const normalized =
        rows
          .map((r) => ({
            bp_number: clean(
              val(r, [
                "bp_number",
                "bp_number_",
                "bp",
                "Bp Number",
              ])
            ),

            farmer_name:
              clean(
                val(r, [
                  "farmer_name",
                  "name",
                ])
              ),

            name_in_bpm:
              clean(
                val(r, [
                  "name_in_bpm",
                  "Name in BPM",
                  "bpm_name",
                  "bp_name",
                  "bpm",
                ]) ||
                cellAt(r, 3)
              ),

            farm_name:
              clean(
                val(r, [
                  "farm_name",
                  "Farm Name",
                  "farm",
                  "farmname",
                ]) ||
                cellAt(r, 4)
              ),

            area_under_rejuvenation:
              clean(
                val(r, [
                  "core_area_plot_rea_area_under_rejuvenation",
                  "core_area_plot_rea_area_under_rejuvenation_",
                  "core_area_plot_rea_(area_under_rejuvenation)",
                  "core_area_plot_rea",
                  "core_area",
                  "area_under_rejuvenation",
                  "area",
                  "area_under_rejuvenation_",
                ]) ||
                cellAt(r, 13)
              ),

            phone: clean(
              val(r, [
                "phone",
                "mobile",
                "phone_number",
                "phone_number_",
              ])
            ),

            village:
              clean(
                val(r, [
                  "village",
                  "village_name",
                ])
              ),

            estate:
              clean(
                val(r, [
                  "estate",
                  "estate_name",
                ])
              ),

            cluster:
              clean(
                val(r, [
                  "cluster",
                  "cluster_id",
                ])
              ),

            team: clean(
              val(r, [
                "team",
                "team_name",
              ])
            ),

            day: clean(
              val(r, [
                "day",
                "day_number",
              ])
            ),

            route_group:
              clean(
                val(r, [
                  "route_group",
                  "route",
                  "route_name",
                ])
              ),

            visit_date:
              date(
                val(r, [
                  "visit_date",
                  "date",
                ])
              ),

            latitude:
              num(
                val(r, [
                  "latitude",
                  "lat",
                ])
              ),

            longitude:
              num(
                val(r, [
                  "longitude",
                  "lon",
                  "lng",
                  "long",
                ])
              ),

            employee_name:
              clean(
                val(r, [
                  "employee",
                  "employee_name",
                ])
              ),

            remarks:
              clean(
                val(r, [
                  "remarks",
                  "remark",
                ])
              ),
          }))
          .filter(
            (x) =>
              x.bp_number
          );

      if (!normalized.length) {
        return res.status(400).json({
          error:
            "No rows with BP Number found",
        });
      }

      /*
        IMPORTANT:
        Import in batches instead of trying to
        send all records in one request.
      */

      let imported = 0;

      for (
        let i = 0;
        i < normalized.length;
        i += DB_PAGE_SIZE
      ) {
        const batch =
          normalized.slice(
            i,
            i + DB_PAGE_SIZE
          );

        const { error } =
          await supabase
            .from("farmers")
            .upsert(
              batch,
              {
                onConflict:
                  "bp_number",
              }
            );

        if (error) {
          throw new Error(
            `Import failed at rows ${
              i + 1
            }-${
              i + batch.length
            }: ${error.message}`
          );
        }

        imported +=
          batch.length;
      }

      invalidateDataCache();
      await audit(req.user, "farmer_dataset_imported", {
        entity_type: "farmer_dataset",
        payload: { imported, file_name: req.file.originalname },
      });

      res.json({
        ok: true,
        imported,
        message: `Successfully imported ${imported} farmer records.`,
      });
    } catch (e) {
      console.error(
        "CSV import error:",
        e
      );

      res.status(500).json({
        error: e.message,
      });
    }
  }
);

/* =======================================================
   IMPORT CLUSTER HTML
======================================================= */

app.post(
  "/api/import-cluster-html",
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!hasDb) {
        return res.status(400).json({
          error:
            "Cluster HTML import requires Supabase configuration.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error:
            "Cluster_Map.html is required",
        });
      }

      const parsed =
        parseClusterHtml(
          req.file.buffer.toString(
            "utf8"
          )
        );

      if (
        !parsed.points.length
      ) {
        return res.status(400).json({
          error:
            "No Cluster/Team/Day/Lat/Lon records were found in this HTML file.",
        });
      }

      /*
        Delete previous imported
        Cluster_Map.html points.
      */

      const { error: deleteError } =
        await supabase
          .from(
            "cluster_points"
          )
          .delete()
          .eq(
            "source",
            "Cluster_Map.html"
          );

      if (deleteError) {
        throw new Error(
          deleteError.message
        );
      }

      const batch =
        parsed.points.map(
          (p) => ({
            ...p,
            source:
              "Cluster_Map.html",
          })
        );

      /*
        Insert in batches.
      */

      let imported = 0;

      for (
        let i = 0;
        i < batch.length;
        i += DB_PAGE_SIZE
      ) {
        const chunk =
          batch.slice(
            i,
            i + DB_PAGE_SIZE
          );

        const { error } =
          await supabase
            .from(
              "cluster_points"
            )
            .insert(chunk);

        if (error) {
          throw new Error(
            `Cluster import failed at rows ${
              i + 1
            }-${
              i + chunk.length
            }: ${error.message}`
          );
        }

        imported +=
          chunk.length;
      }

      clusterPointsCache = { at: 0, data: null };
      invalidateDataCache();
      await audit(req.user, "cluster_map_imported", {
        entity_type: "cluster_map",
        payload: { imported, file_name: req.file.originalname, office: parsed.office },
      });

      res.json({
        ok: true,
        imported,
        office: parsed.office,
        message: `Successfully imported ${imported} cluster map points.`,
      });
    } catch (e) {
      console.error(
        "Cluster HTML import error:",
        e
      );

      res.status(500).json({
        error: e.message,
      });
    }
  }
);

/* =======================================================
   DELETE CLUSTER POINTS
======================================================= */

app.delete(
  "/api/cluster-points",
  requireAdmin,
  async (req, res) => {
    try {
      if (!hasDb) {
        return res.status(400).json({
          error:
            "Requires Supabase configuration.",
        });
      }

      const { error } =
        await supabase
          .from(
            "cluster_points"
          )
          .delete()
          .eq(
            "source",
            "Cluster_Map.html"
          );

      if (error) {
        throw new Error(
          error.message
        );
      }

      clusterPointsCache = { at: 0, data: null };
      await audit(req.user, "cluster_map_cleared", {
        entity_type: "cluster_map",
        payload: { source: "Cluster_Map.html" },
      });

      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({
        error: e.message,
      });
    }
  }
);


/* =======================================================
   AUTH SESSION / LOGIN / LOGOUT
======================================================= */

app.get("/api/auth/me", async (req, res) => {
  try {
    if (!hasDb) return res.status(503).json({ error: "Supabase Auth is not configured." });
    if (!req.user) return res.status(401).json({ error: "Authentication required." });
    res.json({ user: { id: req.user.id, email: req.user.email }, profile: req.user.profile });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/login", requireAuth, async (req, res) => {
  try {
    const now = new Date().toISOString();
    await supabase.from("profiles").update({ last_login_at: now, last_seen_at: now }).eq("user_id", req.user.id);
    await audit(req.user, "login", { entity_type: "session", payload: { login_at: now } });
    res.json({ ok: true, profile: req.user.profile });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  try {
    await audit(req.user, "logout", { entity_type: "session", payload: { logout_at: new Date().toISOString() } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/team-location", requireAuth, async (req, res) => {
  try {
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    const accuracy = req.body?.accuracy == null ? null : Number(req.body.accuracy);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: "Valid latitude and longitude are required." });
    }
    const { error } = await supabase.from("team_locations").insert({
      user_id: req.user.id, latitude, longitude,
      accuracy: Number.isFinite(accuracy) ? accuracy : null
    });
    if (error) throw new Error(error.message);
    /* Keep only recent location history for each user. */
    // The new point is immediately visible; cleanup is deliberately not on
    // the critical path of the live-location request.
    supabase.from("team_locations").delete()
      .eq("user_id", req.user.id)
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .then(({ error }) => {
        if (error) console.warn("Location history cleanup failed:", error.message);
      });

    teamLocationCache = { at: 0, data: null };
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/team-locations", requireAuth, async (req, res) => {
  try {
    const payload = await getLiveTeamPayload();
    res.setHeader("Cache-Control", "private, max-age=3, stale-while-revalidate=5");
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =======================================================
   ADMIN OVERVIEW
======================================================= */

app.get("/api/admin/overview", requireAdmin, async (req, res) => {
  try {
    const all = await allFarmers();
    const mapPoints = await allClusterPoints();
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id,user_id,email,full_name,team,role,is_active,last_login_at,last_seen_at,created_at")
      .order("created_at", { ascending: true });
    if (usersError) throw new Error(usersError.message);
    const { data: auditRows, error: auditError } = await supabase
      .from("audit_logs")
      .select("id,user_id,user_email,user_name,action,entity_type,entity_id,details,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (auditError) throw new Error(auditError.message);
    res.json({
      totals: totals(all),
      traders: traderSummary(all),
      teams: teamSummary(all),
      clusters: clusterSummary(all),
      clusterPoints: mapPoints,
      users: users || [],
      audit: auditRows || [],
      allTotal: all.length,
    });
  } catch (e) {
    console.error("Admin overview error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,user_id,email,full_name,team,role,is_active,last_login_at,last_seen_at,created_at,updated_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    res.json({ users: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const email = clean(req.body?.email).toLowerCase();
    const password = clean(req.body?.password);
    const fullName = clean(req.body?.full_name);
    const team = clean(req.body?.team);
    const role = req.body?.role === "admin" ? "admin" : "enumerator";

    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (role === "admin" && !ADMIN_EMAILS.has(email)) return res.status(400).json({ error: "Only configured administrator emails can have admin role." });

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, team },
    });
    if (error) throw new Error(error.message);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({ user_id: data.user.id, email, full_name: fullName, team, role, is_active: true })
      .select("id,user_id,email,full_name,team,role,is_active,last_login_at,last_seen_at,created_at,updated_at")
      .single();
    if (profileError) throw new Error(profileError.message);

    await audit(req.user, "user_created", { entity_type: "user", entity_id: data.user.id, payload: { email, role } });
    res.json({ ok: true, user: profile });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { data: target, error: findError } = await supabase.from("profiles").select("*").eq("id", id).single();
    if (findError) throw new Error(findError.message);
    const email = clean(target.email).toLowerCase();
    const updates = {};
    if (req.body?.full_name !== undefined) updates.full_name = clean(req.body.full_name);
    if (req.body?.team !== undefined) updates.team = clean(req.body.team);
    if (req.body?.is_active !== undefined) updates.is_active = Boolean(req.body.is_active);
    if (req.body?.role !== undefined) {
      const role = req.body.role === "admin" ? "admin" : "enumerator";
      if (role === "admin" && !ADMIN_EMAILS.has(email)) return res.status(400).json({ error: "This email is not configured as an administrator." });
      updates.role = role;
    }
    if (req.body?.password) {
      if (String(req.body.password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
      const { error: pwError } = await supabase.auth.admin.updateUserById(target.user_id, { password: String(req.body.password) });
      if (pwError) throw new Error(pwError.message);
    }
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from("profiles").update(updates).eq("id", id).select("id,user_id,email,full_name,team,role,is_active,last_login_at,last_seen_at,created_at,updated_at").single();
    if (error) throw new Error(error.message);
    await audit(req.user, "user_updated", { entity_type: "user", entity_id: target.user_id, payload: { email, changes: updates } });
    res.json({ ok: true, user: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/audit", requireAdmin, async (req, res) => {
  try {
    let q = supabase
      .from("audit_logs")
      .select("id,user_id,user_email,user_name,action,entity_type,entity_id,details,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (clean(req.query.user_email)) q = q.eq("user_email", clean(req.query.user_email).toLowerCase());
    if (clean(req.query.action)) q = q.eq("action", clean(req.query.action));
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    res.json({ audit: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* =======================================================
   START SERVER
======================================================= */

app.listen(
  port,
  () => {
    console.log(
      `Polygon API listening on ${port} (${
        hasDb
          ? "Supabase"
          : "demo mode"
      })`
    );
  }
);
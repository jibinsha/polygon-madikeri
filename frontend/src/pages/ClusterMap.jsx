import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  ArrowLeft,
  LocateFixed,
  Maximize2,
  RefreshCw,
  Search,
  X,
  Navigation,
  MapPinned,
  Phone,
  Crosshair,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import * as turf from "@turf/turf";
import { api } from "../api";
import { Select } from "../components";
import "leaflet/dist/leaflet.css";

const CENTER = [13.0714100566, 75.6442024220];

const mapsUrl = (lat, lon) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${lat},${lon}`
  )}`;

/*
  This component only controls the map view.

  IMPORTANT:
  "focus" is NOT a data filter.
  It only decides which cluster the map should zoom to.
  All clusters/farmers remain loaded and visible.
*/
function Fit({ points = [], focus = "" }) {
  const map = useMap();

  useEffect(() => {
    const target = focus
      ? points.filter(
          (x) =>
            String(x.cluster) === String(focus)
        )
      : points;

    const valid = target.filter(
      (x) =>
        Number.isFinite(Number(x.lat)) &&
        Number.isFinite(Number(x.lon))
    );

    if (!valid.length) return;

    try {
      map.fitBounds(
        valid.map((x) => [
          Number(x.lat),
          Number(x.lon),
        ]),
        {
          padding: [35, 35],
          maxZoom: focus ? 16 : 12,
        }
      );
    } catch (error) {
      console.warn(
        "Unable to fit cluster map:",
        error
      );
    }
  }, [points, focus, map]);

  return null;
}

function Locate() {
  const map = useMap();

  return (
    <button
      className="map-control"
      title="My location"
      onClick={() =>
        map.locate({
          setView: true,
          maxZoom: 16,
          enableHighAccuracy: true,
        })
      }
      type="button"
    >
      <LocateFixed size={18} />
    </button>
  );
}

function Full() {
  const map = useMap();

  return (
    <button
      className="map-control second"
      title="Fullscreen"
      onClick={() => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          map
            .getContainer()
            .requestFullscreen?.();
        }
      }}
      type="button"
    >
      <Maximize2 size={18} />
    </button>
  );
}

function CenterOffice({ office }) {
  const map = useMap();

  if (!office) return null;

  return (
    <button
      className="map-control third"
      title="Office"
      onClick={() =>
        map.setView(
          [
            Number(office.lat),
            Number(office.lon),
          ],
          14
        )
      }
      type="button"
    >
      <Navigation size={17} />
    </button>
  );
}

export default function ClusterMap() {
  const [params, setParams] =
    useSearchParams();

  /*
    Cluster in the URL is treated as the
    initial MAP FOCUS only.

    It is deliberately NOT placed in filters.
  */
  const initialFilters = {
    q: params.get("q") || "",
    trader: params.get("trader") || "",
    team: params.get("team") || "",
    day: params.get("day") || "",
    cluster: "",
    status: params.get("status") || "",
  };

  const initialFocus =
    params.get("cluster") || "";

  const [filters, setFilters] =
    useState(initialFilters);

  const [focus, setFocus] =
    useState(initialFocus);

  const [data, setData] =
    useState({
      points: [],
      clusterPoints: [],
      clusters: [],
      totals: {},
      options: {},
      office: {
        lat: 13.137,
        lon: 75.606,
        name: "Office/Base",
      },
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [selected, setSelected] =
    useState(null);

  /*
    Change a real filter.

    Changing a real filter clears the
    visual cluster focus because the available
    data may have changed.
  */
  const setFilter = (
    key,
    value
  ) => {
    setFocus("");

    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  /*
    Cluster selection ONLY changes the map
    zoom/focus. It does NOT change filters
    and therefore does NOT remove other clusters.
  */
  const focusCluster = (cluster) => {
    const value = String(
      cluster ?? ""
    );

    setFocus(value);
  };

  const clearFocus = () => {
    setFocus("");
  };

  const load = () => {
    setLoading(true);
    setError("");

    api
      .clusterMap(filters)
      .then((result) => {
        setData(result);
      })
      .catch((err) => {
        setError(
          err?.message ||
            "Unable to load cluster map."
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  /*
    Load only when actual filters change.
    Focus does NOT reload/filter the data.
  */
  useEffect(() => {
    const timer = setTimeout(
      load,
      140
    );

    return () =>
      clearTimeout(timer);
  }, [
    filters.q,
    filters.trader,
    filters.team,
    filters.day,
    filters.status,
  ]);

  /*
    Keep the URL useful for sharing,
    but cluster remains a visual focus,
    not an API filter.
  */
  useEffect(() => {
    const next = {};

    Object.entries(filters).forEach(
      ([key, value]) => {
        if (
          key !== "cluster" &&
          value
        ) {
          next[key] = value;
        }
      }
    );

    if (focus) {
      next.cluster = focus;
    }

    setParams(next, {
      replace: true,
    });
  }, [
    filters,
    focus,
    setParams,
  ]);

  /*
    Group the complete currently-loaded
    dataset by cluster.
  */
  const grouped = useMemo(
    () =>
      data.clusters.map(
        (cluster) => ({
          ...cluster,

          points:
            data.clusterPoints.filter(
              (point) =>
                String(point.cluster) ===
                String(
                  cluster.cluster
                )
            ),

          farmers:
            data.points.filter(
              (farmer) =>
                String(farmer.cluster) ===
                String(
                  cluster.cluster
                )
            ),
        })
      ),
    [data]
  );

  /*
    Cluster boundary polygons.
  */
  const polygons = useMemo(
    () =>
      grouped
        .map((cluster) => {
          if (
            cluster.points.length < 3
          ) {
            return null;
          }

          try {
            const hull =
              turf.convex(
                turf.featureCollection(
                  cluster.points.map(
                    (point) =>
                      turf.point([
                        Number(
                          point.lon
                        ),
                        Number(
                          point.lat
                        ),
                      ])
                  )
                )
              );

            return hull
              ? {
                  cluster,
                  hull,
                }
              : null;
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    [grouped]
  );

  /*
    Farmer core areas.
  */
  const farmerCore = useMemo(
    () =>
      grouped
        .map((cluster) => {
          const points =
            cluster.farmers.filter(
              (farmer) =>
                Number.isFinite(
                  Number(
                    farmer.lat
                  )
                ) &&
                Number.isFinite(
                  Number(
                    farmer.lon
                  )
                )
            );

          if (points.length < 3) {
            return null;
          }

          try {
            const hull =
              turf.convex(
                turf.featureCollection(
                  points.map(
                    (point) =>
                      turf.point([
                        Number(
                          point.lon
                        ),
                        Number(
                          point.lat
                        ),
                      ])
                  )
                )
              );

            return hull
              ? {
                  cluster,
                  hull,
                }
              : null;
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    [grouped]
  );

  const clear = () => {
    setFilters({
      q: "",
      trader: "",
      team: "",
      day: "",
      cluster: "",
      status: "",
    });

    setFocus("");
    setSelected(null);
  };

  return (
    <div className="map-page">

      {/* =================================================
          TOOLBAR
      ================================================= */}

      <div className="map-toolbar">

        <Link
          to="/"
          className="back-link"
        >
          <ArrowLeft size={17} />
          Dashboard
        </Link>

        <div className="map-title">

          <div className="eyebrow">
            FARMER GEOGRAPHY
          </div>

          <h1>
            Cluster Map
          </h1>

        </div>

        <div className="map-kpis">

          <b>
            {data.totals.farmers || 0}
            <span>Farmers</span>
          </b>

          <b>
            {data.totals.clusters || 0}
            <span>Clusters</span>
          </b>

          <b>
            {data.totals.completed || 0}
            <span>Done</span>
          </b>

        </div>

      </div>


      {/* =================================================
          FILTERS

          Cluster selector is a ZOOM selector,
          NOT a data filter.
      ================================================= */}

      <div className="map-filters">

        <div className="map-search">

          <div className="search-input">

            <Search size={16} />

            <input
              placeholder="Search BP, farmer, village, cluster…"
              value={filters.q}
              onChange={(event) =>
                setFilter(
                  "q",
                  event.target.value
                )
              }
            />

            {filters.q && (
              <button
                onClick={() =>
                  setFilter("q", "")
                }
                type="button"
              >
                <X size={14} />
              </button>
            )}

          </div>

        </div>

        <Select
          label="Trader"
          value={filters.trader}
          options={
            data.options.traders
          }
          onChange={(value) =>
            setFilter(
              "trader",
              value
            )
          }
        />

        <Select
          label="Team"
          value={filters.team}
          options={
            data.options.teams
          }
          onChange={(value) =>
            setFilter(
              "team",
              value
            )
          }
        />

        <Select
          label="Day"
          value={filters.day}
          options={
            data.options.days
          }
          onChange={(value) =>
            setFilter(
              "day",
              value
            )
          }
        />

        <Select
          label="Cluster / Zoom"
          value={focus}
          options={
            data.options.clusters
          }
          onChange={focusCluster}
        />

        <Select
          label="Status"
          value={filters.status}
          options={[
            "Completed",
            "Pending",
          ]}
          onChange={(value) =>
            setFilter(
              "status",
              value
            )
          }
        />

        <button
          className="clear-btn"
          onClick={clear}
          type="button"
        >
          Clear
        </button>

      </div>


      {/* =================================================
          MAIN MAP LAYOUT
      ================================================= */}

      <div className="map-layout">

        {/* =================================================
            CLUSTER LIST

            ALL clusters remain in this list even after
            clicking/focusing one.
        ================================================= */}

        <aside className="cluster-list">

          <div className="list-title">

            <div>

              <div className="eyebrow">
                CLUSTERS
              </div>

              <h2>
                Farmer areas
              </h2>

            </div>

            <div className="cluster-list-actions">

              {focus && (
                <button
                  className="icon-btn"
                  title="Show all clusters / reset zoom"
                  onClick={clearFocus}
                  type="button"
                >
                  <Crosshair size={16} />
                </button>
              )}

              <button
                className="icon-btn"
                onClick={load}
                title="Refresh"
                type="button"
              >
                <RefreshCw size={16} />
              </button>

            </div>

          </div>


          {data.clusters.map(
            (cluster) => {

              const selectedCluster =
                String(focus) ===
                String(
                  cluster.cluster
                );

              return (

                <button
                  key={
                    cluster.cluster
                  }

                  className={
                    `cluster-item ${
                      selectedCluster
                        ? "selected"
                        : ""
                    }`
                  }

                  onClick={() =>
                    focusCluster(
                      cluster.cluster
                    )
                  }

                  type="button"
                >

                  <div className="cluster-name">

                    <i
                      style={{
                        background:
                          cluster.color,
                      }}
                    />

                    <b>
                      Cluster{" "}
                      {cluster.cluster}
                    </b>

                    <span>
                      {cluster.total ||
                        0}
                    </span>

                  </div>


                  <div className="small-progress">

                    <div
                      style={{
                        width: `${pct(
                          cluster.progress
                        )}%`,

                        background:
                          cluster.color,
                      }}
                    />

                  </div>


                  <div className="cluster-meta">

                    <span>
                      {cluster.completed ||
                        0}{" "}
                      completed
                    </span>

                    <b>
                      {cluster.progress ||
                        0}
                      %
                    </b>

                  </div>


                  <small>
                    {cluster.teams?.join(
                      ", "
                    ) ||
                      "Team"}

                    {" · "}

                    {cluster.traders?.join(
                      ", "
                    ) ||
                      "Trader"}
                  </small>

                </button>
              );
            }
          )}


          {!loading &&
            !data.clusters.length && (
              <div className="empty">
                No clusters match the
                current filters.
              </div>
            )}

        </aside>


        {/* =================================================
            MAP
        ================================================= */}

        <section className="map-canvas">

          <MapContainer
            center={CENTER}
            zoom={10}
            className="leaflet-map"
            preferCanvas
          >

            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />


            {/* Focus changes zoom only */}
            <Fit
              points={
                data.points.length
                  ? data.points
                  : data.clusterPoints
              }
              focus={focus}
            />


            <Locate />

            <Full />

            <CenterOffice
              office={data.office}
            />


            {/* =================================================
                CLUSTER BOUNDARIES
            ================================================= */}

            {polygons.map(
              ({
                cluster,
                hull,
              }) => {

                const selectedCluster =
                  String(focus) ===
                  String(
                    cluster.cluster
                  );

                return (

                  <Polygon
                    key={
                      `poly-${cluster.cluster}`
                    }

                    positions={
                      hull
                        .geometry
                        .coordinates[0]
                        .map(
                          ([lon, lat]) => [
                            lat,
                            lon,
                          ]
                        )
                    }

                    pathOptions={{
                      color:
                        cluster.color,

                      weight:
                        selectedCluster
                          ? 3
                          : 2,

                      fillColor:
                        cluster.color,

                      fillOpacity:
                        selectedCluster
                          ? 0.12
                          : 0.04,

                      dashArray:
                        "5 5",
                    }}

                    eventHandlers={{
                      click: () =>
                        focusCluster(
                          cluster.cluster
                        ),
                    }}
                  >

                    <Tooltip sticky>
                      Cluster{" "}
                      {cluster.cluster}{" "}
                      boundary
                    </Tooltip>

                  </Polygon>
                );
              }
            )}


            {/* =================================================
                FARMER CORE AREAS
            ================================================= */}

            {farmerCore.map(
              ({
                cluster,
                hull,
              }) => {

                const selectedCluster =
                  String(focus) ===
                  String(
                    cluster.cluster
                  );

                return (

                  <Polygon
                    key={
                      `core-${cluster.cluster}`
                    }

                    positions={
                      hull
                        .geometry
                        .coordinates[0]
                        .map(
                          ([lon, lat]) => [
                            lat,
                            lon,
                          ]
                        )
                    }

                    pathOptions={{
                      color:
                        cluster.color,

                      weight:
                        selectedCluster
                          ? 2.5
                          : 1.5,

                      fillColor:
                        cluster.color,

                      fillOpacity:
                        selectedCluster
                          ? 0.24
                          : 0.12,
                    }}

                    eventHandlers={{
                      click: () =>
                        focusCluster(
                          cluster.cluster
                        ),
                    }}
                  >

                    <Tooltip sticky>
                      Farmer core area ·
                      Cluster{" "}
                      {cluster.cluster}
                    </Tooltip>

                  </Polygon>
                );
              }
            )}


            {/* =================================================
                CLUSTER MAP POINTS
            ================================================= */}

            {data.clusterPoints.map(
              (point, index) => {

                const selectedCluster =
                  String(focus) ===
                  String(
                    point.cluster
                  );

                return (

                  <CircleMarker
                    key={
                      `cp-${
                        point.id ||
                        index
                      }`
                    }

                    center={[
                      Number(
                        point.lat
                      ),
                      Number(
                        point.lon
                      ),
                    ]}

                    radius={
                      selectedCluster
                        ? 5
                        : 3.5
                    }

                    pathOptions={{
                      color:
                        point.color ||
                        "#2f7d5b",

                      fillColor:
                        point.color ||
                        "#2f7d5b",

                      fillOpacity:
                        0.7,

                      weight: 1,
                    }}
                  >

                    <Tooltip>
                      Cluster{" "}
                      {point.cluster}
                      {" · "}
                      {point.team}
                      {" · Day "}
                      {point.day}
                    </Tooltip>

                  </CircleMarker>
                );
              }
            )}


            {/* =================================================
                FARMER GPS POINTS
            ================================================= */}

            {data.points.map(
              (farmer, index) => {

                const lat =
                  Number(
                    farmer.lat
                  );

                const lon =
                  Number(
                    farmer.lon
                  );

                if (
                  !Number.isFinite(
                    lat
                  ) ||
                  !Number.isFinite(
                    lon
                  )
                ) {
                  return null;
                }

                const completed =
                  farmer.status ===
                  "Completed";

                const focused =
                  String(focus) ===
                  String(
                    farmer.cluster
                  );

                return (

                  <CircleMarker
                    key={
                      `farmer-${
                        farmer.bp
                      }-${index}`
                    }

                    center={[
                      lat,
                      lon,
                    ]}

                    radius={
                      focused
                        ? 7
                        : 5
                    }

                    pathOptions={{
                      color:
                        completed
                          ? "#16845f"
                          : "#7a867f",

                      fillColor:
                        completed
                          ? "#16845f"
                          : "#ffffff",

                      fillOpacity: 1,

                      weight: 2,
                    }}

                    eventHandlers={{
                      click: () =>
                        setSelected(
                          farmer
                        ),
                    }}
                  >

                    <Tooltip>
                      {farmer.name ||
                        farmer.bp ||
                        "Farmer"}

                      {" · "}

                      {farmer.status ||
                        "Pending"}
                    </Tooltip>


                    <Popup>

                      <div className="popup">

                        <small>
                          FARMER
                        </small>

                        <h3>
                          {farmer.name ||
                            "Unnamed farmer"}
                        </h3>

                        <code>
                          {farmer.bp}
                        </code>


                        <div className="popup-grid">

                          <span>
                            Trader
                          </span>

                          <b>
                            {farmer.trader ||
                              "—"}
                          </b>


                          <span>
                            Cluster
                          </span>

                          <b>
                            {farmer.cluster ||
                              "—"}
                          </b>


                          <span>
                            Team
                          </span>

                          <b>
                            {farmer.team ||
                              "—"}
                          </b>


                          <span>
                            Village
                          </span>

                          <b>
                            {farmer.village ||
                              "—"}
                          </b>


                          <span>
                            Phone
                          </span>

                          <b>
                            {farmer.phone ? (
                              <a
                                className="phone-link"
                                href={`tel:${farmer.phone}`}
                              >
                                <Phone
                                  size={11}
                                />

                                {
                                  farmer.phone
                                }
                              </a>
                            ) : (
                              "—"
                            )}
                          </b>

                        </div>


                        <div className="popup-actions">

                          {farmer.lat !=
                            null &&
                            farmer.lon !=
                              null && (
                              <a
                                className="map-link"
                                href={mapsUrl(
                                  farmer.lat,
                                  farmer.lon
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <MapPinned
                                  size={13}
                                />

                                Open in Google Maps
                              </a>
                            )}

                        </div>

                      </div>

                    </Popup>

                  </CircleMarker>
                );
              }
            )}


            {/* OFFICE */}

            {data.office &&
              Number.isFinite(
                Number(
                  data.office.lat
                )
              ) &&
              Number.isFinite(
                Number(
                  data.office.lon
                )
              ) && (

                <CircleMarker
                  center={[
                    Number(
                      data.office.lat
                    ),
                    Number(
                      data.office.lon
                    ),
                  ]}

                  radius={8}

                  pathOptions={{
                    color:
                      "#b23b32",

                    fillColor:
                      "#b23b32",

                    fillOpacity: 1,

                    weight: 2,
                  }}
                >

                  <Tooltip>
                    {
                      data.office.name
                    }
                  </Tooltip>

                </CircleMarker>

              )}

          </MapContainer>


          {/* =================================================
              LEGEND
          ================================================= */}

          <div className="legend">

            <span>
              <i className="done-dot" />
              Completed farmer
            </span>

            <span>
              <i className="pending-dot" />
              Pending farmer
            </span>

            <span>
              <i className="area-dot" />
              Farmer core area
            </span>

            <span>
              ◌ Cluster boundary
            </span>

            <span>
              🏠 Office
            </span>

          </div>


          {loading && (
            <div className="map-loading">
              Updating…
            </div>
          )}

          {error && (
            <div className="map-error">
              {error}
            </div>
          )}


          {/* =================================================
              SELECTED FARMER DRAWER
          ================================================= */}

          {selected && (

            <div className="farmer-drawer">

              <button
                onClick={() =>
                  setSelected(null)
                }
                type="button"
                title="Close"
              >
                <X size={17} />
              </button>

              <div className="eyebrow">
                SELECTED FARMER
              </div>

              <h2>
                {selected.name ||
                  "Unnamed farmer"}
              </h2>

              <code>
                {selected.bp}
              </code>

              <span
                className={`status ${
                  selected.status ===
                  "Completed"
                    ? "done"
                    : "pending"
                }`}
              >
                {selected.status}
              </span>


              <div className="detail-grid">

                <span>
                  Trader
                </span>

                <b>
                  {selected.trader ||
                    "—"}
                </b>


                <span>
                  Cluster
                </span>

                <b>
                  {selected.cluster ||
                    "—"}
                </b>


                <span>
                  Team
                </span>

                <b>
                  {selected.team ||
                    "—"}
                </b>


                <span>
                  Employee
                </span>

                <b>
                  {selected.employee ||
                    "—"}
                </b>


                <span>
                  Day
                </span>

                <b>
                  {selected.day ||
                    "—"}
                </b>


                <span>
                  Village
                </span>

                <b>
                  {selected.village ||
                    "—"}
                </b>


                <span>
                  Phone
                </span>

                <b>
                  {selected.phone ? (
                    <a
                      className="phone-link"
                      href={`tel:${selected.phone}`}
                    >
                      <Phone size={12} />
                      {
                        selected.phone
                      }
                    </a>
                  ) : (
                    "—"
                  )}
                </b>


                <span>
                  Location
                </span>

                <b>
                  {selected.lat !=
                    null &&
                  selected.lon !=
                    null ? (
                    <a
                      className="map-link"
                      href={mapsUrl(
                        selected.lat,
                        selected.lon
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPinned
                        size={13}
                      />
                      Google Maps
                    </a>
                  ) : (
                    "—"
                  )}
                </b>


                <span>
                  Remarks
                </span>

                <b>
                  {selected.remarks ||
                    "—"}
                </b>


                {selected.status ===
                  "Completed" &&
                  selected.completion_date && (
                    <>
                      <span>
                        Completed
                      </span>

                      <b>
                        {new Date(
                          selected.completion_date
                        ).toLocaleString()}
                      </b>
                    </>
                  )}

              </div>

            </div>
          )}

        </section>

      </div>
    </div>
  );
}

function pct(value) {
  return Math.max(
    0,
    Math.min(
      100,
      Number(value) || 0
    )
  );
}

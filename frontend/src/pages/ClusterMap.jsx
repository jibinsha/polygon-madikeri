import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  ArrowLeft,
  LocateFixed,
  Maximize2,
  RefreshCw,
  MapPinned,
  Phone,
  Navigation,
  Users,
  CheckCircle2,
  Clock3,
  X,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import "leaflet/dist/leaflet.css";

const CENTER = [13.0714100566, 75.6442024220];
const FARMER_FIT_MAX_ZOOM = 13;
const TEAM_REFRESH_MS = 5000;

function normalizeLocation(value) {
  if (!value) return null;
  const lat = Number(value.lat ?? value.latitude);
  const lon = Number(value.lon ?? value.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return {
    lat,
    lon,
    accuracy: Number.isFinite(Number(value.accuracy)) ? Number(value.accuracy) : null,
    updatedAt: value.updatedAt || value.updated_at || value.created_at || new Date().toISOString(),
  };
}

function traderFromBp(bp) {
  const parts = String(bp || "").split("-");
  if (parts.length < 3) return "";
  const m = parts[2].match(/^([A-Za-z]+)\d+$/);
  return (m ? m[1] : parts[2]).toUpperCase();
}

const mapsUrl = (lat, lon) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;

const directionsUrl = (lat, lon, origin) => {
  const params = new URLSearchParams({
    api: "1",
    destination: `${lat},${lon}`,
  });
  if (origin?.lat != null && origin?.lon != null) {
    params.set("origin", `${origin.lat},${origin.lon}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

function FitOnce({ points, hasLocation }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || hasLocation || !points?.length) return;
    const valid = points.filter(
      (p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon))
    );
    if (!valid.length) return;

    try {
      map.fitBounds(
        valid.map((p) => [Number(p.lat), Number(p.lon)]),
        { padding: [45, 45], maxZoom: FARMER_FIT_MAX_ZOOM }
      );
      fitted.current = true;
    } catch {
      // Keep the default Madikeri view if fitting fails.
    }
  }, [points, hasLocation, map]);

  return null;
}

function LocateControl({ onLocate }) {
  const map = useMap();
  return (
    <button
      className="map-control"
      title="My location"
      type="button"
      onClick={() => {
        map.locate({ setView: true, maxZoom: 17, enableHighAccuracy: true });
        onLocate?.();
      }}
    >
      <LocateFixed size={18} />
    </button>
  );
}

function FullscreenControl() {
  const map = useMap();
  return (
    <button
      className="map-control second"
      title="Fullscreen map"
      type="button"
      onClick={() => {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else map.getContainer().requestFullscreen?.();
      }}
    >
      <Maximize2 size={18} />
    </button>
  );
}

function RecenterControl({ location }) {
  const map = useMap();
  return (
    <button
      className="map-control third"
      title="Center on my location"
      type="button"
      disabled={!location}
      onClick={() => {
        if (location && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lon))) {
          map.setView([Number(location.lat), Number(location.lon)], 17, { animate: true });
        }
      }}
    >
      <Navigation size={17} />
    </button>
  );
}

function AutoLocate({ location }) {
  const map = useMap();
  const centered = useRef(false);

  useEffect(() => {
    if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lon)) || centered.current) return;
    map.setView([Number(location.lat), Number(location.lon)], 15, { animate: false });
    centered.current = true;
  }, [location, map]);

  return null;
}

function ageLabel(iso) {
  if (!iso) return "No location";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)} hr ago`;
}

function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function FarmerPopup({ farmer, myLocation }) {
  const distance = distanceKm(
    myLocation,
    { lat: Number(farmer.lat), lon: Number(farmer.lon) }
  );

  return (
    <div className="popup farmer-map-popup">
      <small>FARMER</small>
      <h3>{farmer.name || "Unnamed farmer"}</h3>

      <div className="popup-grid farmer-popup-details">
        <span>BP Number</span><b>{farmer.bp || "—"}</b>
        <span>Farm name</span><b>{farmer.farm_name || "—"}</b>
        <span>Area under rejuvenation</span><b>{farmer.area_under_rejuvenation || "—"}</b>
        {distance != null && (
          <>
            <span>Distance</span>
            <b>{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</b>
          </>
        )}
        {farmer.completion_date && (
          <>
            <span>Completed</span>
            <b>{new Date(farmer.completion_date).toLocaleString()}</b>
          </>
        )}
        {farmer.completion_by_name && (
          <>
            <span>Enumerator</span>
            <b>{farmer.completion_by_name}</b>
          </>
        )}
      </div>

      <div className="popup-actions">
        {farmer.phone ? (
          <a className="popup-action phone-action" href={`tel:${farmer.phone}`}>
            <Phone size={13} /> Call {farmer.phone}
          </a>
        ) : null}
        {farmer.lat != null && farmer.lon != null ? (
          <a
            className="popup-action map-link"
            href={directionsUrl(farmer.lat, farmer.lon, myLocation)}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation size={13} /> Navigate
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function ClusterMap() {
  const [data, setData] = useState({ farmers: [], office: null });
  const [team, setTeam] = useState([]);
  const [myLocation, setMyLocation] = useState(() => normalizeLocation(window.__polygonLatestLocation));
  const [loading, setLoading] = useState(true);
  const [refreshingTeam, setRefreshingTeam] = useState(false);
  const [error, setError] = useState("");
  const [bpFilter, setBpFilter] = useState("");
  const [traderFilter, setTraderFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [groups, setGroups] = useState([]);

  const loadMap = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.openMap();
      setData({ farmers: result.farmers || [], office: result.office || null });
    } catch (e) {
      setError(e?.message || "Unable to load map.");
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const result = await api.farmerGroups();
      setGroups(result.groups || []);
    } catch (e) {
      console.warn("Farmer groups unavailable:", e);
    }
  };

  const loadTeam = async () => {
    try {
      setRefreshingTeam(true);
      const result = await api.teamLocations();
      setTeam(result.users || []);
    } catch (e) {
      // Don't blank the map because a team refresh temporarily fails.
      console.warn("Team location refresh failed:", e);
    } finally {
      setRefreshingTeam(false);
    }
  };

  useEffect(() => {
    // Load farmer points first; team positions are independent and refresh
    // separately so the map becomes usable as soon as the farmer payload arrives.
    loadMap();
    loadGroups();
    loadTeam();

    const teamTimer = setInterval(loadTeam, TEAM_REFRESH_MS);

    const onLocation = (event) => {
      const p = event?.detail;
      if (!p) return;
      const location = normalizeLocation(p);
      if (!location) return;
      setMyLocation(location);
    };
    window.addEventListener("polygon-location-updated", onLocation);

    return () => {
      clearInterval(teamTimer);
      window.removeEventListener("polygon-location-updated", onLocation);
    };
  }, []);

  const allMappedFarmers = useMemo(
    () => data.farmers.filter((f) => Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lon))),
    [data.farmers]
  );

  const traderOptions = useMemo(
    () => [...new Set(allMappedFarmers.map((f) => traderFromBp(f.bp)).filter(Boolean))].sort(),
    [allMappedFarmers]
  );

  const farmers = useMemo(() => {
    const group = groups.find((g) => String(g.id) === String(groupFilter));
    const groupBps = group ? new Set((group.farmer_bps || []).map(String)) : null;
    const bp = bpFilter.trim().toLowerCase();
    return allMappedFarmers.filter((f) => {
      if (bp && !String(f.bp || "").toLowerCase().includes(bp)) return false;
      if (traderFilter && traderFromBp(f.bp) !== traderFilter) return false;
      if (groupBps && !groupBps.has(String(f.bp))) return false;
      return true;
    });
  }, [allMappedFarmers, bpFilter, traderFilter, groupFilter, groups]);

  const completed = useMemo(() => farmers.filter((f) => f.status === "Completed").length, [farmers]);
  const pending = farmers.length - completed;
  const mappedTeam = useMemo(() => team.filter((u) => {
    const lat = Number(u?.location?.latitude);
    const lon = Number(u?.location?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }), [team]);

  return (
    <div className="open-map-page">
      <div className="open-map-toolbar">
        <Link to="/" className="back-link"><ArrowLeft size={17} /> Dashboard</Link>
        <div className="open-map-title">
          <div className="eyebrow">FIELD OPERATIONS</div>
          <h1>Open Map</h1>
        </div>
        <div className="open-map-kpis">
          <span><b>{farmers.length}</b> Farmers</span>
          <span className="kpi-done"><b>{completed}</b> Completed</span>
          <span className="kpi-pending"><b>{pending}</b> Pending</span>
          <span className="kpi-team"><b>{mappedTeam.length}</b> Team live</span>
        </div>
        <button className="open-map-refresh" type="button" onClick={() => { loadMap(); loadTeam(); }} title="Refresh map data">
          <RefreshCw size={16} className={refreshingTeam ? "spin" : ""} />
        </button>
      </div>

      <div className="open-map-filters">
        <div className="open-map-bp-search">
          <Search size={15} />
          <input
            value={bpFilter}
            onChange={(e) => setBpFilter(e.target.value)}
            placeholder="Search BP number"
            aria-label="Search BP number"
          />
          {bpFilter && <button type="button" onClick={() => setBpFilter("")} title="Clear BP search"><X size={14} /></button>}
        </div>

        <select value={traderFilter} onChange={(e) => setTraderFilter(e.target.value)} aria-label="Trader">
          <option value="">All Traders / VC</option>
          {traderOptions.map((trader) => <option key={trader} value={trader}>{trader}</option>)}
        </select>

        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} aria-label="Farmer Group">
          <option value="">All Groups</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.count || group.farmer_bps?.length || 0})</option>)}
        </select>
      </div>

      <section className="open-map-canvas">
        <MapContainer center={CENTER} zoom={10} className="leaflet-map" preferCanvas zoomControl>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitOnce points={farmers} hasLocation={Boolean(myLocation)} />
          <AutoLocate location={myLocation} />
          <LocateControl />
          <FullscreenControl />
          <RecenterControl location={myLocation} />

          {farmers.map((farmer) => {
            const done = farmer.status === "Completed";
            return (
              <CircleMarker
                key={`farmer-${farmer.bp}`}
                center={[Number(farmer.lat), Number(farmer.lon)]}
                radius={done ? 7 : 7.5}
                pathOptions={{
                  color: done ? "#147a54" : "#c64035",
                  fillColor: done ? "#20a56f" : "#e05245",
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              >
                <Tooltip direction="top" offset={[0, -7]}>{farmer.name || farmer.bp}</Tooltip>
                <Popup><FarmerPopup farmer={farmer} myLocation={myLocation} /></Popup>
              </CircleMarker>
            );
          })}

          {mappedTeam.map((member) => {
            const lat = Number(member.location.latitude);
            const lon = Number(member.location.longitude);
            const fresh = Date.now() - new Date(member.location.created_at).getTime() < 2 * 60 * 1000;
            return (
              <CircleMarker
                key={`team-${member.user_id}`}
                center={[lat, lon]}
                radius={9}
                pathOptions={{
                  color: "#7144a5",
                  fillColor: "#9c62d2",
                  fillOpacity: 0.95,
                  weight: 3,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>{member.full_name || member.email}</Tooltip>
                <Popup>
                  <div className="popup">
                    <small>TEAM MEMBER</small>
                    <h3>{member.full_name || member.email}</h3>
                    <div className="popup-grid">
                      <span>Team</span><b>{member.team || "—"}</b>
                      <span>Status</span><b>{fresh ? "Live" : "Stale"}</b>
                      <span>Last location</span><b>{ageLabel(member.location.created_at)}</b>
                    </div>
                    <div className="popup-actions">
                      <a className="popup-action map-link" href={directionsUrl(lat, lon, myLocation)} target="_blank" rel="noreferrer"><Navigation size={13} /> Navigate</a>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {myLocation && (
            <>
              {myLocation.accuracy && <Circle center={[myLocation.lat, myLocation.lon]} radius={myLocation.accuracy} pathOptions={{ color: "#2879d0", fillColor: "#2879d0", fillOpacity: 0.08, weight: 1 }} />}
              <CircleMarker center={[myLocation.lat, myLocation.lon]} radius={10} pathOptions={{ color: "#0b5fb3", fillColor: "#2389e5", fillOpacity: 1, weight: 3 }}>
                <Tooltip direction="top" offset={[0, -9]}>My location</Tooltip>
                <Popup><div className="popup"><small>MY LOCATION</small><h3>You are here</h3><div className="popup-grid"><span>Accuracy</span><b>{myLocation.accuracy ? `±${Math.round(myLocation.accuracy)} m` : "—"}</b><span>Updated</span><b>{ageLabel(myLocation.updatedAt)}</b></div></div></Popup>
              </CircleMarker>
            </>
          )}

          {data.office && Number.isFinite(Number(data.office.lat)) && Number.isFinite(Number(data.office.lon)) && (
            <CircleMarker center={[Number(data.office.lat), Number(data.office.lon)]} radius={7} pathOptions={{ color: "#5b5b5b", fillColor: "#626b68", fillOpacity: 1, weight: 2 }}>
              <Tooltip>{data.office.name || "Office/Base"}</Tooltip>
            </CircleMarker>
          )}
        </MapContainer>

        <div className="open-map-legend">
          <span><i className="legend-pending" /> Pending</span>
          <span><i className="legend-completed" /> Completed</span>
          <span><i className="legend-me" /> My location</span>
          <span><i className="legend-team" /> Team member</span>
          <span><i className="legend-office" /> Office</span>
        </div>

        <div className="open-map-status">
          <span><CheckCircle2 size={14} /> {completed} completed</span>
          <span><Clock3 size={14} /> {pending} pending</span>
          <span><Users size={14} /> {mappedTeam.length} team locations</span>
        </div>

        {loading && <div className="open-map-loading">Loading map…</div>}
        {error && <div className="open-map-error"><span>{error}</span><button type="button" onClick={loadMap}><RefreshCw size={13} /> Retry</button><button type="button" onClick={() => setError("")}><X size={13} /></button></div>}
      </section>
    </div>
  );
}

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
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import "leaflet/dist/leaflet.css";

const CENTER = [13.0714100566, 75.6442024220];
const FARMER_FIT_MAX_ZOOM = 13;
const TEAM_REFRESH_MS = 10000;
const LOCATION_SEND_MS = 15000;

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

function FitOnce({ points }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || !points?.length) return;
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
  }, [points, map]);

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
        if (location) map.setView([location.lat, location.lon], 17, { animate: true });
      }}
    >
      <Navigation size={17} />
    </button>
  );
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
  const distance = distanceKm(myLocation, { lat: Number(farmer.lat), lon: Number(farmer.lon) });
  return (
    <div className="popup farmer-map-popup">
      <small>FARMER</small>
      <h3>{farmer.name || "Unnamed farmer"}</h3>
      <code>{farmer.bp || "—"}</code>
      <span className={`status ${farmer.status === "Completed" ? "done" : "pending"}`}>
        {farmer.status === "Completed" ? "Completed" : "Pending"}
      </span>

      <div className="popup-grid">
        <span>Trader</span><b>{farmer.trader || "—"}</b>
        <span>Team</span><b>{farmer.team || "—"}</b>
        <span>Day</span><b>{farmer.day || "—"}</b>
        <span>Cluster</span><b>{farmer.cluster || "—"}</b>
        <span>Village</span><b>{farmer.village || "—"}</b>
        <span>Name in BPM</span><b>{farmer.name_in_bpm || "—"}</b>
        <span>Farm</span><b>{farmer.farm_name || "—"}</b>
        <span>Area</span><b>{farmer.area_under_rejuvenation || "—"}</b>
        {distance != null && <><span>Distance</span><b>{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</b></>}
        {farmer.completion_date && <><span>Completed</span><b>{new Date(farmer.completion_date).toLocaleString()}</b></>}
      </div>

      {farmer.remarks && <div className="popup-remarks"><span>Remarks</span><b>{farmer.remarks}</b></div>}

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
        {farmer.lat != null && farmer.lon != null ? (
          <a className="popup-action map-link" href={mapsUrl(farmer.lat, farmer.lon)} target="_blank" rel="noreferrer">
            <MapPinned size={13} /> Google Maps
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function ClusterMap() {
  const [data, setData] = useState({ farmers: [], office: null });
  const [team, setTeam] = useState([]);
  const [myLocation, setMyLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshingTeam, setRefreshingTeam] = useState(false);
  const [error, setError] = useState("");
  const watchId = useRef(null);
  const lastSentAt = useRef(0);

  const loadMap = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.openMap();
      setData({ farmers: result.farmers || [], office: result.office || null });
      setTeam(result.teamMembers || []);
    } catch (e) {
      setError(e?.message || "Unable to load map.");
    } finally {
      setLoading(false);
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

  const sendMyLocation = async (position) => {
    const next = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      updatedAt: new Date().toISOString(),
    };
    setMyLocation(next);

    if (Date.now() - lastSentAt.current < LOCATION_SEND_MS) return;
    lastSentAt.current = Date.now();
    try {
      await api.updateTeamLocation({
        latitude: next.lat,
        longitude: next.lon,
        accuracy: next.accuracy,
      });
    } catch (e) {
      console.warn("Unable to share current location:", e);
    }
  };

  useEffect(() => {
    loadMap();

    const teamTimer = setInterval(loadTeam, TEAM_REFRESH_MS);

    if (navigator.geolocation) {
      watchId.current = navigator.geolocation.watchPosition(
        sendMyLocation,
        (geoError) => console.warn("Location unavailable:", geoError?.message),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    }

    return () => {
      clearInterval(teamTimer);
      if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current);
    };
  }, []);

  const farmers = useMemo(
    () => data.farmers.filter((f) => Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lon))),
    [data.farmers]
  );

  const completed = useMemo(() => farmers.filter((f) => f.status === "Completed").length, [farmers]);
  const pending = farmers.length - completed;
  const mappedTeam = useMemo(() => team.filter((u) => u.location && Number.isFinite(Number(u.location.latitude)) && Number.isFinite(Number(u.location.longitude))), [team]);

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

      <section className="open-map-canvas">
        <MapContainer center={CENTER} zoom={10} className="leaflet-map" preferCanvas zoomControl>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitOnce points={farmers} />
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
                  color: fresh ? "#7144a5" : "#8d8d8d",
                  fillColor: fresh ? "#9c62d2" : "#a6aaa8",
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

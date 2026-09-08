import React, { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Layers, Map as MapIcon, MapPin, RefreshCw, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Polygon, Tooltip, useMap } from "react-leaflet";
import * as turf from "@turf/turf";
import { api } from "../api";
import { PageHead, Loading, ErrorCard, pct } from "../components";
import "leaflet/dist/leaflet.css";

const CENTER = [13.0714100566, 75.6442024220];

function Fit({ points = [] }) {
  const map = useMap();
  useEffect(() => {
    const valid = points.filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)));
    if (valid.length) map.fitBounds(valid.map(p => [Number(p.lat), Number(p.lon)]), { padding: [25, 25], maxZoom: 12 });
  }, [points, map]);
  return null;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    api.dashboard().then(setData).catch(e => setError(e.message || "Unable to load dashboard"));
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  if (error) return <div className="page"><ErrorCard message={error} onRetry={load} /></div>;
  if (!data) return <div className="page"><Loading /></div>;

  const farmers = data.points || [];
  const traders = data.traders || [];
  const total = data.totals?.farmers ?? data.allTotal ?? 0;
  const completed = data.totals?.completed ?? 0;
  const pending = data.totals?.pending ?? Math.max(total - completed, 0);
  const progress = Number(data.totals?.progress ?? 0);

  const traderColors = ["#2f7d5b", "#3578a5", "#8050a6", "#c45c16", "#7b6b36", "#a33d5d"];

  return <div className="page">
    <PageHead eyebrow="FIELD OPERATIONS" title="Dashboard" description="Farmer progress at a glance." actions={<button className="icon-btn" onClick={load} title="Refresh"><RefreshCw size={16} /></button>} />

    <div className="admin-grid field-stats">
      <div className="admin-stat"><div><Users size={18}/></div><span>Farmers</span><b>{total}</b></div>
      <div className="admin-stat"><div><CheckCircle2 size={18}/></div><span>Completed</span><b>{completed}</b></div>
      <div className="admin-stat"><div><Clock3 size={18}/></div><span>Pending</span><b>{pending}</b></div>
      <div className="admin-stat"><div><Layers size={18}/></div><span>Traders / VC</span><b>{traders.length}</b></div>
    </div>

    <div className="card admin-progress-card">
      <div className="card-head"><div><h2>Overall progress</h2><p>Completed farmer visits.</p></div><strong className="big-percent">{progress}%</strong></div>
      <div className="big-progress"><div style={{ width: `${pct(progress)}%` }} /></div>
    </div>

    <div className="card trader-progress-card">
      <div className="card-head"><div><h2>Trader-wise progress</h2><p>Completion grouped by Trader / VC from the BP number.</p></div></div>
      <div className="trader-progress-list">
        {traders.map((t, i) => <Link key={t.trader} className="trader-progress-row" to={`/farmers?trader=${encodeURIComponent(t.trader)}`}>
          <div className="trader-progress-top"><div className="trader-name"><i style={{ background: traderColors[i % traderColors.length] }} /> <b>{t.trader}</b></div><span><b>{t.completed}</b> / {t.total} · <strong>{t.progress}%</strong></span></div>
          <div className="small-progress"><div style={{ width: `${pct(t.progress)}%`, background: traderColors[i % traderColors.length] }} /></div>
          <div className="trader-progress-meta"><span>{t.pending} pending</span><span>{t.teams?.join(", ") || "Team"}</span></div>
        </Link>)}
        {!traders.length && <EmptyTrader />}
      </div>
    </div>

    <div className="dash-map-wrap card">
      <div className="dash-map-head"><div><div className="eyebrow">FARMER CORE AREA</div><h2>Where the farmers are</h2><p>Actual farmer GPS points and their coverage areas.</p></div><Link className="primary-btn ghost-btn" to="/cluster-map"><MapIcon size={14}/> Open map</Link></div>
      <div className="dash-map"><MapContainer center={CENTER} zoom={10} className="leaflet-map" preferCanvas><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Fit points={farmers}/>{buildCoreAreas(farmers, data.clusters || [])}{farmers.map((p,i)=>{const lat=Number(p.lat),lon=Number(p.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;const done=p.status==="Completed";return <CircleMarker key={`${p.bp}-${i}`} center={[lat,lon]} radius={4.5} pathOptions={{color:done?"#16845f":"#7a867f",fillColor:done?"#16845f":"#fff",fillOpacity:1,weight:2}}><Tooltip>{p.name||p.bp} · {p.status}</Tooltip></CircleMarker>})}</MapContainer></div>
    </div>

    <div className="quick-grid"><Link className="quick-tile" to="/farmers"><Users size={19}/><div><b>Farmers</b><span>Search, call and open farmer locations.</span></div></Link><Link className="quick-tile" to="/team-location"><MapPin size={19}/><div><b>Team Location</b><span>See where teammates last shared their location.</span></div></Link></div>
  </div>;
}

function buildCoreAreas(farmers, clusters) {
  const byCluster = new globalThis.Map();
  farmers.forEach(p => { if (!byCluster.has(String(p.cluster || ""))) byCluster.set(String(p.cluster || ""), []); byCluster.get(String(p.cluster || "")).push(p); });
  return [...byCluster.entries()].map(([cluster, points]) => {
    const valid = points.filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)));
    if (valid.length < 3) return null;
    let hull = null; try { hull = turf.convex(turf.featureCollection(valid.map(p => turf.point([Number(p.lon), Number(p.lat)])))); } catch {}
    if (!hull) return null;
    const c = clusters.find(x => String(x.cluster) === cluster);
    return <Polygon key={`core-${cluster}`} positions={hull.geometry.coordinates[0].map(([lon,lat]) => [lat,lon])} pathOptions={{ color: c?.color || "#2f7d5b", weight: 1.5, fillColor: c?.color || "#2f7d5b", fillOpacity: .14 }}><Tooltip sticky>Farmer core area · Cluster {cluster}</Tooltip></Polygon>;
  });
}

function EmptyTrader() { return <div className="empty">No trader data available.</div>; }

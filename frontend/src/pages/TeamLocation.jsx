import React,{useEffect,useMemo,useState} from "react";
import {MapContainer,TileLayer,CircleMarker,Popup,Tooltip,useMap} from "react-leaflet";
import {LocateFixed,RefreshCw,MapPin,Navigation} from "lucide-react";
import {api} from "../api";
import {PageHead,Loading,ErrorCard} from "../components";
import "leaflet/dist/leaflet.css";

const CENTER=[13.0714100566,75.6442024220];
const ago=iso=>{if(!iso)return "No location";const mins=Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/60000));return mins<1?"Just now":mins<60?`${mins} min ago`:`${Math.floor(mins/60)} hr ago`};
const validLocation=u=>{const lat=Number(u?.location?.latitude),lon=Number(u?.location?.longitude);return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;};
function Fit({users}){const map=useMap();useEffect(()=>{const p=users.map(u=>u.location).filter(x=>{const lat=Number(x?.latitude),lon=Number(x?.longitude);return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180});if(p.length)map.fitBounds(p.map(x=>[Number(x.latitude),Number(x.longitude)]),{padding:[40,40],maxZoom:14})},[users,map]);return null}
export default function TeamLocation(){
 const [users,setUsers]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[sharing,setSharing]=useState(false),[message,setMessage]=useState("");
 const load=(silent=false)=>{if(!silent)setLoading(true);setError("");api.teamLocations().then(r=>setUsers(r.users||[])).catch(e=>setError(e.message)).finally(()=>{if(!silent)setLoading(false)})};
 const sendLocation=()=>{if(!navigator.geolocation){setError("This device does not support location sharing.");return;}setMessage("Getting your location…");navigator.geolocation.getCurrentPosition(async p=>{try{await api.updateTeamLocation({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy});setSharing(true);setMessage("Your location is being shared while this app is open.");load()}catch(e){setError(e.message)}},e=>setError(e.message||"Location permission was denied."),{enableHighAccuracy:true,maximumAge:30000,timeout:15000})};
 useEffect(()=>{
  load();
  const poll=window.setInterval(()=>load(true),10000);
  const onLocation=(event)=>{
    setSharing(true);
    setMessage("Your location is being shared automatically while this app is open.");
  };
  window.addEventListener("polygon-location-updated",onLocation);
  return()=>{
    window.clearInterval(poll);
    window.removeEventListener("polygon-location-updated",onLocation);
  };
 },[]);
 const mapped=useMemo(()=>users.filter(validLocation),[users]);
 return <div className="page team-location-page">
  <PageHead eyebrow="FIELD TEAM" title="Team Location" description="See the latest shared location of active team members." actions={<button className="icon-btn" onClick={load}><RefreshCw size={16}/></button>}/>
  <div className="team-location-note"><MapPin size={15}/><div><b>Location sharing</b><span>Location is fetched automatically while this app is open. Allow location access so teammates can see your latest position.</span></div><button className="secondary-btn" onClick={sendLocation}><LocateFixed size={14}/>{sharing?"Update now":"Share my location"}</button></div>
  {message&&<div className="info-banner success">{message}</div>}
  {error&&<ErrorCard message={error} onRetry={load}/>}
  <div className="team-location-layout">
   <div className="card team-members"><div className="card-head"><div><h2>Team members</h2><p>{mapped.length} with a shared location</p></div></div>
    {users.map(u=>{const fresh=u.location&&Date.now()-new Date(u.location.created_at).getTime()<10*60*1000;return <div className="team-member-row" key={u.user_id}><i className={fresh?"live-dot":"offline-dot"}/><div><b>{u.full_name||u.email}</b><span>{u.team||"Team not assigned"} · {u.role}</span></div><small>{u.location?ago(u.location.created_at):"No location yet"}</small></div>})}
    {!loading&&!users.length&&<div className="empty">No active team members.</div>}
   </div>
   <div className="card team-map-card"><div className="card-head"><div><h2>Live team map</h2><p>Markers use the latest location shared by each member.</p></div></div><div className="team-map"><MapContainer center={CENTER} zoom={10} className="leaflet-map" preferCanvas><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Fit users={mapped}/>{mapped.map((u,i)=><CircleMarker key={u.user_id} center={[Number(u.location.latitude),Number(u.location.longitude)]} radius={8} pathOptions={{color:"#1d6b4a",fillColor:"#2f7d5b",fillOpacity:.9,weight:2}}><Tooltip>{u.full_name||u.email}</Tooltip><Popup><div className="popup"><small>TEAM MEMBER</small><h3>{u.full_name||u.email}</h3><div className="popup-grid"><span>Team</span><b>{u.team||"—"}</b><span>Last location</span><b>{ago(u.location.created_at)}</b></div><a className="map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${u.location.latitude},${u.location.longitude}`)}`} target="_blank" rel="noreferrer"><Navigation size={13}/> Open in Google Maps</a></div></Popup></CircleMarker>)}</MapContainer></div></div>
  </div>
 </div>
}

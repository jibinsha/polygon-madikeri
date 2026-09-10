import React,{useEffect,useState} from "react";
import {NavLink,Navigate,Route,Routes,useLocation} from "react-router-dom";
import {LayoutDashboard,Map,Users,MapPin,Menu,X,ShieldCheck,Database,Activity,LogOut,ArrowLeftRight} from "lucide-react";
import Dashboard from "./pages/Dashboard";
import ClusterMap from "./pages/ClusterMap";
import Farmers from "./pages/Farmers";
import AdminPortal from "./pages/AdminPortal";
import AdminUsers from "./pages/AdminUsers";
import AdminAudit from "./pages/AdminAudit";
import TeamLocation from "./pages/TeamLocation";
import DataManager from "./pages/DataManager";
import {AuthProvider,RequireAdmin,RequireAuth,useAuth} from "./auth";
import { api } from "./api";
import { supabase } from "./supabase";

const fieldLinks=[
 {to:"/",label:"Dashboard",icon:LayoutDashboard,end:true},
 {to:"/cluster-map",label:"Open Map",icon:Map},
 {to:"/farmers",label:"Farmers",icon:Users},
 {to:"/team-location",label:"Team Location",icon:MapPin},
];
const adminLinks=[
 {to:"/admin",label:"Overview",icon:LayoutDashboard,end:true},
 {to:"/admin/users",label:"Team",icon:Users},
 {to:"/admin/data",label:"Master Data",icon:Database},
 {to:"/admin/audit",label:"Activity",icon:Activity},
 {to:"/admin/team-location",label:"Team Location",icon:MapPin},
];

function CompletionRealtime(){
 const {profile}=useAuth();
 useEffect(()=>{
  if(!profile?.user_id || !supabase) return undefined;
  const channel=supabase
   .channel("polygon-completion-live")
   .on("postgres_changes",{event:"*",schema:"public",table:"completed_farmers"},(payload)=>{
    const record=payload?.new || {};
    const oldRecord=payload?.old || {};
    const bp=record.bp_number || oldRecord.bp_number;
    if(!bp) return;
    window.dispatchEvent(new CustomEvent("polygon-completion-updated",{detail:{
      eventType:payload.eventType,
      bp:String(bp),
      record,
      oldRecord
    }}));
   })
   .subscribe((status)=>{
    if(status === "CHANNEL_ERROR") console.warn("Live completion updates unavailable");
   });
  return()=>{ supabase.removeChannel(channel); };
 },[profile?.user_id]);
 return null;
}

function LocationTracker(){
 const {profile}=useAuth();
 const lastSent=React.useRef(0);
 const watchRef=React.useRef(null);

 useEffect(()=>{
  if(!profile?.user_id || !navigator.geolocation) return undefined;

  let alive=true;
  const options={enableHighAccuracy:true,maximumAge:10000,timeout:12000};

  const send=(position)=>{
   if(!alive) return;
   const coords=position?.coords;
   if(!coords) return;
   const latitude=Number(coords.latitude);
   const longitude=Number(coords.longitude);
   const accuracy=Number.isFinite(coords.accuracy)?Number(coords.accuracy):null;
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude)) return;

   const now=Date.now();
   const detail={latitude,longitude,accuracy,updatedAt:new Date(now).toISOString()};
   window.__polygonLatestLocation=detail;
   window.dispatchEvent(new CustomEvent("polygon-location-updated",{detail}));

   // Keep the database traffic low while still giving the team a live field
   // position whenever the authenticated app is actively open.
   if(!navigator.onLine || now-lastSent.current<15000) return;
   lastSent.current=now;
   api.updateTeamLocation({latitude,longitude,accuracy}).catch(()=>{});
  };

  const requestPosition=()=>{
   if(document.visibilityState!=="visible" || !navigator.onLine) return;
   navigator.geolocation.getCurrentPosition(send,()=>{},options);
  };

  navigator.geolocation.getCurrentPosition(send,()=>{},options);
  watchRef.current=navigator.geolocation.watchPosition(send,()=>{},options);

  const timer=window.setInterval(requestPosition,15000);
  const onVisible=()=>{if(document.visibilityState==="visible") requestPosition();};
  const onOnline=()=>requestPosition();
  document.addEventListener("visibilitychange",onVisible);
  window.addEventListener("online",onOnline);

  return()=>{
   alive=false;
   window.clearInterval(timer);
   document.removeEventListener("visibilitychange",onVisible);
   window.removeEventListener("online",onOnline);
   if(watchRef.current!=null) navigator.geolocation.clearWatch(watchRef.current);
   watchRef.current=null;
  };
 },[profile?.user_id]);

 return null;
}

function Shell(){
 const [open,setOpen]=useState(false);
 const [online,setOnline]=useState(navigator.onLine);
 const location=useLocation();
 const {profile,isAdmin,signOut}=useAuth();

 useEffect(()=>{
  const onOnline=()=>setOnline(true);
  const onOffline=()=>setOnline(false);
  window.addEventListener("online",onOnline);
  window.addEventListener("offline",onOffline);
  return()=>{window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline)};
 },[]);

 useEffect(()=>{
  if(profile?.user_id) import("./api").then(({api})=>api.primeOfflineData().catch(()=>{}));
 },[profile?.user_id]);
 useEffect(()=>{window.scrollTo({top:0,left:0,behavior:"auto"});setOpen(false)},[location.pathname]);
 const adminArea=location.pathname.startsWith("/admin");
 const links=adminArea?adminLinks:fieldLinks;
 return <div className="app">
  <LocationTracker/>
  <aside className={`sidebar ${open?"open":""}`}>
   <div className="brand"><div className="brand-mark">P</div><div><strong>Polygon Project</strong><span>{adminArea?"Admin Control":"Madikeri Operations"}</span></div><button className="mobile-close" onClick={()=>setOpen(false)}><X size={20}/></button></div>
   <nav>{links.map(({to,label,icon:Icon,end})=><NavLink key={to} to={to} end={end} className={({isActive})=>isActive?"nav-item active":"nav-item"}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
   {profile?.role === "admin" && (adminArea ? (
     <NavLink to="/" className="portal-switch"><ArrowLeftRight size={15}/><span>Enumerator Portal</span></NavLink>
   ) : (
     <NavLink to="/admin" className="portal-switch"><ArrowLeftRight size={15}/><span>Admin Portal</span></NavLink>
   ))}
   {adminArea&&<div className="admin-nav-note"><ShieldCheck size={15}/><span>Administrator</span></div>}
   <div className="sidebar-footer"><div className="live-dot"/><span>{profile?.full_name||profile?.email||"Signed in"}</span><button className="logout-btn" title="Sign out" onClick={signOut}><LogOut size={15}/></button></div>
  </aside>
  {open&&<div className="scrim" onClick={()=>setOpen(false)}/>}
  <section className="main">
   <header className="topbar"><button className="mobile-menu" onClick={()=>setOpen(true)}><Menu size={21}/></button><div className="topbar-title">Polygon Project : Madikeri</div><div className="topbar-right"><span className="role-badge">{profile?.role||"user"}</span><span className={`online ${online?"":"offline"}`}><i/> {online ? "Connected" : "Offline · saved data"}</span></div></header>
   <Routes>
    <Route path="/" element={<Dashboard/>}/>
    <Route path="/cluster-map" element={<ClusterMap/>}/>
    <Route path="/farmers" element={<Farmers/>}/>
    <Route path="/team-location" element={<TeamLocation/>}/>
    <Route path="/admin" element={<RequireAdmin><AdminPortal/></RequireAdmin>}/>
    <Route path="/admin/users" element={<RequireAdmin><AdminUsers/></RequireAdmin>}/>
    <Route path="/admin/audit" element={<RequireAdmin><AdminAudit/></RequireAdmin>}/>
    <Route path="/admin/team-location" element={<RequireAdmin><TeamLocation/></RequireAdmin>}/>
    <Route path="/admin/data" element={<RequireAdmin><DataManager/></RequireAdmin>}/>
    <Route path="/data" element={<RequireAdmin><DataManager/></RequireAdmin>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
   </Routes>
  </section>
 </div>;
}
export default function App(){return <AuthProvider><RequireAuth><Shell/></RequireAuth></AuthProvider>}

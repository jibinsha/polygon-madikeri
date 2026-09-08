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

const fieldLinks=[
 {to:"/",label:"Dashboard",icon:LayoutDashboard,end:true},
 {to:"/cluster-map",label:"Cluster Map",icon:Map},
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

function Shell(){
 const [open,setOpen]=useState(false);
 const location=useLocation();
 const {profile,isAdmin,signOut}=useAuth();
 useEffect(()=>{window.scrollTo({top:0,left:0,behavior:"auto"});setOpen(false)},[location.pathname]);
 const adminArea=location.pathname.startsWith("/admin");
 const links=adminArea?adminLinks:fieldLinks;
 return <div className="app">
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
   <header className="topbar"><button className="mobile-menu" onClick={()=>setOpen(true)}><Menu size={21}/></button><div className="topbar-title">Polygon Project : Madikeri</div><div className="topbar-right"><span className="role-badge">{profile?.role||"user"}</span><span className="online"><i/> Connected</span></div></header>
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

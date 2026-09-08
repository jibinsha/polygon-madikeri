import React,{useEffect,useState} from "react";
import {Activity,CheckCircle2,Clock3,Database,MapPin,RefreshCw,Users,Download} from "lucide-react";
import {Link} from "react-router-dom";
import {api} from "../api";
import {PageHead,Loading,ErrorCard,pct} from "../components";
function ago(iso){if(!iso)return "Never";const d=Date.now()-new Date(iso).getTime();if(d<60000)return "Just now";if(d<3600000)return `${Math.floor(d/60000)} min ago`;if(d<86400000)return `${Math.floor(d/3600000)} hr ago`;return new Date(iso).toLocaleString();}
export default function AdminPortal(){
 const [data,setData]=useState(null),[error,setError]=useState(""),[reporting,setReporting]=useState(false);
 const load=()=>{setError("");api.adminOverview().then(setData).catch(e=>setError(e.message));};
 useEffect(()=>{load();const t=setInterval(load,30000);return()=>clearInterval(t)},[]);
 if(error)return <div className="page"><ErrorCard message={error} onRetry={load}/></div>;
 if(!data)return <div className="page"><Loading/></div>;
 const downloadReport=async()=>{setReporting(true);setError("");try{await api.downloadReport()}catch(e){setError(e.message||"Could not download report")}finally{setReporting(false)}};
 const enums=(data.users||[]).filter(u=>u.role!=="admin");
 const online=enums.filter(u=>u.is_active&&u.last_seen_at&&Date.now()-new Date(u.last_seen_at).getTime()<10*60*1000).length;
 return <div className="page">
  <PageHead eyebrow="ADMIN CONTROL" title="Overview" description="One place to monitor field progress, team activity and master data." actions={<div className="head-actions-row"><button className="secondary-btn report-btn" onClick={downloadReport} disabled={reporting}><Download size={15}/>{reporting?"Preparing…":"Download Report"}</button><button className="icon-btn" onClick={load} title="Refresh"><RefreshCw size={16}/></button></div>}/>
  <div className="admin-grid">
   <div className="admin-stat"><div><Users size={18}/></div><span>Enumerators</span><b>{enums.length}</b></div>
   <div className="admin-stat"><div><Activity size={18}/></div><span>Active now</span><b>{online}</b></div>
   <div className="admin-stat"><div><Database size={18}/></div><span>Farmers</span><b>{data.allTotal||0}</b></div>
   <div className="admin-stat"><div><CheckCircle2 size={18}/></div><span>Completed</span><b>{data.totals.completed||0}</b></div>
  </div>
  <div className="card admin-progress-card"><div className="card-head"><div><h2>Project progress</h2><p>Overall farmer visit completion.</p></div><strong className="big-percent">{data.totals.progress||0}%</strong></div><div className="big-progress"><div style={{width:`${pct(data.totals.progress)}%`}}/></div><div className="admin-progress-lines"><span><b>{data.totals.completed}</b> completed</span><span><b>{data.totals.pending}</b> pending</span><span><b>{data.totals.clusters}</b> clusters</span></div></div>
  <div className="admin-actions">
   <Link className="quick-tile" to="/admin/users"><Users size={19}/><div><b>Team</b><span>Create accounts, assign teams and control access.</span></div></Link>
   <Link className="quick-tile" to="/admin/data"><Database size={19}/><div><b>Master Data</b><span>Import or update the farmer and cluster master data.</span></div></Link>
   <Link className="quick-tile" to="/admin/audit"><Activity size={19}/><div><b>Activity</b><span>See logins and field/data changes.</span></div></Link>
   <Link className="quick-tile" to="/admin/team-location"><MapPin size={19}/><div><b>Team Location</b><span>See the latest shared field locations.</span></div></Link>
  </div>
  <div className="card"><div className="card-head"><div><h2>Enumerator status</h2><p>Latest app activity.</p></div></div><div className="admin-users-mini">{enums.map(u=>{const active=u.is_active&&u.last_seen_at&&Date.now()-new Date(u.last_seen_at).getTime()<10*60*1000;return <div className="admin-user-row" key={u.id}><i className={active?"live-dot":"offline-dot"}/><div><b>{u.full_name||u.email}</b><span>{u.team||"Team not assigned"} · {u.is_active?"Enabled":"Disabled"}</span></div><strong>{ago(u.last_seen_at)}</strong></div>})}{!enums.length&&<div className="empty">No enumerators created yet.</div>}</div></div>
  <div className="card"><div className="card-head"><div><h2>Recent activity</h2><p>Latest important actions.</p></div><Link className="small-link" to="/admin/audit">View all</Link></div><div className="audit-mini">{(data.audit||[]).slice(0,10).map(a=><div className="audit-row" key={a.id}><div className="audit-icon"><Activity size={14}/></div><div><b>{a.user_name||a.user_email}</b><span>{a.action.replaceAll("_"," ")} {a.entity_id?`· ${a.entity_id}`:""}</span></div><time>{ago(a.created_at)}</time></div>)}</div></div>
 </div>
}

import React,{useEffect,useState} from "react";
import {UserPlus,Power,RefreshCw} from "lucide-react";
import {api} from "../api";
import {PageHead,Loading,ErrorCard} from "../components";
export default function AdminUsers(){
 const [users,setUsers]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[form,setForm]=useState({email:"",full_name:"",team:"",password:""}),[busy,setBusy]=useState(false);
 const load=()=>{setLoading(true);setError("");api.adminUsers().then(r=>setUsers(r.users||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false));}; useEffect(load,[]);
 const create=async e=>{e.preventDefault();setBusy(true);setError("");try{await api.adminCreateUser({...form,role:"enumerator"});setForm({email:"",full_name:"",team:"",password:""});load()}catch(e){setError(e.message)}finally{setBusy(false)}};
 const toggle=async u=>{setError("");try{await api.adminUpdateUser(u.id,{is_active:!u.is_active});load()}catch(e){setError(e.message)}};
 if(loading&&!users.length)return <div className="page"><Loading/></div>;
 return <div className="page"><PageHead eyebrow="ADMIN · TEAM" title="Team" description="Create enumerator accounts, assign teams and control access." actions={<button className="icon-btn" onClick={load}><RefreshCw size={16}/></button>}/>
 {error&&<ErrorCard message={error} onRetry={load}/>}
 <div className="card admin-create"><div className="card-head"><div><h2>Add enumerator</h2><p>The password is stored securely by Supabase Auth.</p></div></div><form className="user-form" onSubmit={create}><input placeholder="Full name" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} required/><input placeholder="Team (e.g. Team 1)" value={form.team} onChange={e=>setForm({...form,team:e.target.value})}/><input type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/><input type="password" minLength="8" placeholder="Temporary password (8+)" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/><button className="primary-btn" disabled={busy}><UserPlus size={15}/>{busy?"Creating…":"Create enumerator"}</button></form></div>
 <div className="card"><div className="card-head"><div><h2>Project team</h2><p>Enable or disable access and see the latest login.</p></div></div><div className="admin-table">{users.map(u=><div className="admin-table-row" key={u.id}><div><b>{u.full_name||"Unnamed"}</b><span>{u.email}</span></div><strong>{u.team||"No team"}</strong><span className={u.is_active?"status-pill active":"status-pill disabled"}>{u.is_active?"Enabled":"Disabled"}</span><span>{u.last_login_at?new Date(u.last_login_at).toLocaleString():"Never logged in"}</span><button className={u.is_active?"danger-btn":"secondary-btn"} onClick={()=>toggle(u)}><Power size={14}/>{u.is_active?"Disable":"Enable"}</button></div>)}</div></div>
 </div>
}

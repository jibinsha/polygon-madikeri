import React,{useEffect,useMemo,useState} from "react";
import {Check,ChevronLeft,ChevronRight,MapPin,RefreshCw} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {api} from "../api";
import {FilterBar,PageHead,Loading,ErrorCard,Empty} from "../components";
const blank={q:"",trader:"",team:"",day:"",cluster:"",route_group:"",visit_date:"",status:"Pending"};
export default function Planner(){
 const [filters,setFilters]=useState(blank),[data,setData]=useState({farmers:[],options:{}}),[error,setError]=useState(""),[loading,setLoading]=useState(true),[done,setDone]=useState(null);
 const navigate=useNavigate(); const set=(k,v)=>setFilters(x=>({...x,[k]:v}));
 const load=()=>{setLoading(true);api.farmers(filters).then(setData).catch(e=>setError(e.message)).finally(()=>setLoading(false))};
 useEffect(()=>{const t=setTimeout(load,120);return()=>clearTimeout(t)},Object.values(filters));
 const pending=data.farmers.filter(f=>f.status!=="Completed");
 const days=useMemo(()=>data.options.days||[],[data.options]);
 const currentDay=filters.day||days[0]||"";
 useEffect(()=>{if(!filters.day&&days.length)set("day",days[0])},[days.length]);
 const mark=async f=>{try{await api.setCompleted(f.bp,true,`Completed from Field Planner${f.remarks?` · ${f.remarks}`:""}`);setDone(f.bp);load();setTimeout(()=>setDone(null),900)}catch(e){setError(e.message)}};
 return <div className="page"><PageHead eyebrow="FIELD EXECUTION" title="Field Planner" description="Work through pending visits in day, team, trader and cluster order." actions={<button className="icon-btn" onClick={load}><RefreshCw size={17}/></button>}/>
 <FilterBar filters={filters} set={set} options={data.options} includeStatus={false}/>
 <div className="planner-strip"><div><b>Day {currentDay||"—"}</b><span>{pending.length} pending visits</span></div><div className="day-pager"><button disabled={!days.length} onClick={()=>{const i=days.indexOf(currentDay);if(i>0)set("day",days[i-1])}}><ChevronLeft size={17}/></button><span>{currentDay?`${days.indexOf(currentDay)+1} / ${days.length}`:"All days"}</span><button disabled={!days.length} onClick={()=>{const i=days.indexOf(currentDay);if(i<days.length-1)set("day",days[i+1])}}><ChevronRight size={17}/></button></div></div>
 {error&&<ErrorCard message={error}/>}
 <div className="planner-list">{pending.map((f,i)=><div className="visit-card" key={f.bp}><div className="visit-index">{i+1}</div><div className="visit-main"><div className="visit-top"><h2>{f.name||"Unnamed farmer"}</h2><span className="trader-chip">{f.trader||"—"}</span></div><code>{f.bp}</code><div className="visit-meta"><span>Cluster {f.cluster||"—"}</span><span>{f.team||"—"}</span><span>{f.employee||"—"}</span><span>Day {f.day||"—"}</span><span>{f.village||"—"}</span><span>{f.phone||"No phone"}</span></div></div><div className="visit-actions">{f.lat!==null&&f.lon!==null&&<button className="secondary-btn" onClick={()=>navigate(`/cluster-map?cluster=${encodeURIComponent(f.cluster||"")}`)}><MapPin size={14}/> Map</button>}<button className="primary-btn" disabled={done===f.bp} onClick={()=>mark(f)}><Check size={15}/>{done===f.bp?"Done":"Complete"}</button></div></div>)}{!loading&&!pending.length&&<Empty text="No pending visits match the current filters."/>}{loading&&<Loading/>}</div>
 </div>
}

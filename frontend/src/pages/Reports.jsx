import React,{useEffect,useState} from "react";
import {Download,RefreshCw} from "lucide-react";
import {api} from "../api";
import {FilterBar,PageHead,Loading,ErrorCard,pct} from "../components";
const blank={q:"",trader:"",team:"",day:"",cluster:"",route_group:"",visit_date:"",status:""};
export default function Reports(){
 const [filters,setFilters]=useState(blank),[data,setData]=useState(null),[error,setError]=useState("");
 const set=(k,v)=>setFilters(x=>({...x,[k]:v}));
 const load=()=>api.dashboard(filters).then(setData).catch(e=>setError(e.message));
 useEffect(()=>{const t=setTimeout(load,120);return()=>clearTimeout(t)},Object.values(filters));
 const exportFile=async()=>{try{await api.downloadCsv(filters)}catch(e){setError(e.message)}};
 if(error)return <div className="page"><ErrorCard message={error} onRetry={load}/></div>;
 if(!data)return <div className="page"><Loading/></div>;
 return <div className="page"><PageHead eyebrow="REPORTING" title="Reports & Export" description="Use the same filters as the dashboard, then export the matching farmer records." actions={<div className="head-actions-row"><button className="secondary-btn" onClick={exportFile}><Download size={15}/> Export filtered CSV</button><button className="icon-btn" onClick={load}><RefreshCw size={17}/></button></div>}/>
 <FilterBar filters={filters} set={set} options={data.options}/>
 <div className="report-kpis"><div><span>Farmers</span><b>{data.totals.farmers}</b></div><div><span>Completed</span><b>{data.totals.completed}</b></div><div><span>Pending</span><b>{data.totals.pending}</b></div><div><span>Progress</span><b>{data.totals.progress}%</b></div><div><span>Clusters</span><b>{data.totals.clusters}</b></div></div>
 <div className="two-col"><div className="card"><div className="card-head"><div><h2>Trader report</h2><p>Completed / assigned by trader.</p></div></div><div className="list">{data.traders.map(t=><div className="progress-row" key={t.trader}><div className="row-title"><b>{t.trader}</b><span>{t.completed}/{t.total}</span></div><div className="small-progress"><div style={{width:`${pct(t.progress)}%`}}/></div><div className="row-meta"><span>{t.progress}%</span><span>{t.pending} pending</span></div></div>)}</div></div><div className="card"><div className="card-head"><div><h2>Cluster report</h2><p>Assignment completion by cluster.</p></div></div><div className="list">{data.clusters.map(c=><div className="progress-row" key={c.cluster}><div className="row-title"><b>Cluster {c.cluster}</b><span>{c.completed}/{c.total}</span></div><div className="small-progress"><div style={{width:`${pct(c.progress)}%`,background:c.color}}/></div><div className="row-meta"><span>{c.progress}%</span><span>{c.teams.join(", ")}</span></div></div>)}</div></div></div>
 </div>
}

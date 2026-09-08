import React,{useEffect,useState} from "react";
import {ArrowRight,RefreshCw,Users} from "lucide-react";
import {Link} from "react-router-dom";
import {api} from "../api";
import {PageHead,Loading,ErrorCard,pct} from "../components";
export default function Traders(){
 const [data,setData]=useState(null),[error,setError]=useState("");
 const load=()=>api.dashboard().then(setData).catch(e=>setError(e.message));
 useEffect(()=>{load()},[]);
 if(error)return <div className="page"><ErrorCard message={error} onRetry={load}/></div>;
 if(!data)return <div className="page"><Loading/></div>;
 return <div className="page">
  <PageHead eyebrow="PERFORMANCE" title="Trader Performance" description="Trader / VC is extracted automatically from the third section of the BP identifier." actions={<button className="icon-btn" onClick={load}><RefreshCw size={17}/></button>}/>
  <div className="info-banner"><b>Example:</b> IN4C5-BP1000-VC1000 → <strong>Trader VC</strong>. This value is derived automatically; no manual trader field is required.</div>
  <div className="trader-grid">{data.traders.map(t=><div className="trader-card" key={t.trader}><div className="trader-card-head"><div className="trader-avatar"><Users size={19}/></div><div><h2>{t.trader}</h2><span>{t.total} assigned farmers</span></div><strong>{t.progress}%</strong></div><div className="big-progress"><div style={{width:`${pct(t.progress)}%`}}/></div><div className="trader-stats"><span><b>{t.completed}</b> Completed</span><span><b>{t.pending}</b> Pending</span><span><b>{t.clusters.length}</b> Clusters</span></div><div className="trader-clusters">{t.clusters.slice(0,8).map(c=><span key={c}>Cluster {c}</span>)}</div><Link className="view-all" to={`/farmers?trader=${encodeURIComponent(t.trader)}`}>Open trader farmers <ArrowRight size={14}/></Link></div>)}</div>
  <div className="card team-performance"><div className="card-head"><div><h2>Team Performance</h2><p>Team-level completion and assignment hierarchy.</p></div></div><div className="team-grid">{(data.teams||[]).map(t=><Link className="team-row" key={t.team} to={`/farmers?team=${encodeURIComponent(t.team)}`}><div><b>{t.team}</b><span>{t.traders.join(", ")||"No trader"} · {t.employees.length} employee(s)</span></div><strong>{t.progress}%</strong><div className="small-progress"><div style={{width:`${pct(t.progress)}%`}}/></div></Link>)}</div></div>
 </div>
}

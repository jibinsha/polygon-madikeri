import React from "react";
import {Search,X,RefreshCw} from "lucide-react";

export function Select({label,value,options,onChange,allLabel}){
 return <select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>
  <option value="">{allLabel||`All ${label}s`}</option>
  {(options||[]).map(x=><option key={x} value={x}>{label==="Cluster"?`Cluster ${x}`:label==="Day"?`Day ${x}`:x}</option>)}
 </select>
}
export function SearchBox({value,onChange,placeholder="Search…"}){
 return <div className="search-input"><Search size={17}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>{value&&<button aria-label="Clear search" onClick={()=>onChange("")}><X size={15}/></button>}</div>
}
export function FilterBar({filters,set,options,includeStatus=true,includeRoute=true,includeDate=true}){
 return <div className="filter-card">
  <SearchBox value={filters.q||""} onChange={v=>set("q",v)} placeholder="Search BP, farmer, village, estate…"/>
  <Select label="Trader" value={filters.trader||""} options={options?.traders} onChange={v=>set("trader",v)}/>
  <Select label="Team" value={filters.team||""} options={options?.teams} onChange={v=>set("team",v)}/>
  <Select label="Day" value={filters.day||""} options={options?.days} onChange={v=>set("day",v)}/>
  <Select label="Cluster" value={filters.cluster||""} options={options?.clusters} onChange={v=>set("cluster",v)}/>
  {includeRoute&&<Select label="Route Group" value={filters.route_group||""} options={options?.routes} onChange={v=>set("route_group",v)}/>}
  {includeDate&&<Select label="Visit Date" value={filters.visit_date||""} options={options?.dates} onChange={v=>set("visit_date",v)}/>}
  {includeStatus&&<Select label="Status" value={filters.status||""} options={["Completed","Pending"]} onChange={v=>set("status",v)}/>}
 </div>
}
export function PageHead({eyebrow,title,description,actions}){
 return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div><div className="head-actions">{actions}</div></div>
}
export function Loading(){return <div className="loading-card">Loading live data…</div>}
export function ErrorCard({message,onRetry}){return <div className="error-card">{message}{onRetry&&<button onClick={onRetry}>Retry</button>}</div>}
export function Empty({text="No data available."}){return <div className="empty">{text}</div>}
export function RefreshButton({onClick}){return <button className="icon-btn" onClick={onClick} title="Refresh"><RefreshCw size={17}/></button>}
export function pct(v){return Math.max(0,Math.min(100,Number(v)||0))}

import React,{useState} from "react";
import {Database,Trash2,Upload,FileSpreadsheet,RefreshCw} from "lucide-react";
import {api} from "../api";
import {PageHead} from "../components";

export default function DataManager(){
 const [status,setStatus]=useState(""),[busy,setBusy]=useState(false);
 const uploadFarmer=async e=>{const f=e.target.files?.[0];if(!f)return;setBusy(true);setStatus("");try{const r=await api.importCsv(f);setStatus(`Successfully imported ${r.imported} farmer records. Existing BP numbers were updated and the master dataset remains in the database.`)}catch(err){setStatus(err.message)}finally{setBusy(false);e.target.value=""}};
 const uploadCluster=async e=>{const f=e.target.files?.[0];if(!f)return;setBusy(true);setStatus("");try{const r=await api.importClusterHtml(f);setStatus(`Imported ${r.imported} cluster map points successfully.`)}catch(err){setStatus(err.message)}finally{setBusy(false);e.target.value=""}};
 const clear=async()=>{if(!confirm("Remove the imported Cluster_Map.html points from the database? This cannot be undone."))return;setBusy(true);try{await api.clearClusterHtml();setStatus("Cluster map points cleared.")}catch(e){setStatus(e.message)}finally{setBusy(false)}};
 return <div className="page"><PageHead eyebrow="ADMIN · DATA CONTROL" title="Master Data Manager" description="Only administrators can change the master farmer and cluster datasets." actions={<RefreshCw size={18}/>}/>
 <div className="admin-warning"><b>Master dataset protection</b><span>Enumerators cannot import, replace or delete master data. Imported records remain in Supabase until an administrator changes them.</span></div>
 <div className="data-grid">
  <div className="data-card"><div className="data-icon"><FileSpreadsheet size={21}/></div><h2>Farmer master dataset</h2><p>Import the Excel-exported CSV using your real columns such as <b>Bp Number</b>, <b>Farmer Name</b>, <b>Lat</b>, <b>Long</b>, <b>Cluster</b>, <b>Day</b>, <b>Team</b> and <b>phone number</b>. Trader/VC is extracted automatically from BP.</p><div className="code-box">Bp Number,Farmer Name,phone number,Cluster,Day,Team,Lat,Long</div><label className="primary-btn file-btn"><Upload size={15}/>{busy?"Processing…":"Import Farmer CSV"}<input type="file" accept=".csv,text/csv" onChange={uploadFarmer}/></label><div className="data-note">Import uses BP Number as the unique key. Re-importing an updated file updates existing BP records and adds new ones; it does not erase records unless an administrator deliberately removes them.</div></div>
  <div className="data-card"><div className="data-icon"><Database size={21}/></div><h2>Cluster map source</h2><p>Upload the exact <b>Cluster_Map.html</b>. The app reads Folium circle markers and stores Cluster, Team, Day and GPS as live map points.</p><label className="primary-btn file-btn"><Upload size={15}/>{busy?"Processing…":"Import Cluster_Map.html"}<input type="file" accept=".html,text/html" onChange={uploadCluster}/></label><button className="danger-btn" onClick={clear} disabled={busy}><Trash2 size={15}/> Clear imported map points</button></div>
 </div>
 {status&&<div className={`info-banner ${/success|imported/i.test(status)?"success":""}`}>{status}</div>}
 <div className="info-banner"><b>Office/Base:</b> approximately <code>13.137, 75.606</code>. This remains visible on the cluster map.</div>
 </div>
}

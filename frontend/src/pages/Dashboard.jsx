import React, { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Layers, RefreshCw, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { PageHead, Loading, ErrorCard, pct } from "../components";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    api.dashboard()
      .then(setData)
      .catch((e) => setError(e.message || "Unable to load dashboard"));
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  if (error) {
    return <div className="page"><ErrorCard message={error} onRetry={load} /></div>;
  }

  if (!data) {
    return <div className="page"><Loading /></div>;
  }

  const traders = data.traders || [];
  const total = data.totals?.farmers ?? data.allTotal ?? 0;
  const completed = data.totals?.completed ?? 0;
  const pending = data.totals?.pending ?? Math.max(total - completed, 0);
  const progress = Number(data.totals?.progress ?? 0);

  const traderColors = ["#2f7d5b", "#3578a5", "#8050a6", "#c45c16", "#7b6b36", "#a33d5d"];

  return (
    <div className="page dashboard-page">
      <PageHead
        eyebrow="FIELD OPERATIONS"
        title="Dashboard"
        description="Completion progress at a glance."
        actions={
          <button className="icon-btn" onClick={load} title="Refresh">
            <RefreshCw size={16} />
          </button>
        }
      />

      <div className="admin-grid field-stats">
        <div className="admin-stat">
          <div><Users size={18} /></div>
          <span>Farmers</span>
          <b>{total}</b>
        </div>
        <div className="admin-stat">
          <div><CheckCircle2 size={18} /></div>
          <span>Completed</span>
          <b>{completed}</b>
        </div>
        <div className="admin-stat">
          <div><Clock3 size={18} /></div>
          <span>Pending</span>
          <b>{pending}</b>
        </div>
        <div className="admin-stat">
          <div><Layers size={18} /></div>
          <span>Traders / VC</span>
          <b>{traders.length}</b>
        </div>
      </div>

      <div className="card admin-progress-card">
        <div className="card-head">
          <div>
            <h2>Overall completion</h2>
            <p>Completed farmer visits across the project.</p>
          </div>
          <strong className="big-percent">{progress}%</strong>
        </div>
        <div className="big-progress">
          <div style={{ width: `${pct(progress)}%` }} />
        </div>
        <div className="dashboard-completion-meta">
          <span><b>{completed}</b> completed</span>
          <span><b>{pending}</b> pending</span>
          <span><b>{total}</b> total</span>
        </div>
      </div>

      <div className="card trader-progress-card">
        <div className="card-head">
          <div>
            <h2>Trader-wise completion</h2>
            <p>Completion grouped by Trader / VC from the BP number.</p>
          </div>
        </div>

        <div className="trader-progress-list">
          {traders.map((t, i) => {
            const color = traderColors[i % traderColors.length];
            return (
              <Link
                key={t.trader}
                className="trader-progress-row"
                to={`/farmers?trader=${encodeURIComponent(t.trader)}`}
              >
                <div className="trader-progress-top">
                  <div className="trader-name">
                    <i style={{ background: color }} />
                    <b>{t.trader}</b>
                  </div>
                  <span>
                    <b>{t.completed}</b> / {t.total} · <strong>{t.progress}%</strong>
                  </span>
                </div>
                <div className="small-progress">
                  <div style={{ width: `${pct(t.progress)}%`, background: color }} />
                </div>
                <div className="trader-progress-meta">
                  <span>{t.completed} completed · {t.pending} pending</span>
                  <span>{t.teams?.join(", ") || "Team"}</span>
                </div>
              </Link>
            );
          })}
          {!traders.length && <div className="empty">No trader data available.</div>}
        </div>
      </div>
    </div>
  );
}

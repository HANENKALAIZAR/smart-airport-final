import { useState } from "react";
import {
  Plane, TrendingUp, Target, BrainCircuit, Settings as SettingsIcon, Globe,
  Cloud, CloudRain, Wind, Sun, AlertTriangle, CheckCircle2, Sparkles, Save,
  Building2, Search, Plus, Filter, Activity, BarChart3, Calendar,
  User, Bell, ShieldCheck, Plug, Palette, Globe2, Database, KeyRound, Mail,
} from "lucide-react";

/* ─────────── Flights ─────────── */
export function FlightsPage() {
  const [tab, setTab] = useState("departures");
  const flights = [
    { num: "TU721", dest: "Paris CDG", time: "14:25", gate: "B07", status: "Delayed", risk: "high" },
    { num: "TU302", dest: "Rome FCO", time: "15:10", gate: "A12", status: "On-Time", risk: "low" },
    { num: "AF1234", dest: "Tunis TUN", time: "15:45", gate: "C03", status: "Boarding", risk: "low" },
    { num: "LH490", dest: "Frankfurt FRA", time: "16:30", gate: "B14", status: "Delayed", risk: "medium" },
    { num: "TU505", dest: "London LHR", time: "17:00", gate: "A05", status: "Scheduled", risk: "low" },
    { num: "IB3456", dest: "Madrid MAD", time: "13:55", gate: "C09", status: "Landed", risk: "low" },
    { num: "TU801", dest: "Düsseldorf DUS", time: "18:15", gate: "B02", status: "Cancelled", risk: "high" },
  ];
  const STATUS_CLASS: Record<string, string> = {
    "On-Time": "admin-table__status--on-time", "Delayed": "admin-table__status--delayed",
    "Boarding": "admin-table__status--boarding", "Departed": "admin-table__status--departed",
    "Landed": "admin-table__status--departed", "Cancelled": "admin-table__status--cancelled",
  };
  return (
    <>
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title" style={{ display: "flex", alignItems: "center", gap: 10 }}><Plane size={22} style={{ color: "var(--adm-accent)" }} /> Flights</h1>
          <p className="admin-page__subtitle">All scheduled, active, and historical movements at TUN.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="admin-btn admin-btn--outline"><Filter size={15} /><span>Filters</span></button>
          <button className="admin-btn admin-btn--primary"><Plus size={15} /><span>Add flight</span></button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,0.03)", border: "1px solid var(--adm-border)", borderRadius: 12, width: "fit-content", marginBottom: "1.25rem" }}>
        {[{ k: "departures", l: "Departures" }, { k: "arrivals", l: "Arrivals" }, { k: "all", l: "All" }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding: "0.5rem 1.1rem", borderRadius: 8, border: "none",
              background: tab === t.k ? "linear-gradient(135deg, #F59E0B, #FBBF24)" : "transparent",
              color: tab === t.k ? "#0A1628" : "var(--adm-text-sub)",
              fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", transition: "all 180ms" }}>
            {t.l}
          </button>
        ))}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Flight</th><th>Destination</th><th>Time</th><th>Gate</th><th>Risk</th><th>Status</th></tr></thead>
          <tbody>
            {flights.map(f => (
              <tr key={f.num}>
                <td style={{ fontWeight: 600 }}>{f.num}</td>
                <td>{f.dest}</td>
                <td>{f.time}</td>
                <td className="admin-table__muted">{f.gate}</td>
                <td><span className={`aviation-badge aviation-badge--${f.risk}`}>{f.risk.toUpperCase()}</span></td>
                <td><span className={STATUS_CLASS[f.status] || ""}>{f.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─────────── Analytics ─────────── */
export function AnalyticsPage() {
  const bars = [62, 78, 84, 71, 89, 92, 76, 82, 88, 79, 85, 91];
  const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
  const max = Math.max(...bars);
  return (
    <>
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title" style={{ display: "flex", alignItems: "center", gap: 10 }}><TrendingUp size={22} style={{ color: "var(--adm-accent)" }} /> Analytics</h1>
          <p className="admin-page__subtitle">12-month performance, delay patterns, and seasonal trends.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="admin-btn admin-btn--outline"><Calendar size={15} /><span>Last 12 months</span></button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { l: "Total flights", v: "29,142", t: "+8%", color: "var(--adm-accent)" },
          { l: "Avg on-time", v: "82.7%", t: "+1.2pp", color: "#34D399" },
          { l: "Avg delay", v: "13.4 min", t: "−2 min", color: "#34D399" },
          { l: "Cancellations", v: "1.8%", t: "−0.4pp", color: "#34D399" },
        ].map(s => (
          <div key={s.l} className="admin-stat-card">
            <div className="admin-stat-card__label">{s.l}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div className="admin-stat-card__value" style={{ color: s.color }}>{s.v}</div>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#34D399" }}>{s.t}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-card" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 2 }}>On-time rate by month</h3>
            <p style={{ fontSize: "0.78rem", color: "var(--adm-text-muted)" }}>Rolling 12-month window</p>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: "0.78rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--adm-text-sub)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "linear-gradient(180deg, #FBBF24, #F59E0B)" }} /> On-time %
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 220, padding: "0 4px" }}>
          {bars.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: "0.7rem", color: "var(--adm-text-muted)", fontWeight: 600 }}>{v}%</div>
              <div style={{
                width: "100%", height: `${(v / max) * 170}px`,
                background: "linear-gradient(180deg, #FBBF24, #F59E0B)",
                borderRadius: "6px 6px 2px 2px",
                boxShadow: "0 -2px 8px rgba(245,158,11,0.3)",
                transition: "all 200ms",
              }} />
              <div style={{ fontSize: "0.72rem", color: "var(--adm-text-muted)" }}>{months[i]}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="admin-card" style={{ padding: "1.5rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: "1rem" }}>Top delay causes</h3>
          {[
            { l: "Weather", v: 38, c: "#60A5FA" },
            { l: "Late arriving aircraft", v: 24, c: "#F59E0B" },
            { l: "Air traffic control", v: 18, c: "#A78BFA" },
            { l: "Crew rotation", v: 12, c: "#34D399" },
            { l: "Other", v: 8, c: "#94A3B8" },
          ].map(r => (
            <div key={r.l} style={{ marginBottom: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.82rem" }}>
                <span style={{ color: "var(--adm-text-sub)" }}>{r.l}</span>
                <span style={{ color: "var(--adm-text)", fontWeight: 600 }}>{r.v}%</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${r.v * 2.3}%`, height: "100%", background: r.c, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="admin-card" style={{ padding: "1.5rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: "1rem" }}>Top airlines by volume</h3>
          {[
            { l: "Tunisair", v: "12,420 flights", p: 92 },
            { l: "Air France", v: "3,210 flights", p: 24 },
            { l: "Lufthansa", v: "2,890 flights", p: 22 },
            { l: "Iberia", v: "1,640 flights", p: 12 },
            { l: "Vueling", v: "1,420 flights", p: 11 },
          ].map(r => (
            <div key={r.l} style={{ marginBottom: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.82rem" }}>
                <span style={{ color: "var(--adm-text-sub)" }}>{r.l}</span>
                <span style={{ color: "var(--adm-text-muted)" }}>{r.v}</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${r.p}%`, height: "100%", background: "linear-gradient(90deg, #F59E0B, #FBBF24)", borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─────────── Predict Delay ─────────── */
export function PredictPage() {
  return (
    <>
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title" style={{ display: "flex", alignItems: "center", gap: 10 }}><Target size={22} style={{ color: "var(--adm-accent)" }} /> Predict Delay</h1>
          <p className="admin-page__subtitle">Run the ML model on a flight and inspect the contributing factors.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="admin-card" style={{ padding: "1.75rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: "1.25rem" }}>Flight inputs</h3>
          {[
            { l: "Flight number", v: "TU721" },
            { l: "Airline", v: "Tunisair" },
            { l: "Route", v: "TUN → CDG" },
            { l: "Scheduled departure", v: "Today, 14:25" },
            { l: "Aircraft type", v: "Airbus A320" },
            { l: "Weather (origin)", v: "Clear, 22°C, winds 8 kt" },
            { l: "Weather (destination)", v: "Cloudy, 14°C, winds 18 kt" },
          ].map(r => (
            <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "0.65rem 0", borderBottom: "1px solid var(--adm-border)", fontSize: "0.85rem" }}>
              <span style={{ color: "var(--adm-text-muted)" }}>{r.l}</span>
              <span style={{ color: "var(--adm-text)", fontWeight: 500 }}>{r.v}</span>
            </div>
          ))}
          <button className="admin-btn admin-btn--primary" style={{ width: "100%", marginTop: "1.25rem" }}>
            <Sparkles size={15} /><span>Run prediction</span>
          </button>
        </div>

        <div className="admin-card" style={{ padding: "1.75rem", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 80% 0%, rgba(245,158,11,0.08), transparent 50%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: "0.5rem" }}>Prediction result</h3>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "3.2rem", fontWeight: 800, color: "#F87171", letterSpacing: "-0.03em", lineHeight: 1 }}>42</span>
              <span style={{ fontSize: "1.1rem", color: "var(--adm-text-sub)" }}>min predicted delay</span>
            </div>
            <span className="aviation-badge aviation-badge--high" style={{ marginBottom: "1.25rem", display: "inline-flex" }}>HIGH RISK · 87% confidence</span>

            <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", marginTop: "1.5rem", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Top factors</h4>
            {[
              { l: "Destination weather (CDG winds)", v: 34, icon: <Wind size={14} /> },
              { l: "Late inbound aircraft", v: 28, icon: <Plane size={14} /> },
              { l: "ATC slot constraints CDG", v: 18, icon: <Activity size={14} /> },
              { l: "Crew rotation buffer", v: 12, icon: <CheckCircle2 size={14} /> },
            ].map(r => (
              <div key={r.l} style={{ marginBottom: "0.7rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, fontSize: "0.82rem" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--adm-text-sub)" }}>
                    <span style={{ color: "var(--adm-accent)" }}>{r.icon}</span>
                    {r.l}
                  </span>
                  <span style={{ color: "var(--adm-text)", fontWeight: 600 }}>{r.v}%</span>
                </div>
                <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${r.v * 2.5}%`, height: "100%", background: "linear-gradient(90deg, #F59E0B, #FBBF24)", borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────── AI Explanations / MLOps Dashboard ─────────── */

function SectionTitle({ icon: Icon, title, sub }: { icon: React.ComponentType<{ size?: number }>; title: string; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "0.9rem" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(251,191,36,0.06))", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--adm-accent)" }}>
        <Icon size={17} />
      </div>
      <div>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)", letterSpacing: "-0.01em" }}>{title}</h2>
        {sub && <div style={{ fontSize: "0.75rem", color: "var(--adm-text-muted)", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Sparkline({ data, color, height = 38, fill = true }: { data: number[]; color: string; height?: number; fill?: boolean }) {
  const w = 100, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / range) * (h - 6) - 3]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  const id = `sg-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.2" fill={color} />
    </svg>
  );
}

function RingGauge({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(1, Math.max(0, value / max));
  const r = 44, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 120, height: 120 }}>
      <svg viewBox="0 0 110 110" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
        <circle cx="55" cy="55" r={r} stroke="rgba(148,163,184,0.12)" strokeWidth="8" fill="none" />
        <circle cx="55" cy="55" r={r} stroke={color} strokeWidth="8" fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dashoffset 600ms" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "1.45rem", fontWeight: 800, color, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--adm-text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

function LivePulse({ color = "#34D399", label }: { color?: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 10px 4px 8px", borderRadius: 999, background: `${color}1f`, border: `1px solid ${color}55`, color, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.04em" }}>
      <span style={{ position: "relative", width: 7, height: 7 }}>
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, animation: "ai-pulse 1.6s ease-out infinite" }} />
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
      </span>
      {label}
    </span>
  );
}

export function AIExplanationsPage() {
  const activeModel = {
    version: "ae-v2-20260515-1314",
    trainedAt: "15/05/2026",
    mae: 18.33,
    r2: 0.0399,
    vsBaseline: 5.3,
    ageDays: 1,
    drift: "none" as const,
    totalPredictions: 0,
  };

  const maeTrend = [22.1, 21.4, 20.8, 19.9, 19.2, 18.7, 18.5, 18.33];
  const r2Trend  = [-0.05, -0.03, 0.00, 0.01, 0.02, 0.03, 0.035, 0.0399];
  const driftTrend = [0.02, 0.03, 0.02, 0.04, 0.03, 0.02, 0.03, 0.02];
  const healthScore = 86;

  const features = [
    { key: "dep_hour",        name: "Departure Hour",        desc: "Hour of scheduled departure (0–23).",            type: "Numeric", group: "Temporal",   imp: 0.82 },
    { key: "is_weekend",      name: "Weekend Flag",          desc: "1 if Saturday/Sunday, else 0.",                  type: "Boolean", group: "Temporal",   imp: 0.41 },
    { key: "distance_km",     name: "Route Distance",        desc: "Haversine distance between dep & arr airports.", type: "Numeric", group: "Geospatial", imp: 0.74 },
    { key: "duration_min",    name: "Flight Duration",       desc: "Scheduled flight duration in minutes.",          type: "Numeric", group: "Geospatial", imp: 0.67 },
    { key: "airline_enc",     name: "Airline Encoding",      desc: "Ordinal-encoded airline IATA code.",             type: "Encoded", group: "Categorical", imp: 0.58 },
    { key: "dep_airport_enc", name: "Dep Airport Encoding",  desc: "Ordinal-encoded departure IATA.",                type: "Encoded", group: "Categorical", imp: 0.49 },
    { key: "arr_airport_enc", name: "Arr Airport Encoding",  desc: "Ordinal-encoded arrival IATA.",                  type: "Encoded", group: "Categorical", imp: 0.53 },
  ];
  const GROUP_COLOR: Record<string, string> = { Temporal: "#FBBF24", Geospatial: "#60A5FA", Categorical: "#A78BFA" };

  const history = [
    { v: "ae-v2-20260515-1314", date: "15/05/2026", mae: 18.33, r2: 0.0399,  dataset: "—",   delta: 5.3,  status: "active"   },
    { v: "ae-v2-20260514-1805", date: "14/05/2026", mae: 16.74, r2: -0.0121, dataset: "—",   delta: -4.3, status: "archived" },
    { v: "ae-v2-20260514-1745", date: "14/05/2026", mae: 16.74, r2: -0.0121, dataset: "—",   delta: -4.3, status: "archived" },
    { v: "ae-v20260513-1825",   date: "14/05/2026", mae: 14.06, r2: -0.2627, dataset: "271", delta: 0.0,  status: "archived" },
  ];

  const pipeline = [
    { step: "01", title: "Data Ingestion",       desc: "ae_flight_dataset populated via Aviation Edge API.", icon: Database,     color: "#60A5FA", state: "done" },
    { step: "02", title: "Time-Based Split",     desc: "Chronological train/test split — no random shuffle.", icon: Calendar,    color: "#A78BFA", state: "done" },
    { step: "03", title: "XGBoost Regression",   desc: "StandardScaler + XGBRegressor on 7 features.",        icon: BrainCircuit, color: "#FBBF24", state: "active" },
    { step: "04", title: "Evaluation & Promote", desc: "MAE / RMSE / R². Promoted if beats baseline.",        icon: CheckCircle2, color: "#34D399", state: "queued" },
  ];

  return (
    <>
      <style>{`
        @keyframes ai-pulse { 0% { transform: scale(1); opacity: 0.6 } 70% { transform: scale(2.4); opacity: 0 } 100% { opacity: 0 } }
        @keyframes ai-shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        @keyframes ai-flow { 0% { stroke-dashoffset: 24 } 100% { stroke-dashoffset: 0 } }
      `}</style>

      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BrainCircuit size={22} style={{ color: "var(--adm-accent)" }} /> AI Model Intelligence
          </h1>
          <p className="admin-page__subtitle">delay_prediction_model.pkl · ae_model_versions · live MLOps telemetry</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <LivePulse label="MONITORING" />
          <button className="admin-btn admin-btn--outline"><Activity size={15} /><span>Refresh</span></button>
        </div>
      </div>

      {/* ───── HERO: Model Health ───── */}
      <div style={{
        position: "relative", overflow: "hidden", marginBottom: "1.5rem",
        padding: "1.6rem 1.8rem", borderRadius: 18,
        background: "linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(99,102,241,0.08) 45%, rgba(16,185,129,0.06) 100%), var(--adm-card-bg, rgba(15,23,42,0.6))",
        border: "1px solid var(--adm-border)",
        boxShadow: "0 24px 60px -30px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        <div style={{ position: "absolute", top: -120, right: -80, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.22), transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -140, left: -60, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.18), transparent 65%)", pointerEvents: "none" }} />
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)",
        }} />

        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "2rem", alignItems: "center" }}>
          <RingGauge value={healthScore} max={100} color="#34D399" label="HEALTH" />

          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.18em", color: "var(--adm-text-muted)", textTransform: "uppercase" }}>Production Model</span>
              <LivePulse color="#34D399" label="LIVE" />
              <span style={{ fontSize: "0.68rem", padding: "3px 9px", borderRadius: 999, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", color: "#34D399", fontWeight: 700, letterSpacing: "0.06em" }}>NO DRIFT</span>
              <span style={{ fontSize: "0.68rem", padding: "3px 9px", borderRadius: 999, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", color: "#60A5FA", fontWeight: 700, letterSpacing: "0.06em" }}>BEATS BASELINE</span>
            </div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: "1.6rem", fontWeight: 800, color: "var(--adm-text)", letterSpacing: "-0.02em", lineHeight: 1.15, wordBreak: "break-all" }}>
              {activeModel.version}
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--adm-text-sub)", marginTop: 6 }}>
              Trained {activeModel.trainedAt} · {activeModel.ageDays}d in production · XGBoost · 7 features
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
            {[
              { l: "MAE 7d", v: "↓ 14.5%", c: "#34D399" },
              { l: "Prediction load", v: "Idle", c: "var(--adm-text-sub)" },
              { l: "Last retrain", v: "1d ago",  c: "var(--adm-text)" },
            ].map(r => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: "0.78rem" }}>
                <span style={{ color: "var(--adm-text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, fontSize: "0.66rem" }}>{r.l}</span>
                <span style={{ color: r.c, fontWeight: 700 }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───── BENTO: featured + secondary metrics ───── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* MAE — featured (large) */}
        <div className="admin-card" style={{
          padding: "1.4rem 1.5rem", position: "relative", overflow: "hidden",
          background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.03) 60%, transparent)",
          border: "1px solid rgba(251,191,36,0.25)",
          boxShadow: "0 20px 50px -30px rgba(251,191,36,0.5)",
        }}>
          <div style={{ position: "absolute", top: -60, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(251,191,36,0.18), transparent 70%)" }} />
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.18em", color: "#FBBF24", textTransform: "uppercase" }}>Prediction Quality</div>
              <div style={{ fontSize: "0.78rem", color: "var(--adm-text-muted)", marginTop: 2 }}>Mean Absolute Error</div>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.35)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FBBF24" }}><TrendingUp size={17} /></div>
          </div>
          <div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 10, marginTop: 14 }}>
            <span style={{ fontSize: "3rem", fontWeight: 800, color: "#FBBF24", letterSpacing: "-0.04em", lineHeight: 1, textShadow: "0 0 24px rgba(251,191,36,0.35)" }}>{activeModel.mae}</span>
            <span style={{ fontSize: "1rem", color: "var(--adm-text-sub)", fontWeight: 600 }}>min</span>
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.78rem", color: "#34D399", fontWeight: 700 }}>↓ 14.5% <span style={{ color: "var(--adm-text-muted)", fontWeight: 500 }}>7d</span></span>
          </div>
          <div style={{ marginTop: 10 }}>
            <Sparkline data={maeTrend} color="#FBBF24" height={42} />
          </div>
        </div>

        {/* R² */}
        <div className="admin-card" style={{ padding: "1.3rem 1.4rem", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, rgba(99,102,241,0.12), transparent 70%)", border: "1px solid rgba(99,102,241,0.25)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.18em", color: "#A5B4FC", textTransform: "uppercase" }}>R² Score</div>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", display: "flex", alignItems: "center", justifyContent: "center", color: "#A5B4FC" }}><Target size={15} /></div>
          </div>
          <div style={{ fontSize: "2.1rem", fontWeight: 800, color: "var(--adm-text)", letterSpacing: "-0.03em", marginTop: 14, lineHeight: 1 }}>{activeModel.r2.toFixed(4)}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--adm-text-muted)", marginTop: 6 }}>Coefficient of determination</div>
          <div style={{ marginTop: 10 }}><Sparkline data={r2Trend} color="#A5B4FC" height={32} /></div>
        </div>

        {/* vs Baseline */}
        <div className="admin-card" style={{ padding: "1.3rem 1.4rem", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, rgba(16,185,129,0.14), transparent 70%)", border: "1px solid rgba(16,185,129,0.28)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.18em", color: "#34D399", textTransform: "uppercase" }}>vs Baseline</div>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(16,185,129,0.18)", border: "1px solid rgba(16,185,129,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34D399" }}><BarChart3 size={15} /></div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 14 }}>
            <span style={{ fontSize: "2.1rem", fontWeight: 800, color: "#34D399", letterSpacing: "-0.03em", lineHeight: 1, textShadow: "0 0 20px rgba(52,211,153,0.4)" }}>+{activeModel.vsBaseline}%</span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--adm-text-muted)", marginTop: 6 }}>Beats mean-delay baseline</div>
          <div style={{ marginTop: 14, display: "flex", gap: 3, alignItems: "flex-end", height: 32 }}>
            {[40, 55, 48, 62, 58, 71, 78, 84].map((v, i) => (
              <div key={i} style={{ flex: 1, height: `${v}%`, background: `linear-gradient(180deg, #34D399, rgba(52,211,153,0.2))`, borderRadius: 2 }} />
            ))}
          </div>
        </div>
      </div>

      {/* Secondary metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.75rem" }}>
        {/* Drift monitor */}
        <div className="admin-card" style={{ padding: "1.1rem 1.25rem", position: "relative", overflow: "hidden", border: "1px solid var(--adm-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.18em", color: "var(--adm-text-muted)", textTransform: "uppercase" }}>Drift Status</span>
            <LivePulse color="#34D399" label="STABLE" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10 }}>
            <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--adm-text)" }}>None</span>
            <span style={{ fontSize: "0.74rem", color: "var(--adm-text-muted)" }}>· PSI 0.02</span>
          </div>
          <div style={{ marginTop: 8 }}><Sparkline data={driftTrend} color="#34D399" height={26} fill={false} /></div>
        </div>

        {/* Model age */}
        <div className="admin-card" style={{ padding: "1.1rem 1.25rem", border: "1px solid var(--adm-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.18em", color: "var(--adm-text-muted)", textTransform: "uppercase" }}>Model Age</span>
            <Calendar size={14} style={{ color: "var(--adm-text-muted)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 14 }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, color: "var(--adm-text)", letterSpacing: "-0.03em", lineHeight: 1 }}>{activeModel.ageDays}</span>
            <span style={{ fontSize: "0.85rem", color: "var(--adm-text-sub)" }}>day in production</span>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 6, borderRadius: 2, background: i < activeModel.ageDays ? "linear-gradient(90deg,#FBBF24,#F59E0B)" : "rgba(148,163,184,0.12)" }} />
            ))}
          </div>
        </div>

        {/* Total predictions */}
        <div className="admin-card" style={{ padding: "1.1rem 1.25rem", border: "1px solid var(--adm-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.18em", color: "var(--adm-text-muted)", textTransform: "uppercase" }}>Inferences</span>
            <Activity size={14} style={{ color: "var(--adm-text-muted)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 14 }}>
            <span style={{ fontSize: "2rem", fontWeight: 800, color: "var(--adm-text)", letterSpacing: "-0.03em", lineHeight: 1 }}>{activeModel.totalPredictions.toLocaleString()}</span>
            <span style={{ fontSize: "0.78rem", color: "var(--adm-text-muted)" }}>lifetime</span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--adm-text-muted)", marginTop: 10 }}>Awaiting first production call</div>
        </div>
      </div>

      {/* ───── Feature Engineering ───── */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <SectionTitle icon={Database} title="Feature Engineering" sub={`${features.length} engineered inputs · used at training and inference`} />
          <div style={{ display: "flex", gap: 6, fontSize: "0.7rem" }}>
            {Object.entries(GROUP_COLOR).map(([g, c]) => (
              <span key={g} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, border: `1px solid ${c}40`, background: `${c}12`, color: c, fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />{g}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "0.85rem" }}>
          {features.map(f => {
            const c = GROUP_COLOR[f.group];
            return (
              <div key={f.key} style={{
                position: "relative", padding: "1.1rem 1.15rem 1.05rem", borderRadius: 14, overflow: "hidden",
                background: "linear-gradient(160deg, rgba(255,255,255,0.025), transparent 60%)",
                border: "1px solid var(--adm-border)", transition: "all 220ms cubic-bezier(.4,0,.2,1)",
              }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = `${c}66`; el.style.transform = "translateY(-3px)"; el.style.boxShadow = `0 18px 40px -22px ${c}99`; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "var(--adm-border)"; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; }}>
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: `linear-gradient(180deg, ${c}, transparent)` }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <code style={{ fontSize: "0.7rem", fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: `${c}1f`, color: c, fontFamily: "ui-monospace,monospace", border: `1px solid ${c}3a` }}>{f.key}</code>
                  <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--adm-text-muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{f.type}</span>
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 4 }}>{f.name}</div>
                <div style={{ fontSize: "0.76rem", color: "var(--adm-text-sub)", lineHeight: 1.55, marginBottom: 12 }}>{f.desc}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--adm-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", minWidth: 64 }}>Importance</span>
                  <div style={{ flex: 1, height: 4, borderRadius: 999, background: "rgba(148,163,184,0.12)", overflow: "hidden" }}>
                    <div style={{ width: `${f.imp * 100}%`, height: "100%", background: `linear-gradient(90deg, ${c}, ${c}88)`, borderRadius: 999, boxShadow: `0 0 8px ${c}80` }} />
                  </div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: c, fontVariantNumeric: "tabular-nums", minWidth: 32, textAlign: "right" }}>{f.imp.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ───── Version History ───── */}
      <div style={{ marginBottom: "1.75rem" }}>
        <SectionTitle icon={BarChart3} title="Model Registry" sub="ae_model_versions — promotion history" />
        <div className="admin-card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--adm-border)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
              <thead>
                <tr>
                  {["", "Version", "Trained", "MAE", "R²", "Trend", "Δ Baseline", "Status"].map(h => (
                    <th key={h} style={{ padding: "0.85rem 1rem", textAlign: "left", fontSize: "0.62rem", fontWeight: 800, color: "var(--adm-text-muted)", letterSpacing: "0.14em", textTransform: "uppercase", borderBottom: "1px solid var(--adm-border)", background: "rgba(255,255,255,0.015)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((r, i) => {
                  const isActive = r.status === "active";
                  const maeTone = r.mae <= 16 ? "#34D399" : r.mae <= 18 ? "#FBBF24" : "#F87171";
                  const deltaTone = r.delta > 0 ? "#34D399" : r.delta < 0 ? "#F87171" : "var(--adm-text-muted)";
                  const mini = [r.mae + 2, r.mae + 1.4, r.mae + 0.8, r.mae + 0.3, r.mae];
                  return (
                    <tr key={r.v + i} style={{
                      borderBottom: i === history.length - 1 ? "none" : "1px solid var(--adm-border)",
                      background: isActive ? "linear-gradient(90deg, rgba(52,211,153,0.08), transparent 60%)" : "transparent",
                      transition: "background 180ms",
                    }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.025)"; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}>
                      <td style={{ padding: "0 0 0 0.4rem", width: 6 }}>
                        {isActive && <div style={{ width: 3, height: 34, borderRadius: 2, background: "linear-gradient(180deg,#34D399,#10B981)", boxShadow: "0 0 10px #34D399" }} />}
                      </td>
                      <td style={{ padding: "1rem 1rem", fontFamily: "ui-monospace,monospace", fontSize: "0.78rem", color: "var(--adm-text)", fontWeight: 600 }}>{r.v}</td>
                      <td style={{ padding: "1rem 1rem", color: "var(--adm-text-sub)" }}>{r.date}</td>
                      <td style={{ padding: "1rem 1rem", fontWeight: 700, color: maeTone, fontVariantNumeric: "tabular-nums" }}>{r.mae.toFixed(2)}<span style={{ fontSize: "0.7rem", color: "var(--adm-text-muted)", fontWeight: 500 }}> min</span></td>
                      <td style={{ padding: "1rem 1rem", color: "var(--adm-text)", fontVariantNumeric: "tabular-nums" }}>{r.r2.toFixed(4)}</td>
                      <td style={{ padding: "0.5rem 1rem", width: 110 }}><div style={{ width: 90 }}><Sparkline data={mini} color={maeTone} height={24} fill={false} /></div></td>
                      <td style={{ padding: "1rem 1rem", fontWeight: 700, color: deltaTone, fontVariantNumeric: "tabular-nums" }}>
                        {r.delta > 0 ? `+${r.delta}%` : r.delta < 0 ? `${r.delta}%` : "0.0%"}
                      </td>
                      <td style={{ padding: "1rem 1rem" }}>
                        {isActive ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 11px", borderRadius: 999, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", color: "#34D399", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.06em" }}>
                            <span style={{ position: "relative", width: 6, height: 6 }}>
                              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#34D399", animation: "ai-pulse 1.6s ease-out infinite" }} />
                              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#34D399" }} />
                            </span>
                            PRODUCTION
                          </span>
                        ) : (
                          <span style={{ padding: "4px 11px", borderRadius: 999, background: "rgba(148,163,184,0.08)", border: "1px solid var(--adm-border)", color: "var(--adm-text-muted)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em" }}>ARCHIVED</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ───── Pipeline ───── */}
      <div>
        <SectionTitle icon={Activity} title="Training Pipeline" sub="End-to-end MLOps workflow · live process map" />
        <div className="admin-card" style={{ padding: "2rem 1.75rem 1.75rem", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 0%, rgba(99,102,241,0.06), transparent 60%)", pointerEvents: "none" }} />

          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, alignItems: "stretch" }}>
            {/* connectors layer */}
            <svg style={{ position: "absolute", top: 38, left: "12%", right: "12%", height: 2, width: "76%", pointerEvents: "none" }} viewBox="0 0 100 2" preserveAspectRatio="none">
              <line x1="0" y1="1" x2="100" y2="1" stroke="rgba(148,163,184,0.18)" strokeWidth="1" />
              <line x1="0" y1="1" x2="62" y2="1" stroke="url(#flowGrad)" strokeWidth="1.8" strokeDasharray="4 4" style={{ animation: "ai-flow 1.6s linear infinite" }} />
              <defs>
                <linearGradient id="flowGrad" x1="0" x2="1">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="50%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#FBBF24" />
                </linearGradient>
              </defs>
            </svg>

            {pipeline.map((p, i) => {
              const Ic = p.icon;
              const isActive = p.state === "active";
              const isDone = p.state === "done";
              return (
                <div key={p.step} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0.75rem", textAlign: "center" }}>
                  <div style={{
                    position: "relative", width: 76, height: 76, borderRadius: 20,
                    background: isActive
                      ? `linear-gradient(135deg, ${p.color}, ${p.color}cc)`
                      : isDone
                      ? `linear-gradient(135deg, ${p.color}33, ${p.color}11)`
                      : "linear-gradient(135deg, rgba(148,163,184,0.12), rgba(148,163,184,0.04))",
                    border: isActive ? `2px solid ${p.color}` : `1px solid ${isDone ? p.color + "55" : "var(--adm-border)"}`,
                    boxShadow: isActive ? `0 0 0 6px ${p.color}22, 0 16px 36px -16px ${p.color}` : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isActive ? "#0A1628" : p.color,
                    marginBottom: 14, zIndex: 2,
                  }}>
                    <Ic size={28} />
                    {isActive && (
                      <span style={{ position: "absolute", inset: -6, borderRadius: 24, border: `2px solid ${p.color}`, opacity: 0.5, animation: "ai-pulse 2s ease-out infinite" }} />
                    )}
                    <span style={{ position: "absolute", top: -6, right: -6, fontSize: "0.58rem", fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "var(--adm-bg, #0A1628)", border: `1px solid ${p.color}66`, color: p.color, letterSpacing: "0.08em" }}>{p.step}</span>
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 6 }}>{p.title}</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--adm-text-sub)", lineHeight: 1.5, maxWidth: 220 }}>{p.desc}</div>
                  <div style={{ marginTop: 12, fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.14em", padding: "3px 10px", borderRadius: 999,
                    background: isActive ? `${p.color}22` : isDone ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.1)",
                    color: isActive ? p.color : isDone ? "#34D399" : "var(--adm-text-muted)",
                    border: `1px solid ${isActive ? p.color + "55" : isDone ? "rgba(52,211,153,0.3)" : "var(--adm-border)"}` }}>
                    {isActive ? "RUNNING" : isDone ? "COMPLETED" : "QUEUED"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────── Settings ─────────── */
export function SettingsPage() {
  const [section, setSection] = useState("profile");
  const sections = [
    { k: "profile", l: "Profile", icon: User },
    { k: "notifications", l: "Notifications", icon: Bell },
    { k: "security", l: "Security", icon: ShieldCheck },
    { k: "integrations", l: "Integrations", icon: Plug },
    { k: "appearance", l: "Appearance", icon: Palette },
    { k: "language", l: "Language & Region", icon: Globe2 },
    { k: "data", l: "Data & Privacy", icon: Database },
    { k: "api", l: "API & Tokens", icon: KeyRound },
  ];

  return (
    <>
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title" style={{ display: "flex", alignItems: "center", gap: 10 }}><SettingsIcon size={22} style={{ color: "var(--adm-accent)" }} /> Settings</h1>
          <p className="admin-page__subtitle">Manage your account, alerts, and integrations.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "1rem" }}>
        <div className="admin-card" style={{ padding: "0.5rem", height: "fit-content" }}>
          {sections.map(s => {
            const Ic = s.icon;
            const active = section === s.k;
            return (
              <button key={s.k} onClick={() => setSection(s.k)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  textAlign: "left", padding: "0.6rem 0.85rem", borderRadius: 8, border: "none",
                  background: active ? "var(--adm-accent-light)" : "transparent",
                  color: active ? "var(--adm-accent)" : "var(--adm-text-sub)",
                  fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", marginBottom: 2, transition: "all 180ms",
                }}>
                <Ic size={15} /> {s.l}
              </button>
            );
          })}
        </div>

        <div className="admin-card" style={{ padding: "1.75rem" }}>
          <SettingsSection section={section} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: "1rem", marginTop: "1.25rem", borderTop: "1px solid var(--adm-border)" }}>
            <button className="admin-btn admin-btn--outline">Cancel</button>
            <button className="admin-btn admin-btn--primary"><Save size={15} /><span>Save changes</span></button>
          </div>
        </div>
      </div>
    </>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: "0.25rem" }}>{title}</h3>
      <p style={{ fontSize: "0.82rem", color: "var(--adm-text-muted)", marginBottom: "1.5rem" }}>{sub}</p>
    </>
  );
}

function Field({ l, v, type = "text" }: { l: string; v: string; type?: string }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.74rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--adm-text-muted)", marginBottom: 6 }}>{l}</label>
      <input type={type} defaultValue={v}
        style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: 8, border: "1px solid var(--adm-border)", background: "rgba(255,255,255,0.05)", color: "var(--adm-text)", fontSize: "0.88rem", outline: "none" }} />
    </div>
  );
}

function ToggleRow({ l, sub, on = true }: { l: string; sub: string; on?: boolean }) {
  const [v, setV] = useState(on);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 0", borderBottom: "1px solid var(--adm-border)" }}>
      <div>
        <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--adm-text)" }}>{l}</div>
        <div style={{ fontSize: "0.78rem", color: "var(--adm-text-muted)" }}>{sub}</div>
      </div>
      <button onClick={() => setV(s => !s)}
        style={{
          width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer",
          background: v ? "linear-gradient(135deg,#F59E0B,#FBBF24)" : "rgba(255,255,255,0.1)",
          position: "relative", transition: "all 180ms",
        }}>
        <span style={{ position: "absolute", top: 2, left: v ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "all 180ms" }} />
      </button>
    </div>
  );
}

function SettingsSection({ section }: { section: string }) {
  if (section === "profile") {
    return (
      <>
        <SectionHeader title="Profile information" sub="How you appear to other operators." />
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: "1.5rem" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #F59E0B, #FBBF24)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: 700, color: "#0A1628" }}>SA</div>
          <div>
            <button className="admin-btn admin-btn--outline admin-btn--compact">Change photo</button>
            <p style={{ fontSize: "0.75rem", color: "var(--adm-text-muted)", marginTop: 6 }}>JPG or PNG, max 2 MB.</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field l="Full name" v="Sarah Admin" />
          <Field l="Email" v="sarah.admin@tun-airport.tn" />
          <Field l="Phone" v="+216 71 754 000" />
          <Field l="Role" v="Super Admin" />
          <Field l="Department" v="Operations" />
          <Field l="Employee ID" v="OPS-00421" />
        </div>
      </>
    );
  }
  if (section === "notifications") {
    return (
      <>
        <SectionHeader title="Notifications" sub="Choose which alerts you want to receive." />
        <ToggleRow l="High-risk delay predictions" sub="Push + email when a flight is flagged HIGH risk." />
        <ToggleRow l="Weather advisories" sub="METAR severity above moderate." />
        <ToggleRow l="Cancellations" sub="Any flight cancelled at TUN or partner airports." />
        <ToggleRow l="Daily digest" sub="Morning summary at 06:00 local time." on={false} />
        <ToggleRow l="Marketing & product updates" sub="Occasional release notes." on={false} />
      </>
    );
  }
  if (section === "security") {
    return (
      <>
        <SectionHeader title="Security" sub="Protect your account and active sessions." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <Field l="Current password" v="" type="password" />
          <Field l="New password" v="" type="password" />
        </div>
        <ToggleRow l="Two-factor authentication" sub="Require a TOTP code on every login." />
        <ToggleRow l="Trusted devices" sub="Skip 2FA on devices you've marked as trusted." />
        <ToggleRow l="Session timeout (15 min)" sub="Sign out automatically after inactivity." />
      </>
    );
  }
  if (section === "integrations") {
    const items = [
      { l: "FlightAware", s: "Live ADS-B feed", on: true },
      { l: "OAG Schedules", s: "Global schedules + IATA codes", on: true },
      { l: "OpenWeather", s: "METAR / TAF data", on: true },
      { l: "Slack", s: "Push alerts to #ops-tun", on: false },
      { l: "PagerDuty", s: "On-call escalations", on: false },
    ];
    return (
      <>
        <SectionHeader title="Integrations" sub="Third-party services connected to this airport." />
        {items.map(i => <ToggleRow key={i.l} l={i.l} sub={i.s} on={i.on} />)}
      </>
    );
  }
  if (section === "appearance") {
    return (
      <>
        <SectionHeader title="Appearance" sub="Theme, density, and accent." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: "1.25rem" }}>
          {[
            { l: "Aviation Navy", g: "linear-gradient(135deg,#0A1628,#132544)", active: true },
            { l: "Midnight", g: "linear-gradient(135deg,#0a0a1a,#1e1e5a)" },
            { l: "Carbon", g: "linear-gradient(135deg,#1a1a1a,#2d2d2d)" },
          ].map(t => (
            <div key={t.l} style={{ padding: 12, borderRadius: 12, border: t.active ? "2px solid var(--adm-accent)" : "1px solid var(--adm-border)", background: "rgba(255,255,255,0.02)", cursor: "pointer" }}>
              <div style={{ height: 64, borderRadius: 8, background: t.g, marginBottom: 8 }} />
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text)" }}>{t.l}</div>
            </div>
          ))}
        </div>
        <ToggleRow l="Compact density" sub="Reduce padding in tables and cards." on={false} />
        <ToggleRow l="High-contrast mode" sub="Stronger borders for low-light cockpits." on={false} />
      </>
    );
  }
  if (section === "language") {
    return (
      <>
        <SectionHeader title="Language & Region" sub="Localization, timezone, and units." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field l="Language" v="English" />
          <Field l="Region" v="Tunisia (TN)" />
          <Field l="Timezone" v="Africa/Tunis (UTC+1)" />
          <Field l="Date format" v="DD MMM YYYY" />
          <Field l="Time format" v="24-hour" />
          <Field l="Distance units" v="Nautical miles" />
        </div>
      </>
    );
  }
  if (section === "data") {
    return (
      <>
        <SectionHeader title="Data & Privacy" sub="Control how your data is stored and shared." />
        <ToggleRow l="Anonymous usage analytics" sub="Help us improve the console." />
        <ToggleRow l="Share crash reports" sub="Auto-send stack traces on errors." />
        <ToggleRow l="Retain logs for 90 days" sub="After 90 days, audit logs are purged." />
        <div style={{ marginTop: "1rem", display: "flex", gap: 8 }}>
          <button className="admin-btn admin-btn--outline">Export my data</button>
          <button className="admin-btn admin-btn--outline" style={{ color: "#F87171" }}>Delete account</button>
        </div>
      </>
    );
  }
  if (section === "api") {
    return (
      <>
        <SectionHeader title="API & Tokens" sub="Personal access tokens for programmatic access." />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Scope</th><th>Created</th><th>Last used</th></tr></thead>
            <tbody>
              <tr><td style={{ fontWeight: 600 }}>Ops Bot</td><td className="admin-table__muted">read:flights</td><td>Mar 12, 2026</td><td>2 min ago</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Reporting</td><td className="admin-table__muted">read:analytics</td><td>Jan 04, 2026</td><td>1 day ago</td></tr>
              <tr><td style={{ fontWeight: 600 }}>CI/CD</td><td className="admin-table__muted">write:deploy</td><td>Dec 22, 2025</td><td>Never</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <button className="admin-btn admin-btn--primary"><KeyRound size={15} /> Create new token</button>
        </div>
      </>
    );
  }
  return null;
}

/* ─────────── Global Ops ─────────── */
export { default as GlobalOpsPage } from "@/components/global-ops/GlobalOpsCenter";
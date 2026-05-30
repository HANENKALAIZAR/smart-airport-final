import { useMemo, useState } from "react";
import {
  FileBarChart, Download, Printer, Calendar as CalendarIcon, Plane, Clock,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Users, Activity,
} from "lucide-react";

/* ────────────────────── Period system ────────────────────── */
type Period = "weekly" | "monthly" | "yearly" | "custom";

type Dataset = {
  period: string;
  kpis: { l: string; v: string; trend: number; icon: any; color: string; inverted?: boolean }[];
  series: number[];
  seriesLabels: string[];
  topRoutes: { l: string; v: number; p: number }[];
  causes: { l: string; v: number; c: string }[];
  summary: string;
};

const DATA: Record<Period, Dataset> = {
  weekly: {
    period: "Week 19 · May 4–10, 2026",
    kpis: [
      { l: "Total flights", v: "612", trend: +3.1, icon: Plane, color: "var(--adm-accent)" },
      { l: "On-time rate", v: "85.4%", trend: +1.2, icon: CheckCircle2, color: "#34D399" },
      { l: "Avg delay", v: "10.8 min", trend: -1.1, icon: Clock, color: "#34D399", inverted: true },
      { l: "Cancellations", v: "1.1%", trend: -0.2, icon: AlertTriangle, color: "#34D399", inverted: true },
      { l: "Passengers", v: "78k", trend: +2.6, icon: Users, color: "var(--adm-accent)" },
      { l: "Active alerts", v: "3", trend: -1, icon: Activity, color: "#FBBF24" },
    ],
    series: [82, 85, 81, 88, 90, 86, 89],
    seriesLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    topRoutes: [
      { l: "TUN → CDG", v: 46, p: 92 },
      { l: "TUN → FCO", v: 38, p: 76 },
      { l: "TUN → FRA", v: 32, p: 64 },
      { l: "TUN → LHR", v: 24, p: 48 },
      { l: "TUN → MAD", v: 22, p: 44 },
    ],
    causes: [
      { l: "Weather", v: 34, c: "#60A5FA" },
      { l: "Late inbound aircraft", v: 27, c: "#F59E0B" },
      { l: "ATC", v: 18, c: "#A78BFA" },
      { l: "Crew rotation", v: 13, c: "#34D399" },
      { l: "Other", v: 8, c: "#94A3B8" },
    ],
    summary:
      "Week 19 closed with 85.4% on-time, up 1.2pp WoW. Cancellations remain low at 1.1%. Late-inbound aircraft (27%) is the leading delay driver — coordinate turnaround with TUN ground ops.",
  },
  monthly: {
    period: "May 2026",
    kpis: [
      { l: "Total flights", v: "2,418", trend: +6.2, icon: Plane, color: "var(--adm-accent)" },
      { l: "On-time rate", v: "84.1%", trend: +1.8, icon: CheckCircle2, color: "#34D399" },
      { l: "Avg delay", v: "11.6 min", trend: -2.4, icon: Clock, color: "#34D399", inverted: true },
      { l: "Cancellations", v: "1.4%", trend: -0.5, icon: AlertTriangle, color: "#34D399", inverted: true },
      { l: "Passengers", v: "318k", trend: +4.1, icon: Users, color: "var(--adm-accent)" },
      { l: "Active alerts", v: "9", trend: -3, icon: Activity, color: "#FBBF24" },
    ],
    series: [72, 78, 81, 85, 79, 88, 91, 84, 80, 76, 83, 87, 90, 92, 86, 81, 77, 84, 88, 91, 89, 85, 82, 86, 90, 93, 88, 84, 81, 87, 89],
    seriesLabels: Array.from({ length: 31 }, (_, i) => String(i + 1)),
    topRoutes: [
      { l: "TUN → CDG", v: 184, p: 92 },
      { l: "TUN → FCO", v: 142, p: 71 },
      { l: "TUN → FRA", v: 128, p: 64 },
      { l: "TUN → LHR", v: 96, p: 48 },
      { l: "TUN → MAD", v: 88, p: 44 },
    ],
    causes: [
      { l: "Weather", v: 36, c: "#60A5FA" },
      { l: "Late inbound aircraft", v: 26, c: "#F59E0B" },
      { l: "ATC", v: 17, c: "#A78BFA" },
      { l: "Crew rotation", v: 13, c: "#34D399" },
      { l: "Other", v: 8, c: "#94A3B8" },
    ],
    summary:
      "May 2026 closed strong with an 84.1% on-time performance, 1.8pp above the prior month. Cancellation rate fell to 1.4%. Late-inbound aircraft accounted for 26% of delays — focus area for June. Passenger throughput hit 318k, a 4.1% lift.",
  },
  yearly: {
    period: "2025",
    kpis: [
      { l: "Total flights", v: "29,142", trend: +8.4, icon: Plane, color: "var(--adm-accent)" },
      { l: "On-time rate", v: "82.7%", trend: +2.3, icon: CheckCircle2, color: "#34D399" },
      { l: "Avg delay", v: "13.4 min", trend: -1.6, icon: Clock, color: "#34D399", inverted: true },
      { l: "Cancellations", v: "1.8%", trend: -0.4, icon: AlertTriangle, color: "#34D399", inverted: true },
      { l: "Passengers", v: "3.84M", trend: +6.7, icon: Users, color: "var(--adm-accent)" },
      { l: "Active alerts", v: "112", trend: -12, icon: Activity, color: "#FBBF24" },
    ],
    series: [68, 72, 75, 78, 82, 85, 88, 84, 81, 79, 83, 86],
    seriesLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    topRoutes: [
      { l: "TUN → CDG", v: 2184, p: 92 },
      { l: "TUN → FCO", v: 1742, p: 73 },
      { l: "TUN → FRA", v: 1528, p: 64 },
      { l: "TUN → LHR", v: 1196, p: 50 },
      { l: "TUN → MAD", v: 1088, p: 46 },
    ],
    causes: [
      { l: "Weather", v: 38, c: "#60A5FA" },
      { l: "Late inbound aircraft", v: 24, c: "#F59E0B" },
      { l: "ATC", v: 18, c: "#A78BFA" },
      { l: "Crew rotation", v: 12, c: "#34D399" },
      { l: "Other", v: 8, c: "#94A3B8" },
    ],
    summary:
      "Network performance improved year-over-year with on-time rate up 2.3pp and average delay reduced by 1.6 minutes. Weather remains the dominant delay driver (38%). Passenger volume grew 6.7% — capacity utilization held steady.",
  },
  custom: {
    period: "Custom range",
    kpis: [
      { l: "Total flights", v: "—", trend: 0, icon: Plane, color: "var(--adm-accent)" },
      { l: "On-time rate", v: "—", trend: 0, icon: CheckCircle2, color: "#34D399" },
      { l: "Avg delay", v: "—", trend: 0, icon: Clock, color: "#34D399", inverted: true },
      { l: "Cancellations", v: "—", trend: 0, icon: AlertTriangle, color: "#34D399", inverted: true },
      { l: "Passengers", v: "—", trend: 0, icon: Users, color: "var(--adm-accent)" },
      { l: "Active alerts", v: "—", trend: 0, icon: Activity, color: "#FBBF24" },
    ],
    series: [],
    seriesLabels: [],
    topRoutes: [],
    causes: [],
    summary: "Pick a custom date range to load aggregated metrics.",
  },
};

/* ────────────────────── Reusable bits ────────────────────── */

function KPI({ l, v, trend, icon: Icon, color, inverted }: any) {
  const positive = inverted ? trend < 0 : trend > 0;
  return (
    <div className="admin-card" style={{ padding: "1.1rem 1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
        <span style={{ fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--adm-text-muted)", fontWeight: 600 }}>{l}</span>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(251,191,36,0.06))", border: "1px solid rgba(245,158,11,0.22)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--adm-accent)" }}>
          <Icon size={16} />
        </div>
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{v}</div>
      {trend !== undefined && trend !== 0 && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: "0.74rem", fontWeight: 600, color: positive ? "#34D399" : "#F87171" }}>
          {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend > 0 ? "+" : ""}{trend}% vs prev.
        </div>
      )}
    </div>
  );
}

function BarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(1, ...data);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: data.length > 14 ? 4 : 12, height: 220 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{
            width: "100%", height: `${(v / max) * 180}px`,
            background: "linear-gradient(180deg, #FBBF24, #F59E0B)",
            borderRadius: "4px 4px 2px 2px",
            boxShadow: "0 -2px 6px rgba(245,158,11,0.25)",
            transition: "height 320ms ease",
          }} />
          {(data.length <= 14 || i % 5 === 0) && (
            <div style={{ fontSize: "0.66rem", color: "var(--adm-text-muted)" }}>{labels[i]}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ────────────────────── Page ────────────────────── */

const TABS: { k: Period; l: string }[] = [
  { k: "weekly", l: "Weekly" },
  { k: "monthly", l: "Monthly" },
  { k: "yearly", l: "Yearly" },
  { k: "custom", l: "Custom" },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [from, setFrom] = useState("2026-05-01");
  const [to, setTo] = useState("2026-05-15");
  const data = useMemo(() => DATA[period], [period]);

  const headerLabel = period === "weekly" ? "On-time rate by day"
    : period === "monthly" ? "On-time rate by day"
    : period === "yearly" ? "On-time rate by month"
    : "On-time rate";

  return (
    <>
      <div className="admin-page__header">
        <div>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-accent)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Analytics
          </span>
          <h1 className="admin-page__title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileBarChart size={22} style={{ color: "var(--adm-accent)" }} /> Network performance · {data.period}
          </h1>
          <p className="admin-page__subtitle">Unified weekly, monthly and yearly insights for Tunis–Carthage Intl.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="admin-btn admin-btn--outline"><Printer size={15} /><span>Print</span></button>
          <button className="admin-btn admin-btn--primary"><Download size={15} /><span>Export PDF</span></button>
        </div>
      </div>

      {/* Period tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,0.03)", border: "1px solid var(--adm-border)", borderRadius: 12 }}>
          {TABS.map(t => {
            const active = period === t.k;
            return (
              <button key={t.k} onClick={() => setPeriod(t.k)}
                style={{
                  padding: "0.5rem 1.05rem", borderRadius: 8, border: "none",
                  background: active ? "linear-gradient(135deg, #F59E0B, #FBBF24)" : "transparent",
                  color: active ? "#0A1628" : "var(--adm-text-sub)",
                  fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", transition: "all 180ms",
                }}>
                {t.l}
              </button>
            );
          })}
        </div>
        {period === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.45rem 0.7rem", border: "1px solid var(--adm-border)", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
            <CalendarIcon size={14} style={{ color: "var(--adm-accent)" }} />
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ background: "transparent", border: "none", color: "var(--adm-text)", fontSize: "0.82rem", outline: "none" }} />
            <span style={{ color: "var(--adm-text-muted)" }}>→</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ background: "transparent", border: "none", color: "var(--adm-text)", fontSize: "0.82rem", outline: "none" }} />
          </div>
        )}
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
        {data.kpis.map((k) => <KPI key={k.l} {...k} />)}
      </div>

      {/* Big chart */}
      <div className="admin-card" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--adm-text)" }}>{headerLabel}</h3>
            <p style={{ fontSize: "0.78rem", color: "var(--adm-text-muted)" }}>
              {data.series.length ? `${data.series.length} data points · ${data.period}` : "Select a period to display chart"}
            </p>
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--adm-text-sub)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "linear-gradient(180deg, #FBBF24, #F59E0B)" }} /> On-time %
          </span>
        </div>
        {data.series.length > 0 ? (
          <BarChart data={data.series} labels={data.seriesLabels} />
        ) : (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--adm-text-muted)", fontSize: "0.85rem" }}>No data for selected range.</div>
        )}
      </div>

      {/* Routes + causes */}
      {data.topRoutes.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
          <div className="admin-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: "1rem" }}>Top routes</h3>
            {data.topRoutes.map(r => (
              <div key={r.l} style={{ marginBottom: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.82rem" }}>
                  <span style={{ color: "var(--adm-text-sub)" }}>{r.l}</span>
                  <span style={{ color: "var(--adm-text)", fontWeight: 600 }}>{r.v.toLocaleString()} flights</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${r.p}%`, height: "100%", background: "linear-gradient(90deg, #F59E0B, #FBBF24)", borderRadius: 999, transition: "width 320ms ease" }} />
                </div>
              </div>
            ))}
          </div>
          <div className="admin-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: "1rem" }}>Delay causes breakdown</h3>
            {data.causes.map(r => (
              <div key={r.l} style={{ marginBottom: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.82rem" }}>
                  <span style={{ color: "var(--adm-text-sub)" }}>{r.l}</span>
                  <span style={{ color: "var(--adm-text)", fontWeight: 600 }}>{r.v}%</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, r.v * 2.5)}%`, height: "100%", background: r.c, borderRadius: 999, transition: "width 320ms ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="admin-card" style={{ padding: "1.5rem" }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: "0.5rem" }}>Executive summary</h3>
        <p style={{ fontSize: "0.88rem", lineHeight: 1.7, color: "#CBD5E1" }}>{data.summary}</p>
      </div>
    </>
  );
}

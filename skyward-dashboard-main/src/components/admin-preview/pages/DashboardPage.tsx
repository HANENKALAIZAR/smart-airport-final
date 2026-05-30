import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plane, Clock, AlertTriangle, TrendingUp, TrendingDown, RefreshCw,
  ArrowUp, ArrowDown, X, MapPin, CloudRain,
  ChevronLeft, ChevronRight, Search, ChevronDown, Check,
  XCircle, BellRing, Users as UsersIcon, Wrench, Radio, Cloud,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Standardized vocabularies (single source of truth across the platform)
// ---------------------------------------------------------------------------
export const AIRPORT_CODES = ["TUN", "DJE", "NBE", "MIR"] as const;
export type AirportCode = (typeof AIRPORT_CODES)[number];

export const FLIGHT_STATUSES = [
  "On Time", "Delayed", "Canceled", "Boarding", "Departed", "Landed",
] as const;
export type FlightStatus = (typeof FLIGHT_STATUSES)[number];

type FlightRow = {
  id: number; num: string; airline: string; route: string; routeFull: string;
  time: string; terminal: string; gate: string; weather: string;
  delay: number; risk: "low" | "medium" | "high"; status: FlightStatus;
  direction: "departure" | "arrival"; aircraft?: string;
};

const FLIGHTS: FlightRow[] = [
  { id: 1, num: "TU721", airline: "Tunisair",   route: "TUN → CDG", routeFull: "Paris Charles de Gaulle", time: "08:49", terminal: "1", gate: "B3", weather: "Storm",  delay: 45, risk: "high",   status: "Delayed",  direction: "departure", aircraft: "Boeing 737-800" },
  { id: 2, num: "TU302", airline: "Tunisair",   route: "DJE → FCO", routeFull: "Rome Fiumicino",         time: "10:19", terminal: "1", gate: "A7", weather: "Clear",  delay: 0,  risk: "low",    status: "On Time",  direction: "departure", aircraft: "Airbus A320" },
  { id: 3, num: "AF1234",airline: "Air France", route: "CDG → TUN", routeFull: "Paris CDG",              time: "14:34", terminal: "2", gate: "C2", weather: "Cloudy", delay: 0,  risk: "low",    status: "Boarding", direction: "arrival",   aircraft: "Airbus A319" },
  { id: 4, num: "LH490", airline: "Lufthansa",  route: "FRA → MIR", routeFull: "Frankfurt",              time: "15:19", terminal: "2", gate: "D1", weather: "Wind",   delay: 20, risk: "medium", status: "Delayed",  direction: "arrival",   aircraft: "Airbus A321" },
  { id: 5, num: "TU505", airline: "Tunisair",   route: "TUN → LHR", routeFull: "London Heathrow",        time: "19:49", terminal: "1", gate: "B9", weather: "Clear",  delay: 0,  risk: "low",    status: "Boarding", direction: "departure", aircraft: "Boeing 737-800" },
  { id: 6, num: "IB3456",airline: "Iberia",     route: "MAD → NBE", routeFull: "Madrid Barajas",         time: "13:34", terminal: "1", gate: "A3", weather: "Clear",  delay: 0,  risk: "low",    status: "Landed",   direction: "arrival",   aircraft: "Airbus A320" },
  { id: 7, num: "TU801", airline: "Tunisair",   route: "MIR → DUS", routeFull: "Düsseldorf",             time: "21:49", terminal: "1", gate: "C5", weather: "Storm",  delay: 0,  risk: "high",   status: "Canceled", direction: "departure", aircraft: "Boeing 737-800" },
  { id: 8, num: "VY1234",airline: "Vueling",    route: "BCN → DJE", routeFull: "Barcelona",              time: "16:00", terminal: "2", gate: "D4", weather: "Clear",  delay: 5,  risk: "low",    status: "Departed", direction: "arrival",   aircraft: "Airbus A320" },
];

// AI alerts only reference standardized airport codes
type OpsTeam = "Ground Ops" | "Crew Scheduling" | "Air Traffic" | "Maintenance" | "Weather Desk";
type AIAlert = {
  flight: string; airport: AirportCode; risk: number;
  title: string; action: string; team: OpsTeam;
  status: "Pending" | "Rejected" | "Escalated"; time: string;
};
const INITIAL_ALERTS: AIAlert[] = [
  { flight: "LH7890", airport: "TUN", risk: 72, title: "Aircraft turnaround delay expected", action: "Increase ground crew by 2 staff",   team: "Ground Ops",      status: "Pending", time: "16/04/2026 03:03" },
  { flight: "BA5678", airport: "MIR", risk: 45, title: "Slot conflict at Terminal 2",         action: "Coordinate slot reassignment",       team: "Air Traffic",     status: "Pending", time: "16/04/2026 03:03" },
  { flight: "UA9012", airport: "DJE", risk: 25, title: "Minor schedule deviation",            action: "Monitor for next 30 minutes",        team: "Air Traffic",     status: "Pending", time: "16/04/2026 03:03" },
  { flight: "EK4421", airport: "NBE", risk: 58, title: "Crew rest violation risk",            action: "Reassign standby crew",              team: "Crew Scheduling", status: "Pending", time: "16/04/2026 03:03" },
];
const TEAM_META: Record<OpsTeam, { color: string; icon: any }> = {
  "Ground Ops":      { color: "#60A5FA", icon: UsersIcon },
  "Crew Scheduling": { color: "#A78BFA", icon: UsersIcon },
  "Air Traffic":     { color: "#34D399", icon: Radio },
  "Maintenance":     { color: "#F59E0B", icon: Wrench },
  "Weather Desk":    { color: "#22D3EE", icon: Cloud },
};

const STATUS_META: Record<FlightStatus, { dot: string; cls: string }> = {
  "On Time":  { dot: "#34D399", cls: "admin-table__status--on-time" },
  "Delayed":  { dot: "#F87171", cls: "admin-table__status--delayed" },
  "Canceled": { dot: "#FB7185", cls: "admin-table__status--cancelled" },
  "Boarding": { dot: "#FBBF24", cls: "admin-table__status--boarding" },
  "Departed": { dot: "#94A3B8", cls: "admin-table__status--departed" },
  "Landed":   { dot: "#60A5FA", cls: "admin-table__status--departed" },
};

// ---------------------------------------------------------------------------
// CustomSelect — polished dropdown used across the dashboard filters
// ---------------------------------------------------------------------------
function CustomSelect<T extends string>({
  label, value, options, onChange, width = 170,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; dot?: string }[];
  onChange: (v: T) => void;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const current = options.find(o => o.value === value);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", flexDirection: "column", gap: 4, minWidth: width }}>
      <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--adm-text-muted)" }}>{label}</span>
      <button
        type="button"
        className="csel__btn"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "space-between",
          gap: 8, padding: "0.5rem 0.7rem",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--adm-border)",
          borderRadius: 10, cursor: "pointer",
          color: "var(--adm-text)", fontSize: "0.8rem", fontWeight: 600,
          fontFamily: "inherit", minHeight: 36, width: "100%",
          transition: "all 200ms ease",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current?.dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: current.dot, boxShadow: `0 0 6px ${current.dot}88` }} />}
          {current?.label}
        </span>
        <ChevronDown size={14} style={{ transition: "transform 200ms ease", transform: open ? "rotate(180deg)" : "rotate(0)", color: "var(--adm-text-muted)", flexShrink: 0 }} />
      </button>
      {open && (
        <ul
          className="csel__menu"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            margin: 0, padding: 4, listStyle: "none", zIndex: 60,
            background: "var(--adm-card)", border: "1px solid var(--adm-border)",
            borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
            maxHeight: 260, overflowY: "auto",
            animation: "customSelectFadeIn 140ms ease-out",
          }}
        >
          {options.map(o => {
            const active = o.value === value;
            return (
              <li
                key={o.value}
                className="csel__opt"
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "0.5rem 0.65rem", borderRadius: 7, cursor: "pointer",
                  fontSize: "0.8rem", fontWeight: active ? 700 : 500,
                  color: active ? "var(--adm-accent)" : "var(--adm-text-sub)",
                  background: active ? "var(--adm-accent-light)" : "transparent",
                  transition: "background 120ms ease",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                {o.dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: o.dot }} />}
                <span style={{ flex: 1 }}>{o.label}</span>
                {active && <Check size={13} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function KPICard({ title, value, suffix, icon, trend }: { title: string; value: string | number; suffix?: string; icon: React.ReactNode; trend?: number }) {
  const isUp = trend !== undefined && trend > 0;
  const isDown = trend !== undefined && trend < 0;
  return (
    <div className="kpi-card">
      <div className="kpi-card__header">
        <div>
          <p className="kpi-card__title">{title}</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span className="kpi-card__value">
              {value}
              {suffix && <span className="kpi-card__suffix">{suffix}</span>}
            </span>
          </div>
          {trend !== undefined && (
            <div className={`kpi-card__trend ${isUp ? "kpi-card__trend--up" : isDown ? "kpi-card__trend--down" : "kpi-card__trend--neutral"}`}>
              {isUp && <TrendingUp size={16} />}
              {isDown && <TrendingDown size={16} />}
              <span>{isUp ? "+" : ""}{trend}%</span>
            </div>
          )}
        </div>
        <div className="kpi-card__icon">{icon}</div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 8;

type StatusFilter = "all" | FlightStatus;
type RiskFilter = "all" | "low" | "medium" | "high";
type AirportFilter = "all" | AirportCode;
type TimeRange = "all" | "morning" | "afternoon" | "evening";

const STATUS_OPTIONS: { value: StatusFilter; label: string; dot?: string }[] = [
  { value: "all", label: "All" },
  ...FLIGHT_STATUSES.map(s => ({ value: s as StatusFilter, label: s, dot: STATUS_META[s].dot })),
];

const RISK_OPTIONS: { value: RiskFilter; label: string }[] = [
  { value: "all", label: "All Risk" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const TIME_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "all", label: "All Day" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

const AIRPORT_OPTIONS: { value: AirportFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...AIRPORT_CODES.map(c => ({ value: c as AirportFilter, label: c })),
];

function inTimeRange(time: string, range: TimeRange) {
  if (range === "all") return true;
  const [h] = time.split(":").map(Number);
  if (range === "morning") return h >= 0 && h < 12;
  if (range === "afternoon") return h >= 12 && h < 18;
  return h >= 18 && h <= 23;
}

export default function DashboardPage({
  dateLabel,
  role = "superadmin",
  onOpenAnalytics,
}: {
  dateLabel: string;
  role?: "superadmin" | "admin";
  onOpenAnalytics?: () => void;
}) {
  const [search, setSearch] = useState("");
  // Draft (in-form) filter values — only push into applied state when "Apply" is clicked.
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("all");
  const [draftRisk, setDraftRisk] = useState<RiskFilter>("all");
  const [draftAirport, setDraftAirport] = useState<AirportFilter>("all");
  const [draftTime, setDraftTime] = useState<TimeRange>("all");
  // Applied filter values used by the table query
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [airportFilter, setAirportFilter] = useState<AirportFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeRange>("all");
  const [directionTab, setDirectionTab] = useState<"all" | "departure" | "arrival">("all");
  const [openFlight, setOpenFlight] = useState<FlightRow | null>(null);
  const [page, setPage] = useState(1);

  const [aiAirport, setAiAirport] = useState<AirportFilter>("all");
  const [aiRisk, setAiRisk] = useState<RiskFilter>("all");
  const [alerts, setAlerts] = useState<AIAlert[]>(INITIAL_ALERTS);

  const updateAlert = (flight: string, patch: Partial<AIAlert>) =>
    setAlerts(prev => prev.map(a => (a.flight === flight ? { ...a, ...patch } : a)));

  const draftDirty =
    draftStatus !== statusFilter ||
    draftRisk !== riskFilter ||
    draftAirport !== airportFilter ||
    draftTime !== timeFilter;

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (riskFilter !== "all" ? 1 : 0) +
    (airportFilter !== "all" ? 1 : 0) +
    (timeFilter !== "all" ? 1 : 0);

  const applyFilters = () => {
    setStatusFilter(draftStatus);
    setRiskFilter(draftRisk);
    setAirportFilter(draftAirport);
    setTimeFilter(draftTime);
    setPage(1);
  };
  const resetFilters = () => {
    setDraftStatus("all"); setDraftRisk("all"); setDraftAirport("all"); setDraftTime("all");
    setStatusFilter("all"); setRiskFilter("all"); setAirportFilter("all"); setTimeFilter("all");
    setPage(1);
  };

  const filtered = useMemo(() => FLIGHTS.filter(f => {
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (riskFilter !== "all" && f.risk !== riskFilter) return false;
    if (directionTab !== "all" && f.direction !== directionTab) return false;
    if (!inTimeRange(f.time, timeFilter)) return false;
    if (airportFilter !== "all") {
      const [from, to] = f.route.split(" → ");
      if (from !== airportFilter && to !== airportFilter) return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${f.num} ${f.airline} ${f.route} ${f.routeFull} ${f.gate}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [statusFilter, riskFilter, directionTab, timeFilter, airportFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (role === "superadmin") {
        if (aiAirport !== "all" && a.airport !== aiAirport) return false;
      } else {
        const lvl = a.risk >= 70 ? "high" : a.risk >= 40 ? "medium" : "low";
        if (aiRisk !== "all" && lvl !== aiRisk) return false;
      }
      return true;
    });
  }, [alerts, role, aiAirport, aiRisk]);

  const departureCount = FLIGHTS.filter(f => f.direction === "departure").length;
  const arrivalCount = FLIGHTS.filter(f => f.direction === "arrival").length;

  const resetPage = () => setPage(1);

  return (
    <>
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title">Operations Overview</h1>
          <p className="admin-page__subtitle">Live ops snapshot — Tunis–Carthage Intl., {dateLabel}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="admin-btn admin-btn--outline"><RefreshCw size={15} /><span>Refresh</span></button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <KPICard title="Total Flights Today" value="248" icon={<Plane size={28} />} trend={6} />
        <KPICard title="On-Time Rate" value="84.2" suffix="%" icon={<Clock size={28} />} trend={2} />
        <KPICard title="Avg Delay" value="12" suffix=" min" icon={<AlertTriangle size={28} />} trend={-4} />
        <KPICard title="Active Gates" value="34" suffix="/42" icon={<TrendingUp size={28} />} trend={0} />
      </div>

      {/* Modern data-control toolbar */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center",
        gap: "0.75rem", padding: "0.85rem", marginBottom: "1rem",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--adm-border)",
        borderRadius: 14,
      }}>
        {/* Search */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "0.5rem 0.85rem",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--adm-border)",
          borderRadius: 10,
          minWidth: 240, flex: "0 1 280px",
        }}>
          <Search size={15} style={{ color: "var(--adm-text-muted)" }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
            placeholder="Search flights, airlines, gates…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--adm-text)", fontSize: "0.82rem",
            }}
          />
        </div>

        <CustomSelect<StatusFilter>
          label="Status"
          options={STATUS_OPTIONS}
          value={draftStatus}
          onChange={setDraftStatus}
        />
        <CustomSelect<RiskFilter>
          label="Risk"
          options={RISK_OPTIONS}
          value={draftRisk}
          onChange={setDraftRisk}
          width={150}
        />
        <CustomSelect<AirportFilter>
          label="Airport"
          options={AIRPORT_OPTIONS}
          value={draftAirport}
          onChange={setDraftAirport}
          width={140}
        />
        <CustomSelect<TimeRange>
          label="Time"
          options={TIME_OPTIONS}
          value={draftTime}
          onChange={setDraftTime}
          width={160}
        />

        {/* Active filter indicator + actions */}
        <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {activeFilterCount > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "0.35rem 0.65rem", borderRadius: 999,
              background: "var(--adm-accent-light)", color: "var(--adm-accent)",
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.04em",
              border: "1px solid var(--adm-accent-light)",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--adm-accent)" }} />
              {activeFilterCount} ACTIVE
            </span>
          )}
          <button
            type="button"
            onClick={resetFilters}
            disabled={activeFilterCount === 0 && !draftDirty}
            className="admin-btn admin-btn--outline admin-btn--compact"
            style={{ opacity: activeFilterCount === 0 && !draftDirty ? 0.5 : 1, cursor: activeFilterCount === 0 && !draftDirty ? "not-allowed" : "pointer" }}
          >
            <RefreshCw size={13} /> <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={applyFilters}
            disabled={!draftDirty}
            className="admin-btn admin-btn--primary admin-btn--compact"
            style={{ opacity: draftDirty ? 1 : 0.55, cursor: draftDirty ? "pointer" : "not-allowed" }}
          >
            <Check size={14} /> <span>Apply Filters</span>
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: "1rem", alignItems: "flex-start" }}>
        {/* Departures & Arrivals table */}
        <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--adm-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Plane size={18} style={{ color: "var(--adm-accent)" }} />
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--adm-text)" }}>Departures & Arrivals</h3>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 999, background: "rgba(52,211,153,0.12)", color: "#34D399", fontSize: "0.68rem", fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399" }} /> LIVE
              </span>
            </div>
            <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,0.03)", border: "1px solid var(--adm-border)", borderRadius: 10 }}>
              {[
                { k: "all", l: "All", c: FLIGHTS.length },
                { k: "departure", l: "Departures", c: departureCount, icon: ArrowUp },
                { k: "arrival", l: "Arrivals", c: arrivalCount, icon: ArrowDown },
              ].map(t => {
                const active = directionTab === t.k;
                const Icon = (t as any).icon;
                return (
                  <button key={t.k} onClick={() => setDirectionTab(t.k as any)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.35rem 0.75rem", borderRadius: 7, border: "none",
                      background: active ? "linear-gradient(135deg, #F59E0B, #FBBF24)" : "transparent",
                      color: active ? "#0A1628" : "var(--adm-text-sub)", fontSize: "0.76rem", fontWeight: 600, cursor: "pointer" }}>
                    {Icon && <Icon size={12} />} {t.l}
                    {t.c > 0 && <span style={{ padding: "0 6px", borderRadius: 8, background: active ? "rgba(10,22,40,0.18)" : "rgba(255,255,255,0.06)", fontSize: "0.65rem", fontWeight: 700 }}>{t.c}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr><th></th><th>Flight</th><th>Airline</th><th>Route</th><th>Scheduled</th><th>Terminal</th><th>Gate</th><th>Delay</th><th>Status</th></tr>
              </thead>
              <tbody>
                {pageRows.map(f => {
                  const Dir = f.direction === "departure" ? ArrowUp : ArrowDown;
                  const dirColor = f.direction === "departure" ? "#60A5FA" : "#34D399";
                  const meta = STATUS_META[f.status];
                  return (
                    <tr key={f.id} onClick={() => setOpenFlight(f)} style={{ cursor: "pointer" }}>
                      <td><Dir size={16} style={{ color: dirColor }} /></td>
                      <td style={{ fontWeight: 700 }}>{f.num}</td>
                      <td className="admin-table__muted">{f.airline}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{f.route}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--adm-text-muted)" }}>{f.routeFull}</div>
                      </td>
                      <td>{f.time}</td>
                      <td>{f.terminal}</td>
                      <td>{f.gate}</td>
                      <td><span className={f.delay > 0 ? "admin-table__danger" : ""}>{f.delay > 0 ? `+${f.delay} min` : "0 min"}</span></td>
                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "3px 9px", borderRadius: 999,
                          background: `${meta.dot}1f`,
                          color: meta.dot,
                          fontSize: "0.72rem", fontWeight: 700,
                          border: `1px solid ${meta.dot}40`,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot }} />
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: "var(--adm-text-muted)" }}>No flights match the selected filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.1rem", borderTop: "1px solid var(--adm-border)" }}>
              <span style={{ fontSize: "0.74rem", color: "var(--adm-text-muted)" }}>
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--adm-border)", background: "transparent", color: "var(--adm-text-sub)", cursor: safePage === 1 ? "not-allowed" : "pointer", opacity: safePage === 1 ? 0.4 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => {
                  const active = n === safePage;
                  return (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      style={{ minWidth: 32, height: 32, padding: "0 10px", borderRadius: 8, border: active ? "1px solid var(--adm-accent)" : "1px solid var(--adm-border)", background: active ? "linear-gradient(135deg, #F59E0B, #FBBF24)" : "transparent", color: active ? "#0A1628" : "var(--adm-text-sub)", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}
                    >
                      {n}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--adm-border)", background: "transparent", color: "var(--adm-text-sub)", cursor: safePage === totalPages ? "not-allowed" : "pointer", opacity: safePage === totalPages ? 0.4 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  aria-label="Next page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Decision-Support panel */}
        <div className="admin-card" style={{ padding: 0, overflow: "hidden", position: "sticky", top: 16, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 7rem)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--adm-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} style={{ color: "var(--adm-accent)" }} />
              <div>
                <h3 style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)" }}>AI Recommendations</h3>
                <div style={{ fontSize: "0.68rem", color: "var(--adm-text-muted)", marginTop: 2 }}>Review · Reject · Escalate to ops team</div>
              </div>
            </div>
            <span style={{ minWidth: 22, height: 22, padding: "0 6px", borderRadius: 11, background: "var(--adm-accent-light)", color: "var(--adm-accent)", fontSize: "0.7rem", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {filteredAlerts.filter(a => a.status === "Pending").length}
            </span>
          </div>
          <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--adm-border)" }}>
            {role === "superadmin" ? (
              <CustomSelect<AirportFilter>
                label="Filter by airport"
                options={AIRPORT_OPTIONS}
                value={aiAirport}
                onChange={setAiAirport}
              />
            ) : (
              <CustomSelect<RiskFilter>
                label="Filter by risk"
                options={RISK_OPTIONS}
                value={aiRisk}
                onChange={setAiRisk}
              />
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            {filteredAlerts.length === 0 && (
              <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--adm-text-muted)", fontSize: "0.8rem" }}>No recommendations match this filter.</div>
            )}
            {filteredAlerts.map(a => {
              const riskColor = a.risk >= 70 ? "#F87171" : a.risk >= 40 ? "#FBBF24" : "#34D399";
              const team = TEAM_META[a.team];
              const TeamIcon = team.icon;
              const isPending = a.status === "Pending";
              const isRejected = a.status === "Rejected";
              const isEscalated = a.status === "Escalated";
              return (
                <div key={a.flight} style={{
                  padding: "0.9rem", borderRadius: 12,
                  border: `1px solid ${isEscalated ? "rgba(96,165,250,0.35)" : isRejected ? "rgba(148,163,184,0.25)" : "var(--adm-border)"}`,
                  background: isEscalated ? "rgba(96,165,250,0.06)" : isRejected ? "rgba(148,163,184,0.04)" : "rgba(255,255,255,0.02)",
                  opacity: isRejected ? 0.7 : 1,
                  transition: "all 200ms ease",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--adm-text)" }}>{a.flight}</span>
                        <span style={{ fontSize: "0.66rem", color: "var(--adm-text-muted)", padding: "1px 6px", border: "1px solid var(--adm-border)", borderRadius: 4 }}>{a.airport}</span>
                      </div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--adm-text)", marginTop: 4 }}>{a.title}</div>
                    </div>
                    <span style={{ padding: "3px 8px", borderRadius: 999, background: `${riskColor}22`, color: riskColor, fontSize: "0.66rem", fontWeight: 800, border: `1px solid ${riskColor}40`, whiteSpace: "nowrap" }}>{a.risk}% risk</span>
                  </div>

                  {/* AI suggestion */}
                  <div style={{ padding: "0.55rem 0.7rem", borderRadius: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)", marginBottom: 8 }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--adm-accent)", marginBottom: 3 }}>AI Suggestion</div>
                    <div style={{ fontSize: "0.76rem", color: "var(--adm-text-sub)", lineHeight: 1.4 }}>{a.action}</div>
                  </div>

                  {/* Responsible team */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: "0.72rem" }}>
                    <span style={{ color: "var(--adm-text-muted)" }}>Route to:</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 999, background: `${team.color}1a`, color: team.color, border: `1px solid ${team.color}40`, fontWeight: 700 }}>
                      <TeamIcon size={11} /> {a.team}
                    </span>
                  </div>

                  {/* Status / actions */}
                  {isPending ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => updateAlert(a.flight, { status: "Rejected" })}
                        style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid var(--adm-border)", background: "transparent", color: "var(--adm-text-sub)", fontSize: "0.74rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 150ms" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.10)"; e.currentTarget.style.color = "#F87171"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.35)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--adm-text-sub)"; e.currentTarget.style.borderColor = "var(--adm-border)"; }}
                      >
                        <XCircle size={13} /> Reject
                      </button>
                      <button
                        onClick={() => updateAlert(a.flight, { status: "Escalated" })}
                        style={{ flex: 1.4, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "0.45rem 0.6rem", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #2563EB, #60A5FA)", color: "#fff", fontSize: "0.74rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 10px rgba(37,99,235,0.35)" }}
                      >
                        <BellRing size={13} /> Notify {a.team}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6, borderTop: "1px dashed var(--adm-border)" }}>
                      {isEscalated ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: "#60A5FA", fontWeight: 700 }}>
                          <BellRing size={12} /> Escalated to {a.team}
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: "var(--adm-text-muted)", fontWeight: 700 }}>
                          <XCircle size={12} /> Rejected by admin
                        </span>
                      )}
                      <button
                        onClick={() => updateAlert(a.flight, { status: "Pending" })}
                        style={{ background: "none", border: "none", color: "var(--adm-accent)", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Undo
                      </button>
                    </div>
                  )}

                  <div style={{ marginTop: 8, fontSize: "0.66rem", color: "var(--adm-text-muted)", textAlign: "right" }}>{a.time}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {openFlight && <FlightDetailModal f={openFlight} onClose={() => setOpenFlight(null)} />}
    </>
  );
}

function FlightDetailModal({ f, onClose }: { f: FlightRow; onClose: () => void }) {
  const isDelayed = f.delay > 0;
  const aiRisk = isDelayed ? 43 : 12;
  const meta = STATUS_META[f.status];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,8,20,0.7)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "3rem 1rem", overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 720, background: "var(--adm-card)", border: "1px solid var(--adm-border)", borderRadius: 16, boxShadow: "var(--adm-shadow-md)", overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--adm-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--adm-text)", letterSpacing: "-0.01em" }}>Flight {f.num}</h2>
                <span style={{ padding: "3px 10px", borderRadius: 999, background: `${meta.dot}1f`, color: meta.dot, fontSize: "0.7rem", fontWeight: 700, border: `1px solid ${meta.dot}40` }}>{f.status}</span>
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--adm-text-muted)" }}>{f.airline}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: "0.85rem", color: "var(--adm-text-sub)" }}>
                <MapPin size={14} style={{ color: "var(--adm-accent)" }} /> {f.route.split(" → ")[0]}
                <Plane size={14} style={{ color: "var(--adm-accent)" }} />
                <MapPin size={14} style={{ color: "var(--adm-accent)" }} /> {f.route.split(" → ")[1]}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--adm-text-muted)", cursor: "pointer", padding: 6 }}><X size={20} /></button>
          </div>
        </div>

        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.85rem" }}>
            <div style={{ padding: "1rem", border: "1px solid var(--adm-border)", borderRadius: 12, background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--adm-text-muted)", marginBottom: 8 }}><Clock size={11} style={{ display: "inline", marginRight: 4 }} /> DEPARTURE TIMES</div>
              <div style={{ fontSize: "0.7rem", color: "var(--adm-text-muted)" }}>Scheduled</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--adm-text)" }}>{f.time}</div>
              {isDelayed && <>
                <div style={{ marginTop: 8, fontSize: "0.7rem", color: "var(--adm-text-muted)" }}>Actual / Estimated</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#F87171" }}>(+{f.delay} min)</div>
                <div style={{ fontSize: "0.72rem", color: "var(--adm-accent)", fontWeight: 600 }}>Delay: {f.delay} minutes</div>
              </>}
            </div>
            <div style={{ padding: "1rem", border: "1px solid var(--adm-border)", borderRadius: 12, background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--adm-text-muted)", marginBottom: 8 }}><MapPin size={11} style={{ display: "inline", marginRight: 4 }} /> GATE INFORMATION</div>
              <div style={{ display: "flex", gap: 18 }}>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--adm-text-muted)" }}>Terminal</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--adm-text)" }}>{f.terminal}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--adm-text-muted)" }}>Gate</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--adm-text)" }}>{f.gate}</div>
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: "0.78rem", color: "var(--adm-text-sub)" }}>{f.aircraft}</div>
            </div>
            <div style={{ padding: "1rem", border: "1px solid var(--adm-border)", borderRadius: 12, background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--adm-text-muted)", marginBottom: 8 }}>AI DELAY PROBABILITY</div>
              <div style={{ position: "relative", width: 110, height: 110 }}>
                <svg width="110" height="110" viewBox="0 0 110 110">
                  <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                  <circle cx="55" cy="55" r="46" fill="none" stroke="var(--adm-accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(aiRisk / 100) * 289} 289`} transform="rotate(-90 55 55)" />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--adm-accent)" }}>{aiRisk}%</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--adm-text-muted)" }}>{aiRisk > 60 ? "High" : aiRisk > 30 ? "Medium" : "Low"} Risk</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <div style={{ padding: "1rem", border: "1px solid var(--adm-border)", borderRadius: 12, background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--adm-accent)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={13} /> AI RISK ANALYSIS</div>
              <div style={{ fontSize: "0.78rem", color: "var(--adm-text-muted)", marginBottom: 12 }}>Our AI model has identified the following factors contributing to the delay risk:</div>
              {[
                { l: "Weather Conditions", v: 93 },
                { l: "Air Traffic Congestion", v: 71 },
                { l: "Aircraft Turnaround Time", v: 49 },
                { l: "Historical Performance", v: 53 },
              ].map(r => (
                <div key={r.l} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", marginBottom: 4 }}>
                    <span style={{ color: "var(--adm-text-sub)" }}>{r.l}</span>
                    <span style={{ color: "var(--adm-text)", fontWeight: 700 }}>{r.v}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ width: `${r.v}%`, height: "100%", background: "linear-gradient(90deg, #60A5FA, #F59E0B)" }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "1rem", border: "1px solid var(--adm-border)", borderRadius: 12, background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#60A5FA", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><CloudRain size={13} /> WEATHER IMPACT</div>
              <div style={{ padding: "0.7rem", borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)", marginBottom: 12 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--adm-accent)", marginBottom: 2 }}>⚠ Weather Advisory</div>
                <div style={{ fontSize: "0.74rem", color: "var(--adm-text-sub)" }}>Thunderstorms reported in the area. Moderate delays expected.</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--adm-text-muted)" }}>Origin ({f.route.split(" → ")[0]})</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#34D399" }}>Clear, 22°C</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--adm-text-muted)" }}>Good Conditions</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--adm-text-muted)" }}>Destination ({f.route.split(" → ")[1]})</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#F87171" }}>Storms, 18°C</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--adm-text-muted)" }}>Poor Conditions</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: "1rem", border: "1px solid var(--adm-border)", borderRadius: 12, background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#60A5FA", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Radio size={13} /> FLIGHT TIMELINE</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Check-in open", "Boarding", "Push-back", "Take-off", "Cruise", "Landing"].map((s, i) => (
                <div key={s} style={{ flex: "1 1 110px", padding: "0.55rem 0.7rem", borderRadius: 8, background: i < 2 ? "var(--adm-accent-light)" : "rgba(255,255,255,0.03)", border: `1px solid ${i < 2 ? "var(--adm-accent)" : "var(--adm-border)"}`, fontSize: "0.74rem", color: i < 2 ? "var(--adm-accent)" : "var(--adm-text-sub)", fontWeight: 600, textAlign: "center" }}>
                  {s}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
            <button onClick={onClose} className="admin-btn admin-btn--outline">Close</button>
            <button className="admin-btn admin-btn--primary"><BellRing size={14} /><span>Notify Crew</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

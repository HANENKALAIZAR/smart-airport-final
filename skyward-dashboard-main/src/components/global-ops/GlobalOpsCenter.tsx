import { motion, type Variants } from "framer-motion";
import { useState } from "react";
import {
  BrainCircuit,
  Globe,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plane,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { RadarChart, type RadarMetric } from "@/components/global-ops/RadarChart";
import { DelayHeatmap } from "@/components/global-ops/DelayHeatmap";
import { WeatherImpact } from "@/components/global-ops/WeatherImpact";
import { AirlineRankings } from "@/components/global-ops/AirlineRankings";

type RiskLevel = "Low" | "Medium" | "High";

interface AirportRow {
  code: string;
  name: string;
  city: string;
  totalFlights: number;
  delayed: number;
  onTimePct: number;
  aiAcc: number;
  risk: RiskLevel;
  perf: number;
}

const AIRPORTS: AirportRow[] = [
  { code: "TUN", name: "Tunis-Carthage", city: "Tunis", totalFlights: 147, delayed: 12, onTimePct: 91.8, aiAcc: 94, risk: "Low", perf: 92 },
  { code: "MIR", name: "Habib Bourguiba", city: "Monastir", totalFlights: 189, delayed: 35, onTimePct: 81.5, aiAcc: 85, risk: "High", perf: 45 },
  { code: "DJE", name: "Zarzis", city: "Djerba", totalFlights: 178, delayed: 18, onTimePct: 89.9, aiAcc: 91, risk: "Low", perf: 80 },
  { code: "NBE", name: "Hammamet", city: "Enfidha", totalFlights: 172, delayed: 20, onTimePct: 88.4, aiAcc: 90, risk: "Low", perf: 78 },
];

const RADAR_METRICS: RadarMetric[] = [
  { label: "OTP", value: 87 },
  { label: "AI Accuracy", value: 91 },
  { label: "Response", value: 78 },
  { label: "Resources", value: 82 },
  { label: "Satisfaction", value: 85 },
];

const totalFlights = AIRPORTS.reduce((s, a) => s + a.totalFlights, 0);
const globalOTP = (AIRPORTS.reduce((s, a) => s + a.onTimePct, 0) / AIRPORTS.length).toFixed(1);
const highRiskApts = AIRPORTS.filter((a) => a.risk === "High").length;

const riskStyle: Record<RiskLevel, string> = {
  Low: "bg-success/10 text-success border-success/30",
  Medium: "bg-warning/10 text-warning border-warning/30",
  High: "bg-danger/10 text-danger border-danger/30",
};

const perfGradient = (p: number) =>
  p >= 80 ? "bg-gradient-success" : p >= 60 ? "bg-gradient-warning" : "bg-gradient-danger";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE, delay: i * 0.06 },
  }),
};

type AccentKey = "cyan" | "info" | "success" | "danger" | "violet";

const accentMap: Record<AccentKey, { text: string; glow: string; bar: string }> = {
  cyan:    { text: "text-primary", glow: "from-primary/20", bar: "bg-gradient-cyan" },
  info:    { text: "text-info",    glow: "from-info/20",    bar: "bg-info" },
  success: { text: "text-success", glow: "from-success/20", bar: "bg-gradient-success" },
  danger:  { text: "text-danger",  glow: "from-danger/20",  bar: "bg-gradient-danger" },
  violet:  { text: "text-violet",  glow: "from-violet/20",  bar: "bg-gradient-violet" },
};

interface KpiCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  accent: AccentKey;
  trend?: { dir: "up" | "down"; value: string };
  barPct: number;
  i: number;
}

function KpiCard({ title, value, icon: Icon, accent, trend, barPct, i }: KpiCardProps) {
  const a = accentMap[accent];
  return (
    <motion.div
      custom={i}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      whileHover={{ y: -3 }}
      className="glass-card group relative overflow-hidden p-5"
    >
      <div className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${a.glow} to-transparent opacity-60 blur-2xl transition-opacity group-hover:opacity-100`} />
      <div className="relative flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-surface-3/60 ${a.text}`}>
          <Icon size={18} strokeWidth={2.2} />
        </div>
      </div>
      <div className="relative mt-5 flex items-baseline gap-2">
        <span className={`font-display text-4xl font-semibold tracking-tight ${a.text} font-mono-num`}>
          {value}
        </span>
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
              trend.dir === "up" ? "text-success" : "text-danger"
            }`}
          >
            {trend.dir === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}
          </span>
        )}
      </div>
      <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-surface-3/80">
        <motion.div
          className={`h-full rounded-full ${a.bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${barPct}%` }}
          transition={{ duration: 1, delay: 0.2 + i * 0.05, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );
}

const SCOPES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
] as const;

type ScopeId = (typeof SCOPES)[number]["id"];

function AnalyticsTier() {
  const [scope, setScope] = useState<ScopeId>("7d");
  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 border-t border-border/60 pt-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
            <BarChart3 size={12} className="text-violet" />
            Analytics Lens
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            Historical{" "}
            <span className="bg-gradient-violet bg-clip-text text-transparent">Insights</span>
          </h2>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Trend analysis and root-cause indicators across the selected window.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface-2/60 p-1 backdrop-blur">
          {SCOPES.map((s) => {
            const active = s.id === scope;
            return (
              <button
                key={s.id}
                onClick={() => setScope(s.id)}
                className={`relative rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="scope-pill"
                    className="absolute inset-0 rounded-lg bg-gradient-cyan shadow-glow"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <motion.div
        key={`heatmap-${scope}`}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="glass-card p-6"
      >
        <DelayHeatmap />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <motion.div
          key={`weather-${scope}`}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="glass-card p-6 lg:col-span-2"
        >
          <WeatherImpact />
        </motion.div>
        <motion.div
          key={`rankings-${scope}`}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="glass-card p-6 lg:col-span-3"
        >
          <AirlineRankings />
        </motion.div>
      </div>
    </motion.section>
  );
}

export default function GlobalOpsCenter() {
  return (
    <div className="text-foreground">
      {/* Header */}
      <motion.header
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="mb-10 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end"
      >
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Live · Updated 12s ago
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Global Operations{" "}
            <span className="bg-gradient-cyan bg-clip-text text-transparent">Center</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            Multi-airport system monitoring · real-time AI-assisted performance intelligence.
          </p>
        </div>
      </motion.header>

      {/* KPI grid */}
      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard i={0} title="Total Airports" value={String(AIRPORTS.length)} icon={Globe} accent="info" barPct={100} />
        <KpiCard i={1} title="Total Flights" value={totalFlights.toLocaleString()} icon={Plane} accent="cyan" barPct={75} trend={{ dir: "up", value: "1.5%" }} />
        <KpiCard i={2} title="Global OTP" value={`${globalOTP}%`} icon={TrendingUp} accent="success" barPct={Number(globalOTP)} trend={{ dir: "up", value: "1.5%" }} />
        <KpiCard i={3} title="High-Risk Airports" value={String(highRiskApts)} icon={AlertTriangle} accent="danger" barPct={(highRiskApts / AIRPORTS.length) * 100} />
        <KpiCard i={4} title="AI Accuracy" value="91.0%" icon={BrainCircuit} accent="violet" barPct={91} trend={{ dir: "down", value: "0.8%" }} />
      </section>

      {/* Airport performance table */}
      <motion.section variants={fadeUp} initial="hidden" animate="show" className="glass-card mb-8 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-5">
          <div>
            <h2 className="font-display text-lg font-semibold">Airport Performance Overview</h2>
            <p className="text-xs text-muted-foreground">Live OTP, delays and AI risk across the network</p>
          </div>
          <span className="rounded-full border border-border bg-surface-3/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            {AIRPORTS.length} stations
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-medium">Airport</th>
                <th className="px-6 py-3 font-medium">Total Flights</th>
                <th className="px-6 py-3 font-medium">Delayed</th>
                <th className="px-6 py-3 font-medium">On-Time</th>
                <th className="px-6 py-3 font-medium">Risk Level</th>
                <th className="px-6 py-3 font-medium">Performance</th>
              </tr>
            </thead>
            <tbody>
              {AIRPORTS.map((apt, idx) => (
                <motion.tr
                  key={apt.code}
                  custom={idx}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  className="border-t border-border/40 transition hover:bg-surface-2/60"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-3/60 font-mono-num text-xs font-bold text-primary">
                        {apt.code}
                      </div>
                      <div>
                        <div className="font-semibold">{apt.name}</div>
                        <div className="text-xs text-muted-foreground">{apt.city}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono-num font-semibold">{apt.totalFlights}</td>
                  <td className={`px-6 py-4 font-mono-num font-semibold ${apt.delayed > 25 ? "text-danger" : "text-warning"}`}>
                    {apt.delayed}
                  </td>
                  <td className={`px-6 py-4 font-mono-num font-semibold ${apt.onTimePct >= 88 ? "text-success" : "text-warning"}`}>
                    {apt.onTimePct}%
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${riskStyle[apt.risk]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {apt.risk}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-3">
                        <motion.div
                          className={`h-full rounded-full ${perfGradient(apt.perf)}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${apt.perf}%` }}
                          transition={{ duration: 0.9, delay: 0.2 + idx * 0.08, ease: "easeOut" }}
                        />
                      </div>
                      <span className="font-mono-num text-xs font-semibold text-muted-foreground">{apt.perf}</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* Bottom row */}
      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card p-6 lg:col-span-3">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Performance Comparison</h3>
              <p className="text-xs text-muted-foreground">On-time percentage vs AI accuracy by station</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-success" /> On-Time
              </span>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm bg-gradient-cyan" /> AI Accuracy
              </span>
            </div>
          </div>

          <div className="flex h-72 gap-4">
            <div className="flex h-full flex-col justify-between py-1 text-[10px] font-medium text-muted-foreground">
              {[100, 75, 50, 25, 0].map((v) => (
                <span key={v} className="font-mono-num">{v}</span>
              ))}
            </div>
            <div className="relative flex flex-1 items-end gap-6 border-l border-border/50 pl-4">
              <div className="pointer-events-none absolute inset-0 ml-4 flex flex-col justify-between">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="border-t border-dashed border-border/30" />
                ))}
              </div>
              {AIRPORTS.map((apt, i) => (
                <div key={apt.code} className="group relative flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-full w-full items-end justify-center gap-1.5">
                    <motion.div
                      title={`On-Time ${apt.onTimePct}%`}
                      className="relative w-1/2 overflow-hidden rounded-t-md bg-gradient-success"
                      initial={{ height: 0 }}
                      animate={{ height: `${apt.onTimePct}%` }}
                      transition={{ duration: 1, delay: 0.2 + i * 0.1, ease: EASE }}
                    >
                      <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-success opacity-0 transition group-hover:opacity-100 font-mono-num">
                        {apt.onTimePct}
                      </span>
                    </motion.div>
                    <motion.div
                      title={`AI Accuracy ${apt.aiAcc}%`}
                      className="relative w-1/2 overflow-hidden rounded-t-md bg-gradient-cyan"
                      initial={{ height: 0 }}
                      animate={{ height: `${apt.aiAcc}%` }}
                      transition={{ duration: 1, delay: 0.3 + i * 0.1, ease: EASE }}
                    >
                      <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-primary opacity-0 transition group-hover:opacity-100 font-mono-num">
                        {apt.aiAcc}
                      </span>
                    </motion.div>
                  </div>
                  <span className="font-mono-num text-xs font-semibold text-muted-foreground">{apt.code}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" className="glass-card flex flex-col items-center p-6 lg:col-span-2">
          <div className="mb-2 w-full">
            <h3 className="font-display text-base font-semibold">Global System Health</h3>
            <p className="text-xs text-muted-foreground">Composite operational signals</p>
          </div>
          <div className="flex flex-1 items-center justify-center py-2">
            <RadarChart metrics={RADAR_METRICS} size={280} />
          </div>
          <div className="mt-2 flex w-full items-center justify-between rounded-xl border border-border/60 bg-surface-2/60 px-4 py-3">
            <span className="text-xs text-muted-foreground">Composite score</span>
            <span className="font-mono-num text-lg font-semibold text-primary">84.6</span>
          </div>
        </motion.div>
      </section>

      <AnalyticsTier />
    </div>
  );
}

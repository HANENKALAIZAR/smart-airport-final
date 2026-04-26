import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FlightArcMap } from "@/components/FlightArcMap";
import { StatusBadge } from "@/components/StatusBadge";
import { useCountdown, formatTime, formatDate } from "@/lib/time";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, Clock, Cloud, Luggage, Plane,
  ShieldCheck, TrendingUp, Wind, Loader2, AlertTriangle,
  Info, Brain, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFlight, type Flight, type FlightPrediction } from "@/services/api";

// ── Helpers ────────────────────────────────────────────────────────────────
function RiskBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-destructive" : score >= 40 ? "bg-warning" : "bg-success";
  const label = score >= 70 ? "Risque élevé" : score >= 40 ? "Risque modéré" : "Faible risque";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span><span>{Math.round(score)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${score}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

function ShapBar({ label, value, maxVal }: { label: string; value: number; maxVal: number }) {
  const pct = maxVal > 0 ? Math.min(100, (Math.abs(value) / maxVal) * 100) : 0;
  const color = value > 0 ? "bg-destructive/70" : "bg-success/70";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground truncate max-w-[160px]">{label}</span>
        <span className={value > 0 ? "text-destructive" : "text-success"}>
          {value > 0 ? "+" : ""}{value.toFixed(2)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────
const FlightDetail = () => {
  const { id }   = useParams<{ id: string }>();
  const nav      = useNavigate();
  const { i18n } = useTranslation();
  const locale   = i18n.language === "fr" ? "fr-FR" : i18n.language === "ar" ? "ar" : "en-US";

  const [flight,  setFlight]  = useState<Flight | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShap, setShowShap] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getFlight(id).then(f => { setFlight(f); setLoading(false); });
  }, [id]);

  const cd = useCountdown(flight?.departureTime ?? new Date().toISOString());

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm">Chargement du vol…</span>
      </div>
    </div>
  );

  if (!flight) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-3">
        <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">Vol introuvable.</p>
        <Button variant="ghost" onClick={() => nav(-1)}>Retour</Button>
      </div>
    </div>
  );

  const pred = flight.prediction;
  const isInAir = flight.status === "on_time" && flight.progress > 0 && flight.progress < 1;

  const steps = [
    { key: "checkIn",  icon: CheckCircle2, done: true },
    { key: "security", icon: ShieldCheck,  done: true },
    { key: "boarding", icon: Plane,        done: flight.status !== "scheduled", active: flight.status === "boarding" },
    { key: "takeoff",  icon: TrendingUp,   done: isInAir || flight.status === "landed", active: false },
    { key: "cruising", icon: Wind,         done: flight.status === "landed", active: isInAir },
    { key: "landing",  icon: Cloud,        done: flight.status === "landed", active: false },
    { key: "arrival",  icon: Luggage,      done: flight.status === "landed", active: false },
  ];

  const stepLabels: Record<string, string> = {
    checkIn: "Check-in", security: "Sécurité", boarding: "Embarquement",
    takeoff: "Décollage", cruising: "En vol", landing: "Atterrissage", arrival: "Arrivée",
  };

  // Top facteurs SHAP
  const shapEntries = pred?.shapExplanation
    ? Object.entries(pred.shapExplanation).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6)
    : [];
  const maxShap = shapEntries.length > 0 ? Math.abs(shapEntries[0][1]) : 1;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => nav(-1)} className="gap-2 -ms-3 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 rtl-flip" /> Retour
      </Button>

      {/* Hero carte de vol */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-lg"
      >
        <div className="absolute inset-0 opacity-90">
          <FlightArcMap from={flight.from} to={flight.to} progress={flight.progress} className="h-full w-full" />
        </div>
        <div className="relative p-6 md:p-8 min-h-[420px] flex flex-col bg-gradient-to-b from-background/95 via-background/30 to-background/90">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Suivi · <span className="font-mono">{flight.flightNumber}</span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl mt-1">
                {flight.from.city} <span className="text-muted-foreground/50">→</span> {flight.to.city}
              </h1>
              <div className="text-sm text-muted-foreground mt-1">{flight.airline} · {flight.aircraft}</div>
            </div>
            <StatusBadge status={flight.status} />
          </div>

          <div className="mt-auto pt-8 grid md:grid-cols-3 gap-6">
            <Stat label="Départ" value={formatTime(flight.departureTime, locale)}
              sub={`${flight.from.code} · ${formatDate(flight.departureTime, locale)}`} />
            <Stat
              label={isInAir ? "Progression" : "Compte à rebours"}
              value={isInAir ? `${Math.round(flight.progress * 100)}%`
                : `${cd.hours}h ${String(cd.minutes).padStart(2, "0")}m`}
              sub={isInAir ? `${Math.round((1 - flight.progress) * flight.durationMin)} min restantes` : undefined}
            />
            <Stat label="Arrivée" value={formatTime(flight.arrivalTime, locale)}
              sub={`${flight.to.code} · ${formatDate(flight.arrivalTime, locale)}`} align="end" />
          </div>
        </div>
      </motion.div>

      {/* Retard + cause */}
      {flight.delayMin > 0 && flight.delayCause && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="surface-card rounded-2xl p-6 border-l-4 border-destructive/60">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{flight.delayCause.icon}</span>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-destructive">{flight.delayCause.title}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                  +{flight.delayMin} min
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{flight.delayCause.summary}</p>
              <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-info/5 border border-info/20">
                <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">{flight.delayCause.passengerTip}</p>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Timeline */}
      <section className="surface-card rounded-2xl p-6 md:p-8">
        <h3 className="font-display text-2xl mb-6">Étapes du voyage</h3>
        <div className="relative">
          <div className="absolute top-5 start-5 end-5 h-px bg-border hidden md:block" />
          <div className="absolute top-5 start-5 h-px bg-gradient-amber hidden md:block"
            style={{ width: `${(steps.filter(s => s.done).length / steps.length) * 90}%` }} />
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-6">
            {steps.map((s, i) => {
              const state = s.done ? "done" : s.active ? "active" : "upcoming";
              return (
                <motion.div key={s.key}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="relative flex flex-col items-center text-center">
                  <div className={`relative grid place-items-center h-10 w-10 rounded-full border-2 ${
                    state === "done"   ? "bg-primary border-primary text-primary-foreground"
                    : state === "active" ? "bg-background border-primary text-primary"
                    : "bg-background border-border text-muted-foreground/50"}`}>
                    {state === "active" && <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />}
                    <s.icon className="relative h-4 w-4" />
                  </div>
                  <div className="mt-3 text-xs font-medium">{stepLabels[s.key]}</div>
                  <div className="text-[10px] uppercase tracking-wider mt-1 text-muted-foreground">
                    {state === "done" ? "Terminé" : state === "active" ? "En cours" : "À venir"}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Infos vol */}
      <div className="grid md:grid-cols-3 gap-4">
        <InfoCard title="Porte" value={flight.gate ?? "—"} sub={`Terminal ${flight.terminal ?? "—"}`} />
        <InfoCard title="Appareil" value={flight.aircraft} sub={`${Math.floor(flight.durationMin / 60)}h ${flight.durationMin % 60}m de vol`} />
        <InfoCard title="Distance" value={`${flight.distanceKm.toLocaleString()} km`} sub={`Fiabilité compagnie : ${flight.onTimeHistory}%`} />
      </div>

      {/* Prédiction AI */}
      {pred ? (
        <section className="surface-card rounded-2xl p-6 md:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-display text-2xl">Prédiction AI</h3>
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-primary border border-primary/30 rounded-full px-2 py-0.5">
              {pred.modelVersion ?? "ML Model"}
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Score de risque</div>
              <RiskBar score={pred.riskScore} />
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Retard prédit</div>
              <div className="font-display text-3xl tabular">
                {pred.predictedDelayMin > 0 ? `+${pred.predictedDelayMin} min` : "À l'heure"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Confiance : {Math.round(pred.confidence * 100)}%
              </div>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Ponctualité compagnie</div>
              <div className="font-display text-3xl tabular">{flight.onTimeHistory}%</div>
              <div className="text-xs text-muted-foreground mt-1">Historique des vols</div>
            </div>
          </div>

          {/* Facteurs SHAP */}
          {shapEntries.length > 0 && (
            <div>
              <button onClick={() => setShowShap(v => !v)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3">
                Facteurs explicatifs
                {showShap ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showShap && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="space-y-3 pt-1">
                  {shapEntries.map(([label, value]) => (
                    <ShapBar key={label} label={label} value={value} maxVal={maxShap} />
                  ))}
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Valeurs SHAP — rouge = augmente le risque · vert = réduit le risque
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="surface-card rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-display text-2xl">Prédiction AI</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Insight tone="success" title="Historique ponctualité"
              body={`Cette compagnie est à l'heure ${flight.onTimeHistory}% du temps sur cette route.`} />
            <Insight tone="info" title="Impact météo"
              body="Connectez le backend pour obtenir les prédictions météo en temps réel." />
            <Insight tone="primary" title="Prédiction ML"
              body="Démarrez le backend FastAPI pour activer les prédictions XGBoost en direct." />
          </div>
        </section>
      )}

      {/* Droits passagers */}
      {flight.passengerRights && flight.passengerRights.length > 0 && (
        <section className="surface-card rounded-2xl p-6 md:p-8">
          <h3 className="font-display text-2xl mb-4">Vos droits passager</h3>
          <div className="space-y-3">
            {flight.passengerRights.map((r, i) => (
              <div key={i} className="rounded-xl border border-border p-4 flex gap-3">
                <div className="grid place-items-center h-8 w-8 rounded-lg bg-info/10 text-info shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wider text-info">{r.regulation}</span>
                    <span className="text-xs text-muted-foreground">Délai &gt; {r.delayThreshold} min</span>
                    {r.compensation && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 font-semibold">
                        {r.compensation}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// ── Sous-composants ────────────────────────────────────────────────────────
function Stat({ label, value, sub, align = "start" }: { label: string; value: string; sub?: string; align?: "start" | "end" }) {
  return (
    <div className={align === "end" ? "md:text-end" : ""}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="font-display text-3xl tabular mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1 font-mono">{sub}</div>}
    </div>
  );
}

function InfoCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="surface-card rounded-xl p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="font-display text-2xl mt-1 tabular">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Insight({ tone, title, body }: { tone: "success" | "info" | "primary"; title: string; body: string }) {
  const toneCls = {
    success: "border-success/30 bg-success/5 text-success",
    info:    "border-info/30 bg-info/5 text-info",
    primary: "border-primary/30 bg-primary/5 text-primary",
  }[tone];
  return (
    <div className={`rounded-xl border ${toneCls} p-5`}>
      <div className="text-xs uppercase tracking-wider font-semibold">{title}</div>
      <div className="mt-2 text-sm text-foreground/80 leading-relaxed">{body}</div>
    </div>
  );
}

export default FlightDetail;

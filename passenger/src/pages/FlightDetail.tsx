import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPassengerFlight, getPassengerPrediction, type Flight, type FlightPrediction } from "@/services/api";
import { FlightArcMap } from "@/components/FlightArcMap";
import { StatusBadge } from "@/components/StatusBadge";
import { useCountdown, formatTime, formatDate } from "@/lib/time";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, Cloud, Luggage, Plane, ShieldCheck,
  TrendingUp, Wind, Brain, AlertTriangle, Radio, Scale, Coffee, Hotel, Euro, FileText, ArrowRight,
  Sparkles, Bell, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const FlightDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const [flight, setFlight] = useState<Flight | null>(location.state?.flight || null);
  const [error, setError] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertSaving, setAlertSaving] = useState(false);
  const [livePrediction, setLivePrediction] = useState<FlightPrediction | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);

  // ── Types ─────────────────────────────────────────────────────────────
  // (Using FlightPrediction from api.ts)

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;

    const loadData = async () => {
      if (!id) return;
      try {
        const data = await getPassengerFlight(id);
        if (data && !cancelled) {
          setFlight(data);
          setError(false);
        } else if (!cancelled) {
          setError(true);
        }
      } catch (err) {
        if (!cancelled) setError(true);
      }
    };

    loadData();
    interval = setInterval(loadData, 30000); // 30s instead of 15s to respect AE API limits

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  // ── Fetch real ML prediction from backend ──────────────────────
  useEffect(() => {
    if (!flight) return;
    const fn = flight.flightNumber;
    if (!fn || fn === 'UNKNOWN') return;
    
    setPredictionLoading(true);
    getPassengerPrediction(fn)
      .then(pred => {
        if (pred) setLivePrediction(pred);
      })
      .catch(() => null)
      .finally(() => setPredictionLoading(false));
  }, [flight?.flightNumber]);

  const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "ar" ? "ar" : "en-US";
  const cd = useCountdown(flight?.departureTime ?? new Date().toISOString());

  if (error) return (
    <div className="py-24 text-center">
      <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
      <h2 className="text-2xl font-display mb-2">Flight Not Found</h2>
      <p className="text-muted-foreground mb-6">We couldn't find details for flight ID: {id}</p>
      <Button onClick={() => nav("/flights")}>Back to Flights</Button>
    </div>
  );

  if (!flight) return (
    <div className="py-24 text-center text-muted-foreground">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
      Loading flight details...
    </div>
  );

  // ───────────────────── Real ML Prediction ─────────────────────
  // Use prediction from flight.prediction (DB flights) or livePrediction (live flights)
  const pred: FlightPrediction | null = flight.prediction ?? livePrediction ?? null;

  // ───────────────────── Passenger Rights (from DB) ─────────────
  // Use rights returned by the backend (/api/flights/{id}) — never compute on frontend
  const dbRights = flight.passengerRights ?? [];

  const steps = [
    { key: "checkIn",   icon: CheckCircle2, done: true,                                           active: false,                      scheduled: addMin(flight.scheduledDeparture, -180), estimated: addMin(flight.departureTime, -180) },
    { key: "boarding",  icon: Plane,        done: flight.status !== "scheduled",                  active: flight.status === "boarding", scheduled: addMin(flight.scheduledDeparture, -40),  estimated: addMin(flight.departureTime, -40) },
    { key: "departure", icon: TrendingUp,   done: ["in_air","landed"].includes(flight.status),    active: flight.status === "boarding", scheduled: flight.scheduledDeparture,               estimated: flight.departureTime },
    { key: "takeoff",   icon: Wind,         done: ["in_air","landed"].includes(flight.status),    active: false,                       scheduled: addMin(flight.scheduledDeparture, 15),    estimated: addMin(flight.departureTime, 15) },
    { key: "landing",   icon: Cloud,        done: flight.status === "landed",                     active: flight.status === "in_air",  scheduled: addMin(flight.scheduledArrival, -10),     estimated: addMin(flight.arrivalTime, -10) },
    { key: "arrival",   icon: Luggage,      done: flight.status === "landed",                     active: false,                       scheduled: flight.scheduledArrival,                  estimated: flight.arrivalTime },
  ];


  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => nav(-1)} className="gap-2 -ms-3 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 rtl-flip" /> Back
      </Button>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-lg">
        <div className="absolute inset-0 opacity-90">
          <FlightArcMap from={flight.from} to={flight.to} progress={flight.progress || 0.05} className="h-full w-full" />
        </div>
        <div className="relative p-6 md:p-8 min-h-[420px] flex flex-col bg-gradient-to-b from-background/95 via-background/30 to-background/90">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                {t("flightDetail.track")} · <span className="font-mono">{flight.flightNumber}</span>
              </div>
              <h1 className="font-display text-4xl md:text-5xl mt-1">
                {flight.from.city} <span className="text-muted-foreground/50">→</span> {flight.to.city}
              </h1>
              <div className="text-sm text-muted-foreground mt-1">{flight.airline} · {flight.aircraft}</div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={flight.status} />
              {/* If it's a hex ID (OpenSky), show a live badge */}
              {id?.length === 6 && /^[0-9a-fA-F]+$/.test(id) && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-info/30 bg-info/10 px-2.5 py-0.5 text-[10px] font-semibold text-info uppercase tracking-wider">
                  <Radio className="h-3 w-3" /> Live Data
                </span>
              )}
            </div>
          </div>

          <div className="absolute top-6 end-6 md:top-8 md:end-8">
            <Dialog open={alertsOpen} onOpenChange={setAlertsOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 backdrop-blur bg-background/60 border-primary/40 hover:bg-primary/10">
                  <Bell className="h-4 w-4" /> Activate alerts
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="grid place-items-center h-10 w-10 rounded-xl bg-primary/15 text-primary border border-primary/30">
                      <Bell className="h-5 w-5" />
                    </div>
                    <DialogTitle className="font-display text-xl">Stay updated on {flight.flightNumber}</DialogTitle>
                  </div>
                  <DialogDescription className="text-sm leading-relaxed">
                    We'll send you real-time email updates for delays, gate changes, and boarding calls.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-3">
                  <Label htmlFor="alert-email" className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Email address</Label>
                  <Input id="alert-email" type="email" placeholder="you@example.com" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Used only for flight status alerts. You can unsubscribe at any time by replying STOP.</p>
                </div>
                <DialogFooter className="mt-4">
                  <Button variant="ghost" onClick={() => setAlertsOpen(false)} disabled={alertSaving}>Cancel</Button>
                  <Button disabled={alertSaving} onClick={async () => {
                    if (!alertEmail) { toast({ title: "Email required", description: "Please enter a valid email address.", variant: "destructive" }); return; }
                    setAlertSaving(true);
                    try {
                      const res = await fetch(`${import.meta.env.VITE_API_URL}/passenger/alerts/subscribe`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          email: alertEmail,
                          flight_number: flight.flightNumber,
                          dep_iata: flight.from.code,
                          arr_iata: flight.to.code,
                          scheduled_departure: flight.scheduledDeparture,
                          airline: flight.airline
                        })
                      });
                      if (!res.ok) throw new Error("Failed to subscribe");
                      toast({ title: "Alerts activated", description: `You'll receive live updates at ${alertEmail}.` });
                      setAlertsOpen(false); setAlertEmail("");
                    } catch (err) {
                      toast({ title: "Error", description: "Could not activate alerts. Try again.", variant: "destructive" });
                    } finally {
                      setAlertSaving(false);
                    }
                  }} className="gap-2">
                    {alertSaving ? <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin"/> : <Bell className="h-4 w-4" />}
                    {alertSaving ? "Activating..." : "Activate"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>


          <div className="mt-auto pt-8 grid md:grid-cols-3 gap-6">
            <Stat label={t("common.departure")} value={formatTime(flight.departureTime, locale)} sub={`${flight.from.code} · ${formatDate(flight.departureTime, locale)}`} />
            <Stat
              label={flight.status === "in_air" ? t("flightDetail.flightProgress") : flight.status === "landed" ? "Status" : t("dashboard.countdown")}
              value={flight.status === "in_air" ? `${Math.round(flight.progress * 100)}%` : flight.status === "landed" ? "Arrived" : `${cd.hours}h ${String(cd.minutes).padStart(2, "0")}m`}
              sub={flight.status === "in_air" ? `${Math.round((1 - flight.progress) * flight.durationMin)} ${t("common.minutes")} remaining` : flight.status === "landed" ? "Flight completed" : undefined}
            />
            <Stat label={t("common.arrival")} value={formatTime(flight.arrivalTime, locale)} sub={`${flight.to.code} · ${formatDate(flight.arrivalTime, locale)}`} align="end" />
          </div>
        </div>
      </motion.div>

      {/* Timeline */}
      <section className="surface-card rounded-2xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h3 className="font-display text-2xl">{t("timeline.title")}</h3>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/60" /> Scheduled</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Estimated</span>
          </div>
        </div>
        <div className="relative">
          <div className="absolute top-5 start-5 end-5 h-px bg-border hidden md:block" />
          <div 
            className="absolute top-5 start-5 h-px bg-gradient-amber hidden md:block timeline-progress" 
            style={{ "--progress-width": `${(steps.filter(s => s.done).length / steps.length) * 90}%` } as React.CSSProperties} 
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6">
            {steps.map((s, i) => {
              const state = s.done ? "done" : s.active ? "active" : "upcoming";
              const sched = formatTime(s.scheduled, locale);
              const est = formatTime(s.estimated, locale);
              const drift = Math.round((new Date(s.estimated).getTime() - new Date(s.scheduled).getTime()) / 60000);
              return (
                <motion.div key={s.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="relative flex flex-col items-center text-center">
                  <div className={`relative grid place-items-center h-10 w-10 rounded-full border-2 ${
                    state === "done" ? "bg-primary border-primary text-primary-foreground"
                    : state === "active" ? "bg-background border-primary text-primary"
                    : "bg-background border-border text-muted-foreground/50"}`}>
                    {state === "active" && <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />}
                    <s.icon className="relative h-4 w-4" />
                  </div>
                  <div className="mt-3 text-xs font-medium">{t(`timeline.${s.key}`, { defaultValue: defaultStepLabel(s.key) })}</div>
                  <div className="mt-2 space-y-0.5">
                    <div className="text-[10px] text-muted-foreground tabular">Sched · <span className="font-mono">{sched}</span></div>
                    <div className={`text-[10px] tabular ${drift > 0 ? "text-warning" : "text-primary"}`}>
                      Est · <span className="font-mono">{est}</span>
                      {drift > 0 && <span className="ms-1">(+{drift}m)</span>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Info grid */}
      <div className={`grid gap-4 ${flight.aircraft !== '—' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <InfoCard title={t("common.gate")} value={flight.gate ?? "—"} sub={`${t("common.terminal")} ${flight.terminal ?? "—"}`} />
        {flight.aircraft !== '—' && (
          <InfoCard title="Aircraft" value={flight.aircraft} sub={`${flight.airline} · ${flight.airlineCode}`} />
        )}
        <InfoCard title={t("common.distance")} value={`${flight.distanceKm.toLocaleString()} km`} sub={`${Math.floor(flight.durationMin / 60)}h ${flight.durationMin % 60}m`} />
      </div>


      {/* AI Delay Prediction — real ML backend */}
      <section className="surface-card rounded-2xl p-6 md:p-8 overflow-hidden relative">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-primary flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> AI Delay Prediction
              </div>
              <h3 className="font-display text-2xl mt-0.5">Delay forecast</h3>
            </div>
          </div>
          {pred && (
            <div className="text-xs text-muted-foreground bg-background/60 border border-border rounded-full px-3 py-1.5">
              Confidence · <span className="text-foreground font-mono">{Math.round((pred.confidence ?? 0) * 100)}%</span>
            </div>
          )}
        </div>

        {predictionLoading && (
          <div className="py-8 flex items-center gap-3 text-muted-foreground">
            <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <span className="text-sm">Loading AI prediction…</span>
          </div>
        )}

        {!predictionLoading && !pred && (
          <div className="py-8 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Prediction unavailable — ML model has not processed this flight yet.
          </div>
        )}

        {!predictionLoading && pred && (
          <>
            <div className="relative grid lg:grid-cols-3 gap-4 mb-6">
              <PredictionStat
                tone={pred.riskScore >= 0.7 ? "high" : pred.riskScore >= 0.4 ? "medium" : "low"}
                label="Risk score" value={`${Math.round(pred.riskScore * 100)}%`}
                sub={pred.riskScore >= 0.7 ? "High risk" : pred.riskScore >= 0.4 ? "Moderate risk" : "Low risk · likely on-time"}
                progress={Math.round(pred.riskScore * 100)} />
              <PredictionStat
                tone={pred.riskScore >= 0.7 ? "high" : pred.riskScore >= 0.4 ? "medium" : "low"}
                label="Predicted delay"
                value={!pred.predictedDelayMin || pred.predictedDelayMin <= 5 ? "On time" : `+${Math.floor(pred.predictedDelayMin / 60)}h ${pred.predictedDelayMin % 60}m`}
                sub={`Estimated arrival impact at ${flight.to.code}`} />
              <PredictionStat tone="info" label="Model confidence"
                value={`${Math.round((pred.confidence ?? 0) * 100)}%`}
                sub="Based on historical route + airline data"
                progress={Math.round((pred.confidence ?? 0) * 100)} />
            </div>

            {pred.topFactors && pred.topFactors.length > 0 && (
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top delay factors (SHAP)</h4>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">From real ML model</span>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {pred.topFactors.map((f, i) => (
                    <motion.div key={f.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="rounded-xl border border-border bg-background/40 p-4 hover:border-primary/40 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="font-medium text-sm capitalize">{f.label.replace(/_/g, ' ')}</div>
                        <div className="font-mono text-xs text-primary tabular">{f.value >= 0 ? '+' : ''}{f.value.toFixed(2)}</div>
                      </div>
                      <div className="h-1.5 rounded-full bg-border overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.abs(f.value) * 100)}%` }}
                          transition={{ delay: 0.2 + i * 0.05, duration: 0.7, ease: "easeOut" }}
                          className={`h-full ${f.value >= 0 ? "bg-gradient-to-r from-destructive to-destructive/60" : "bg-gradient-to-r from-success to-success/60"}`} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Passenger Rights — from database */}
      <section className="surface-card rounded-2xl p-6 md:p-8 overflow-hidden relative">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-info/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-info/20 to-info/5 border border-info/30">
              <Scale className="h-5 w-5 text-info" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-info flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" /> Passenger Rights
              </div>
              <h3 className="font-display text-2xl mt-0.5">Your entitlements</h3>
            </div>
          </div>
        </div>

        {dbRights.length === 0 ? (
          <div className="py-8 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
            <Scale className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Rights data unavailable — check flight status or visit the passenger rights page.
            <div className="mt-4">
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link to="/passenger-rights">Explore passenger rights <ArrowRight className="h-4 w-4 rtl-flip" /></Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative grid md:grid-cols-2 gap-3 mb-5">
              {dbRights.map((r: { title: string; description: string; active: boolean; compensation?: string }, i: number) => (
                <motion.div key={r.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`rounded-xl border p-4 transition-all ${r.active ? "border-info/40 bg-info/5 shadow-sm" : "border-border bg-background/30 opacity-70"}`}>
                  <div className="flex items-start gap-3">
                    <div className={`grid place-items-center h-9 w-9 shrink-0 rounded-lg ${r.active ? "bg-info/15 text-info" : "bg-muted text-muted-foreground"}`}>
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium text-sm">{r.title}</div>
                        {r.active
                          ? <span className="text-[10px] uppercase tracking-wider text-info bg-info/10 border border-info/30 rounded-full px-2 py-0.5">Active</span>
                          : <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Not yet triggered</span>}
                      </div>
                      <div className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{r.description}</div>
                      {r.compensation && <div className="mt-2 text-sm font-mono text-success">{r.compensation}</div>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="relative flex items-center justify-between flex-wrap gap-3 pt-4 border-t border-border">
              <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-xl">
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <span>Compensation does not apply if the delay is caused by extraordinary circumstances (severe weather, ATC strikes) outside the airline's control.</span>
              </div>
              <Button asChild variant="outline" className="gap-2">
                <Link to="/passenger-rights">Full rights guide <ArrowRight className="h-4 w-4 rtl-flip" /></Link>
              </Button>
            </div>
          </>
        )}
      </section>

    </div>
  );
};

// ── Helpers ────────────────────────────────────────────────────────────────

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

function GoodCard({ icon: Icon, label, title, sub, extra }: { icon: React.ComponentType<{ className?: string }>; label: string; title: string; sub?: string; extra?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-5 hover:border-info/40 transition-colors">
      <div className="flex items-start gap-3">
        <div className="grid place-items-center h-10 w-10 shrink-0 rounded-lg bg-info/10 text-info border border-info/20">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display text-xl mt-1 tabular">{title}</div>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
          {extra && <div className="text-xs text-foreground/70 mt-2 leading-relaxed">{extra}</div>}
        </div>
      </div>
    </div>
  );
}

function addMin(iso: string, m: number) {
  return new Date(new Date(iso).getTime() + m * 60_000).toISOString();
}

function defaultStepLabel(key: string) {
  const map: Record<string, string> = { checkIn: "Check-in", boarding: "Boarding", departure: "Departure", takeoff: "Take-off", landing: "Landing", arrival: "Arrival" };
  return map[key] ?? key;
}

function computeGoodToKnow(flight: { from: { code: string; city: string }; to: { code: string; city: string }; arrivalTime: string }) {
  const tzMap: Record<string, { offset: number; label: string }> = {
    CDG: { offset: 1, label: "(UTC+1)" }, LHR: { offset: 0, label: "(UTC+0)" }, JFK: { offset: -5, label: "(UTC-5)" },
    DXB: { offset: 4, label: "(UTC+4)" }, IST: { offset: 3, label: "(UTC+3)" }, CMN: { offset: 1, label: "(UTC+1)" },
    TUN: { offset: 1, label: "(UTC+1)" }, MIR: { offset: 1, label: "(UTC+1)" }, NBE: { offset: 1, label: "(UTC+1)" },
    DJE: { offset: 1, label: "(UTC+1)" }, FRA: { offset: 1, label: "(UTC+1)" }, FCO: { offset: 1, label: "(UTC+1)" },
    MAD: { offset: 1, label: "(UTC+1)" }, BRU: { offset: 1, label: "(UTC+1)" }, GVA: { offset: 1, label: "(UTC+1)" },
    ORY: { offset: 1, label: "(UTC+1)" }, LYS: { offset: 1, label: "(UTC+1)" }, DOH: { offset: 3, label: "(UTC+3)" },
  };

  const weatherFor = (code: string) => {
    const seed = [...code].reduce((s, c) => s + c.charCodeAt(0), 0);
    const conditions = [
      { c: "Clear sky", advice: "Smooth conditions expected.", base: 24 },
      { c: "Partly cloudy", advice: "Comfortable weather on the ground.", base: 19 },
      { c: "Light rain", advice: "Bring a light jacket — minor taxi delays possible.", base: 14 },
      { c: "Overcast", advice: "Cool and grey — visibility good.", base: 12 },
      { c: "Sunny", advice: "Warm — stay hydrated.", base: 28 },
    ];
    const pick = conditions[seed % conditions.length];
    return { condition: pick.c, advice: pick.advice, temp: pick.base + (seed % 5), wind: 6 + (seed % 18), humidity: 40 + (seed % 45) };
  };

  const dep = tzMap[flight.from.code] ?? { offset: 0, label: "(UTC)" };
  const arr = tzMap[flight.to.code] ?? { offset: 0, label: "(UTC)" };
  const tzDiff = arr.offset - dep.offset;
  const localArrival = new Date(flight.arrivalTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

  return { depWeather: weatherFor(flight.from.code), arrWeather: weatherFor(flight.to.code), depTz: dep.label, arrTz: arr.label, tzDiff, localArrival };
}

function Insight({ tone, title, body }: { tone: "success" | "info" | "primary"; title: string; body: string }) {
  const toneCls = { success: "border-success/30 bg-success/5 text-success", info: "border-info/30 bg-info/5 text-info", primary: "border-primary/30 bg-primary/5 text-primary" }[tone];
  return (
    <div className={`rounded-xl border ${toneCls} p-5`}>
      <div className="text-xs uppercase tracking-wider font-semibold">{title}</div>
      <div className="mt-2 text-sm text-foreground/80 leading-relaxed">{body}</div>
    </div>
  );
}

function PredictionStat({ tone, label, value, sub, progress }: { tone: "low" | "medium" | "high" | "info"; label: string; value: string; sub?: string; progress?: number }) {
  const toneMap = {
    low:    { ring: "border-success/30",     text: "text-success",     bar: "from-success to-success/60",         chip: "bg-success/10" },
    medium: { ring: "border-warning/30",     text: "text-warning",     bar: "from-warning to-warning/60",         chip: "bg-warning/10" },
    high:   { ring: "border-destructive/30", text: "text-destructive", bar: "from-destructive to-destructive/60", chip: "bg-destructive/10" },
    info:   { ring: "border-info/30",        text: "text-info",        bar: "from-info to-info/60",               chip: "bg-info/10" },
  } as const;
  const c = toneMap[tone];
  return (
    <div className={`rounded-xl border ${c.ring} ${c.chip} p-5 relative overflow-hidden`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={`font-display text-3xl mt-1 tabular ${c.text}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1.5">{sub}</div>}
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 rounded-full bg-background/60 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, progress)}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full bg-gradient-to-r ${c.bar}`} />
        </div>
      )}
    </div>
  );
}

export default FlightDetail;
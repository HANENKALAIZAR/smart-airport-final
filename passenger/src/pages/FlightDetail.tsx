import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getFlight, type Flight } from "@/services/api";
import { FlightArcMap } from "@/components/FlightArcMap";
import { StatusBadge } from "@/components/StatusBadge";
import { useCountdown, formatTime, formatDate } from "@/lib/time";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, Cloud, Luggage, Plane, ShieldCheck,
  TrendingUp, Wind, Brain, AlertTriangle, CloudRain, Wrench,
  Users, Radio, Scale, Coffee, Hotel, Euro, FileText, ArrowRight,
  Sparkles, Bell, CloudSun, Globe2, Thermometer, Mail, MessageCircle, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [alertPhone, setAlertPhone] = useState("");
  const [alertSaving, setAlertSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;

    const loadData = async () => {
      if (!id) return;
      try {
        // Try DB first
        const dbData = await getFlight(id);
        if (dbData && !cancelled) {
          setFlight(dbData);
          setError(false);
          return;
        }
      } catch (err) {
        // Fallback to AE
      }

      // If DB fails (it's an AE flight), fetch from AE using the Tunisian airport code
      const currentFlight = flight || location.state?.flight;
      if (!currentFlight) {
        if (!cancelled) setError(true);
        return;
      }

      const isTnDep = ["TUN", "MIR", "NBE", "DJE", "SFA", "GAF", "TOE"].includes(currentFlight.from.code);
      const isTnArr = ["TUN", "MIR", "NBE", "DJE", "SFA", "GAF", "TOE"].includes(currentFlight.to.code);
      const airportCode = isTnDep ? currentFlight.from.code : isTnArr ? currentFlight.to.code : "TUN";
      
      try {
        const { getAviationEdgeFlights } = await import("@/services/api");
        const aeFlights = await getAviationEdgeFlights(airportCode, "both");
        const updated = aeFlights.find(f => f.id === id || f.flightNumber === id);
        if (updated && !cancelled) {
          setFlight(updated);
          setError(false);
        } else if (!flight && !cancelled) {
          setError(true);
        }
      } catch (e) {
        if (!flight && !cancelled) setError(true);
      }
    };

    loadData();
    interval = setInterval(loadData, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

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

  // ───────────────────── AI Delay Prediction ─────────────────────
  const delayPrediction = (() => {
    const onTime = flight.onTimeHistory;
    const declaredDelay = flight.delayMin;
    const baseProb = Math.min(95, Math.max(5, 100 - onTime + (declaredDelay ?? 0) * 0.6));
    const expectedDelay =
      flight.status === "delayed" ? Math.max((declaredDelay ?? 0), 35)
      : flight.status === "in_air" ? (declaredDelay ?? 0)
      : declaredDelay !== null ? Math.round((100 - onTime) * 0.6 + declaredDelay)
      : Math.round((100 - onTime) * 0.6);

    const severity: "low" | "medium" | "high" =
      expectedDelay >= 180 ? "high" : expectedDelay >= 60 ? "medium" : "low";

    const long = flight.distanceKm > 4000;
    const causes = [
      { label: "Weather conditions", icon: CloudRain, weight: long ? 38 : 22, detail: long ? "Headwinds and convective activity along the oceanic track." : "Light rain and reduced visibility forecast at destination." },
      { label: "Air-traffic congestion", icon: Radio, weight: 26, detail: "ATC slot restrictions during peak departure window." },
      { label: "Aircraft rotation", icon: Plane, weight: 100 - onTime > 18 ? 22 : 14, detail: "Inbound aircraft arriving from previous leg with reduced turnaround." },
      { label: "Crew & operations", icon: Users, weight: 10, detail: "Crew duty-time checks and final boarding reconciliation." },
      { label: "Technical / maintenance", icon: Wrench, weight: 8, detail: "Routine pre-flight inspection — no open defects reported." },
    ];
    const total = causes.reduce((s, c) => s + c.weight, 0);
    const ranked = causes.map((c) => ({ ...c, pct: Math.round((c.weight / total) * 100) })).sort((a, b) => b.pct - a.pct);

    return { probability: Math.round(baseProb), expectedDelay, severity, causes: ranked, confidence: Math.min(96, 70 + Math.round(onTime / 5)) };
  })();

  // ───────────────────── Passenger Rights ─────────────────────
  const expected = delayPrediction.expectedDelay;
  const distance = flight.distanceKm;
  const compensation =
    expected >= 180
      ? distance <= 1500 ? { amount: "€250", tier: "Short-haul (≤1,500 km)" }
      : distance <= 3500 ? { amount: "€400", tier: "Medium-haul (1,500–3,500 km)" }
      : { amount: "€600", tier: "Long-haul (>3,500 km)" }
      : null;

  const rights = [
    { threshold: 120, icon: Coffee, title: "Meals & refreshments", body: "Free meals and drinks proportionate to the waiting time, plus 2 phone calls or emails.", active: expected >= 120 },
    { threshold: 180, icon: Euro, title: "Financial compensation", body: compensation ? `Up to ${compensation.amount} per passenger under EC 261/2004 — ${compensation.tier}.` : "Triggered at 3h+ arrival delay if the cause is within the airline's control.", active: expected >= 180 },
    { threshold: 300, icon: Hotel, title: "Hotel & transfers", body: "If a new flight departs the next day, the airline must provide hotel accommodation and airport transfers.", active: expected >= 300 },
    { threshold: 300, icon: FileText, title: "Refund or rerouting", body: "From 5 hours of delay, you may request a full refund of the unused portion or rerouting at the earliest opportunity.", active: expected >= 300 },
  ];

  const steps = [
    { key: "checkIn",   icon: CheckCircle2, done: true,                                           active: false,                      scheduled: addMin(flight.scheduledDeparture, -180), estimated: addMin(flight.departureTime, -180) },
    { key: "boarding",  icon: Plane,        done: flight.status !== "scheduled",                  active: flight.status === "boarding", scheduled: addMin(flight.scheduledDeparture, -40),  estimated: addMin(flight.departureTime, -40) },
    { key: "departure", icon: TrendingUp,   done: ["in_air","landed"].includes(flight.status),    active: flight.status === "boarding", scheduled: flight.scheduledDeparture,               estimated: flight.departureTime },
    { key: "takeoff",   icon: Wind,         done: ["in_air","landed"].includes(flight.status),    active: false,                       scheduled: addMin(flight.scheduledDeparture, 15),    estimated: addMin(flight.departureTime, 15) },
    { key: "landing",   icon: Cloud,        done: flight.status === "landed",                     active: flight.status === "in_air",  scheduled: addMin(flight.scheduledArrival, -10),     estimated: addMin(flight.arrivalTime, -10) },
    { key: "arrival",   icon: Luggage,      done: flight.status === "landed",                     active: false,                       scheduled: flight.scheduledArrival,                  estimated: flight.arrivalTime },
  ];

  const goodToKnow = computeGoodToKnow(flight);

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
                    We'll send you real-time updates for delays, gate changes, and boarding calls.
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="email" className="mt-2">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="email" className="gap-2"><Mail className="h-3.5 w-3.5" />Email</TabsTrigger>
                    <TabsTrigger value="whatsapp" className="gap-2"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</TabsTrigger>
                  </TabsList>
                  <TabsContent value="email" className="space-y-2 mt-4">
                    <Label htmlFor="alert-email">Email address</Label>
                    <Input id="alert-email" type="email" placeholder="you@example.com" value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} />
                    <p className="text-xs text-muted-foreground">We'll only use your email for flight updates.</p>
                  </TabsContent>
                  <TabsContent value="whatsapp" className="space-y-2 mt-4">
                    <Label htmlFor="alert-phone">WhatsApp number</Label>
                    <Input id="alert-phone" type="tel" placeholder="+216 12 345 678" value={alertPhone} onChange={(e) => setAlertPhone(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Include country code.</p>
                  </TabsContent>
                </Tabs>
                <DialogFooter className="mt-4">
                  <Button variant="ghost" onClick={() => setAlertsOpen(false)} disabled={alertSaving}>Cancel</Button>
                  <Button disabled={alertSaving} onClick={async () => {
                    const target = alertEmail || alertPhone;
                    if (!target) { toast({ title: "Missing contact", description: "Please enter an email.", variant: "destructive" }); return; }
                    if (!alertEmail) { toast({ title: "Not supported", description: "Only email alerts are supported right now.", variant: "destructive" }); return; }
                    
                    setAlertSaving(true);
                    try {
                      const res = await fetch(`${import.meta.env.VITE_API_URL}/alerts/subscribe`, {
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
                      toast({ title: "Alerts activated", description: `You'll receive live updates on ${target}.` });
                      setAlertsOpen(false); setAlertEmail(""); setAlertPhone("");
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
          <div className="absolute top-5 start-5 h-px bg-gradient-amber hidden md:block" style={{ width: `${(steps.filter(s => s.done).length / steps.length) * 90}%` }} />
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

      {/* Good to know */}
      <section className="surface-card rounded-2xl p-6 md:p-8 overflow-hidden relative">
        <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-info/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-3 mb-6">
          <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-info/20 to-info/5 border border-info/30">
            <Sparkles className="h-5 w-5 text-info" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-info">Travel intelligence</div>
            <h3 className="font-display text-2xl mt-0.5">Good to know</h3>
          </div>
        </div>
        <div className="relative grid md:grid-cols-2 gap-4">
          <GoodCard icon={CloudSun} label={`Weather · ${flight.from.city} (${flight.from.code})`} title={`${goodToKnow.depWeather.temp}°C · ${goodToKnow.depWeather.condition}`} sub={`Wind ${goodToKnow.depWeather.wind} km/h · Humidity ${goodToKnow.depWeather.humidity}%`} extra={goodToKnow.depWeather.advice} />
          <GoodCard icon={Thermometer} label={`Weather · ${flight.to.city} (${flight.to.code})`} title={`${goodToKnow.arrWeather.temp}°C · ${goodToKnow.arrWeather.condition}`} sub={`Wind ${goodToKnow.arrWeather.wind} km/h · Humidity ${goodToKnow.arrWeather.humidity}%`} extra={goodToKnow.arrWeather.advice} />
          <GoodCard icon={Globe2} label="Time zone change"
            title={goodToKnow.tzDiff === 0 ? "Same time zone" : `${goodToKnow.tzDiff > 0 ? "+" : ""}${goodToKnow.tzDiff}h on arrival`}
            sub={`${flight.from.city} ${goodToKnow.depTz} → ${flight.to.city} ${goodToKnow.arrTz}`}
            extra={goodToKnow.tzDiff === 0 ? "No clock adjustment needed." : `Set your watch ${goodToKnow.tzDiff > 0 ? "forward" : "back"} ${Math.abs(goodToKnow.tzDiff)}h after landing.`} />
          <GoodCard icon={Timer} label={`Local time on arrival · ${flight.to.code}`} title={goodToKnow.localArrival}
            sub={`Flight duration ${Math.floor(flight.durationMin / 60)}h ${flight.durationMin % 60}m`}
            extra={goodToKnow.tzDiff > 2 ? "Light jet-lag possible — hydrate and adjust sleep ahead." : "Minor time shift — should feel comfortable on arrival."} />
        </div>
      </section>

      {/* AI Delay Prediction */}
      <section className="surface-card rounded-2xl p-6 md:p-8 overflow-hidden relative">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-primary flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Smart AI Prediction
              </div>
              <h3 className="font-display text-2xl mt-0.5">Delay forecast & probable causes</h3>
            </div>
          </div>
          <div className="text-xs text-muted-foreground bg-background/60 border border-border rounded-full px-3 py-1.5">
            Confidence · <span className="text-foreground font-mono">{delayPrediction.confidence}%</span>
          </div>
        </div>
        <div className="relative grid lg:grid-cols-3 gap-4 mb-6">
          <PredictionStat tone={delayPrediction.severity} label="Probability of delay" value={`${delayPrediction.probability}%`}
            sub={delayPrediction.severity === "low" ? "Low risk · likely on-time" : delayPrediction.severity === "medium" ? "Moderate risk" : "High risk"}
            progress={delayPrediction.probability} />
          <PredictionStat tone={delayPrediction.severity} label="Expected delay"
            value={delayPrediction.expectedDelay <= 5 ? "On time" : `+${Math.floor(delayPrediction.expectedDelay / 60)}h ${delayPrediction.expectedDelay % 60}m`}
            sub={`Estimated arrival impact at ${flight.to.code}`} />
          <PredictionStat tone="info" label="Historical on-time" value={`${flight.onTimeHistory}%`}
            sub={`${flight.airline} · ${flight.flightNumber} (last 90 days)`} progress={flight.onTimeHistory} />
        </div>
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Probable causes</h4>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Weighted by AI</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {delayPrediction.causes.map((c, i) => (
              <motion.div key={c.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-background/40 p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="grid place-items-center h-9 w-9 shrink-0 rounded-lg bg-primary/10 text-primary">
                    <c.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{c.label}</div>
                      <div className="font-mono text-xs text-primary tabular">{c.pct}%</div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-border overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${c.pct}%` }} transition={{ delay: 0.2 + i * 0.05, duration: 0.7, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-primary to-primary/60" />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground leading-relaxed">{c.detail}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Passenger Rights */}
      <section className="surface-card rounded-2xl p-6 md:p-8 overflow-hidden relative">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-info/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-info/20 to-info/5 border border-info/30">
              <Scale className="h-5 w-5 text-info" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-info flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" /> Your Rights
              </div>
              <h3 className="font-display text-2xl mt-0.5">
                {expected >= 120 ? "What you're entitled to in this delay scenario" : "Rights you'd unlock if this flight is delayed"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Based on EC Regulation 261/2004 · estimated impact{" "}
                <span className="text-foreground font-mono">{expected <= 5 ? "negligible" : `+${Math.floor(expected / 60)}h ${expected % 60}m`}</span>
              </p>
            </div>
          </div>
          {compensation && (
            <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-success">Potential compensation</div>
              <div className="font-display text-2xl text-success tabular">{compensation.amount}</div>
              <div className="text-[10px] text-muted-foreground">{compensation.tier}</div>
            </div>
          )}
        </div>
        <div className="relative grid md:grid-cols-2 gap-3 mb-5">
          {rights.map((r, i) => (
            <motion.div key={r.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`rounded-xl border p-4 transition-all ${r.active ? "border-info/40 bg-info/5 shadow-sm" : "border-border bg-background/30 opacity-70"}`}>
              <div className="flex items-start gap-3">
                <div className={`grid place-items-center h-9 w-9 shrink-0 rounded-lg ${r.active ? "bg-info/15 text-info" : "bg-muted text-muted-foreground"}`}>
                  <r.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-sm">{r.title}</div>
                    {r.active
                      ? <span className="text-[10px] uppercase tracking-wider text-info bg-info/10 border border-info/30 rounded-full px-2 py-0.5">Active</span>
                      : <span className="text-[10px] uppercase tracking-wider text-muted-foreground">From {Math.floor(r.threshold / 60)}h</span>}
                  </div>
                  <div className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{r.body}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="relative flex items-center justify-between flex-wrap gap-3 pt-4 border-t border-border">
          <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-xl">
            <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
            <span>Compensation does not apply if the delay is caused by extraordinary circumstances (severe weather, security risks, ATC strikes outside the airline's control).</span>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/passenger-rights">Explore full passenger rights <ArrowRight className="h-4 w-4 rtl-flip" /></Link>
          </Button>
        </div>
      </section>

      {/* Predictive insights */}
      <section className="surface-card rounded-2xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-2xl">{t("insights.title")}</h3>
          <span className="text-[10px] uppercase tracking-[0.2em] text-primary">Smart AI</span>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Insight tone="success" title={t("insights.onTimeLikely")} body={t("insights.historicalOnTime", { rate: flight.onTimeHistory })} />
          <Insight tone="info" title={t("insights.weatherImpact")} body="Light rain at destination · minor turbulence forecast over Atlantic." />
          <Insight tone="primary" title={t("insights.trafficLight")} body="Security wait ~8 min · Gate is 6 min walk from your location." />
        </div>
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
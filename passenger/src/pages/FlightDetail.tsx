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
  Sparkles, Bell, Mail, Clock, ShieldAlert,
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

  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    subscribed: boolean;
    is_active?: boolean;
    status?: string;
    completed_at?: string;
    completion_reason?: string;
  } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("passenger_alert_email");
    if (savedEmail) {
      setAlertEmail(savedEmail);
    }
  }, []);

  const fetchSubscriptionStatus = async (email: string) => {
    if (!email || !flight?.flightNumber) return;
    setCheckingStatus(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/passenger/alerts/status?email=${encodeURIComponent(email)}&flight_number=${encodeURIComponent(flight.flightNumber)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSubscriptionStatus(data);
      }
    } catch (err) {
      console.error("Failed to check subscription status", err);
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (alertEmail && alertEmail.includes("@") && alertsOpen) {
      const delayDebounceFn = setTimeout(() => {
        fetchSubscriptionStatus(alertEmail);
      }, 500);

      return () => clearTimeout(delayDebounceFn);
    } else if (!alertEmail) {
      setSubscriptionStatus(null);
    }
  }, [alertEmail, alertsOpen, flight?.flightNumber]);


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

  // Let's extract normalized variables for ML prediction in render context:
  const getNormalizedMLPrediction = (p: FlightPrediction | null) => {
    if (!p) return null;
    
    // Normalize riskScore to 0-1
    const rawRisk = p.riskScore ?? 0;
    const riskFraction = rawRisk > 1 ? rawRisk / 100 : rawRisk;
    const riskPercent = Math.round(riskFraction * 100);

    // Normalize confidence to 0-1
    const rawConf = p.confidence ?? 0;
    const confidenceFraction = rawConf > 1 ? rawConf / 100 : rawConf;
    const confidencePercent = Math.round(confidenceFraction * 100);

    // Confidence interpretation & subtext
    let confidenceLabel = "Limited confidence";
    let confidenceSub = "Dynamic weather or system updates introduce uncertainty";
    if (confidenceFraction >= 0.75) {
      confidenceLabel = "High confidence";
      confidenceSub = "Strong historical trends support this delay forecast";
    } else if (confidenceFraction >= 0.45) {
      confidenceLabel = "Moderate confidence";
      confidenceSub = "Reliable prediction based on route schedule patterns";
    }

    // Risk Tone and Subtext
    let riskTone: "low" | "medium" | "high" = "low";
    let riskSub = "Low delay risk · Likely on-time";
    if (riskFraction >= 0.7) {
      riskTone = "high";
      riskSub = "High delay risk · Heavy schedule delays expected";
    } else if (riskFraction >= 0.4) {
      riskTone = "medium";
      riskSub = "Moderate delay risk · Minor schedule adjustments possible";
    }

    return {
      ...p,
      riskFraction,
      riskPercent,
      confidenceFraction,
      confidencePercent,
      confidenceLabel,
      confidenceSub,
      riskTone,
      riskSub
    };
  };

  const normPred = getNormalizedMLPrediction(pred);

  // ───────────────────── Passenger Rights (from DB) ─────────────
  // Use rights returned by the backend (/api/flights/{id}) — never compute on frontend
  const dbRights = flight.passengerRights ?? [];

  // ── Journey Timeline Logic & Sync ──
  const getStepStates = (status: string) => {
    switch (status) {
      case "scheduled":
        return {
          scheduled: { done: false, active: true },
          boarding: { done: false, active: false },
          departed: { done: false, active: false },
          arrived: { done: false, active: false },
        };
      case "boarding":
        return {
          scheduled: { done: true, active: false },
          boarding: { done: false, active: true },
          departed: { done: false, active: false },
          arrived: { done: false, active: false },
        };
      case "departed":
      case "in_air":
        return {
          scheduled: { done: true, active: false },
          boarding: { done: true, active: false },
          departed: { done: false, active: true },
          arrived: { done: false, active: false },
        };
      case "landed":
        return {
          scheduled: { done: true, active: false },
          boarding: { done: true, active: false },
          departed: { done: true, active: false },
          arrived: { done: true, active: true },
        };
      case "cancelled":
      default:
        return {
          scheduled: { done: false, active: false },
          boarding: { done: false, active: false },
          departed: { done: false, active: false },
          arrived: { done: false, active: false },
        };
    }
  };

  const getFlightProgressInfo = (f: Flight) => {
    if (f.status === "cancelled") {
      return { percent: 0, label: "Cancelled", isCancelled: true, remainingMs: 0 };
    }
    if (f.status === "landed") {
      return { percent: 100, label: "Arrived", remainingMs: 0 };
    }
    if (f.status === "scheduled" || f.status === "boarding") {
      return { percent: 0, label: f.status === "boarding" ? "Boarding" : "Scheduled", remainingMs: 0 };
    }

    const depTime = new Date(f.departureTime || f.scheduledDeparture);
    const arrTime = new Date(f.arrivalTime || f.scheduledArrival);
    const now = new Date();

    const totalDurationMs = arrTime.getTime() - depTime.getTime();
    if (totalDurationMs <= 0) {
      return { percent: 50, label: "En Route", remainingMs: 0 };
    }

    const elapsedMs = now.getTime() - depTime.getTime();
    const progressPercent = Math.min(99, Math.max(1, Math.round((elapsedMs / totalDurationMs) * 100)));
    const remainingMs = arrTime.getTime() - now.getTime();

    return {
      percent: progressPercent,
      label: "En Route",
      remainingMs: remainingMs > 0 ? remainingMs : 0,
    };
  };

  const progressInfo = getFlightProgressInfo(flight);

  const getRemainingTimeDisplay = (info: any, f: Flight) => {
    if (f.status === "cancelled") {
      return "Cancelled";
    }
    if (f.status === "landed") {
      return "Flight completed";
    }
    if (f.status === "scheduled" || f.status === "boarding") {
      const depTime = new Date(f.departureTime || f.scheduledDeparture);
      const now = new Date();
      const diffMs = depTime.getTime() - now.getTime();
      if (diffMs > 0) {
        const diffMins = Math.round(diffMs / 60000);
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        if (h > 0) {
          return `Departs in ${h}h ${String(m).padStart(2, "0")}m`;
        }
        return `Departs in ${m}m`;
      }
      return f.status === "boarding" ? "Boarding now" : "Scheduled departure passed";
    }

    const remainingMs = info.remainingMs ?? 0;
    if (remainingMs <= 0) {
      return "Arriving shortly";
    }
    const remainingMins = Math.round(remainingMs / 60000);
    const h = Math.floor(remainingMins / 60);
    const m = remainingMins % 60;
    if (h > 0) {
      return `${h}h ${String(m).padStart(2, "0")}m remaining`;
    }
    return `${m}m remaining`;
  };

  const stepStates = getStepStates(flight.status);

  const steps = [
    { 
      key: "scheduled", 
      icon: Clock, 
      done: stepStates.scheduled.done, 
      active: stepStates.scheduled.active, 
      scheduled: flight.scheduledDeparture, 
      estimated: flight.departureTime || flight.scheduledDeparture 
    },
    { 
      key: "boarding", 
      icon: Plane, 
      done: stepStates.boarding.done, 
      active: stepStates.boarding.active, 
      scheduled: addMin(flight.scheduledDeparture, -40), 
      estimated: addMin(flight.departureTime || flight.scheduledDeparture, -40) 
    },
    { 
      key: "departed", 
      icon: TrendingUp, 
      done: stepStates.departed.done, 
      active: stepStates.departed.active, 
      scheduled: flight.scheduledDeparture, 
      estimated: flight.departureTime || flight.scheduledDeparture 
    },
    { 
      key: "arrived", 
      icon: Luggage, 
      done: stepStates.arrived.done, 
      active: stepStates.arrived.active, 
      scheduled: flight.scheduledArrival, 
      estimated: flight.arrivalTime || flight.scheduledArrival 
    },
  ];

  // Helper for progress line in horizontal timeline
  const getTimelineProgressWidth = () => {
    switch (flight.status) {
      case "scheduled": return 0;
      case "boarding": return 33;
      case "departed":
      case "in_air": return 66;
      case "landed": return 100;
      default: return 0;
    }
  };
  const timelineProgressWidth = getTimelineProgressWidth();


  return (
    <div className="space-y-8 pb-12">
      <Button variant="ghost" onClick={() => nav(-1)} className="gap-2 -ms-3 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 rtl-flip" /> Back
      </Button>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-lg">
        {/* Globe backdrop */}
        <div className="absolute inset-0 opacity-40 mix-blend-overlay dark:opacity-20 pointer-events-none">
          <FlightArcMap from={flight.from} to={flight.to} progress={progressInfo.percent / 100} className="h-full w-full" />
        </div>
        
        {/* Premium Overlay gradient for perfect light/dark contrast */}
        <div className="relative p-6 md:p-8 min-h-[320px] flex flex-col justify-between bg-background/40 backdrop-blur-[6px]">
          {/* Header Info */}
          <div className="flex items-center justify-between border-b border-border/60 pb-6 mb-6 flex-wrap gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                {flight.status === "in_air" || flight.status === "departed" ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
                )}
                {t("flightDetail.track")} · <span className="font-mono font-bold">{flight.canonicalFlightNumber || flight.flightNumber}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-0.5 font-medium">{flight.airline} · {flight.aircraft !== "—" ? flight.aircraft : "Commercial Jet"}</div>
            </div>
            
            <div className="flex items-center gap-2">
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
                    <Label htmlFor="alert-email" className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" /> Email address
                    </Label>
                    <Input
                      id="alert-email"
                      type="email"
                      placeholder="you@example.com"
                      value={alertEmail}
                      onChange={(e) => setAlertEmail(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Used only for flight status alerts. You can unsubscribe at any time.
                    </p>
                  </div>

                  {checkingStatus && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2 animate-pulse">
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      Checking subscription status...
                    </div>
                  )}

                  {!checkingStatus && subscriptionStatus?.subscribed && (
                    <div className="mt-4 p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Subscription Status
                        </span>
                        {subscriptionStatus.status === "ACTIVE" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success border border-success/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                            Active
                          </span>
                        )}
                        {subscriptionStatus.status === "COMPLETED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-info/15 text-info border border-info/30">
                            Completed
                          </span>
                        )}
                        {subscriptionStatus.status === "CANCELLED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                            Cancelled
                          </span>
                        )}
                        {subscriptionStatus.status === "EXPIRED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/15 text-warning border border-warning/30">
                            Expired
                          </span>
                        )}
                      </div>

                      <div className="text-sm leading-relaxed text-muted-foreground">
                        {subscriptionStatus.status === "ACTIVE" && (
                          <p>
                            You are currently tracking <strong>{flight.flightNumber}</strong>. We'll email you about gate updates, delays, or boarding calls.
                          </p>
                        )}
                        {subscriptionStatus.status === "COMPLETED" && (
                          <div className="space-y-1">
                            <p className="text-foreground font-medium">Alerts completed</p>
                            <p className="text-xs">
                              Reason: {subscriptionStatus.completion_reason === "flight_landed" ? "Flight has landed." :
                                       subscriptionStatus.completion_reason === "flight_cancelled" ? "Flight was cancelled." :
                                       subscriptionStatus.completion_reason === "flight_departed" ? "Flight has departed." :
                                       subscriptionStatus.completion_reason || "Flight reached a final status."}
                            </p>
                            {subscriptionStatus.completed_at && (
                              <p className="text-[10px] font-mono">
                                Closed: {new Date(subscriptionStatus.completed_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}
                        {subscriptionStatus.status === "CANCELLED" && (
                          <div className="space-y-1">
                            <p className="text-foreground font-medium">Alerts cancelled</p>
                            <p className="text-xs">You manually unsubscribed from updates for this flight.</p>
                            {subscriptionStatus.completed_at && (
                              <p className="text-[10px] font-mono">
                                Unsubscribed: {new Date(subscriptionStatus.completed_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}
                        {subscriptionStatus.status === "EXPIRED" && (
                          <div className="space-y-1">
                            <p className="text-foreground font-medium">Alerts expired</p>
                            <p className="text-xs">Alerts stopped because the scheduled departure time passed without final status updates.</p>
                            {subscriptionStatus.completed_at && (
                              <p className="text-[10px] font-mono">
                                Expired: {new Date(subscriptionStatus.completed_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {subscriptionStatus.status === "ACTIVE" ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full mt-1 gap-2"
                          disabled={alertSaving}
                          onClick={async () => {
                            setAlertSaving(true);
                            try {
                              const res = await fetch(`${import.meta.env.VITE_API_URL}/passenger/alerts/unsubscribe`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  email: alertEmail,
                                  flight_number: flight.flightNumber,
                                }),
                              });
                              if (!res.ok) throw new Error("Failed to unsubscribe");
                              toast({ title: "Alerts cancelled", description: "You have unsubscribed from flight alerts." });
                              fetchSubscriptionStatus(alertEmail);
                            } catch (err) {
                              toast({ title: "Error", description: "Could not cancel alerts. Try again.", variant: "destructive" });
                            } finally {
                              setAlertSaving(false);
                            }
                          }}
                        >
                          {alertSaving ? <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin"/> : null}
                          Cancel Alerts / Unsubscribe
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-1 gap-2 border-primary/40 text-primary hover:bg-primary/10"
                          disabled={alertSaving}
                          onClick={async () => {
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
                                  airline: flight.airline,
                                }),
                              });
                              if (!res.ok) throw new Error("Failed to subscribe");
                              localStorage.setItem("passenger_alert_email", alertEmail.trim());
                              toast({ title: "Alerts activated", description: `Re-subscribed at ${alertEmail}.` });
                              fetchSubscriptionStatus(alertEmail);
                            } catch (err) {
                              toast({ title: "Error", description: "Could not activate alerts. Try again.", variant: "destructive" });
                            } finally {
                              setAlertSaving(false);
                            }
                          }}
                        >
                          {alertSaving ? <div className="h-4 w-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin"/> : <Bell className="h-4 w-4" />}
                          Re-activate Alerts
                        </Button>
                      )}
                    </div>
                  )}

                  <DialogFooter className="mt-4">
                    <Button variant="ghost" onClick={() => setAlertsOpen(false)} disabled={alertSaving}>
                      Close
                    </Button>
                    {(!subscriptionStatus || !subscriptionStatus.subscribed) && (
                      <Button
                        disabled={alertSaving || checkingStatus}
                        onClick={async () => {
                          if (!alertEmail || !alertEmail.includes("@")) {
                            toast({
                              title: "Valid email required",
                              description: "Please enter a valid email address.",
                              variant: "destructive",
                            });
                            return;
                          }
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
                                airline: flight.airline,
                              }),
                            });
                            if (!res.ok) throw new Error("Failed to subscribe");
                            localStorage.setItem("passenger_alert_email", alertEmail.trim());
                            toast({ title: "Alerts activated", description: `You'll receive live updates at ${alertEmail}.` });
                            fetchSubscriptionStatus(alertEmail);
                          } catch (err) {
                            toast({ title: "Error", description: "Could not activate alerts. Try again.", variant: "destructive" });
                          } finally {
                            setAlertSaving(false);
                          }
                        }}
                        className="gap-2"
                      >
                        {alertSaving ? (
                          <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        ) : (
                          <Bell className="h-4 w-4" />
                        )}
                        {alertSaving ? "Activating..." : "Activate"}
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Redesigned Map/Trajectory Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-4">
            {/* Departure */}
            <div className="lg:col-span-3 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5 font-bold">
                <span className="h-2 w-2 rounded-full bg-primary" /> Departure
              </div>
              <div className="font-mono text-5xl font-black text-foreground tracking-tighter">{flight.from.code}</div>
              <div className="text-base font-bold leading-tight">{flight.from.city}</div>
              <div className="space-y-0.5 pt-1">
                <div className="text-lg font-bold font-mono tracking-tight tabular-nums text-foreground/90">
                  {formatTime(flight.departureTime, locale)}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  Scheduled: {formatTime(flight.scheduledDeparture, locale)}
                </div>
              </div>
            </div>

            {/* Path visualization */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center space-y-4">
              <div className="flex flex-col items-center gap-1">
                <StatusBadge status={flight.status} />
                <div className="text-xl font-extrabold text-foreground mt-1.5 font-mono tracking-tight text-center">
                  {getRemainingTimeDisplay(progressInfo, flight)}
                </div>
              </div>

              {/* Trajectory */}
              <div className="w-full relative py-6 select-none">
                {/* Back dashed trail */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 border-t-2 border-dashed border-muted-foreground/30 -translate-y-1/2" />
                {/* Active colored path */}
                <div 
                  className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-primary to-info -translate-y-1/2 transition-all duration-75" 
                  style={{ width: `${progressInfo.percent}%` }}
                />
                
                {/* Airplane marker */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-75"
                  style={{ left: `${progressInfo.percent}%` }}
                >
                  <div className="relative group">
                    {progressInfo.percent > 0 && progressInfo.percent < 100 && (
                      <span className="absolute inset-0 -m-3 rounded-full bg-primary/20 animate-ping" />
                    )}
                    <div className="grid place-items-center h-8 w-8 rounded-full bg-background border border-primary/40 shadow-md text-primary">
                      <Plane className="h-4 w-4 rotate-90" />
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-0.5 rounded bg-foreground text-background text-[10px] font-mono font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      {progressInfo.percent}%
                    </div>
                  </div>
                </div>

                {/* Origin / Destination nodes */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-background border-2 border-primary" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-background border-2 border-info" />
              </div>

              <div className="w-full flex justify-between text-[11px] text-muted-foreground font-mono">
                <span>0%</span>
                <span className="font-semibold text-foreground/80">Flight Progress: {progressInfo.percent}%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Arrival */}
            <div className="lg:col-span-3 space-y-2 lg:text-end">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground flex items-center lg:justify-end gap-1.5 font-bold">
                Arrival <span className="h-2 w-2 rounded-full bg-info" />
              </div>
              <div className="font-mono text-5xl font-black text-foreground tracking-tighter">{flight.to.code}</div>
              <div className="text-base font-bold leading-tight">{flight.to.city}</div>
              <div className="space-y-0.5 pt-1">
                <div className="text-lg font-bold font-mono tracking-tight tabular-nums text-foreground/90">
                  {formatTime(flight.arrivalTime, locale)}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  Scheduled: {formatTime(flight.scheduledArrival, locale)}
                </div>
              </div>
            </div>
          </div>

        </div>
      </motion.div>

      {/* Timeline */}
      <section className="surface-card rounded-2xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h3 className="font-display text-2xl font-semibold text-foreground">Journey Timeline</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Real-time milestones tracking flight progress</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40 border border-border" /> Scheduled
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Estimated
            </span>
          </div>
        </div>
        
        {/* Step Progress visualization */}
        <div className="relative">
          {/* Horizontal progress bar for medium+ screens */}
          <div className="absolute top-6 start-6 end-6 h-1 bg-border/40 rounded-full hidden md:block" />
          <div 
            className="absolute top-6 start-6 h-1 bg-gradient-amber rounded-full hidden md:block transition-all duration-500" 
            style={{ width: `${timelineProgressWidth}%` }}
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {steps.map((s, i) => {
              const state = s.done ? "done" : s.active ? "active" : "upcoming";
              const sched = formatTime(s.scheduled, locale);
              const est = formatTime(s.estimated, locale);
              const drift = Math.round((new Date(s.estimated).getTime() - new Date(s.scheduled).getTime()) / 60000);
              
              return (
                <motion.div 
                  key={s.key} 
                  initial={{ opacity: 0, y: 8 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="flex md:flex-col items-center md:text-center gap-4 md:gap-0 relative"
                >
                  {/* Step Connector line for vertical timeline on mobile */}
                  {i < steps.length - 1 && (
                    <div className="absolute left-[23px] top-12 bottom-[-32px] w-0.5 bg-border/60 md:hidden" />
                  )}

                  {/* Step Icon Container */}
                  <div className={`relative grid place-items-center h-12 w-12 rounded-full border-2 transition-all duration-300 z-10 shrink-0 ${
                    state === "done" 
                      ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                      : state === "active" 
                      ? "bg-background border-primary text-primary shadow-lg ring-4 ring-primary/10 scale-110"
                      : "bg-background border-border text-muted-foreground/40"
                  }`}>
                    {state === "active" && (
                      <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping pointer-events-none" />
                    )}
                    <s.icon className={`h-5 w-5 ${state === "active" ? "animate-pulse" : ""}`} />
                  </div>

                  {/* Step Details */}
                  <div className="md:mt-4 flex-1 md:w-full space-y-1">
                    <div className={`text-sm font-semibold capitalize tracking-tight ${
                      state === "active" ? "text-foreground font-bold" : "text-muted-foreground"
                    }`}>
                      {t(`timeline.${s.key}`, { defaultValue: defaultStepLabel(s.key) })}
                    </div>
                    
                    <div className="flex flex-col md:items-center gap-0.5 text-xs text-muted-foreground">
                      <div className="font-mono text-[11px] tabular-nums">
                        Sched: <span className="text-foreground/80">{sched}</span>
                      </div>
                      <div className={`font-mono text-[11px] tabular-nums flex items-center gap-1 ${
                        drift > 0 ? "text-warning font-semibold" : "text-primary/90"
                      }`}>
                        Est: <span>{est}</span>
                        {drift > 0 && <span className="text-[10px] bg-warning/10 px-1 py-0.25 rounded border border-warning/20">+{drift}m</span>}
                      </div>
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
              <div className="text-[10px] uppercase tracking-[0.22em] text-primary flex items-center gap-1.5 font-bold">
                <Sparkles className="h-3 w-3" /> AI Delay Prediction
              </div>
              <h3 className="font-display text-2xl mt-0.5 font-semibold text-foreground">Delay Forecast</h3>
            </div>
          </div>
          {normPred && (
            <div className="text-[10px] uppercase tracking-wider text-primary bg-primary/10 border border-primary/25 rounded-full px-3 py-1 font-semibold flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              ML Prediction Active
            </div>
          )}
        </div>

        {predictionLoading && (
          <div className="py-8 flex items-center gap-3 text-muted-foreground">
            <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <span className="text-sm">Loading AI prediction…</span>
          </div>
        )}

        {!predictionLoading && !normPred && (
          <div className="py-8 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground bg-background/20">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
            Prediction unavailable — ML model has not processed this flight yet.
          </div>
        )}

        {!predictionLoading && normPred && (
          <>
            <div className="relative grid lg:grid-cols-3 gap-4 mb-6">
              <PredictionStat
                tone={normPred.riskTone}
                label="Risk score" 
                value={`${normPred.riskPercent}%`}
                sub={normPred.riskSub}
                progress={normPred.riskPercent} 
              />
              <PredictionStat
                tone={normPred.riskTone}
                label="Predicted delay"
                value={!normPred.predictedDelayMin || normPred.predictedDelayMin <= 5 ? "On time" : `+${Math.floor(normPred.predictedDelayMin / 60)}h ${normPred.predictedDelayMin % 60}m`}
                sub={`Estimated arrival impact at ${flight.to.code}`} 
              />
              <PredictionStat 
                tone={normPred.confidenceFraction >= 0.75 ? "info" : normPred.confidenceFraction >= 0.45 ? "medium" : "high"} 
                label="Model confidence"
                value={normPred.confidenceLabel}
                sub={`${normPred.confidencePercent}% confidence · ${normPred.confidenceSub}`}
                progress={normPred.confidencePercent} 
              />
            </div>

            {normPred.topFactors && normPred.topFactors.length > 0 && (
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Top delay factors (SHAP)</h4>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">From real ML model</span>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {normPred.topFactors.map((f, i) => (
                    <motion.div key={f.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="rounded-xl border border-border bg-background/40 p-4 hover:border-primary/40 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="font-semibold text-sm capitalize text-foreground">{f.label.replace(/_/g, ' ')}</div>
                        <div className="font-mono text-xs text-primary font-bold tabular">{f.value >= 0 ? '+' : ''}{f.value.toFixed(2)}</div>
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
          <div className="rounded-xl border border-border bg-background/30 p-6 md:p-8 text-center max-w-2xl mx-auto space-y-4">
            <div className="mx-auto grid place-items-center h-16 w-16 rounded-full bg-info/10 text-info border border-info/20 shadow-inner">
              <Scale className="h-8 w-8" />
            </div>
            
            <div className="space-y-1.5">
              <h4 className="font-semibold text-lg text-foreground">No active passenger rights triggers detected</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Passenger rights and compensation entitlements (such as EU261 or local regulations) dynamically trigger based on real-time flight delays, cancellations, or boarding denials.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 text-start">
              <div className="rounded-lg border border-border/60 bg-background/50 p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-info" /> Delay Triggers
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Delays exceeding 3 hours at arrival may qualify for compensation up to €600, depending on route distance.
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/50 p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5 text-info" /> Cancellation & Duty of Care
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  If cancelled, passengers are entitled to re-routing, meals, free communication, and accommodation if delayed overnight.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button asChild variant="outline" size="sm" className="gap-2 border-info/40 text-info hover:bg-info/10">
                <Link to="/passenger-rights">
                  Explore Passenger Rights Guide <ArrowRight className="h-4 w-4 rtl-flip" />
                </Link>
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
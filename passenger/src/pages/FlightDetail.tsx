import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getPassengerFlight,
  getPassengerPrediction,
  type Flight,
  type FlightPrediction,
} from "@/services/api";
import { StatusBadge } from "@/components/StatusBadge";
import { useCountdown, formatTime, formatDate } from "@/lib/time";
import { motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Bell, Brain, CheckCircle2, Clock,
  Luggage, Plane, Scale, ShieldCheck, Sparkles,
  TrendingUp, AlertTriangle, Wind, Cloud, Gauge, Radio,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

/* ──────────────────────────────────────────────────────────────────────────
 * FlightDetail
 * Real backend, modern UI. No mock data — every field comes from `flight`,
 * `normPred` (real ML prediction) or `dbRights` (backend passenger rights).
 * ────────────────────────────────────────────────────────────────────────── */

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

  /* ───────── Effects (UNCHANGED backend logic) ───────── */

  useEffect(() => {
    const savedEmail = localStorage.getItem("passenger_alert_email");
    if (savedEmail) setAlertEmail(savedEmail);
  }, []);

  const fetchSubscriptionStatus = async (email: string) => {
    if (!email || !flight?.flightNumber) return;
    setCheckingStatus(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/passenger/alerts/status?email=${encodeURIComponent(email)}&flight_number=${encodeURIComponent(flight.flightNumber)}`
      );
      if (res.ok) setSubscriptionStatus(await res.json());
    } catch (err) {
      console.error("Failed to check subscription status", err);
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (alertEmail && alertEmail.includes("@") && alertsOpen) {
      const t = setTimeout(() => fetchSubscriptionStatus(alertEmail), 500);
      return () => clearTimeout(t);
    } else if (!alertEmail) {
      setSubscriptionStatus(null);
    }
  }, [alertEmail, alertsOpen, flight?.flightNumber]);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;
    const loadData = async () => {
      if (!id) return;
      try {
        const data = await getPassengerFlight(id);
        if (data && !cancelled) { setFlight(data); setError(false); }
        else if (!cancelled) setError(true);
      } catch {
        if (!cancelled) setError(true);
      }
    };
    loadData();
    interval = setInterval(loadData, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [id]);

  useEffect(() => {
    if (!flight) return;
    const fn = flight.flightNumber;
    if (!fn || fn === "UNKNOWN") return;
    setPredictionLoading(true);
    getPassengerPrediction(fn)
      .then(pred => { if (pred) setLivePrediction(pred); })
      .catch(() => null)
      .finally(() => setPredictionLoading(false));
  }, [flight?.flightNumber]);

  const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "ar" ? "ar" : "en-US";
  useCountdown(flight?.departureTime ?? new Date().toISOString());

  /* ───────── Early states ───────── */

  if (error) return (
    <div className="py-24 text-center">
      <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
      <h2 className="text-2xl font-semibold mb-2">{t("flight_not_found", "Flight Not Found")}</h2>
      <p className="text-muted-foreground mb-6">{t("flight_not_found_desc", "We couldn't find details for this flight.")}</p>
      <Button onClick={() => nav("/flights")}>{t("back_to_flights", "Back to Flights")}</Button>
    </div>
  );

  if (!flight) return (
    <div className="py-24 text-center text-muted-foreground">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
      {t("loading_flight", "Loading flight details...")}
    </div>
  );

  /* ───────── Real ML prediction normalization (UNCHANGED) ───────── */
  const pred: FlightPrediction | null = flight.prediction ?? livePrediction ?? null;

  const getNormalizedMLPrediction = (p: FlightPrediction | null) => {
    if (!p) return null;
    const rawRisk = p.riskScore ?? 0;
    const riskFraction = rawRisk > 1 ? rawRisk / 100 : rawRisk;
    const riskPercent = Math.round(riskFraction * 100);
    const rawConf = p.confidence ?? 0;
    const confidenceFraction = rawConf > 1 ? rawConf / 100 : rawConf;
    const confidencePercent = Math.round(confidenceFraction * 100);

    const lng = i18n.language;
    let confidenceLabel = lng === "fr" ? "Confiance limitée" : lng === "ar" ? "ثقة محدودة" : "Limited confidence";
    let confidenceSub = lng === "fr" ? "Les mises à jour météo ou système introduisent de l'incertitude" : lng === "ar" ? "تحديثات الطقس أو النظام قد تسبب عدم يقين" : "Dynamic weather or system updates introduce uncertainty";
    if (confidenceFraction >= 0.75) {
      confidenceLabel = lng === "fr" ? "Haute confiance" : lng === "ar" ? "ثقة عالية" : "High confidence";
      confidenceSub = lng === "fr" ? "Des tendances historiques solides soutiennent cette prévision" : lng === "ar" ? "اتجاهات تاريخية قوية تدعم هذا التوقع" : "Strong historical trends support this delay forecast";
    } else if (confidenceFraction >= 0.45) {
      confidenceLabel = lng === "fr" ? "Confiance modérée" : lng === "ar" ? "ثقة متوسطة" : "Moderate confidence";
      confidenceSub = lng === "fr" ? "Prédiction fiable basée sur les schémas de route" : lng === "ar" ? "توقع موثوق بناءً على أنماط المسار" : "Reliable prediction based on route schedule patterns";
    }

    let riskTone: "low" | "medium" | "high" = "low";
    let riskSub = lng === "fr" ? "Faible risque de retard · Probablement à l'heure" : lng === "ar" ? "مخاطر تأخير منخفضة · على الأرجح في الموعد" : "Low delay risk · Likely on-time";
    if (riskFraction >= 0.7) {
      riskTone = "high";
      riskSub = lng === "fr" ? "Risque élevé · Retards importants prévus" : lng === "ar" ? "مخاطر تأخير عالية · تأخيرات كبيرة متوقعة" : "High delay risk · Heavy schedule delays expected";
    } else if (riskFraction >= 0.4) {
      riskTone = "medium";
      riskSub = lng === "fr" ? "Risque modéré · Des ajustements mineurs possibles" : lng === "ar" ? "مخاطر تأخير متوسطة · تعديلات طفيفة محتملة" : "Moderate delay risk · Minor schedule adjustments possible";
    }

    return { ...p, riskFraction, riskPercent, confidenceFraction, confidencePercent, confidenceLabel, confidenceSub, riskTone, riskSub };
  };

  const normPred = getNormalizedMLPrediction(pred);
  const dbRights = flight.passengerRights ?? [];
  const isDelayed = flight.status === "delayed" || (flight.delayMin ?? 0) > 5;

  /* ───────── Passenger-friendly SHAP explanation ───────── */
  const shapExplanations = (normPred?.topFactors ?? [])
    .map(f => shapToPassengerExplanation(f.label, f.value))
    .filter(Boolean) as string[];
  const uniqueExplanations = [...new Set(shapExplanations)];

  /* ───────── Progress + timeline logic (UNCHANGED) ───────── */

  const getStepStates = (status: string) => {
    switch (status) {
      case "scheduled": return { scheduled: { done: false, active: true }, boarding: { done: false, active: false }, departed: { done: false, active: false }, arrived: { done: false, active: false } };
      case "boarding":  return { scheduled: { done: true,  active: false }, boarding: { done: false, active: true  }, departed: { done: false, active: false }, arrived: { done: false, active: false } };
      case "departed":
      case "in_air":    return { scheduled: { done: true,  active: false }, boarding: { done: true,  active: false }, departed: { done: false, active: true  }, arrived: { done: false, active: false } };
      case "landed":    return { scheduled: { done: true,  active: false }, boarding: { done: true,  active: false }, departed: { done: true,  active: false }, arrived: { done: true,  active: true  } };
      case "delayed": {
        const depTs = new Date(flight.departureTime || flight.scheduledDeparture).getTime();
        const arrTs = new Date(flight.arrivalTime || flight.scheduledArrival).getTime();
        const now = Date.now();
        if (arrTs < now) return { scheduled: { done: true, active: false }, boarding: { done: true, active: false }, departed: { done: true, active: false }, arrived: { done: true, active: true } };
        if (depTs < now) return { scheduled: { done: true, active: false }, boarding: { done: true, active: false }, departed: { done: false, active: true }, arrived: { done: false, active: false } };
        return { scheduled: { done: false, active: true }, boarding: { done: false, active: false }, departed: { done: false, active: false }, arrived: { done: false, active: false } };
      }
      default:          return { scheduled: { done: false, active: false }, boarding: { done: false, active: false }, departed: { done: false, active: false }, arrived: { done: false, active: false } };
    }
  };

  const getFlightProgressInfo = (f: Flight) => {
    const lng = i18n.language;
    const cancelled = lng === "fr" ? "Annulé" : lng === "ar" ? "ملغاة" : "Cancelled";
    const arrived = lng === "fr" ? "Arrivé" : lng === "ar" ? "وصلت" : "Arrived";
    const boarding = lng === "fr" ? "Embarquement" : lng === "ar" ? "صعود" : "Boarding";
    const scheduled = lng === "fr" ? "Programmé" : lng === "ar" ? "مجدولة" : "Scheduled";
    const enRoute = lng === "fr" ? "En vol" : lng === "ar" ? "في الجو" : "En Route";
    if (f.status === "cancelled") return { percent: 0, label: cancelled, isCancelled: true, remainingMs: 0 };
    if (f.status === "landed")    return { percent: 100, label: arrived, remainingMs: 0 };
    if (f.status === "scheduled" || f.status === "boarding") return { percent: 0, label: f.status === "boarding" ? boarding : scheduled, remainingMs: 0 };
    const depTime = new Date(f.departureTime || f.scheduledDeparture);
    const arrTime = new Date(f.arrivalTime || f.scheduledArrival);
    const now = new Date();
    const totalMs = arrTime.getTime() - depTime.getTime();
    if (totalMs <= 0) return { percent: 50, label: enRoute, remainingMs: 0 };
    const elapsed = now.getTime() - depTime.getTime();
    const percent = Math.min(99, Math.max(1, Math.round((elapsed / totalMs) * 100)));
    const remainingMs = arrTime.getTime() - now.getTime();
    return { percent, label: enRoute, remainingMs: remainingMs > 0 ? remainingMs : 0 };
  };

  const progressInfo = getFlightProgressInfo(flight);

  const getRemainingTimeDisplay = (info: any, f: Flight) => {
    const lng = i18n.language;
    const cancelled = lng === "fr" ? "Annulé" : lng === "ar" ? "ملغاة" : "Cancelled";
    const completed = lng === "fr" ? "Vol terminé" : lng === "ar" ? "اكتملت الرحلة" : "Flight completed";
    const boardingNow = lng === "fr" ? "Embarquement en cours" : lng === "ar" ? "جاري الصعود الآن" : "Boarding now";
    const passed = lng === "fr" ? "Heure de départ dépassée" : lng === "ar" ? "موعد المغادرة مضى" : "Scheduled departure passed";
    const arriving = lng === "fr" ? "Arrivée imminente" : lng === "ar" ? "سيصل قريباً" : "Arriving shortly";
    if (f.status === "cancelled") return cancelled;
    if (f.status === "landed")    return completed;
    if (f.status === "scheduled" || f.status === "boarding") {
      const depTime = new Date(f.departureTime || f.scheduledDeparture);
      const diffMs = depTime.getTime() - Date.now();
      if (diffMs > 0) {
        const mins = Math.round(diffMs / 60000);
        const h = Math.floor(mins / 60), m = mins % 60;
        const departsIn = lng === "fr" ? "Départ dans" : lng === "ar" ? "تغادر خلال" : "Departs in";
        return h > 0 ? `${departsIn} ${h}h ${String(m).padStart(2, "0")}m` : `${departsIn} ${m}m`;
      }
      return f.status === "boarding" ? boardingNow : passed;
    }
    const remainingMs = info.remainingMs ?? 0;
    if (remainingMs <= 0) return arriving;
    const mins = Math.round(remainingMs / 60000);
    const h = Math.floor(mins / 60), m = mins % 60;
    const remaining = lng === "fr" ? "restant" : lng === "ar" ? "متبقي" : "remaining";
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m ${remaining}` : `${m}m ${remaining}`;
  };

  const stepStates = getStepStates(flight.status);

  const steps = [
    { key: "scheduled", icon: Clock,      ...stepStates.scheduled, scheduled: flight.scheduledDeparture, estimated: flight.departureTime || flight.scheduledDeparture },
    { key: "boarding",  icon: Plane,      ...stepStates.boarding,  scheduled: addMin(flight.scheduledDeparture, -40), estimated: null },
    { key: "departed",  icon: TrendingUp, ...stepStates.departed,  scheduled: flight.scheduledDeparture, estimated: flight.departureTime || flight.scheduledDeparture },
    { key: "arrived",   icon: Luggage,    ...stepStates.arrived,   scheduled: flight.scheduledArrival,   estimated: flight.arrivalTime || flight.scheduledArrival },
  ];

  const timelineProgressWidth = (() => {
    switch (flight.status) {
      case "scheduled": return 0;
      case "boarding":  return 33;
      case "departed":
      case "in_air":
      case "delayed":   return 66;
      case "landed":    return 100;
      default:          return 0;
    }
  })();

  /* ───────── Display-derived values (no mock data) ───────── */

  const depDrift = Math.round((new Date(flight.departureTime || flight.scheduledDeparture).getTime() - new Date(flight.scheduledDeparture).getTime()) / 60000);
  const arrDrift = Math.round((new Date(flight.arrivalTime   || flight.scheduledArrival  ).getTime() - new Date(flight.scheduledArrival  ).getTime()) / 60000);
  const isLive = flight.status === "in_air" || flight.status === "departed";

  /* ───────── Render ───────── */

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 md:px-6 space-y-6 pb-16 pt-4">

        {/* Top bar */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={() => nav(-1)} className="gap-2 -ms-3 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 rtl-flip" /> {t("common.back", "Back")}
          </Button>

          <Dialog open={alertsOpen} onOpenChange={setAlertsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2 rounded-full border-border bg-card hover:border-primary/60 hover:text-primary">
                <Bell className="h-3.5 w-3.5" /> {t("activate_alerts", "Activate alerts")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="grid place-items-center h-10 w-10 rounded-xl bg-primary/15 text-primary border border-primary/30">
                    <Bell className="h-5 w-5" />
                  </div>
                  <DialogTitle className="text-xl">{t("alerts_dialog_title", "Stay updated on {{fn}}", { fn: flight.flightNumber })}</DialogTitle>
                </div>
                <DialogDescription className="text-sm leading-relaxed">
                  {t("alerts_dialog_desc", "We'll send you real-time email updates for delays, gate changes, and boarding calls.")}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-3">
                <Label htmlFor="alert-email" className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> {t("alerts_email_label", "Email address")}
                </Label>
                <Input
                  id="alert-email"
                  type="email"
                  placeholder={t("alerts_email_placeholder", "you@example.com")}
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("alerts_privacy_note", "Used only for flight status alerts. You can unsubscribe at any time.")}
                </p>
              </div>

              {checkingStatus && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2 animate-pulse">
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  {t("alerts_checking_status", "Checking subscription status...")}
                </div>
              )}

              {!checkingStatus && subscriptionStatus?.subscribed && (
                <div className="mt-4 p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("alerts_subscription_status", "Subscription Status")}</span>
                    {subscriptionStatus.status === "ACTIVE" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success border border-success/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> {t("status_active", "Active")}
                      </span>
                    )}
                    {subscriptionStatus.status === "COMPLETED" && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-info/15 text-info border border-info/30">{t("status_completed", "Completed")}</span>}
                    {subscriptionStatus.status === "CANCELLED" && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">{t("status_cancelled", "Cancelled")}</span>}
                    {subscriptionStatus.status === "EXPIRED"  && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/15 text-warning border border-warning/30">{t("status_expired", "Expired")}</span>}
                  </div>

                  <div className="text-sm leading-relaxed text-muted-foreground">
                    {subscriptionStatus.status === "ACTIVE" && (
                      <p>{t("alerts_active_desc", "You are currently tracking {{fn}}. We'll email you about gate updates, delays, or boarding calls.", { fn: flight.flightNumber })}</p>
                    )}
                    {subscriptionStatus.status === "COMPLETED" && (
                      <div className="space-y-1">
                        <p className="text-foreground font-medium">{t("alerts_completed_title", "Alerts completed")}</p>
                        <p className="text-xs">
                          {t("alerts_reason", "Reason")}: {subscriptionStatus.completion_reason === "flight_landed" ? t("alerts_reason_landed", "Flight has landed.")
                                 : subscriptionStatus.completion_reason === "flight_cancelled" ? t("alerts_reason_cancelled", "Flight was cancelled.")
                                 : subscriptionStatus.completion_reason === "flight_departed" ? t("alerts_reason_departed", "Flight has departed.")
                                 : subscriptionStatus.completion_reason || t("alerts_reason_final", "Flight reached a final status.")}
                        </p>
                        {subscriptionStatus.completed_at && <p className="text-[10px] font-mono">{t("alerts_closed", "Closed")}: {new Date(subscriptionStatus.completed_at).toLocaleString()}</p>}
                      </div>
                    )}
                    {subscriptionStatus.status === "CANCELLED" && (
                      <div className="space-y-1">
                        <p className="text-foreground font-medium">{t("alerts_cancelled_title", "Alerts cancelled")}</p>
                        <p className="text-xs">{t("alerts_cancelled_desc", "You manually unsubscribed from updates for this flight.")}</p>
                        {subscriptionStatus.completed_at && <p className="text-[10px] font-mono">{t("alerts_unsubscribed", "Unsubscribed")}: {new Date(subscriptionStatus.completed_at).toLocaleString()}</p>}
                      </div>
                    )}
                    {subscriptionStatus.status === "EXPIRED" && (
                      <div className="space-y-1">
                        <p className="text-foreground font-medium">{t("alerts_expired_title", "Alerts expired")}</p>
                        <p className="text-xs">{t("alerts_expired_desc", "Alerts stopped because the scheduled departure time passed without final status updates.")}</p>
                        {subscriptionStatus.completed_at && <p className="text-[10px] font-mono">{t("alerts_expired_label", "Expired")}: {new Date(subscriptionStatus.completed_at).toLocaleString()}</p>}
                      </div>
                    )}
                  </div>

                  {subscriptionStatus.status === "ACTIVE" ? (
                    <Button
                      variant="destructive" size="sm" className="w-full mt-1 gap-2" disabled={alertSaving}
                      onClick={async () => {
                        setAlertSaving(true);
                        try {
                          const res = await fetch(`${import.meta.env.VITE_API_URL}/passenger/alerts/unsubscribe`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: alertEmail, flight_number: flight.flightNumber }),
                          });
                          if (!res.ok) throw new Error();
                          toast({ title: t("alerts_cancelled_toast", "Alerts cancelled"), description: t("alerts_cancelled_toast_desc", "You have unsubscribed from flight alerts.") });
                          fetchSubscriptionStatus(alertEmail);
                        } catch { toast({ title: t("error", "Error"), description: t("alerts_cancel_error", "Could not cancel alerts. Try again."), variant: "destructive" }); }
                        finally { setAlertSaving(false); }
                      }}
                    >
                      {alertSaving && <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin"/>}
                      {t("alerts_cancel_btn", "Cancel Alerts / Unsubscribe")}
                    </Button>
                  ) : (
                    <Button
                      variant="outline" size="sm" className="w-full mt-1 gap-2 border-primary/40 text-primary hover:bg-primary/10" disabled={alertSaving}
                      onClick={async () => {
                        setAlertSaving(true);
                        try {
                          const res = await fetch(`${import.meta.env.VITE_API_URL}/passenger/alerts/subscribe`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              email: alertEmail, flight_number: flight.flightNumber,
                              dep_iata: flight.from.code, arr_iata: flight.to.code,
                              scheduled_departure: flight.scheduledDeparture, airline: flight.airline,
                            }),
                          });
                          if (!res.ok) throw new Error();
                          localStorage.setItem("passenger_alert_email", alertEmail.trim());
                          toast({ title: t("alerts_activated_toast", "Alerts activated"), description: t("alerts_reactivated_desc", "Re-subscribed at {{email}}.", { email: alertEmail }) });
                          fetchSubscriptionStatus(alertEmail);
                        } catch { toast({ title: t("error", "Error"), description: t("alerts_activate_error", "Could not activate alerts. Try again."), variant: "destructive" }); }
                        finally { setAlertSaving(false); }
                      }}
                    >
                      {alertSaving ? <div className="h-4 w-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin"/> : <Bell className="h-4 w-4" />}
                      {t("alerts_reactivate_btn", "Re-activate Alerts")}
                    </Button>
                  )}
                </div>
              )}

              <DialogFooter className="mt-4">
                <Button variant="ghost" onClick={() => setAlertsOpen(false)} disabled={alertSaving}>{t("close", "Close")}</Button>
                {(!subscriptionStatus || !subscriptionStatus.subscribed) && (
                  <Button
                    disabled={alertSaving || checkingStatus}
                    onClick={async () => {
                      if (!alertEmail || !alertEmail.includes("@")) {
                        toast({ title: t("alerts_email_required", "Valid email required"), description: t("alerts_email_required_desc", "Please enter a valid email address."), variant: "destructive" });
                        return;
                      }
                      setAlertSaving(true);
                      try {
                        const res = await fetch(`${import.meta.env.VITE_API_URL}/passenger/alerts/subscribe`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            email: alertEmail, flight_number: flight.flightNumber,
                            dep_iata: flight.from.code, arr_iata: flight.to.code,
                            scheduled_departure: flight.scheduledDeparture, airline: flight.airline,
                          }),
                        });
                        if (!res.ok) throw new Error();
                        localStorage.setItem("passenger_alert_email", alertEmail.trim());
                        toast({ title: t("alerts_activated_toast", "Alerts activated"), description: t("alerts_activated_desc", "You'll receive live updates at {{email}}.", { email: alertEmail }) });
                        fetchSubscriptionStatus(alertEmail);
                      } catch { toast({ title: t("error", "Error"), description: t("alerts_activate_error", "Could not activate alerts. Try again."), variant: "destructive" }); }
                      finally { setAlertSaving(false); }
                    }}
                    className="gap-2"
                  >
                    {alertSaving ? <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" /> : <Bell className="h-4 w-4" />}
                    {alertSaving ? t("activating", "Activating...") : t("activate", "Activate")}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-border/70 bg-card shadow-[0_1px_0_rgba(0,0,0,0.02),0_20px_50px_-30px_rgba(180,120,40,0.25)]"
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 opacity-[0.5]"
              style={{ backgroundImage: "radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 70%)" }} />
            <ArcSVG />
          </div>

          <div className="relative p-6 md:p-10">
            {/* Meta row */}
            <div className="flex items-center justify-between gap-4 flex-wrap mb-10">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-medium text-primary">
                  {isLive ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
                  )}
                  {t("flightDetail_track", "Live tracking")}
                </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="font-mono text-sm font-semibold tracking-tight">{flight.canonicalFlightNumber || flight.flightNumber}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-sm text-muted-foreground">{flight.airline}{flight.aircraft && flight.aircraft !== "—" && flight.aircraft !== t("unknown", "Unknown") ? ` · ${flight.aircraft}` : ""}</span>
              </div>
              <StatusBadge status={flight.status} />
            </div>

            {/* Route */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 lg:gap-12 items-center">
              {/* Departure */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">{t("departure", "Departure")}</div>
                <div className="font-mono text-6xl md:text-7xl font-semibold tracking-[-0.04em] leading-none">{flight.from.code}</div>
                <div className="text-sm text-muted-foreground">{flight.from.city}{flight.from.name ? ` · ${flight.from.name}` : ""}</div>
                <div className="pt-3 flex items-baseline gap-3 flex-wrap">
                  <div className="font-mono text-2xl font-medium tabular-nums text-primary">{formatTime(flight.departureTime || flight.scheduledDeparture, locale)}</div>
                  {depDrift !== 0 && (
                    <>
                      <div className="text-xs text-muted-foreground/70 line-through font-mono">{formatTime(flight.scheduledDeparture, locale)}</div>
                      <DriftChip min={depDrift} />
                    </>
                  )}
                </div>
              </div>

              {/* Center progress */}
              <div className="flex flex-col items-center min-w-[220px] lg:min-w-[300px]">
                <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground font-medium mb-2">{progressInfo.label}</div>
                <div className="text-2xl md:text-3xl font-semibold tabular-nums tracking-tight text-center mb-6">
                  {getRemainingTimeDisplay(progressInfo, flight)}
                </div>

                <div className="w-full relative h-8 flex items-center">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border" />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-primary to-primary/80 transition-all duration-700"
                    style={{ width: `${progressInfo.percent}%` }} />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full border-2 border-muted-foreground/40 bg-card" />
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${progressInfo.percent}%` }}>
                    {progressInfo.percent > 0 && progressInfo.percent < 100 && (
                      <span className="absolute inset-0 -m-2 rounded-full bg-primary/30 animate-ping" />
                    )}
                    <div className="relative grid place-items-center h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-card">
                      <Plane className="h-3.5 w-3.5 rotate-90" />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4 text-[11px] font-mono tabular-nums text-muted-foreground">
                  <span>0%</span>
                  <span className="text-foreground font-semibold">Flight progress · {progressInfo.percent}%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Arrival */}
              <div className="space-y-2 lg:text-right">
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
                  <span className="inline-flex items-center gap-1.5 lg:flex-row-reverse">
                    <span className="h-1.5 w-1.5 rounded-full bg-info" /> {t("arrival", "Arrival")}
                  </span>
                </div>
                <div className="font-mono text-6xl md:text-7xl font-semibold tracking-[-0.04em] leading-none">{flight.to.code}</div>
                <div className="text-sm text-muted-foreground">{flight.to.city}{flight.to.name ? ` · ${flight.to.name}` : ""}</div>
                <div className="pt-3 flex items-baseline gap-3 lg:justify-end flex-wrap">
                  <div className={`font-mono text-2xl font-medium tabular-nums ${arrDrift <= 0 ? "text-success" : "text-warning"}`}>
                    {formatTime(flight.arrivalTime || flight.scheduledArrival, locale)}
                  </div>
                  {arrDrift !== 0 && (
                    <>
                      <div className="text-xs text-muted-foreground/70 line-through font-mono">{formatTime(flight.scheduledArrival, locale)}</div>
                      <DriftChip min={arrDrift} />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Live telemetry strip (only when in air & data exists) */}
            {isLive && (flight.altitudeFt || flight.speedKts || flight.headingDeg) && (
              <div className="mt-10 pt-6 border-t border-border/60 grid grid-cols-2 md:grid-cols-4 gap-6">
                {typeof flight.altitudeFt === "number" && (
                  <Telemetry icon={Gauge} label={t("telemetry_altitude", "Altitude")} value={flight.altitudeFt.toLocaleString()} unit="ft" />
                )}
                {typeof flight.speedKts === "number" && (
                  <Telemetry icon={Wind}  label={t("telemetry_speed", "Ground speed")} value={String(flight.speedKts)} unit="kts" />
                )}
                {typeof flight.headingDeg === "number" && (
                  <Telemetry icon={Radio} label={t("telemetry_heading", "Heading")} value={`${flight.headingDeg}°`} />
                )}
                <Telemetry icon={Cloud} label={t("telemetry_date", "Date")} value={formatDate(flight.scheduledDeparture, locale)} />
              </div>
            )}
          </div>
        </motion.section>

        {/* QUICK FACTS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/70 rounded-2xl overflow-hidden border border-border/70 shadow-sm">
          <Fact label={t("fact_gate", "Gate")}     value={flight.to.gate ?? flight.gate ?? t("not_assigned", "Not yet assigned")} sub={flight.to.terminal ? `${t("terminal", "Terminal")} ${flight.to.terminal}` : undefined} />
          <Fact label={t("fact_aircraft", "Aircraft")} value={flight.aircraft && flight.aircraft !== "—" && flight.aircraft !== "Unknown" ? flight.aircraft : t("info_unavailable", "Information unavailable")} sub={`${flight.airline} · ${flight.airlineCode}`} />
          <Fact label={t("fact_distance", "Distance")} value={flight.distanceKm > 0 ? `${flight.distanceKm.toLocaleString()} km` : t("info_unavailable", "Information unavailable")} sub={flight.durationMin > 0 ? t("duration_flight", "{{h}}h {{m}}m flight", { h: Math.floor(flight.durationMin / 60), m: flight.durationMin % 60 }) : undefined} />
          <Fact label={t("fact_airline", "Airline")}  value={flight.airlineCode} sub={flight.airline} />
        </div>

        {/* TIMELINE */}
        <section className="rounded-3xl border border-border/70 bg-card p-6 md:p-8 shadow-sm">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-3">
            <div>
              <h3 className="text-xl font-semibold tracking-tight">{t("timeline_title", "Journey timeline")}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t("timeline_subtitle", "Real-time milestones tracking flight progress")}</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" /> {t("timeline_scheduled", "Scheduled")}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> {t("timeline_estimated", "Estimated")}</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute top-5 left-5 right-5 h-px bg-border hidden md:block" />
            <div className="absolute top-5 left-5 h-px bg-primary hidden md:block transition-all duration-700"
              style={{ width: `${timelineProgressWidth}%` }} />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4 relative">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const state = s.done ? "done" : s.active ? "active" : "upcoming";
                const sched = formatTime(s.scheduled, locale);
                const est = s.estimated ? formatTime(s.estimated, locale) : null;
                const drift = s.estimated ? Math.round((new Date(s.estimated).getTime() - new Date(s.scheduled).getTime()) / 60000) : null;
                return (
                  <motion.div key={s.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.4 }}
                    className="flex md:flex-col items-start md:items-center gap-4 md:gap-0 relative">
                    <div className={`relative grid place-items-center h-10 w-10 rounded-full z-10 shrink-0 transition-colors shadow-sm ${
                      state === "done" ? "bg-primary text-primary-foreground"
                      : state === "active" ? "bg-card border-2 border-primary text-primary"
                      : "bg-card border border-border text-muted-foreground/60"
                    }`}>
                      {state === "active" && <span className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" />}
                      {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <div className="md:mt-4 md:text-center flex-1 md:w-full">
                      <div className={`text-sm ${state === "active" ? "font-semibold text-foreground" : state === "done" ? "text-foreground" : "text-muted-foreground"}`}>
                        {t(`timeline.${s.key}`, { defaultValue: defaultStepLabel(s.key) })}
                      </div>
                      <div className="mt-1 flex flex-col md:items-center text-[11px] font-mono tabular-nums">
                          <span className="text-muted-foreground/70">{t("timeline_sched_abbr", "Sched.")} {sched}</span>
                        <span className="text-foreground flex items-center gap-1.5">
                          {est ? (
                            <>
                              {t("timeline_est_abbr", "Est.")} {est}
                              {drift !== null && drift !== 0 && (
                                <span className={`text-[10px] font-semibold px-1 py-px rounded ${drift > 0 ? "text-warning bg-warning/10" : "text-success bg-success/10"}`}>
                                  {drift > 0 ? "+" : ""}{drift}m
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("timeline_check_airline", "Check with airline")}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* AI PREDICTION (real ML) */}
        <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/5 p-6 md:p-8 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-8">
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-11 w-11 rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-primary font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> {t("ai_delay_label", "AI delay prediction")}
                </div>
                <h3 className="text-xl font-semibold tracking-tight mt-0.5">{t("delay_forecast", "Delay forecast")}</h3>
              </div>
            </div>
            {normPred && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-success bg-success/10 px-3 py-1.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> {t("ml_prediction_active", "ML prediction active")}
              </span>
            )}
          </div>

          {predictionLoading && (
            <div className="py-8 flex items-center gap-3 text-muted-foreground">
              <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <span className="text-sm">{t("loading_prediction", "Loading AI prediction…")}</span>
            </div>
          )}

          {!predictionLoading && !normPred && (
            <div className="py-8 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground bg-background/20">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
              {t("prediction_unavailable", "Prediction unavailable — ML model has not processed this flight yet.")}
            </div>
          )}

          {!predictionLoading && normPred && (
            <>
              <div className="grid lg:grid-cols-3 gap-3 mb-8">
                <PredictionStat tone={normPred.riskTone} label={t("risk_score", "Risk score")}
                  value={`${normPred.riskPercent}%`} sub={normPred.riskSub} progress={normPred.riskPercent} />
                <PredictionStat tone={normPred.riskTone} label={t("predicted_delay", "Predicted delay")}
                  value={!normPred.predictedDelayMin || normPred.predictedDelayMin <= 5 ? t("on_time", "On time") : `+${Math.floor(normPred.predictedDelayMin / 60)}h ${normPred.predictedDelayMin % 60}m`}
                  sub={t("arrival_impact", "Estimated arrival impact at {{code}}", { code: flight.to.code })} />
                <PredictionStat tone="info" label={t("model_confidence", "Model confidence")}
                  value={normPred.confidenceLabel}
                  sub={`${normPred.confidencePercent}% · ${normPred.confidenceSub}`}
                  progress={normPred.confidencePercent} />
              </div>

              {uniqueExplanations.length > 1 && (
                <div>
                  <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">{t("why_delay_predicted", "Why this delay is predicted")}</h4>
                  <div className="space-y-2">
                    {uniqueExplanations.slice(0, 4).map((text, i) => (
                      <motion.div key={text} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                        {text}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* PASSENGER RIGHTS (from DB) */}
        <section className="rounded-3xl border border-border/70 bg-card p-6 md:p-8 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-8">
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-11 w-11 rounded-2xl bg-info/10 text-info">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-info font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3" /> {t("passenger_rights", "Passenger rights")}
                </div>
                <h3 className="text-xl font-semibold tracking-tight mt-0.5">{t("your_entitlements", "Your entitlements")}</h3>
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground">{t("rights_basis", "Based on EU261 · auto-evaluated")}</span>
          </div>

          {isDelayed ? (
            <div className="rounded-xl border border-border bg-background/30 p-6 md:p-8 text-center max-w-2xl mx-auto space-y-4">
              <div className="mx-auto grid place-items-center h-16 w-16 rounded-full bg-warning/10 text-warning border border-warning/20">
                <Clock className="h-8 w-8" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-semibold text-lg">{t("rights_delayed", "Your flight is currently delayed")}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {flight.delayMin && flight.delayMin >= 180
                    ? t("rights_delayed_compensation", "This flight may qualify for assistance or compensation.")
                    : t("rights_delayed_no_compensation", "The current delay does not yet trigger compensation rights.")}
                </p>
                {flight.delayMin && flight.delayMin > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("rights_delayed_detail", "Current delay: {{min}} minutes.", { min: flight.delayMin })}
                  </p>
                )}
              </div>
              <div className="pt-2">
                <Button asChild variant="outline" size="sm" className="gap-2 border-info/40 text-info hover:bg-info/10">
                  <Link to="/passenger-rights">{t("explore_rights_guide", "Explore Passenger Rights Guide")} <ArrowRight className="h-4 w-4 rtl-flip" /></Link>
                </Button>
              </div>
            </div>
          ) : dbRights.length === 0 ? (
            <div className="rounded-xl border border-border bg-background/30 p-6 md:p-8 text-center max-w-2xl mx-auto space-y-4">
              <div className="mx-auto grid place-items-center h-16 w-16 rounded-full bg-info/10 text-info border border-info/20">
                <Scale className="h-8 w-8" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-semibold text-lg">{t("rights_onschedule", "Your flight is currently on schedule")}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("rights_onschedule_desc", "Passenger rights and compensation typically apply for delays over 3 hours, cancellations, or boarding denials. No such event has been detected for this flight. If your flight is disrupted, eligible entitlements will appear here automatically.")}
                </p>
              </div>
              <div className="pt-2">
                <Button asChild variant="outline" size="sm" className="gap-2 border-info/40 text-info hover:bg-info/10">
                  <Link to="/passenger-rights">{t("explore_rights_guide", "Explore Passenger Rights Guide")} <ArrowRight className="h-4 w-4 rtl-flip" /></Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-2 mb-6">
                {dbRights.map((r: { title: string; description: string; active: boolean; compensation?: string }, i: number) => (
                  <motion.div key={r.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className={`rounded-xl border p-4 transition-colors ${r.active ? "border-primary/40 bg-primary/[0.04]" : "border-border/70 opacity-70"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`grid place-items-center h-8 w-8 shrink-0 rounded-lg ${r.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium text-sm">{r.title}</div>
                          {r.active
                            ? <span className="text-[10px] uppercase tracking-wider text-success font-semibold">{t("active_upper", "Active")}</span>
                            : <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("standby_upper", "Standby")}</span>}
                        </div>
                        <div className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{r.description}</div>
                        {r.compensation && <div className="mt-2 text-sm font-mono font-semibold text-primary">{r.compensation}</div>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3 pt-5 border-t border-border/60">
                <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-xl">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                  <span>{t("rights_disclaimer", "Compensation does not apply for extraordinary circumstances (severe weather, ATC strikes, security threats).")}</span>
                </div>
                <Button asChild variant="outline" className="gap-2">
                  <Link to="/passenger-rights">{t("full_rights_guide", "Full rights guide")} <ArrowRight className="h-4 w-4 rtl-flip" /></Link>
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default FlightDetail;

/* ─────────────────────────  HELPERS  ───────────────────────── */

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card p-5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">{label}</div>
      <div className="text-xl font-semibold tracking-tight mt-1.5 truncate">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function DetailCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 flex items-start gap-4 shadow-sm">
      <div className="grid place-items-center h-10 w-10 rounded-xl bg-primary/10 text-primary shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">{label}</div>
        <div className="text-base font-semibold tracking-tight mt-0.5 truncate">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function Telemetry({ icon: Icon, label, value, unit }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; unit?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid place-items-center h-9 w-9 rounded-xl bg-primary/10 text-primary shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">{label}</div>
        <div className="text-sm font-semibold tabular-nums">
          {value} {unit && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

function PredictionStat({ tone, label, value, sub, progress }: {
  tone: "low" | "medium" | "high" | "info";
  label: string; value: string; sub?: string; progress?: number;
}) {
  const toneMap = {
    low:    { text: "text-success",     bar: "bg-success" },
    medium: { text: "text-primary",     bar: "bg-primary" },
    high:   { text: "text-destructive", bar: "bg-destructive" },
    info:   { text: "text-info",        bar: "bg-info" },
  } as const;
  const c = toneMap[tone];
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">{label}</div>
      <div className={`text-3xl font-semibold tracking-tight tabular-nums mt-2 ${c.text}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{sub}</div>}
      {typeof progress === "number" && (
        <div className="mt-4 h-1 rounded-full bg-muted overflow-hidden">
          <div className={`h-full transition-all duration-700 ${c.bar}`} style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
    </div>
  );
}

function DriftChip({ min }: { min: number }) {
  if (min === 0) return null;
  const positive = min > 0;
  return (
    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${positive ? "text-warning bg-warning/10" : "text-success bg-success/10"}`}>
      {positive ? "+" : ""}{min}m
    </span>
  );
}

function ArcSVG() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.35]" viewBox="0 0 800 400" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="var(--primary)" stopOpacity="0.0" />
          <stop offset="50%"  stopColor="var(--primary)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d="M 80 320 Q 400 40 720 320" stroke="url(#arc)" strokeWidth="1.5" fill="none" strokeDasharray="3 6" />
      <circle cx="80"  cy="320" r="4" fill="var(--primary)" />
      <circle cx="720" cy="320" r="4" fill="var(--primary)" opacity="0.5" />
    </svg>
  );
}

function addMin(iso: string, m: number) {
  return new Date(new Date(iso).getTime() + m * 60_000).toISOString();
}

function defaultStepLabel(key: string) {
  const map: Record<string, string> = {
    scheduled: "Scheduled", boarding: "Boarding", departed: "Departed", arrived: "Arrived",
    checkIn: "Check-in", departure: "Departure", takeoff: "Take-off", landing: "Landing", arrival: "Arrival",
  };
  return map[key] ?? key;
}

/* ───────── Passenger-friendly SHAP explanation mapper ───────── */
function shapToPassengerExplanation(label: string, value: number): string | null {
  if (Math.abs(value) < 0.5) return null;
  const inc = value > 0;
  const l = label.toLowerCase();

  const POSITIVE_INCREASE: [string, string][] = [
    ['route historical delay', 'Historical performance of this route increases delay risk.'],
    ['airline historical delay', 'Historical performance of this airline may affect punctuality.'],
    ['hour historical delay', 'Current departure time has a history of delays.'],
    ['time of day', 'Departure time may contribute to delays.'],
    ['peak hour', 'Peak-hour departure may cause delays.'],
    ['weekend', 'Weekend schedules may affect this flight.'],
    ['distance', 'Flight distance and duration affect scheduling.'],
    ['duration', 'Flight duration may impact on-time performance.'],
    ['weather', 'Weather conditions may affect this flight.'],
    ['congestion', 'Airport traffic levels may contribute to delays.'],
    ['traffic volume', 'Route congestion may affect this flight.'],
    ['airport departure load', 'Airport departure traffic may cause delays.'],
    ['airline', 'Airline operational factors may affect this flight.'],
    ['origin airport', 'Departure airport conditions may impact this flight.'],
    ['destination airport', 'Arrival airport conditions may impact this flight.'],
    ['dep_airport', 'Departure airport conditions may impact this flight.'],
    ['arr_airport', 'Arrival airport conditions may impact this flight.'],
    ['month', 'Seasonal factors may affect this flight.'],
    ['day of week', 'Day of week patterns may influence delays.'],
  ];

  if (!inc) {
    const REDUCING: [string, string][] = [
      ['route historical delay', 'Route history suggests lower delay risk.'],
      ['airline historical delay', 'Airline has good on-time performance.'],
      ['hour historical delay', 'This time of day typically has fewer delays.'],
      ['time of day', 'Departure time is favorable for on-time departure.'],
      ['airline', 'Airline has strong operational performance.'],
      ['weather', 'Weather conditions are favorable for this flight.'],
      ['distance', 'Flight distance is favorable for on-time performance.'],
      ['duration', 'Flight duration is manageable for scheduling.'],
    ];
    for (const [key, msg] of REDUCING) {
      if (l.includes(key)) return msg;
    }
    return `Slightly reduces delay risk.`;
  }

  for (const [key, msg] of POSITIVE_INCREASE) {
    if (l.includes(key)) return msg;
  }
  return null;
}

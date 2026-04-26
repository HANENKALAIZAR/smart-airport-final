import { motion } from "framer-motion";
import { Plane, ArrowRight, Clock, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { type Flight } from "@/data/mockFlights";
import { FlightArcMap } from "./FlightArcMap";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { useCountdown, formatTime, formatDate } from "@/lib/time";

export function NextFlightHero({ flight }: { flight: Flight }) {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const { days, hours, minutes, seconds } = useCountdown(flight.departureTime);
  const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "ar" ? "ar" : "en-US";

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-lg"
    >
      {/* Map fills the card */}
      <div className="absolute inset-0">
        <FlightArcMap from={flight.from} to={flight.to} progress={0.18} className="h-full w-full opacity-90" />
      </div>

      {/* Top gradient overlay for legibility */}
      <div className="relative bg-gradient-to-b from-background/95 via-background/40 to-background/90 p-6 md:p-8 min-h-[460px] flex flex-col">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {t("dashboard.nextFlight")}
            </div>
            <h1 className="mt-2 font-display text-4xl md:text-5xl text-foreground">
              {flight.from.city} <span className="text-muted-foreground/50">→</span> {flight.to.city}
            </h1>
            <div className="mt-2 text-sm text-muted-foreground tabular">
              {flight.airline} · <span className="font-mono">{flight.flightNumber}</span> · {flight.aircraft}
            </div>
          </div>
          <StatusBadge status={flight.status} className="shrink-0" />
        </div>

        <div className="mt-auto pt-10 grid md:grid-cols-3 gap-6 items-end">
          {/* Departure */}
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("common.departure")}
            </div>
            <div className="font-display text-3xl tabular">{formatTime(flight.departureTime, locale)}</div>
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{flight.from.code}</span> · {formatDate(flight.departureTime, locale)}
            </div>
            {flight.gate && (
              <div className="mt-2 inline-flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-md bg-primary/10 text-primary font-mono">
                  {t("common.gate")} {flight.gate}
                </span>
                <span className="text-muted-foreground">{t("common.terminal")} {flight.terminal}</span>
              </div>
            )}
          </div>

          {/* Countdown */}
          <div className="md:text-center">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
              {flight.status === "boarding" ? t("dashboard.boardingIn") : t("dashboard.countdown")}
            </div>
            <div className="flex md:justify-center gap-3 font-mono tabular">
              {days > 0 && (
                <CountUnit value={days} label="d" />
              )}
              <CountUnit value={hours} label="h" />
              <CountUnit value={minutes} label="m" />
              <CountUnit value={seconds} label="s" muted />
            </div>
          </div>

          {/* Arrival */}
          <div className="space-y-1 md:text-end">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("common.arrival")}
            </div>
            <div className="font-display text-3xl tabular">{formatTime(flight.arrivalTime, locale)}</div>
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{flight.to.code}</span> · {formatDate(flight.arrivalTime, locale)}
            </div>
            <div className="mt-3">
              <Button
                onClick={() => nav(`/flights/${flight.id}`)}
                className="rounded-full bg-foreground text-background hover:bg-foreground/90 gap-2"
              >
                {t("flightDetail.track")} <ArrowRight className="h-4 w-4 rtl-flip" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function CountUnit({ value, label, muted }: { value: number; label: string; muted?: boolean }) {
  return (
    <div className={`flex items-baseline gap-1 ${muted ? "opacity-60" : ""}`}>
      <span className="text-3xl md:text-4xl font-display leading-none">{String(value).padStart(2, "0")}</span>
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { type Flight } from "@/data/mockFlights";
import { StatusBadge } from "./StatusBadge";
import { formatTime, formatDate } from "@/lib/time";
import { ArrowRight, Plane } from "lucide-react";
import { motion } from "framer-motion";

export function FlightCard({ flight, index = 0 }: { flight: Flight; index?: number }) {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const locale = i18n.language === "fr" ? "fr-FR" : i18n.language === "ar" ? "ar" : "en-US";

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => nav(`/flights/${flight.id}`)}
      className="group w-full text-start surface-card rounded-xl p-5 hover:shadow-lg hover:border-primary/40 transition-all"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono font-semibold tracking-wider">{flight.flightNumber}</span>
          <span className="text-muted-foreground">· {flight.airline}</span>
        </div>
        <StatusBadge status={flight.status} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <div className="font-display text-2xl tabular">{formatTime(flight.departureTime, locale)}</div>
          <div className="text-xs font-mono text-muted-foreground mt-0.5">{flight.from.code}</div>
          <div className="text-xs text-muted-foreground truncate">{flight.from.city}</div>
        </div>

        <div className="flex flex-col items-center text-muted-foreground/60 px-2">
          <Plane className="h-4 w-4 rtl-flip rotate-[-35deg] text-primary/80 group-hover:translate-x-1 group-hover:rtl:-translate-x-1 transition-transform" />
          <div className="mt-1 text-[10px] uppercase tracking-wider tabular">
            {Math.floor(flight.durationMin / 60)}h {flight.durationMin % 60}m
          </div>
        </div>

        <div className="text-end">
          <div className="font-display text-2xl tabular">{formatTime(flight.arrivalTime, locale)}</div>
          <div className="text-xs font-mono text-muted-foreground mt-0.5">{flight.to.code}</div>
          <div className="text-xs text-muted-foreground truncate">{flight.to.city}</div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatDate(flight.departureTime, locale)}</span>
        <span className="inline-flex items-center gap-1 text-foreground/70 group-hover:text-primary transition-colors">
          {t("common.viewDetails")} <ArrowRight className="h-3 w-3 rtl-flip" />
        </span>
      </div>
    </motion.button>
  );
}

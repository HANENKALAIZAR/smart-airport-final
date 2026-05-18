import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Plane, Clock, MapPin, Sparkles, Info } from "lucide-react";
import { motion } from "framer-motion";
import { getFlights, type Flight } from "@/services/api";

type NotifKind = "boarding" | "delay" | "gate" | "service" | "info";

interface AppNotification {
  id: string;
  kind: NotifKind;
  title: string;
  message: string;
  flight?: string;
  unread: boolean;
  minutesAgo: number;
}

const filters = [
  { key: "all",      label: "all" },
  { key: "boarding", label: "boarding" },
  { key: "delay",    label: "delays" },
  { key: "service",  label: "services" },
];

const iconFor = (k: NotifKind) =>
  k === "boarding" ? Plane : k === "delay" ? Clock : k === "gate" ? MapPin : k === "service" ? Sparkles : Info;

const toneFor = (k: NotifKind) =>
  k === "boarding" ? "bg-primary/10 text-primary"
  : k === "delay"   ? "bg-destructive/10 text-destructive"
  : k === "gate"    ? "bg-info/10 text-info"
  : k === "service" ? "bg-success/10 text-success"
  : "bg-muted text-muted-foreground";

// Build notifications from REAL flight statuses only — no static fake items
function buildNotifications(flights: Flight[]): AppNotification[] {
  const notifs: AppNotification[] = [];
  const now = Date.now();

  flights.forEach((f) => {
    if (f.status === "boarding") {
      const depMs = new Date(f.departureTime).getTime();
      const minutesAgo = Math.max(0, Math.round((now - (depMs - 40 * 60 * 1000)) / 60000));
      notifs.push({
        id: `board-${f.id}`, kind: "boarding",
        title: `Boarding open — ${f.flightNumber}`,
        message: `${f.from.city} → ${f.to.city} · Gate ${f.gate ?? "—"}`,
        flight: f.flightNumber, unread: minutesAgo < 15, minutesAgo,
      });
    }
    if (f.status === "delayed" && f.delayMin != null && f.delayMin > 0) {
      const minutesAgo = 0; // delay was just detected (real-time)
      notifs.push({
        id: `delay-${f.id}`, kind: "delay",
        title: `Delay reported — ${f.flightNumber}`,
        message: `${f.from.city} → ${f.to.city} delayed by ${f.delayMin} min.`,
        flight: f.flightNumber, unread: true, minutesAgo,
      });
    }
  });

  return notifs.sort((a, b) => a.minutesAgo - b.minutesAgo);
}

const Notifications = () => {
  const { t } = useTranslation();
  const [active, setActive]     = useState("all");
  const [notifs, setNotifs]     = useState<AppNotification[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    getFlights({ limit: 50 }).then(data => {
      setNotifs(buildNotifications(data));
      setLoading(false);
    });
  }, []);

  const list = active === "all" ? notifs : notifs.filter(n => n.kind === active);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{t("nav.notifications")}</div>
          <h1 className="font-display text-3xl md:text-4xl mt-1">{t("notifications.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("notifications.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {notifs.some(n => n.unread) && (
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          )}
          <button className="text-xs uppercase tracking-wider text-muted-foreground hover:text-primary">
            {t("notifications.markAllRead")}
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(f => (
          <button key={f.key} onClick={() => setActive(f.key)}
            className={`shrink-0 px-4 h-9 rounded-full border text-sm transition-all ${
              active === f.key
                ? "bg-foreground text-background border-foreground"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}>
            {t(`notifications.${f.label}`)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface-card rounded-xl p-4 h-16 animate-pulse bg-secondary/40" />
          ))
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucune notification pour ce filtre.</p>
          </div>
        ) : (
          list.map((n, i) => <NotifRow key={n.id} n={n} i={i} />)
        )}
      </div>
    </div>
  );
};

function NotifRow({ n, i }: { n: AppNotification; i: number }) {
  const { t } = useTranslation();
  const Icon = iconFor(n.kind);
  const tone = toneFor(n.kind);
  const ago  = n.minutesAgo < 60
    ? t("notifications.minutesAgo", { n: n.minutesAgo })
    : t("notifications.hoursAgo",   { n: Math.round(n.minutesAgo / 60) });

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.04, duration: 0.4 }}
      className={`surface-card rounded-xl p-4 flex items-start gap-4 ${n.unread ? "border-primary/30" : ""}`}
    >
      <div className={`grid place-items-center h-10 w-10 rounded-xl shrink-0 ${tone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{n.title}</span>
          {n.flight && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
              {n.flight}
            </span>
          )}
          {n.unread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
      </div>
      <div className="text-[11px] text-muted-foreground tabular shrink-0 whitespace-nowrap">{ago}</div>
    </motion.div>
  );
}

export default Notifications;

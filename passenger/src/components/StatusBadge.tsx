import { cn } from "@/lib/utils";
import type { FlightStatus } from "@/services/api";
import { useTranslation } from "react-i18next";

const map: Record<FlightStatus, { label: string; cls: string; dot?: boolean }> = {
  scheduled: { label: "scheduled", cls: "bg-secondary text-secondary-foreground border-border" },
  on_time:   { label: "on_time",   cls: "bg-success/15 text-success border-success/30" },
  boarding:  { label: "boarding",  cls: "bg-primary/15 text-primary border-primary/30", dot: true },
  taxiing:   { label: "taxiing",   cls: "bg-warning/15 text-warning border-warning/30", dot: true },
  in_air:    { label: "in_air",    cls: "bg-info/15 text-info border-info/30", dot: true },
  landed:    { label: "landed",    cls: "bg-success/15 text-success border-success/30" },
  delayed:   { label: "delayed",   cls: "bg-destructive/15 text-destructive border-destructive/30", dot: true },
  cancelled: { label: "cancelled", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function StatusBadge({ status, className }: { status: FlightStatus; className?: string }) {
  const { t } = useTranslation();
  const m = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider border",
        m.cls,
        className
      )}
    >
      {m.dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 animate-ping" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {t(`common.${m.label}`)}
    </span>
  );
}

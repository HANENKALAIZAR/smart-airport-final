import { motion } from "framer-motion";
import { CloudRain, Wind, CloudSnow, Sun, CloudFog } from "lucide-react";

const ROWS = [
  { label: "Clear", icon: Sun, impact: 8, color: "hsl(var(--success))" },
  { label: "Cloudy", icon: CloudFog, impact: 14, color: "hsl(var(--info))" },
  { label: "Rain", icon: CloudRain, impact: 38, color: "hsl(var(--warning))" },
  { label: "Wind", icon: Wind, impact: 52, color: "hsl(var(--warning))" },
  { label: "Snow / Ice", icon: CloudSnow, impact: 78, color: "hsl(var(--danger))" },
];

export function WeatherImpact() {
  return (
    <div>
      <div className="mb-5">
        <h3 className="font-display text-base font-semibold">Weather Impact</h3>
        <p className="text-xs text-muted-foreground">% of delays attributed to each condition</p>
      </div>
      <div className="space-y-3">
        {ROWS.map((row, i) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-surface-3/60" style={{ color: row.color }}>
                <Icon size={15} />
              </div>
              <div className="flex flex-1 items-center gap-3">
                <span className="w-20 text-xs font-medium text-foreground">{row.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${row.impact}%` }}
                    transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: row.color }}
                  />
                </div>
                <span className="w-10 text-right font-mono-num text-xs font-semibold text-muted-foreground">{row.impact}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { motion } from "framer-motion";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = ["06", "08", "10", "12", "14", "16", "18", "20", "22"];

// deterministic pseudo-random
function v(d: number, h: number) {
  const seed = (d * 13 + h * 7) % 100;
  return Math.round((Math.sin(seed) * 0.5 + 0.5) * 100);
}

function tone(value: number) {
  if (value < 25) return "hsl(var(--success) / 0.25)";
  if (value < 50) return "hsl(var(--success) / 0.55)";
  if (value < 70) return "hsl(var(--warning) / 0.6)";
  if (value < 85) return "hsl(var(--warning) / 0.85)";
  return "hsl(var(--danger) / 0.9)";
}

export function DelayHeatmap() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">Delay Density Heatmap</h3>
          <p className="text-xs text-muted-foreground">Average delay intensity by weekday and hour window</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Low</span>
          <div className="h-2 w-32 rounded-full" style={{ background: "linear-gradient(90deg, hsl(var(--success)), hsl(var(--warning)), hsl(var(--danger)))" }} />
          <span>High</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-1" style={{ gridTemplateColumns: `60px repeat(${HOURS.length}, minmax(40px, 1fr))` }}>
          <div />
          {HOURS.map((h) => (
            <div key={h} className="text-center font-mono-num text-[10px] font-semibold text-muted-foreground">
              {h}
            </div>
          ))}
          {DAYS.map((d, di) => (
            <>
              <div key={d} className="flex items-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {d}
              </div>
              {HOURS.map((_, hi) => {
                const val = v(di, hi);
                return (
                  <motion.div
                    key={`${di}-${hi}`}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: (di + hi) * 0.015 }}
                    title={`${d} ${HOURS[hi]}:00 — ${val}`}
                    className="aspect-square rounded-md border border-border/40"
                    style={{ background: tone(val) }}
                  />
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

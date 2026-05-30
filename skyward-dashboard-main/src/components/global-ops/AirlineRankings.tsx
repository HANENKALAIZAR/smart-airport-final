import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

type Row = {
  rank: number;
  airline: string;
  code: string;
  otp: number;
  flights: number;
  delta: number;
};

const ROWS: Row[] = [
  { rank: 1, airline: "Tunisair", code: "TU", otp: 92.4, flights: 184, delta: 1.8 },
  { rank: 2, airline: "Nouvelair", code: "BJ", otp: 89.1, flights: 96, delta: 0.6 },
  { rank: 3, airline: "Lufthansa", code: "LH", otp: 87.5, flights: 42, delta: -0.4 },
  { rank: 4, airline: "Air France", code: "AF", otp: 84.0, flights: 58, delta: 1.2 },
  { rank: 5, airline: "Turkish Airlines", code: "TK", otp: 81.7, flights: 34, delta: -1.6 },
  { rank: 6, airline: "Emirates", code: "EK", otp: 79.3, flights: 20, delta: 0.2 },
];

export function AirlineRankings() {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">Airline Performance Rankings</h3>
          <p className="text-xs text-muted-foreground">Top operators by on-time performance</p>
        </div>
        <span className="rounded-full border border-border bg-surface-3/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Last 7 days
        </span>
      </div>
      <div className="space-y-2">
        {ROWS.map((r, i) => (
          <motion.div
            key={r.code}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-2/50 p-3 transition hover:bg-surface-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3 font-mono-num text-xs font-bold text-primary">
              {r.rank}
            </div>
            <div className="flex flex-1 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-surface-3/60 font-mono-num text-[11px] font-bold text-foreground">
                {r.code}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{r.airline}</div>
                <div className="text-[11px] text-muted-foreground font-mono-num">{r.flights} flights</div>
              </div>
            </div>
            <div className="hidden w-40 sm:block">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${r.otp}%` }}
                  transition={{ duration: 0.9, delay: 0.1 + i * 0.05, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-success"
                />
              </div>
            </div>
            <div className="flex w-20 flex-col items-end">
              <span className="font-mono-num text-sm font-semibold text-foreground">{r.otp}%</span>
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${r.delta >= 0 ? "text-success" : "text-danger"}`}>
                {r.delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(r.delta).toFixed(1)}%
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

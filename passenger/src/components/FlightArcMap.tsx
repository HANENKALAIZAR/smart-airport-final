import { motion } from "framer-motion";
import { Plane } from "lucide-react";
import type { Airport } from "@/data/mockFlights";
import { useEffect, useState } from "react";

interface Props {
  from: Airport;
  to: Airport;
  progress: number; // 0..1
  className?: string;
}

/** SVG world-map flight arc with animated plane along the path. */
export function FlightArcMap({ from, to, progress, className }: Props) {
  const W = 800;
  const H = 380;

  const x1 = from.x * W;
  const y1 = from.y * H;
  const x2 = to.x * W;
  const y2 = to.y * H;

  // Curve control point above the midpoint
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const lift = Math.min(140, len * 0.35);
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * lift;
  const cy = my + ny * lift - 30;

  const pathD = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

  // Compute plane position along quadratic Bezier
  const t = Math.max(0, Math.min(1, progress));
  const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
  const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
  // tangent for rotation
  const tdx = 2 * (1 - t) * (cx - x1) + 2 * t * (x2 - cx);
  const tdy = 2 * (1 - t) * (cy - y1) + 2 * t * (y2 - cy);
  const angle = (Math.atan2(tdy, tdx) * 180) / Math.PI;

  // Subtle parallax stars
  const [stars] = useState(() =>
    Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.3,
      o: Math.random() * 0.6 + 0.2,
    }))
  );

  // Re-trigger trail animation when route changes
  const [key, setKey] = useState(0);
  useEffect(() => setKey((k) => k + 1), [from.code, to.code]);

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="globe" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.18)" />
            <stop offset="55%" stopColor="hsl(var(--info) / 0.06)" />
            <stop offset="100%" stopColor="hsl(var(--background) / 0)" />
          </radialGradient>
          <linearGradient id="arc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
          </linearGradient>
          <filter id="planeGlow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Backdrop globe glow */}
        <rect width={W} height={H} fill="url(#globe)" />

        {/* Latitude / longitude grid */}
        <g stroke="hsl(var(--border))" strokeOpacity="0.35" strokeWidth="0.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`h${i}`} x1="0" x2={W} y1={(H / 8) * (i + 1)} y2={(H / 8) * (i + 1)} />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={`v${i}`} y1="0" y2={H} x1={(W / 12) * (i + 1)} x2={(W / 12) * (i + 1)} />
          ))}
        </g>

        {/* Stars */}
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="hsl(var(--foreground))" opacity={s.o * 0.4} />
        ))}

        {/* Stylized continents (very abstract blobs) */}
        <g fill="hsl(var(--foreground) / 0.06)">
          <ellipse cx={170} cy={150} rx={90} ry={50} />
          <ellipse cx={170} cy={250} rx={70} ry={70} />
          <ellipse cx={420} cy={130} rx={120} ry={55} />
          <ellipse cx={460} cy={210} rx={90} ry={60} />
          <ellipse cx={650} cy={160} rx={130} ry={70} />
          <ellipse cx={620} cy={270} rx={70} ry={45} />
        </g>

        {/* Background dashed arc for full path */}
        <path
          d={pathD}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeOpacity="0.2"
          strokeWidth="1"
          strokeDasharray="3 5"
        />

        {/* Animated drawn arc */}
        <motion.path
          key={`arc-${key}`}
          d={pathD}
          fill="none"
          stroke="url(#arc)"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Origin */}
        <g>
          <circle cx={x1} cy={y1} r="14" fill="hsl(var(--primary) / 0.12)" />
          <circle cx={x1} cy={y1} r="5" fill="hsl(var(--primary))" />
          <text
            x={x1}
            y={y1 - 18}
            fontSize="11"
            fontWeight="600"
            fill="hsl(var(--foreground))"
            textAnchor="middle"
            className="font-mono"
          >
            {from.code}
          </text>
        </g>

        {/* Destination */}
        <g>
          <circle cx={x2} cy={y2} r="14" fill="hsl(var(--primary) / 0.08)" />
          <circle
            cx={x2}
            cy={y2}
            r="5"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
          <text
            x={x2}
            y={y2 - 18}
            fontSize="11"
            fontWeight="600"
            fill="hsl(var(--foreground))"
            textAnchor="middle"
            className="font-mono"
          >
            {to.code}
          </text>
        </g>

        {/* Plane */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.5 }}
          transform={`translate(${px} ${py}) rotate(${angle})`}
          filter="url(#planeGlow)"
        >
          <circle r="14" fill="hsl(var(--primary) / 0.18)" />
          <path
            d="M -10 0 L 10 0 M 6 -4 L 12 0 L 6 4 M -4 -3 L 0 0 L -4 3"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </motion.g>
      </svg>
    </div>
  );
}

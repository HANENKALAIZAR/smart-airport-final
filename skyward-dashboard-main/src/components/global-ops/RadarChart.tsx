import { motion } from "framer-motion";

export type RadarMetric = { label: string; value: number };

type Props = {
  metrics: RadarMetric[];
  size?: number;
};

export function RadarChart({ metrics, size = 260 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 32;
  const n = metrics.length;

  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointFor = (i: number, value: number) => {
    const r = (radius * value) / 100;
    const a = angleFor(i);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const labelFor = (i: number) => {
    const r = radius + 18;
    const a = angleFor(i);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  const polygon = metrics
    .map((m, i) => {
      const { x, y } = pointFor(i, m.value);
      return `${x},${y}`;
    })
    .join(" ");

  const rings = [25, 50, 75, 100];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((r) => (
        <polygon
          key={r}
          points={metrics
            .map((_, i) => {
              const { x, y } = pointFor(i, r);
              return `${x},${y}`;
            })
            .join(" ")}
          fill="none"
          stroke="hsl(var(--border))"
          strokeOpacity={0.5}
        />
      ))}
      {metrics.map((_, i) => {
        const { x, y } = pointFor(i, 100);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="hsl(var(--border))"
            strokeOpacity={0.4}
          />
        );
      })}
      <motion.polygon
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
        points={polygon}
        fill="hsl(var(--accent-amber) / 0.18)"
        stroke="hsl(var(--accent-amber))"
        strokeWidth={2}
      />
      {metrics.map((m, i) => {
        const { x, y } = pointFor(i, m.value);
        return (
          <circle key={i} cx={x} cy={y} r={3.5} fill="hsl(var(--accent-amber))" />
        );
      })}
      {metrics.map((m, i) => {
        const { x, y } = labelFor(i);
        return (
          <text
            key={i}
            x={x}
            y={y}
            fontSize={10}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="hsl(var(--muted-foreground))"
            style={{ fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}
          >
            {m.label}
          </text>
        );
      })}
    </svg>
  );
}

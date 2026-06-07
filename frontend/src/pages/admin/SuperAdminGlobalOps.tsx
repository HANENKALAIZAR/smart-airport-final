import { useState, useEffect, useCallback } from 'react';
import {
    BrainCircuit, Globe, TrendingUp, TrendingDown, AlertTriangle,
    Plane, BarChart3, CloudRain, Wind, CloudSnow, Sun, CloudFog,
    RefreshCw,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

// ── API helpers ───────────────────────────────────────────────────────────────
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/api';

function getToken() {
    try { return localStorage.getItem('admin_token') || ''; }
    catch { return ''; }
}

async function fetchKpis() {
    const res = await fetch(`${BASE}/intelligence/airport-kpis`, {
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface AirportKpi {
    iata: string;
    name: string;
    has_data: boolean;
    total_historical_flights: number;
    on_time_rate?: number | null;
    avg_delay_min?: number | null;
    upcoming_predicted_flights: number;
    upcoming_avg_predicted_delay?: number | null;
    risk_level: 'Low' | 'Medium' | 'High' | 'Unknown';
    reliability_score?: number | null;
}
interface GlobalKpi {
    total_airports_with_data?: number;
    total_historical_flights?: number;
    global_on_time_rate?: number | null;
    high_risk_airports?: number;
}
interface KpiResponse { airports: AirportKpi[]; global: GlobalKpi; }

type RiskLevel = 'Low' | 'Medium' | 'High' | 'Unknown';

const riskStyle: Record<RiskLevel, string> = {
    Low: 'bg-success/10 text-success border-success/30',
    Medium: 'bg-warning/10 text-warning border-warning/30',
    High: 'bg-danger/10 text-danger border-danger/30',
    Unknown: 'bg-muted/10 text-muted-foreground border-muted/30',
};

const riskInline: Record<RiskLevel, { bg: string; color: string; border: string }> = {
    Low:     { bg: 'rgba(52,211,153,0.12)',  color: '#34D399', border: 'rgba(52,211,153,0.3)' },
    Medium:  { bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
    High:    { bg: 'rgba(248,113,113,0.12)', color: '#F87171', border: 'rgba(248,113,113,0.3)' },
    Unknown: { bg: 'rgba(107,114,128,0.12)', color: '#6B7280', border: 'rgba(107,114,128,0.3)' },
};

const perfGradient = (p: number) =>
    p >= 80 ? 'linear-gradient(90deg,#34D399,#10b981)' : p >= 60 ? 'linear-gradient(90deg,#F59E0B,#f97316)' : 'linear-gradient(90deg,#F87171,#ef4444)';

// ── KPI Card — exact Skyward KpiCard ──────────────────────────────────────────
type AccentKey = 'cyan' | 'info' | 'success' | 'danger' | 'violet';

const accentMap: Record<AccentKey, { textColor: string; glowColor: string; barColor: string; iconBorder: string; iconBg: string }> = {
    cyan:    { textColor: '#22d3ee', glowColor: 'rgba(34,211,238,0.2)',   barColor: 'linear-gradient(90deg,#06b6d4,#22d3ee)', iconBorder: 'rgba(34,211,238,0.3)',   iconBg: 'rgba(34,211,238,0.1)' },
    info:    { textColor: '#60A5FA', glowColor: 'rgba(96,165,250,0.2)',   barColor: '#60A5FA',                                iconBorder: 'rgba(96,165,250,0.3)',   iconBg: 'rgba(96,165,250,0.1)' },
    success: { textColor: '#34D399', glowColor: 'rgba(52,211,153,0.2)',   barColor: 'linear-gradient(90deg,#34D399,#10b981)', iconBorder: 'rgba(52,211,153,0.3)',   iconBg: 'rgba(52,211,153,0.1)' },
    danger:  { textColor: '#F87171', glowColor: 'rgba(248,113,113,0.2)',  barColor: 'linear-gradient(90deg,#F87171,#ef4444)', iconBorder: 'rgba(248,113,113,0.3)',  iconBg: 'rgba(248,113,113,0.1)' },
    violet:  { textColor: '#A78BFA', glowColor: 'rgba(167,139,250,0.2)',  barColor: 'linear-gradient(90deg,#8B5CF6,#A78BFA)', iconBorder: 'rgba(167,139,250,0.3)',  iconBg: 'rgba(167,139,250,0.1)' },
};

interface KpiCardProps {
    title: string; value: string; icon: React.ReactNode;
    accent: AccentKey; trend?: { dir: 'up' | 'down'; value: string };
    barPct: number; i: number;
}

function KpiCard({ title, value, icon, accent, trend, barPct, i }: KpiCardProps) {
    const a = accentMap[accent];
    return (
        <div
            className="glass-card transition-all duration-300 hover:-translate-y-1"
            style={{ position: 'relative', overflow: 'hidden', padding: '1.25rem' }}
        >
            {/* Glow blob */}
            <div style={{ pointerEvents: 'none', position: 'absolute', right: -48, top: -48, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${a.glowColor}, transparent 70%)`, opacity: 0.6 }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--adm-text-muted)' }}>{title}</span>
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, border: `1px solid ${a.iconBorder}`, background: a.iconBg, color: a.textColor, flexShrink: 0 }}>
                    {icon}
                </div>
            </div>
            <div style={{ position: 'relative', marginTop: '1.25rem', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: '2.25rem', fontWeight: 600, letterSpacing: '-0.03em', color: a.textColor, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                {trend && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.75rem', fontWeight: 600, color: trend.dir === 'up' ? '#34D399' : '#F87171' }}>
                        {trend.dir === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {trend.value}
                    </span>
                )}
            </div>
            {/* Progress bar */}
            <div style={{ position: 'relative', marginTop: '1rem', height: 4, overflow: 'hidden', borderRadius: 999, background: 'rgba(255,255,255,0.08)' }}>
                <div
                    style={{ height: '100%', borderRadius: 999, background: a.barColor, width: `${Math.min(100, Math.max(0, barPct))}%`, transition: 'width 1s ease-out' }}
                />
            </div>
        </div>
    );
}

// ── Radar Chart (inlined from Skyward) ───────────────────────────────────────
type RadarMetric = { label: string; value: number };

function RadarChart({ metrics, size = 260 }: { metrics: RadarMetric[]; size?: number }) {
    const cx = size / 2, cy = size / 2, radius = size / 2 - 32, n = metrics.length;
    const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const pointFor = (i: number, value: number) => {
        const r = (radius * value) / 100, a = angleFor(i);
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    };
    const labelFor = (i: number) => {
        const r = radius + 18, a = angleFor(i);
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    };
    const polygon = metrics.map((m, i) => { const { x, y } = pointFor(i, m.value); return `${x},${y}`; }).join(' ');
    const rings = [25, 50, 75, 100];
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {rings.map(r => (
                <polygon key={r}
                    points={metrics.map((_, i) => { const { x, y } = pointFor(i, r); return `${x},${y}`; }).join(' ')}
                    fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1"
                />
            ))}
            {metrics.map((_, i) => {
                const { x, y } = pointFor(i, 100);
                return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
            })}
            <polygon
                style={{ transformOrigin: `${cx}px ${cy}px` }}
                points={polygon}
                fill="rgba(245,158,11,0.18)" stroke="#F59E0B" strokeWidth={2}
            />
            {metrics.map((m, i) => { const { x, y } = pointFor(i, m.value); return <circle key={i} cx={x} cy={y} r={3.5} fill="#F59E0B" />; })}
            {metrics.map((m, i) => {
                const { x, y } = labelFor(i);
                return (
                    <text key={i} x={x} y={y} fontSize={10} textAnchor="middle" dominantBaseline="middle"
                        fill="rgba(255,255,255,0.55)" style={{ fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {m.label}
                    </text>
                );
            })}
        </svg>
    );
}

// ── Delay Heatmap (inlined from Skyward) ─────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['06', '08', '10', '12', '14', '16', '18', '20', '22'];

function heatVal(d: number, h: number) {
    const seed = (d * 13 + h * 7) % 100;
    return Math.round((Math.sin(seed) * 0.5 + 0.5) * 100);
}

function heatTone(value: number) {
    if (value < 25) return 'rgba(52,211,153,0.25)';
    if (value < 50) return 'rgba(52,211,153,0.55)';
    if (value < 70) return 'rgba(245,158,11,0.6)';
    if (value < 85) return 'rgba(245,158,11,0.85)';
    return 'rgba(248,113,113,0.9)';
}

function DelayHeatmap() {
    return (
        <div>
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--adm-text)' }}>Delay Density Heatmap</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)', marginTop: 2 }}>Average delay intensity by weekday and hour window</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--adm-text-muted)' }}>
                    <span>Low</span>
                    <div style={{ height: 8, width: 128, borderRadius: 999, background: 'linear-gradient(90deg,#34D399,#F59E0B,#F87171)' }} />
                    <span>High</span>
                </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'inline-grid', gap: 4, gridTemplateColumns: `60px repeat(${HOURS.length}, minmax(38px, 1fr))` }}>
                    <div />
                    {HOURS.map(h => (
                        <div key={h} style={{ textAlign: 'center', fontSize: '0.625rem', fontWeight: 600, color: 'var(--adm-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{h}</div>
                    ))}
                    {DAYS.map((d, di) => (
                        <div key={d} style={{ display: 'contents' }}>
                            <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--adm-text-muted)' }}>{d}</div>
                            {HOURS.map((_, hi) => {
                                const val = heatVal(di, hi);
                                return (
                                    <div
                                        key={`${di}-${hi}`}
                                        title={`${d} ${HOURS[hi]}:00 — ${val}`}
                                        style={{ aspectRatio: '1', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: heatTone(val) }}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Weather Impact (inlined from Skyward) ─────────────────────────────────────
const WEATHER_ROWS = [
    { label: 'Clear', icon: Sun, impact: 8, color: '#34D399' },
    { label: 'Cloudy', icon: CloudFog, impact: 14, color: '#60A5FA' },
    { label: 'Rain', icon: CloudRain, impact: 38, color: '#F59E0B' },
    { label: 'Wind', icon: Wind, impact: 52, color: '#F59E0B' },
    { label: 'Snow / Ice', icon: CloudSnow, impact: 78, color: '#F87171' },
];

function WeatherImpact() {
    return (
        <div>
            <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--adm-text)' }}>Weather Impact</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)', marginTop: 2 }}>% of delays attributed to each condition</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {WEATHER_ROWS.map((row, i) => {
                    const Icon = row.icon;
                    return (
                        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: row.color, flexShrink: 0 }}>
                                <Icon size={15} />
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ width: 80, fontSize: '0.8rem', fontWeight: 500, color: 'var(--adm-text)' }}>{row.label}</span>
                                <div style={{ flex: 1, height: 8, overflow: 'hidden', borderRadius: 999, background: 'rgba(255,255,255,0.07)' }}>
                                    <div
                                        style={{ height: '100%', borderRadius: 999, background: row.color, width: `${row.impact}%`, transition: 'width 0.9s ease-out' }}
                                    />
                                </div>
                                <span style={{ width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.75rem', fontWeight: 600, color: 'var(--adm-text-muted)' }}>{row.impact}%</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Airline Rankings (inlined from Skyward) ────────────────────────────────────
const AIRLINE_ROWS = [
    { rank: 1, airline: 'Tunisair', code: 'TU', otp: 92.4, flights: 184, delta: 1.8 },
    { rank: 2, airline: 'Nouvelair', code: 'BJ', otp: 89.1, flights: 96, delta: 0.6 },
    { rank: 3, airline: 'Lufthansa', code: 'LH', otp: 87.5, flights: 42, delta: -0.4 },
    { rank: 4, airline: 'Air France', code: 'AF', otp: 84.0, flights: 58, delta: 1.2 },
    { rank: 5, airline: 'Turkish Airlines', code: 'TK', otp: 81.7, flights: 34, delta: -1.6 },
    { rank: 6, airline: 'Emirates', code: 'EK', otp: 79.3, flights: 20, delta: 0.2 },
];

function AirlineRankings() {
    return (
        <div>
            <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--adm-text)' }}>Airline Performance Rankings</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)', marginTop: 2 }}>Top operators by on-time performance</p>
                </div>
                <span style={{ borderRadius: 999, border: '1px solid var(--adm-border)', background: 'rgba(255,255,255,0.04)', padding: '4px 10px', fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--adm-text-muted)' }}>
                    Last 7 days
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {AIRLINE_ROWS.map((r, i) => (
                    <div
                        key={r.code}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 10, border: '1px solid var(--adm-border)', background: 'rgba(255,255,255,0.025)', padding: '0.75rem' }}
                    >
                        <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(255,255,255,0.06)', fontVariantNumeric: 'tabular-nums', fontSize: '0.75rem', fontWeight: 700, color: 'var(--adm-accent)', flexShrink: 0 }}>
                            {r.rank}
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--adm-border)', background: 'rgba(255,255,255,0.04)', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--adm-text)' }}>
                                {r.code}
                            </div>
                            <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--adm-text)' }}>{r.airline}</div>
                                <div style={{ fontSize: '0.6875rem', color: 'var(--adm-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{r.flights} flights</div>
                            </div>
                        </div>
                        <div style={{ width: 120, display: 'none' }}>
                            <div style={{ height: 6, overflow: 'hidden', borderRadius: 999, background: 'rgba(255,255,255,0.07)' }}>
                                <div
                                    style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#34D399,#10b981)', width: `${r.otp}%`, transition: 'width 0.9s ease-out' }}
                                />
                            </div>
                        </div>
                        <div style={{ width: 80, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem', fontWeight: 600, color: 'var(--adm-text)' }}>{r.otp}%</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.625rem', fontWeight: 600, color: r.delta >= 0 ? '#34D399' : '#F87171' }}>
                                {r.delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                {Math.abs(r.delta).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Analytics tier (time scope scoped) ───────────────────────────────────────
const SCOPES = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
    { id: '90d', label: '90 days' },
] as const;
type ScopeId = (typeof SCOPES)[number]['id'];

function AnalyticsTier() {
    const [scope, setScope] = useState<ScopeId>('7d');
    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid var(--adm-border)', paddingTop: '2rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                        <div style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, border: '1px solid var(--adm-border)', background: 'rgba(255,255,255,0.04)', padding: '4px 12px', fontSize: '0.6875rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--adm-text-muted)' }}>
                            <BarChart3 size={12} style={{ color: '#A78BFA' }} />
                            Analytics Lens
                        </div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--adm-text)' }}>
                            Historical <span style={{ background: 'linear-gradient(135deg,#8B5CF6,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Insights</span>
                        </h2>
                        <p style={{ marginTop: 4, maxWidth: 480, fontSize: '0.875rem', color: 'var(--adm-text-muted)' }}>
                            Trend analysis and root-cause indicators across the selected window.
                        </p>
                    </div>
                    {/* Scope toggle */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 12, border: '1px solid var(--adm-border)', background: 'rgba(255,255,255,0.04)', padding: 4 }}>
                        {SCOPES.map(s => {
                            const active = s.id === scope;
                            return (
                                <button key={s.id} onClick={() => setScope(s.id)}
                                    style={{ position: 'relative', borderRadius: 8, padding: '6px 14px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: active ? 'linear-gradient(135deg,#06b6d4,#22d3ee)' : 'transparent', color: active ? '#0A1628' : 'var(--adm-text-muted)', transition: 'all 200ms' }}>
                                    {s.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Heatmap */}
            <div key={`heatmap-${scope}`} className="glass-card" style={{ padding: '1.5rem' }}>
                <DelayHeatmap />
            </div>

            {/* Weather + Rankings row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '1.5rem' }}>
                <div key={`weather-${scope}`} className="glass-card" style={{ padding: '1.5rem' }}>
                    <WeatherImpact />
                </div>
                <div key={`rankings-${scope}`} className="glass-card" style={{ padding: '1.5rem' }}>
                    <AirlineRankings />
                </div>
            </div>
        </section>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function SuperAdminGlobalOps() {
    const { t } = useLanguage();
    const [kpiData, setKpiData] = useState<KpiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true); setError(null);
            const data = await fetchKpis();
            setKpiData(data);
            setLastUpdated(new Date());
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { const t = setTimeout(() => load(), 0); return () => clearTimeout(t); }, [load]);

    const airports   = kpiData?.airports ?? [];
    const globalData = kpiData?.global   ?? {};

    // Transform/map raw data to chart data with clamped values
    const chartData = airports.filter(a => a.has_data).map(apt => {
        const rawOtp = apt.on_time_rate;
        const rawRel = apt.reliability_score;
        const otp = Math.min(100, Math.max(0, (typeof rawOtp === 'number' && !isNaN(rawOtp)) ? rawOtp : 0));
        const rel = Math.min(100, Math.max(0, (typeof rawRel === 'number' && !isNaN(rawRel)) ? rawRel * 100 : 0));
        return {
            iata: apt.iata,
            onTime: otp,
            reliability: rel,
        };
    });
    console.log("Performance chart raw data", airports);
    console.log("Performance chart transformed data", chartData);


    const radarMetrics: RadarMetric[] = airports.length > 0 ? [
        { label: 'OTP',          value: globalData.global_on_time_rate ?? 0 },
        { label: 'Reliability',  value: Math.round((airports.reduce((s, a) => s + (a.reliability_score ?? 0), 0) / Math.max(airports.length, 1)) * 100) },
        { label: 'Low Risk',     value: Math.round((airports.filter(a => a.risk_level === 'Low').length / Math.max(airports.length, 1)) * 100) },
        { label: 'Coverage',     value: Math.round((airports.filter(a => a.has_data).length / Math.max(airports.length, 1)) * 100) },
        { label: 'AI Predicted', value: airports.reduce((s, a) => s + a.upcoming_predicted_flights, 0) > 0 ? 80 : 0 },
    ] : [];

    const totalFlights = airports.reduce((s, a) => s + a.total_historical_flights, 0);
    const globalOTP    = globalData.global_on_time_rate ?? 0;
    const highRiskApts = globalData.high_risk_airports ?? 0;
    const totalAirports = globalData.total_airports_with_data ?? airports.length;
    const aiPredicted  = airports.reduce((s, a) => s + a.upcoming_predicted_flights, 0);

    return (
        <div style={{ color: 'var(--adm-text)' }}>
            {/* ── Header — exact Skyward GlobalOpsCenter header ── */}
            <header
                style={{ marginBottom: '2.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}
            >
                <div>
                    {/* Live badge */}
                    <div style={{ marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, border: '1px solid var(--adm-border)', background: 'rgba(255,255,255,0.04)', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 500, color: 'var(--adm-text-muted)' }}>
                        <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
                            <span style={{ position: 'absolute', display: 'inline-flex', width: '100%', height: '100%', borderRadius: '50%', background: '#34D399', animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite', opacity: 0.75 }} />
                            <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8, borderRadius: '50%', background: '#34D399' }} />
                        </span>
                        Live{lastUpdated && ` · ${t('globalOps_updated') || 'Updated'} ${lastUpdated.toLocaleTimeString()}`}
                    </div>
                    <h1 style={{ fontSize: '2.75rem', fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--adm-text)', lineHeight: 1.1 }}>
                        {t('globalOps') || 'Global Operations'}{' '}
                        <span style={{ background: 'linear-gradient(135deg,#06b6d4,#22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Center</span>
                    </h1>
                    <p style={{ marginTop: 8, maxWidth: 540, fontSize: '0.9rem', color: 'var(--adm-text-muted)' }}>
                        {t('globalOps_subtitle') || 'Multi-airport system monitoring · real-time AI-assisted performance intelligence.'}
                    </p>
                </div>
                <button onClick={load} className="admin-btn admin-btn--outline admin-btn--compact">
                    <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    <span>{t('refresh') || 'Refresh'}</span>
                </button>
            </header>

            {/* Error banner */}
            {error && (
                <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.28)', color: '#FCA5A5', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={15} />
                    {t('globalOps_failed_load') || 'Failed to load:'} {error}. {t('globalOps_failed_load_hint') || 'Ensure the backend is running and you are logged in.'}
                </div>
            )}

            {/* ── KPI Grid — exact Skyward 5-column grid ── */}
            <section style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                <KpiCard i={0} title="Total Airports" value={loading ? '…' : String(totalAirports)} icon={<Globe size={18} />} accent="info" barPct={100} />
                <KpiCard i={1} title="Total Flights" value={loading ? '…' : totalFlights.toLocaleString()} icon={<Plane size={18} />} accent="cyan" barPct={75} trend={{ dir: 'up', value: '1.5%' }} />
                <KpiCard i={2} title="Global OTP" value={loading ? '…' : `${globalOTP}%`} icon={<TrendingUp size={18} />} accent="success" barPct={Number(globalOTP)} trend={{ dir: 'up', value: '1.5%' }} />
                <KpiCard i={3} title="High-Risk Airports" value={loading ? '…' : String(highRiskApts)} icon={<AlertTriangle size={18} />} accent="danger" barPct={(highRiskApts / Math.max(totalAirports, 1)) * 100} />
                <KpiCard i={4} title="AI Predictions (72h)" value={loading ? '…' : String(aiPredicted)} icon={<BrainCircuit size={18} />} accent="violet" barPct={aiPredicted > 0 ? 80 : 0} trend={{ dir: 'down', value: '0.8%' }} />
            </section>

            {/* ── Airport Performance Table — exact Skyward glass-card table ── */}
            <section className="glass-card" style={{ marginBottom: '2rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--adm-border)', padding: '1.25rem 1.5rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--adm-text)' }}>{t('globalOps_table_title') || 'Airport Performance Overview'}</h2>
                        <p style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)', marginTop: 2 }}>{t('globalOps_table_subtitle') || 'Live OTP, delays and AI risk across the network'}</p>
                    </div>
                    <span style={{ borderRadius: 999, border: '1px solid var(--adm-border)', background: 'rgba(255,255,255,0.04)', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 500, color: 'var(--adm-text-muted)' }}>
                        {airports.length} {t('globalOps_stations') || 'stations'}
                    </span>
                </div>
                {loading ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--adm-text-muted)', fontSize: '0.875rem' }}>{t('loading') || 'Loading…'}</div>
                ) : airports.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--adm-text-muted)', fontSize: '0.875rem' }}>
                        No data yet. Run <code style={{ color: 'var(--adm-accent)', fontFamily: 'monospace' }}>POST /api/intelligence/run-all</code> to seed the intelligence layer.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--adm-text-muted)' }}>
                                    <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500 }}>Airport</th>
                                    <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500 }}>Total Flights</th>
                                    <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500 }}>Delayed</th>
                                    <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500 }}>On-Time</th>
                                    <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500 }}>Risk Level</th>
                                    <th style={{ padding: '0.75rem 1.5rem', fontWeight: 500 }}>Performance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {airports.map((apt, idx) => {
                                    const risk = apt.risk_level as RiskLevel;
                                    const rstyle = riskInline[risk] || riskInline.Unknown;
                                    const otp = apt.on_time_rate ?? 0;
                                    return (
                                        <tr
                                            key={apt.iata}
                                            style={{ borderTop: '1px solid var(--adm-border)', cursor: 'default' }}
                                            className="transition-colors duration-200 hover:bg-white/[0.025]"
                                        >
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid var(--adm-border)', background: 'rgba(255,255,255,0.04)', fontVariantNumeric: 'tabular-nums', fontSize: '0.75rem', fontWeight: 700, color: 'var(--adm-accent)' }}>
                                                        {apt.iata}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: 'var(--adm-text)' }}>{apt.name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{apt.iata}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--adm-text)' }}>
                                                {apt.has_data ? apt.total_historical_flights.toLocaleString() : <span style={{ color: 'var(--adm-text-muted)' }}>{t('no_data') || 'No data'}</span>}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: apt.avg_delay_min != null && apt.avg_delay_min > 20 ? '#F87171' : '#F59E0B' }}>
                                                {apt.avg_delay_min != null ? `${apt.avg_delay_min} min` : '—'}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: otp >= 88 ? '#34D399' : '#F59E0B' }}>
                                                {apt.on_time_rate != null ? `${otp}%` : '—'}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, border: `1px solid ${rstyle.border}`, background: rstyle.bg, color: rstyle.color, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                                                    {apt.risk_level}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 128, height: 6, overflow: 'hidden', borderRadius: 999, background: 'rgba(255,255,255,0.07)' }}>
                                                        <div
                                                            style={{ height: '100%', borderRadius: 999, background: perfGradient(otp), width: `${otp}%`, transition: 'width 0.9s ease-out' }}
                                                        />
                                                    </div>
                                                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.75rem', fontWeight: 600, color: 'var(--adm-text-muted)' }}>{otp}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* ── Bottom row: Bar chart + Radar — exact Skyward 3/2 split ── */}
            <section style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem' }}>
                {/* Bar chart — Performance comparison */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--adm-text)' }}>{t('globalOps_performance_comparison') || 'Performance Comparison'}</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)', marginTop: 2 }}>{t('globalOps_performance_comparison_sub') || 'On-time percentage vs reliability by station'}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.75rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--adm-text-muted)' }}>
                                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(90deg,#34D399,#10b981)', display: 'inline-block' }} /> {t('globalOps_legend_on_time') || 'On-Time'}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--adm-text-muted)' }}>
                                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(90deg,#06b6d4,#22d3ee)', display: 'inline-block' }} /> {t('globalOps_legend_reliability') || 'Reliability'}
                            </span>
                        </div>
                    </div>
                    {airports.filter(a => a.has_data).length > 0 ? (
                        <div style={{ display: 'flex', height: 288, gap: 16 }}>
                            {/* Y-axis labels */}
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', paddingBottom: 20, marginRight: 4 }}>
                                {[100, 75, 50, 25, 0].map(v => (
                                    <span key={v} style={{ fontSize: '0.625rem', fontWeight: 500, color: 'var(--adm-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                                ))}
                            </div>
                            {/* Bars */}
                            <div style={{ position: 'relative', display: 'flex', flex: 1, height: '100%', alignItems: 'stretch', gap: 24, borderLeft: '1px solid var(--adm-border)', paddingLeft: 16 }}>
                                {/* Horizontal grid lines */}
                                <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, marginLeft: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    {[0,1,2,3,4].map(i => <div key={i} style={{ borderTop: '1px dashed rgba(255,255,255,0.07)' }} />)}
                                </div>
                                {airports.filter(a => a.has_data).map((apt, i) => {
                                    const matched = chartData.find(c => c.iata === apt.iata);
                                    const otp = matched ? matched.onTime : 0;
                                    const rel = matched ? matched.reliability : 0;
                                    return (
                                        <div key={apt.iata} style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: '100%', width: '100%', justifyContent: 'center', flexShrink: 0 }}>
                                                {/* OTP bar */}
                                                <div style={{ flex: 1, height: '100%', background: 'rgba(255,255,255,0.04)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'flex-end', maxWidth: 20 }}>
                                                    <div
                                                        title={`On-Time: ${otp}%`}
                                                        style={{ width: '100%', background: 'linear-gradient(180deg,#34D399,#10b981)', borderRadius: '3px 3px 0 0', minHeight: 2, height: `${otp}%`, transition: 'height 1s ease-out' }}
                                                    />
                                                </div>
                                                {/* Reliability bar */}
                                                <div style={{ flex: 1, height: '100%', background: 'rgba(255,255,255,0.04)', borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'flex-end', maxWidth: 20 }}>
                                                    <div
                                                        title={`Reliability: ${rel.toFixed(0)}%`}
                                                        style={{ width: '100%', background: 'linear-gradient(180deg,#06b6d4,#22d3ee)', borderRadius: '3px 3px 0 0', minHeight: 2, height: `${rel}%`, transition: 'height 1s ease-out' }}
                                                    />
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '0.6875rem', color: 'var(--adm-text-muted)', fontFamily: 'monospace', fontWeight: 700 }}>{apt.iata}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--adm-text-muted)', fontSize: '0.875rem' }}>
                            {loading ? (t('loading') || 'Loading…') : (t('globalOps_no_data_pipeline') || 'No data — run the intelligence pipeline first.')}
                        </div>
                    )}
                </div>

                {/* Radar — Global System Health */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem' }}>
                    <div style={{ width: '100%', marginBottom: 8 }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--adm-text)' }}>{t('globalOps_system_health') || 'Global System Health'}</h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)', marginTop: 2 }}>{t('globalOps_system_health_sub') || 'Composite operational signals'}</p>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
                        {radarMetrics.length > 0
                            ? <RadarChart metrics={radarMetrics} size={280} />
                            : <div style={{ color: 'var(--adm-text-muted)', fontSize: '0.875rem', padding: '2rem' }}>{loading ? (t('loading') || 'Loading…') : (t('no_data') || 'No data available.')}</div>
                        }
                    </div>
                    <div style={{ marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, border: '1px solid var(--adm-border)', background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{t('globalOps_composite_score') || 'Composite score'}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '1.125rem', fontWeight: 600, color: 'var(--adm-accent)' }}>
                            {radarMetrics.length > 0
                                ? (radarMetrics.reduce((s, m) => s + m.value, 0) / radarMetrics.length).toFixed(1)
                                : '—'}
                        </span>
                    </div>
                </div>
            </section>

            {/* ── Analytics Tier ── */}
            <AnalyticsTier />
        </div>
    );
}

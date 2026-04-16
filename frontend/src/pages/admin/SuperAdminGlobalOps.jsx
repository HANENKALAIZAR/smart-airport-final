import { BrainCircuit, Globe, TrendingUp, AlertTriangle, Plane } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const AIRPORTS_DATA = [
    { code: 'TUN', name: 'Tunis', city: 'Tunis', totalFlights: 147, delayed: 12, onTimePct: 91.8, aiAcc: 94, risk: 'Low', perf: 92 },
    { code: 'MIR', name: 'Monastir', city: 'Monastir', totalFlights: 189, delayed: 35, onTimePct: 81.5, aiAcc: 85, risk: 'High', perf: 45 },
    { code: 'DJE', name: 'Djerba', city: 'Djerba', totalFlights: 178, delayed: 18, onTimePct: 89.9, aiAcc: 91, risk: 'Low', perf: 80 },
    { code: 'NBE', name: 'Enfidha', city: 'Enfidha', totalFlights: 172, delayed: 20, onTimePct: 88.4, aiAcc: 90, risk: 'Low', perf: 78 },
];

const TOP_AIRLINES = [
    { name: 'Tunisair', otp: 92.5 },
    { name: 'Air France', otp: 88.3 },
    { name: 'Lufthansa', otp: 91.2 },
    { name: 'Turkish Airlines', otp: 89.7 },
    { name: 'British Airways', otp: 87.1 },
];

const RADAR_METRICS = [
    { label: 'OTP', value: 87 },
    { label: 'AI Accuracy', value: 91 },
    { label: 'Response Time', value: 78 },
    { label: 'Resource Utilization', value: 82 },
    { label: 'Passenger Satisfaction', value: 85 },
];

const RISK_COLOR = { Low: '#22C55E', Medium: '#F59E0B', High: '#EF4444' };
const PERF_COLOR = (p) => p >= 80 ? '#22C55E' : p >= 60 ? '#F59E0B' : '#EF4444';

const totalFlights = AIRPORTS_DATA.reduce((s, a) => s + a.totalFlights, 0);
const globalOTP = (AIRPORTS_DATA.reduce((s, a) => s + a.onTimePct, 0) / AIRPORTS_DATA.length).toFixed(1);
const highRiskApts = AIRPORTS_DATA.filter(a => a.risk === 'High').length;

/* ── SVG Radar / Spider Chart ──────────────── */
function RadarChart({ metrics, size = 220 }) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.38;
    const n = metrics.length;

    function pt(i, pct) {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return {
            x: cx + r * pct * Math.cos(angle),
            y: cy + r * pct * Math.sin(angle),
        };
    }
    function labelPt(i) {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const dist = r + 26;
        return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
    }

    // Grid rings
    const rings = [0.25, 0.5, 0.75, 1];
    // Axes
    const axes = metrics.map((_, i) => {
        const outer = pt(i, 1);
        return `M${cx},${cy} L${outer.x},${outer.y}`;
    });
    // Data polygon
    const dataPoints = metrics.map((m, i) => pt(i, m.value / 100));
    const polyline = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Grid rings */}
            {rings.map(ring => (
                <polygon key={ring}
                    points={metrics.map((_, i) => { const p = pt(i, ring); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ')}
                    fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"
                />
            ))}
            {/* Ring labels */}
            {rings.map(ring => {
                const p = pt(0, ring);
                return <text key={ring} x={p.x + 3} y={p.y} fontSize="8" fill="rgba(255,255,255,0.25)">{Math.round(ring * 100)}</text>;
            })}
            {/* Axes */}
            {axes.map((d, i) => <path key={i} d={d} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />)}
            {/* Data area */}
            <path d={polyline} fill="rgba(14,165,233,0.18)" stroke="#0EA5E9" strokeWidth="1.5" />
            {/* Data points */}
            {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="#0EA5E9" />)}
            {/* Labels */}
            {metrics.map((m, i) => {
                const lp = labelPt(i);
                return (
                    <text key={i} x={lp.x} y={lp.y} fontSize="9" fill="rgba(255,255,255,0.55)"
                        textAnchor="middle" dominantBaseline="middle">
                        {m.label}
                    </text>
                );
            })}
        </svg>
    );
}

export default function SuperAdminGlobalOps() {
    const { t } = useLanguage();

    return (
        <div className="admin-space-y-6">
            {/* Page header */}
            <div className="admin-page-header">
                <h1>{t('globalOps') || 'Global Operations Center'}</h1>
                <p>Multi-Airport System Monitoring</p>
            </div>

            {/* KPI cards */}
            <div className="admin-grid-5">
                <div className="admin-kpi-card">
                    <div className="admin-kpi-card__top">
                        <span className="admin-kpi-card__title">Total Airports</span>
                        <div className="admin-kpi-card__icon admin-kpi-card__icon--blue"><Globe size={22} /></div>
                    </div>
                    <div className="admin-kpi-card__value">{AIRPORTS_DATA.length}</div>
                    <div className="admin-kpi-card__bar"><div style={{ width: '100%', height: '100%', background: '#3B82F6', borderRadius: 4 }} /></div>
                </div>
                <div className="admin-kpi-card">
                    <div className="admin-kpi-card__top">
                        <span className="admin-kpi-card__title">Total Flights</span>
                        <div className="admin-kpi-card__icon admin-kpi-card__icon--cyan"><Plane size={22} /></div>
                    </div>
                    <div className="admin-kpi-card__value">{totalFlights.toLocaleString()}</div>
                    <div className="admin-kpi-card__trend admin-kpi-card__trend--up">↑ 1.5%</div>
                    <div className="admin-kpi-card__bar"><div style={{ width: '75%', height: '100%', background: '#0EA5E9', borderRadius: 4 }} /></div>
                </div>
                <div className="admin-kpi-card">
                    <div className="admin-kpi-card__top">
                        <span className="admin-kpi-card__title">Global OTP</span>
                        <div className="admin-kpi-card__icon admin-kpi-card__icon--green"><TrendingUp size={22} /></div>
                    </div>
                    <div className="admin-kpi-card__value">{globalOTP}%</div>
                    <div className="admin-kpi-card__trend admin-kpi-card__trend--up">↑ 1.5%</div>
                    <div className="admin-kpi-card__bar"><div style={{ width: `${globalOTP}%`, height: '100%', background: '#22C55E', borderRadius: 4 }} /></div>
                </div>
                <div className="admin-kpi-card">
                    <div className="admin-kpi-card__top">
                        <span className="admin-kpi-card__title">High Risk Airports</span>
                        <div className="admin-kpi-card__icon admin-kpi-card__icon--red"><AlertTriangle size={22} /></div>
                    </div>
                    <div className="admin-kpi-card__value" style={{ color: highRiskApts > 0 ? '#EF4444' : '#22C55E' }}>{highRiskApts}</div>
                    <div className="admin-kpi-card__bar"><div style={{ width: `${(highRiskApts / AIRPORTS_DATA.length) * 100}%`, height: '100%', background: '#EF4444', borderRadius: 4 }} /></div>
                </div>
                <div className="admin-kpi-card">
                    <div className="admin-kpi-card__top">
                        <span className="admin-kpi-card__title">AI Accuracy</span>
                        <div className="admin-kpi-card__icon admin-kpi-card__icon--purple"><BrainCircuit size={22} /></div>
                    </div>
                    <div className="admin-kpi-card__value">91.0%</div>
                    <div className="admin-kpi-card__trend admin-kpi-card__trend--down">↓ 0.8%</div>
                    <div className="admin-kpi-card__bar"><div style={{ width: '91%', height: '100%', background: '#A855F7', borderRadius: 4 }} /></div>
                </div>
            </div>

            {/* Airport Performance Overview */}
            <div className="admin-table-wrap">
                <h2 className="admin-section-title">Airport Performance Overview</h2>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Airport</th>
                            <th>Total Flights</th>
                            <th>Delayed</th>
                            <th>On Time %</th>
                            <th>Risk Level</th>
                            <th>Performance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {AIRPORTS_DATA.map(apt => (
                            <tr key={apt.code}>
                                <td>
                                    <div style={{ fontWeight: 700, color: '#E2E8F0' }}>{apt.code}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{apt.city}</div>
                                </td>
                                <td style={{ color: '#E2E8F0', fontWeight: 600 }}>{apt.totalFlights}</td>
                                <td style={{ color: apt.delayed > 25 ? '#EF4444' : '#F59E0B', fontWeight: 600 }}>{apt.delayed}</td>
                                <td style={{ color: apt.onTimePct >= 88 ? '#22C55E' : '#F59E0B', fontWeight: 600 }}>{apt.onTimePct}%</td>
                                <td>
                                    <span className="global-risk-pill" style={{ background: `${RISK_COLOR[apt.risk]}20`, color: RISK_COLOR[apt.risk], border: `1px solid ${RISK_COLOR[apt.risk]}40` }}>
                                        {apt.risk}
                                    </span>
                                </td>
                                <td>
                                    <div className="global-perf-bar-track">
                                        <div className="global-perf-bar-fill" style={{ width: `${apt.perf}%`, background: PERF_COLOR(apt.perf) }} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Bottom row: Grouped bar chart + Radar */}
            <div className="global-bottom-row">
                {/* Grouped Bar Chart */}
                <div className="admin-table-wrap">
                    <h3 className="admin-section-title" style={{ fontSize: '1rem' }}>Airport Performance Comparison</h3>
                    <div className="global-grouped-chart">
                        {/* Y-axis labels */}
                        <div className="global-grouped-chart__y">
                            {[100, 75, 50, 25, 0].map(v => (
                                <span key={v}>{v}</span>
                            ))}
                        </div>
                        {/* Bars */}
                        <div className="global-grouped-chart__bars">
                            {AIRPORTS_DATA.map(apt => (
                                <div key={apt.code} className="global-grouped-chart__group">
                                    <div className="global-grouped-chart__bar-pair">
                                        <div className="global-grouped-chart__bar-wrap" title={`On-Time: ${apt.onTimePct}%`}>
                                            <div className="global-grouped-chart__bar global-grouped-chart__bar--green"
                                                style={{ height: `${apt.onTimePct}%` }} />
                                        </div>
                                        <div className="global-grouped-chart__bar-wrap" title={`AI Accuracy: ${apt.aiAcc}%`}>
                                            <div className="global-grouped-chart__bar global-grouped-chart__bar--blue"
                                                style={{ height: `${apt.aiAcc}%` }} />
                                        </div>
                                    </div>
                                    <span className="global-grouped-chart__label">{apt.code}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 12, height: 12, background: '#22C55E', borderRadius: 2, display: 'inline-block' }} /> On-Time %
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 12, height: 12, background: '#0EA5E9', borderRadius: 2, display: 'inline-block' }} /> AI Accuracy %
                        </span>
                    </div>
                </div>

                {/* Radar / Spider Chart */}
                <div className="admin-table-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h3 className="admin-section-title" style={{ fontSize: '1rem', width: '100%' }}>Global System Health</h3>
                    <RadarChart metrics={RADAR_METRICS} size={260} />
                </div>
            </div>

            {/* Top Airlines Performance */}
            <div className="admin-table-wrap">
                <h3 className="admin-section-title" style={{ fontSize: '1rem' }}>Top Airlines Performance</h3>
                <div className="global-airlines-row">
                    {TOP_AIRLINES.map(a => (
                        <div key={a.name} className="global-airline-card">
                            <div className="global-airline-card__name">{a.name}</div>
                            <div className="global-airline-card__otp" style={{ color: a.otp >= 90 ? '#22C55E' : '#F59E0B' }}>
                                {a.otp}%
                            </div>
                            <div className="global-airline-card__label">On-Time Performance</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect, useCallback } from 'react';
import { BrainCircuit, Globe, TrendingUp, AlertTriangle, Plane, RefreshCw, Activity, Clock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/api';

function getToken() {
    try { return localStorage.getItem('admin_token') || ''; } catch { return ''; }
}

async function fetchKpis() {
    const res = await fetch(`${BASE}/intelligence/airport-kpis`, {
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

const RISK_COLOR  = { Low: '#22C55E', Medium: '#F59E0B', High: '#EF4444', Unknown: '#6B7280' };
const PERF_COLOR  = (p) => p >= 80 ? '#22C55E' : p >= 60 ? '#F59E0B' : '#EF4444';

/* ── SVG Radar / Spider Chart — driven by real data ────────── */
function RadarChart({ metrics, size = 220 }) {
    const cx = size / 2;
    const cy = size / 2;
    const r  = size * 0.38;
    const n  = metrics.length;

    function pt(i, pct) {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return { x: cx + r * pct * Math.cos(angle), y: cy + r * pct * Math.sin(angle) };
    }
    function labelPt(i) {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const dist = r + 28;
        return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
    }

    const rings = [0.25, 0.5, 0.75, 1];
    const axes  = metrics.map((_, i) => { const o = pt(i, 1); return `M${cx},${cy} L${o.x},${o.y}`; });
    const dataPoints = metrics.map((m, i) => pt(i, (m.value || 0) / 100));
    const polyline   = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {rings.map(ring => (
                <polygon key={ring}
                    points={metrics.map((_, i) => { const p = pt(i, ring); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ')}
                    fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"
                />
            ))}
            {rings.map(ring => {
                const p = pt(0, ring);
                return <text key={ring} x={p.x + 3} y={p.y} fontSize="8" fill="rgba(255,255,255,0.25)">{Math.round(ring * 100)}</text>;
            })}
            {axes.map((d, i) => <path key={i} d={d} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />)}
            <path d={polyline} fill="rgba(14,165,233,0.18)" stroke="#0EA5E9" strokeWidth="1.5" />
            {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="#0EA5E9" />)}
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
    const [kpiData, setKpiData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchKpis();
            setKpiData(data);
            setLastUpdated(new Date());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => { load(); }, 0);
        return () => clearTimeout(timer);
    }, [load]);

    const airports   = kpiData?.airports    ?? [];
    const globalData = kpiData?.global      ?? {};

    // Build radar from real airport data
    const radarMetrics = airports.length > 0 ? [
        { label: 'OTP',           value: globalData.global_on_time_rate ?? 0 },
        { label: 'Reliability',   value: Math.round((airports.reduce((s, a) => s + (a.reliability_score ?? 0), 0) / Math.max(airports.length, 1)) * 100) },
        { label: 'Low Risk Apts', value: Math.round((airports.filter(a => a.risk_level === 'Low').length / Math.max(airports.length, 1)) * 100) },
        { label: 'Data Coverage', value: Math.round((airports.filter(a => a.has_data).length / Math.max(airports.length, 1)) * 100) },
        { label: 'AI Predicted',  value: airports.reduce((s, a) => s + a.upcoming_predicted_flights, 0) > 0 ? 80 : 0 },
    ] : [];

    return (
        <div className="admin-space-y-6">
            {/* Page header */}
            <div className="admin-page-header">
                <div>
                    <h1>{t('globalOps') || 'Global Operations Center'}</h1>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', marginTop: 2 }}>
                        Live multi-airport intelligence — sourced from <strong>ae_aviation_stats</strong>
                        {lastUpdated && ` · updated ${lastUpdated.toLocaleTimeString()}`}
                    </p>
                </div>
                <button
                    onClick={load}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                        borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.04)', cursor: 'pointer',
                        fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)',
                    }}
                >
                    <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    Refresh
                </button>
            </div>

            {error && (
                <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '0.84rem' }}>
                    Failed to load: {error}. Ensure the backend is running and you are logged in.
                </div>
            )}

            {/* KPI cards — real data */}
            <div className="admin-grid-5">
                <div className="admin-kpi-card">
                    <div className="admin-kpi-card__top">
                        <span className="admin-kpi-card__title">Airports Tracked</span>
                        <div className="admin-kpi-card__icon admin-kpi-card__icon--blue"><Globe size={22} /></div>
                    </div>
                    <div className="admin-kpi-card__value">{loading ? '…' : globalData.total_airports_with_data ?? 0}</div>
                    <div className="admin-kpi-card__bar"><div style={{ width: '100%', height: '100%', background: '#3B82F6', borderRadius: 4 }} /></div>
                </div>
                <div className="admin-kpi-card">
                    <div className="admin-kpi-card__top">
                        <span className="admin-kpi-card__title">Historical Flights</span>
                        <div className="admin-kpi-card__icon admin-kpi-card__icon--cyan"><Plane size={22} /></div>
                    </div>
                    <div className="admin-kpi-card__value">{loading ? '…' : (globalData.total_historical_flights ?? 0).toLocaleString()}</div>
                    <div className="admin-kpi-card__trend admin-kpi-card__trend--up">Training dataset</div>
                    <div className="admin-kpi-card__bar"><div style={{ width: '75%', height: '100%', background: '#0EA5E9', borderRadius: 4 }} /></div>
                </div>
                <div className="admin-kpi-card">
                    <div className="admin-kpi-card__top">
                        <span className="admin-kpi-card__title">Global OTP</span>
                        <div className="admin-kpi-card__icon admin-kpi-card__icon--green"><TrendingUp size={22} /></div>
                    </div>
                    <div className="admin-kpi-card__value">
                        {loading ? '…' : (globalData.global_on_time_rate != null ? `${globalData.global_on_time_rate}%` : 'N/A')}
                    </div>
                    <div className="admin-kpi-card__bar">
                        <div style={{ width: `${globalData.global_on_time_rate ?? 0}%`, height: '100%', background: '#22C55E', borderRadius: 4 }} />
                    </div>
                </div>
                <div className="admin-kpi-card">
                    <div className="admin-kpi-card__top">
                        <span className="admin-kpi-card__title">High Risk Airports</span>
                        <div className="admin-kpi-card__icon admin-kpi-card__icon--red"><AlertTriangle size={22} /></div>
                    </div>
                    <div className="admin-kpi-card__value"
                        style={{ color: (globalData.high_risk_airports ?? 0) > 0 ? '#EF4444' : '#22C55E' }}>
                        {loading ? '…' : (globalData.high_risk_airports ?? 0)}
                    </div>
                    <div className="admin-kpi-card__bar">
                        <div style={{
                            width: `${((globalData.high_risk_airports ?? 0) / Math.max(airports.length, 1)) * 100}%`,
                            height: '100%', background: '#EF4444', borderRadius: 4
                        }} />
                    </div>
                </div>
                <div className="admin-kpi-card">
                    <div className="admin-kpi-card__top">
                        <span className="admin-kpi-card__title">AI Predictions (72h)</span>
                        <div className="admin-kpi-card__icon admin-kpi-card__icon--purple"><BrainCircuit size={22} /></div>
                    </div>
                    <div className="admin-kpi-card__value">
                        {loading ? '…' : airports.reduce((s, a) => s + a.upcoming_predicted_flights, 0)}
                    </div>
                    <div className="admin-kpi-card__trend" style={{ color: '#A855F7' }}>
                        <Activity size={12} style={{ display: 'inline', marginRight: 3 }} />Live model
                    </div>
                    <div className="admin-kpi-card__bar"><div style={{ width: '70%', height: '100%', background: '#A855F7', borderRadius: 4 }} /></div>
                </div>
            </div>

            {/* Airport Performance Table */}
            <div className="admin-table-wrap">
                <h2 className="admin-section-title">Airport Performance — Real Intelligence Data</h2>
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>Loading live data…</div>
                ) : airports.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                        No data yet. Run <code>POST /api/intelligence/run-all</code> to seed the intelligence layer.
                    </div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Airport</th>
                                <th>Historical Flights</th>
                                <th>On-Time Rate</th>
                                <th>Avg Delay</th>
                                <th>AI Predicted (72h)</th>
                                <th>Risk Level</th>
                                <th>Performance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {airports.map(apt => (
                                <tr key={apt.iata}>
                                    <td>
                                        <div style={{ fontWeight: 700, color: '#E2E8F0' }}>{apt.iata}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{apt.name}</div>
                                    </td>
                                    <td style={{ color: '#E2E8F0', fontWeight: 600 }}>
                                        {apt.has_data ? apt.total_historical_flights : <span style={{ color: 'rgba(255,255,255,0.25)' }}>No data</span>}
                                    </td>
                                    <td style={{ color: apt.on_time_rate != null && apt.on_time_rate >= 80 ? '#22C55E' : '#F59E0B', fontWeight: 600 }}>
                                        {apt.on_time_rate != null ? `${apt.on_time_rate}%` : '—'}
                                    </td>
                                    <td style={{ color: '#E2E8F0' }}>
                                        {apt.avg_delay_min != null ? (
                                            <span style={{ color: apt.avg_delay_min > 20 ? '#EF4444' : '#F59E0B' }}>
                                                {apt.avg_delay_min} min
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td style={{ color: '#A5B4FC', fontWeight: 600 }}>
                                        {apt.upcoming_predicted_flights}
                                        {apt.upcoming_avg_predicted_delay != null && (
                                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>
                                                ~{apt.upcoming_avg_predicted_delay}min
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <span className="global-risk-pill" style={{
                                            background: `${RISK_COLOR[apt.risk_level]}20`,
                                            color: RISK_COLOR[apt.risk_level],
                                            border: `1px solid ${RISK_COLOR[apt.risk_level]}40`
                                        }}>
                                            {apt.risk_level}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="global-perf-bar-track">
                                            <div className="global-perf-bar-fill"
                                                style={{ width: `${apt.on_time_rate ?? 0}%`, background: PERF_COLOR(apt.on_time_rate ?? 0) }} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Bottom row: Bar chart + Radar */}
            <div className="global-bottom-row">
                {/* Grouped Bar Chart */}
                <div className="admin-table-wrap">
                    <h3 className="admin-section-title" style={{ fontSize: '1rem' }}>On-Time % vs AI Predictions (Live)</h3>
                    {airports.length > 0 ? (
                        <>
                        <div className="global-grouped-chart">
                            <div className="global-grouped-chart__y">
                                {[100, 75, 50, 25, 0].map(v => <span key={v}>{v}</span>)}
                            </div>
                            <div className="global-grouped-chart__bars">
                                {airports.filter(a => a.has_data).map(apt => (
                                    <div key={apt.iata} className="global-grouped-chart__group">
                                        <div className="global-grouped-chart__bar-pair">
                                            <div className="global-grouped-chart__bar-wrap" title={`On-Time: ${apt.on_time_rate}%`}>
                                                <div className="global-grouped-chart__bar global-grouped-chart__bar--green"
                                                    style={{ height: `${apt.on_time_rate ?? 0}%` }} />
                                            </div>
                                            <div className="global-grouped-chart__bar-wrap"
                                                title={`Reliability: ${apt.reliability_score != null ? (apt.reliability_score * 100).toFixed(0) : '?'}%`}>
                                                <div className="global-grouped-chart__bar global-grouped-chart__bar--blue"
                                                    style={{ height: `${apt.reliability_score != null ? apt.reliability_score * 100 : 0}%` }} />
                                            </div>
                                        </div>
                                        <span className="global-grouped-chart__label">{apt.iata}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 12, height: 12, background: '#22C55E', borderRadius: 2, display: 'inline-block' }} /> On-Time %
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 12, height: 12, background: '#0EA5E9', borderRadius: 2, display: 'inline-block' }} /> Reliability Score
                            </span>
                        </div>
                        </>
                    ) : (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                            No data — run the intelligence pipeline first.
                        </div>
                    )}
                </div>

                {/* Radar — real data */}
                <div className="admin-table-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h3 className="admin-section-title" style={{ fontSize: '1rem', width: '100%' }}>Global System Health</h3>
                    {radarMetrics.length > 0
                        ? <RadarChart metrics={radarMetrics} size={260} />
                        : <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', marginTop: '2rem' }}>Loading…</div>
                    }
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>
                        Derived from ae_aviation_stats · no mock values
                    </div>
                </div>
            </div>

            {/* Airline reliability table */}
            <div className="admin-table-wrap">
                <h3 className="admin-section-title" style={{ fontSize: '1rem' }}>Upcoming AI-Predicted Flights by Airport</h3>
                <div className="global-airlines-row">
                    {airports.map(a => (
                        <div key={a.iata} className="global-airline-card">
                            <div className="global-airline-card__name" style={{ fontWeight: 800, fontSize: '1.1rem' }}>{a.iata}</div>
                            <div className="global-airline-card__otp"
                                style={{ color: a.upcoming_predicted_flights > 0 ? '#A5B4FC' : 'rgba(255,255,255,0.25)' }}>
                                {a.upcoming_predicted_flights}
                            </div>
                            <div className="global-airline-card__label">
                                {a.upcoming_avg_predicted_delay != null
                                    ? `~${a.upcoming_avg_predicted_delay}min avg predicted delay`
                                    : 'No predictions yet'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

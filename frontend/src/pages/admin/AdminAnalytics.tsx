import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    TrendingUp, Calendar, Plane, AlertTriangle, Activity, 
    RefreshCw, Zap, Bell, CheckCircle, Clock, Users
} from 'lucide-react';
import { useAirport } from '../../context/AirportContext';
import { useLanguage } from '../../context/LanguageContext';
import { apiGetAdminAnalytics } from '../../services/adminApi';

/* ── Types ── */
type Period = 'weekly' | 'monthly' | 'yearly' | 'custom';

/* ── Lightweight, memoized Bar Chart ── */
const BarChart = React.memo(({ data, labels }: { data: number[]; labels: string[] }) => {
    const max = Math.max(1, ...data);
    
    // Create 4 subtle horizontal grid lines
    const gridLines = [1, 0.75, 0.5, 0.25];

    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: data.length > 14 ? 4 : 12, height: 220, padding: '0 4px', zIndex: 1 }}>
            {/* Grid lines */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBottom: '20px' }}>
                {gridLines.map((ratio, idx) => (
                    <div key={idx} style={{ borderTop: '1px dashed rgba(255,255,255,0.05)', width: '100%', position: 'relative' }}>
                        <span style={{ position: 'absolute', top: -8, left: -25, fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>
                            {Math.round(max * ratio)}
                        </span>
                    </div>
                ))}
            </div>

            {/* Bars */}
            {data.map((v, i) => {
                // Semantic color logic for the chart: Green for high on-time rate, Amber for med, Red for low.
                let barColor = 'linear-gradient(180deg, #FBBF24, #F59E0B)'; // Amber
                if (v >= 80) barColor = 'linear-gradient(180deg, #34D399, #10B981)'; // Green
                if (v <= 50) barColor = 'linear-gradient(180deg, #F87171, #EF4444)'; // Red

                return (
                    <div 
                        key={i} 
                        title={`${labels[i]}: ${v}% on-time`} // Native hover tooltip
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'crosshair' }}
                    >
                        <div style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)', fontWeight: 600 }}>{v}%</div>
                        <div style={{
                            width: '100%', height: `${(v / max) * 170}px`,
                            background: barColor,
                            borderRadius: '6px 6px 2px 2px',
                            boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
                            transition: 'height 400ms ease, background 300ms ease',
                        }} />
                        {(data.length <= 14 || i % 5 === 0) && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>{labels[i]}</div>
                        )}
                    </div>
                );
            })}
        </div>
    );
});

/* ── Progress bar row ── */
function BarRow({ l, v, p, c }: { l: string; v: string | number; p: number; c?: string }) {
    return (
        <div style={{ marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--adm-text-sub)' }}>{l}</span>
                <span style={{ color: 'var(--adm-text)', fontWeight: 500 }}>{typeof v === 'number' ? v.toLocaleString() : v}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ 
                    width: `${Math.max(0, Math.min(100, p))}%`, 
                    height: '100%', 
                    background: c || 'linear-gradient(90deg, #60A5FA, #3B82F6)', 
                    borderRadius: 999, 
                    transition: 'width 400ms ease' 
                }} />
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════ */
export default function AdminAnalytics() {
    const { selectedAirport } = useAirport();
    const { t } = useLanguage();
    const [period, setPeriod] = useState<Period>('monthly');
    const [from, setFrom] = useState('2026-01-01');
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

    // Unified Real Data State
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [timeAgoStr, setTimeAgoStr] = useState<string>('Just now');
    const loadIntervalRef = useRef<number | null>(null);
    const timeIntervalRef = useRef<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        let days = 30;
        if (period === 'weekly') days = 7;
        else if (period === 'monthly') days = 30;
        else if (period === 'yearly') days = 365;
        else if (period === 'custom') {
            const d1 = new Date(from);
            const d2 = new Date(to);
            days = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24)));
        }

        try {
            const res = await apiGetAdminAnalytics({ days, airport_iata: selectedAirport.iata });
            if (res.data) {
                setData(res.data);
                setLastUpdated(new Date());
            }
        } catch (err) {
            console.error("Failed to load analytics", err);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [period, from, to, selectedAirport.iata]);

    // Polling logic - Safe cleanup
    useEffect(() => { 
        load(); 
        if (loadIntervalRef.current) clearInterval(loadIntervalRef.current);
        loadIntervalRef.current = window.setInterval(load, 60000); // 60s
        
        return () => {
            if (loadIntervalRef.current) clearInterval(loadIntervalRef.current);
        };
    }, [load]);

    // "Last updated X sec ago" logic
    useEffect(() => {
        if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
        timeIntervalRef.current = window.setInterval(() => {
            if (!lastUpdated) return;
            const diff = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
            if (diff < 10) setTimeAgoStr('Just now');
            else if (diff < 60) setTimeAgoStr(`${diff} sec ago`);
            else setTimeAgoStr(`${Math.floor(diff / 60)} min ago`);
        }, 1000);

        return () => {
            if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
        };
    }, [lastUpdated]);

    // ── Mapping Data to UI ──
    const seriesData = data?.dailyPerformance?.map((d: any) => Math.round(d.onTimeRate)) || [];
    const seriesLabels = data?.dailyPerformance?.map((d: any) => {
        const parts = d.date.split('-');
        return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d.date;
    }) || [];

    // Semantic Colors
    const COLOR_SUCCESS = '#34D399';
    const COLOR_WARNING = '#F59E0B';
    const COLOR_ERROR = '#F87171';
    const COLOR_NEUTRAL = '#60A5FA';
    const COLOR_ACTIVE = '#A78BFA';

    // Skeleton placeholder for loading
    const isSkeleton = loading && !data;

    const stats = [
        { l: 'Total Flights', v: data?.summary?.totalFlights || 0, c: COLOR_NEUTRAL, icon: Plane },
        { l: 'Avg On-Time', v: data?.summary?.onTimeRate != null ? `${data.summary.onTimeRate.toFixed(1)}%` : 'N/A', c: COLOR_SUCCESS, icon: CheckCircle },
        { l: 'Active Flights', v: data?.summary?.activeFlights || 0, c: COLOR_ACTIVE, icon: Activity },
        { l: 'Landed Flights', v: data?.summary?.landedFlights || 0, c: '#4ADE80', icon: Plane },
        { l: 'Scheduled Flights', v: data?.summary?.scheduledFlights || 0, c: 'var(--adm-text-sub)', icon: Calendar },
        { l: 'Delayed Flights', v: data?.summary?.delayedFlights || 0, c: COLOR_WARNING, icon: Clock },
        { l: 'Cancellations', v: data?.summary?.cancelledFlights || 0, c: COLOR_ERROR, icon: AlertTriangle },
    ];

    const delayFactors = data?.delayFactors || [];

    const routes = data?.routeAnalytics || [];
    const maxRouteFlights = routes[0]?.totalFlights || 1;
    const headerLabel = period === 'yearly' ? 'On-time rate over time' : 'On-time rate by day';

    const TABS: { k: Period; l: string }[] = [
        { k: 'weekly', l: 'Weekly' },
        { k: 'monthly', l: 'Monthly' },
        { k: 'yearly', l: 'Yearly' },
        { k: 'custom', l: 'Custom' },
    ];

    return (
        <>
            {/* Page header */}
            <div className="admin-page__header">
                <div>
                    <h1 className="admin-page__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <TrendingUp size={22} style={{ color: 'var(--adm-accent)' }} /> Analytics
                    </h1>
                    <p className="admin-page__subtitle">Real-time operational metrics · {selectedAirport.name} ({selectedAirport.iata})</p>
                </div>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                    {/* Live pulse indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ position: 'relative', width: 8, height: 8 }}>
                            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: COLOR_SUCCESS }} />
                            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: COLOR_SUCCESS, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                        </div>
                        <span style={{ fontSize: '0.78rem', color: 'var(--adm-text-sub)', fontWeight: 500 }}>
                            Live · <span style={{ opacity: 0.8 }}>{timeAgoStr}</span>
                        </span>
                    </div>

                    <button 
                        className="admin-btn admin-btn--outline" 
                        onClick={load}
                        style={{ padding: '0.4rem 0.8rem' }}
                    >
                        <RefreshCw size={14} className={loading ? 'su-spin' : ''} style={{ marginRight: 6 }} />
                        <span style={{ fontSize: '0.8rem' }}>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Executive Summary */}
            {data?.executiveSummary && (
                <div style={{ 
                    background: 'rgba(52, 211, 153, 0.05)', 
                    border: '1px solid rgba(52, 211, 153, 0.2)', 
                    padding: '1.25rem', 
                    borderRadius: 12, 
                    marginBottom: '1.5rem', 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '1rem',
                    transition: 'opacity 300ms',
                    opacity: loading ? 0.7 : 1
                }}>
                    <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: 10, borderRadius: 10 }}>
                        <Activity size={22} color={COLOR_SUCCESS} />
                    </div>
                    <div>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: COLOR_SUCCESS, fontWeight: 700 }}>Executive Summary</h4>
                        <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--adm-text)', lineHeight: 1.6 }}>
                            {data.executiveSummary.split(/(strong|elevated delays|limited sample|uncategorized|\d+\.\d+%|\b[A-Z]{3}→[A-Z]{3}\b|\d+ tracked flights|\d+ predictions)/g).map((part: string, i: number) => 
                                part.includes('%') || part.includes('→') || part.match(/\d+/) || part.includes('strong') || part.includes('elevated') || part.includes('limited') ? (
                                    <strong key={i} style={{ color: 'var(--adm-text)', fontWeight: 700 }}>{part}</strong>
                                ) : (
                                    <span key={i} style={{ color: 'var(--adm-text-sub)' }}>{part}</span>
                                )
                            )}
                        </p>
                        {data?.summary?.limitedSampleSize && (
                            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: COLOR_WARNING, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <AlertTriangle size={14} /> Limited operational sample size may affect accuracy.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Period tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--adm-border)', borderRadius: 12 }}>
                    {TABS.map(tab => {
                        const active = period === tab.k;
                        return (
                            <button key={tab.k} onClick={() => setPeriod(tab.k)}
                                style={{
                                    padding: '0.5rem 1.1rem', borderRadius: 8, border: 'none',
                                    background: active ? 'linear-gradient(135deg, #F59E0B, #FBBF24)' : 'transparent',
                                    color: active ? '#0A1628' : 'var(--adm-text-sub)',
                                    fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 180ms',
                                }}>
                                {tab.l}
                            </button>
                        );
                    })}
                </div>
                {period === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.45rem 0.7rem', border: '1px solid var(--adm-border)', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                        <Calendar size={14} style={{ color: 'var(--adm-accent)' }} />
                        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--adm-text)', fontSize: '0.82rem', outline: 'none' }} />
                        <span style={{ color: 'var(--adm-text-muted)' }}>→</span>
                        <input type="date" value={to} onChange={e => setTo(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--adm-text)', fontSize: '0.82rem', outline: 'none' }} />
                    </div>
                )}
            </div>

            {/* KPI stat-cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {stats.map(s => (
                    <div key={s.l} className="admin-stat-card" style={{ opacity: isSkeleton ? 0.5 : 1, transition: 'opacity 300ms' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="admin-stat-card__label" style={{ marginBottom: 8 }}>{s.l}</div>
                            <s.icon size={16} color={s.c} style={{ opacity: 0.6 }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div className="admin-stat-card__value" style={{ color: s.c }}>
                                {isSkeleton ? '…' : s.v}
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)' }}>
                                Selected period
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main bar chart */}
            <div className="admin-card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--adm-text)', marginBottom: 2, marginTop: 0 }}>{headerLabel}</h3>
                        <p style={{ fontSize: '0.78rem', color: 'var(--adm-text-muted)', margin: 0 }}>
                            {seriesData.length} data points
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: '0.78rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--adm-text-sub)' }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: COLOR_SUCCESS }} /> High ≥ 80%
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--adm-text-sub)' }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: COLOR_WARNING }} /> Med &gt; 50%
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--adm-text-sub)' }}>
                            <span style={{ width: 10, height: 10, borderRadius: 2, background: COLOR_ERROR }} /> Low ≤ 50%
                        </span>
                    </div>
                </div>
                {seriesData.length > 0 ? (
                    <BarChart data={seriesData} labels={seriesLabels} />
                ) : (
                    <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--adm-text-muted)', fontSize: '0.85rem' }}>
                        {loading ? 'Loading operational data...' : 'No operational analytics available for the selected period.'}
                    </div>
                )}
            </div>

            {/* Three-column bottom row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', opacity: isSkeleton ? 0.5 : 1, transition: 'opacity 300ms' }}>
                
                {/* Delay Causes */}
                <div className="admin-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--adm-text)', margin: 0 }}>Inferred Delay Factors</h3>
                        <AlertTriangle size={16} color="var(--adm-text-muted)" />
                    </div>
                    {delayFactors.length === 1 && delayFactors[0].label === 'Uncategorized Delays' ? (
                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, color: 'var(--adm-text-sub)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                            Exact delay causes are not available from the current AviationEdge dataset. Delays are tracked, but source attribution is incomplete.
                        </div>
                    ) : delayFactors.length > 0 ? (
                        <>
                            {delayFactors.map((f: any) => {
                                let c = 'rgba(255,255,255,0.4)';
                                if (f.label.includes('Congestion')) c = COLOR_WARNING;
                                else if (f.label.includes('Reconciliation')) c = COLOR_NEUTRAL;
                                else if (f.label.includes('Operational')) c = COLOR_ACTIVE;
                                else if (f.label.includes('Incomplete')) c = COLOR_ERROR;
                                
                                return (
                                    <BarRow 
                                        key={f.label} 
                                        l={<>{f.label} {f.isInferred && <span style={{ fontSize: '0.65rem', opacity: 0.6, marginLeft: 4, fontWeight: 'normal' }}>(Inferred)</span>}</>} 
                                        v={`${f.count} (${f.percentage}%)`} 
                                        p={f.percentage} 
                                        c={c} 
                                    />
                                );
                            })}
                            <p style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)', marginTop: '1.25rem', fontStyle: 'italic', lineHeight: 1.4 }}>
                                Delay factors are inferred from available operational indicators, not official root-cause codes.
                            </p>
                        </>
                    ) : (
                        <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--adm-text-muted)', fontSize: '0.8rem' }}>
                            {loading ? 'Processing...' : '0 delayed flights.'}
                        </div>
                    )}
                </div>

                {/* Top Routes */}
                <div className="admin-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--adm-text)', marginBottom: '1.5rem', marginTop: 0 }}>Top Routes by Volume</h3>
                    {routes.length > 0 ? (
                        routes.slice(0, 5).map((r: any) => (
                            <BarRow key={r.route} l={r.route} v={`${r.totalFlights} flights — ${r.delayRate}% delayed`} p={(r.totalFlights / maxRouteFlights) * 100} c={COLOR_NEUTRAL} />
                        ))
                    ) : (
                        <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--adm-text-muted)', fontSize: '0.8rem' }}>
                            {loading ? 'Processing...' : 'No active routes.'}
                        </div>
                    )}
                </div>

                {/* AI & Alerts */}
                <div className="admin-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--adm-text)', marginBottom: '1.5rem', marginTop: 0 }}>AI & Operational Tracking</h3>
                    
                    {data?.aiAnalytics?.predictionsGenerated === 0 ? (
                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, color: 'var(--adm-text-sub)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                            No AI prediction records available for this period.
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: `1px solid rgba(52, 211, 153, 0.2)`, padding: 10, borderRadius: 8 }}>
                                    <Zap size={20} color={COLOR_SUCCESS} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--adm-text-sub)' }}>AI Predictions Generated</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--adm-text)' }}>
                                        {data?.aiAnalytics?.predictionsGenerated.toLocaleString() || 0}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: `1px solid rgba(245, 158, 11, 0.2)`, padding: 10, borderRadius: 8 }}>
                                    <CheckCircle size={20} color={COLOR_WARNING} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--adm-text-sub)' }}>Est. Prediction Accuracy</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--adm-text)' }}>
                                        {data?.aiAnalytics?.predictionAccuracy || 0}%
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <div style={{ height: 1, background: 'var(--adm-border)', margin: '1.25rem 0' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: 'rgba(167, 139, 250, 0.1)', border: `1px solid rgba(167, 139, 250, 0.2)`, padding: 10, borderRadius: 8 }}>
                            <Bell size={20} color={COLOR_ACTIVE} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--adm-text-sub)' }}>Total Alerts Dispatched</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--adm-text)' }}>
                                {data?.alertAnalytics?.alertsSent.toLocaleString() || 0}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Inject minimal keyframes for the pulse animation if not globally available */}
            <style>{`
                @keyframes pulse {
                    0% { transform: scale(0.95); opacity: 0.8; }
                    50% { transform: scale(1.5); opacity: 0; }
                    100% { transform: scale(0.95); opacity: 0; }
                }
            `}</style>
        </>
    );
}

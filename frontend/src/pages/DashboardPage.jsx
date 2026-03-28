import { useState, useEffect } from 'react';
import { BarChart3, AlertTriangle, TrendingUp, Plane } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, AreaChart, Area,
} from 'recharts';
import { getDashboardOverview, getDelayCauses, getDelayHistory, getAirlinesPerformance } from '../services/api';

export default function DashboardPage() {
    const [overview, setOverview] = useState(null);
    const [causes, setCauses] = useState([]);
    const [history, setHistory] = useState([]);
    const [airlines, setAirlines] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        const [o, c, h, a] = await Promise.all([
            getDashboardOverview(),
            getDelayCauses(),
            getDelayHistory(),
            getAirlinesPerformance(),
        ]);
        setOverview(o);
        setCauses(c);
        setHistory(h);
        setAirlines(a);
        setLoading(false);
    }

    if (loading) {
        return (
            <div className="animate-in">
                <div className="skeleton skeleton--title" style={{ marginBottom: 24 }} />
                <div className="stats-grid">
                    {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
                </div>
            </div>
        );
    }

    const chartTooltipStyle = {
        backgroundColor: '#1E293B',
        border: '1px solid #334155',
        borderRadius: 8,
        color: '#F1F5F9',
        fontSize: 13,
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1 className="page-title">📊 Staff Dashboard</h1>
                <p className="page-subtitle">AI-powered operations analytics (last 30 days)</p>
            </div>

            {/* ── KPI Cards ─────────────────────── */}
            {overview && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-card__value">{overview.total_flights.toLocaleString()}</div>
                        <div className="stat-card__label">Total Flights</div>
                    </div>
                    <div className="stat-card stat-card--success">
                        <div className="stat-card__value">{overview.on_time_count.toLocaleString()}</div>
                        <div className="stat-card__label">On Time</div>
                    </div>
                    <div className="stat-card stat-card--danger">
                        <div className="stat-card__value">{overview.delayed_count.toLocaleString()}</div>
                        <div className="stat-card__label">Delayed</div>
                    </div>
                    <div className="stat-card stat-card--warning">
                        <div className="stat-card__value">{overview.at_risk_count}</div>
                        <div className="stat-card__label">At Risk</div>
                    </div>
                </div>
            )}

            {/* Secondary KPIs */}
            {overview && (
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 'var(--space-xl)' }}>
                    <div className="stat-card">
                        <div className="stat-card__value" style={{ color: 'var(--orange)' }}>{overview.delay_rate}%</div>
                        <div className="stat-card__label">Delay Rate</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card__value" style={{ color: 'var(--info)' }}>{overview.avg_delay_minutes}</div>
                        <div className="stat-card__label">Avg Delay (min)</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card__value" style={{ color: 'var(--gray-400)' }}>{overview.cancelled_count}</div>
                        <div className="stat-card__label">Cancelled</div>
                    </div>
                </div>
            )}

            {/* ── Delay History Chart ────────────── */}
            <div className="chart-container">
                <div className="chart-title">📈 Delay Rate Trend (Weekly)</div>
                <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={history}>
                        <defs>
                            <linearGradient id="gradDelay" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#64748B" fontSize={12} />
                        <YAxis stroke="#64748B" fontSize={12} unit="%" />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Area type="monotone" dataKey="delay_rate" stroke="#6366F1" fill="url(#gradDelay)" strokeWidth={2} name="Delay Rate %" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* ── Delay Causes ──────────────────── */}
            <div className="chart-container">
                <div className="chart-title">🔍 Delay Contributing Factors</div>
                {causes.map((cause, i) => {
                    const colors = ['#EF4444', '#F97316', '#EAB308', '#3B82F6'];
                    return (
                        <div key={i} style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{cause.factor}</span>
                                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: colors[i] }}>{cause.impact}%</span>
                            </div>
                            <div style={{ height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                                <div
                                    style={{
                                        width: `${cause.impact}%`,
                                        height: '100%',
                                        background: `linear-gradient(90deg, ${colors[i]}, ${colors[i]}88)`,
                                        borderRadius: 4,
                                        transition: 'width 1s ease-out',
                                    }}
                                />
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{cause.description}</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Airlines Performance ───────────── */}
            <div className="chart-container">
                <div className="chart-title">🏢 Airline Performance</div>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={airlines} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" stroke="#64748B" fontSize={12} unit="%" />
                        <YAxis type="category" dataKey="airline_iata" stroke="#64748B" fontSize={12} width={40} />
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${v}%`, 'Delay Rate']} />
                        <Bar dataKey="delay_rate" fill="#6366F1" radius={[0, 4, 4, 0]} name="Delay Rate" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* ── Airlines Table ─────────────────── */}
            <div className="card" style={{ overflowX: 'auto' }}>
                <div className="detail-section__title">
                    <TrendingUp size={18} /> Detailed Airlines Report
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Airline</th>
                            <th>Flights</th>
                            <th>Delay %</th>
                            <th>Avg Delay</th>
                            <th>Reliability</th>
                        </tr>
                    </thead>
                    <tbody>
                        {airlines.map(al => (
                            <tr key={al.airline_iata}>
                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {al.airline_iata} – {al.airline_name}
                                </td>
                                <td>{al.total_flights}</td>
                                <td>
                                    <span style={{
                                        color: al.delay_rate > 30 ? 'var(--danger)' : al.delay_rate > 25 ? 'var(--warning)' : 'var(--success)',
                                        fontWeight: 600,
                                    }}>
                                        {al.delay_rate}%
                                    </span>
                                </td>
                                <td>{al.avg_delay_minutes} min</td>
                                <td>
                                    <span style={{ color: al.reliability_score > 0.8 ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {(al.reliability_score * 100).toFixed(0)}%
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

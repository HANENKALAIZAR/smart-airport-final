import { useState, useEffect } from 'react';
import { TrendingUp, BarChart3, PieChart as PieIcon, Activity } from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fetchDashboard } from '../services/api';

const COLORS = {
    primary: '#6366F1',
    secondary: '#00C2FF',
    success: '#22C55E',
    warning: '#EAB308',
    danger: '#EF4444',
    muted: '#94A3B8',
};

const tooltipStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '0.8rem',
    color: 'var(--text-primary)',
};

// Mock analytics data (when backend data is supplemented)
const mockDelayDistribution = [
    { range: '0–10 min', count: 45 },
    { range: '11–20 min', count: 28 },
    { range: '21–30 min', count: 22 },
    { range: '31–45 min', count: 15 },
    { range: '46–60 min', count: 10 },
    { range: '60+ min', count: 4 },
];

const mockDelayByAirline = [
    { airline: 'American', avgDelay: 15 },
    { airline: 'United', avgDelay: 22 },
    { airline: 'Delta', avgDelay: 18 },
    { airline: 'Southwest', avgDelay: 12 },
    { airline: 'Air France', avgDelay: 20 },
    { airline: 'Emirates', avgDelay: 8 },
];

export default function AnalyticsPage() {
    const [overview, setOverview] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [ov, hist] = await Promise.all([
                    fetchDashboard.overview(),
                    fetchDashboard.history(),
                ]);
                setOverview(ov);
                setHistory(hist);
            } catch (e) {
                console.error('Analytics load error', e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const onTimeVsDelayed = overview ? [
        { name: 'On-Time', value: overview.on_time_count, color: COLORS.success },
        { name: 'Delayed', value: overview.delayed_count, color: COLORS.danger },
        { name: 'Cancelled', value: overview.cancelled_count, color: COLORS.muted },
    ] : [];

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1 className="page-title">📊 Analytics</h1>
                <p className="page-subtitle">Historical data and performance insights</p>
            </div>

            {loading ? (
                <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                    {[1, 2].map(i => <div key={i} className="skeleton skeleton--card"></div>)}
                </div>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-lg)' }}>
                        {/* Delay Distribution */}
                        <div className="card">
                            <div className="card__header">
                                <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <BarChart3 size={18} style={{ color: 'var(--primary-400)' }} />
                                    Delay Distribution
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={mockDelayDistribution}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* On-Time vs Delayed Pie */}
                        <div className="card">
                            <div className="card__header">
                                <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <PieIcon size={18} style={{ color: 'var(--primary-400)' }} />
                                    On-Time vs Delayed
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={onTimeVsDelayed}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, value }) => `${name}: ${value}`}
                                        outerRadius={90}
                                        dataKey="value"
                                    >
                                        {onTimeVsDelayed.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Average Delay by Airline */}
                        <div className="card">
                            <div className="card__header">
                                <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <TrendingUp size={18} style={{ color: 'var(--primary-400)' }} />
                                    Avg Delay by Airline
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={mockDelayByAirline} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <YAxis dataKey="airline" type="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={90} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Bar dataKey="avgDelay" fill={COLORS.secondary} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Delay Trend */}
                        <div className="card">
                            <div className="card__header">
                                <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Activity size={18} style={{ color: 'var(--primary-400)' }} />
                                    Delay Trend (7 days)
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={history.length ? history : [
                                    { date: 'Feb 9', delay_rate: 22, avg_delay: 15, total_flights: 118 },
                                    { date: 'Feb 10', delay_rate: 18, avg_delay: 18, total_flights: 122 },
                                    { date: 'Feb 11', delay_rate: 25, avg_delay: 22, total_flights: 115 },
                                    { date: 'Feb 12', delay_rate: 20, avg_delay: 17, total_flights: 125 },
                                    { date: 'Feb 13', delay_rate: 21, avg_delay: 19, total_flights: 120 },
                                    { date: 'Feb 14', delay_rate: 19, avg_delay: 16, total_flights: 119 },
                                    { date: 'Feb 15', delay_rate: 23, avg_delay: 18, total_flights: 124 },
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Legend />
                                    <Line type="monotone" dataKey="avg_delay" stroke={COLORS.danger} strokeWidth={2} name="Avg Delay (min)" dot={{ fill: COLORS.danger, r: 4 }} />
                                    <Line type="monotone" dataKey="total_flights" stroke={COLORS.primary} strokeWidth={2} name="Total Flights" dot={{ fill: COLORS.primary, r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="stats-grid" style={{ marginTop: 'var(--space-lg)' }}>
                        <div className="stat-card">
                            <div className="stat-card__value">{overview?.total_flights || 3847}</div>
                            <div className="stat-card__label">Total Analyzed</div>
                        </div>
                        <div className="stat-card stat-card--success">
                            <div className="stat-card__value">94.2%</div>
                            <div className="stat-card__label">Model Accuracy</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card__value">18:00</div>
                            <div className="stat-card__label">Peak Delay Hour</div>
                        </div>
                        <div className="stat-card stat-card--danger">
                            <div className="stat-card__value">37%</div>
                            <div className="stat-card__label">Weather Impact</div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

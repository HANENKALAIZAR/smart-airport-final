import { useState } from 'react';
import { BarChart3, TrendingUp, Clock, AlertTriangle, Plane } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const delayByHour = [
    { hour: '06', avg: 8 }, { hour: '07', avg: 12 }, { hour: '08', avg: 22 },
    { hour: '09', avg: 18 }, { hour: '10', avg: 15 }, { hour: '11', avg: 10 },
    { hour: '12', avg: 14 }, { hour: '13', avg: 16 }, { hour: '14', avg: 20 },
    { hour: '15', avg: 25 }, { hour: '16', avg: 35 }, { hour: '17', avg: 42 },
    { hour: '18', avg: 38 }, { hour: '19', avg: 30 }, { hour: '20', avg: 22 },
    { hour: '21', avg: 15 }, { hour: '22', avg: 10 },
];

const topRoutes = [
    { route: 'TUN → CDG', flights: 42, avgDelay: 18, onTime: 78 },
    { route: 'TUN → ORY', flights: 38, avgDelay: 12, onTime: 85 },
    { route: 'TUN → IST', flights: 28, avgDelay: 25, onTime: 68 },
    { route: 'TUN → FRA', flights: 21, avgDelay: 22, onTime: 72 },
    { route: 'TUN → DOH', flights: 14, avgDelay: 8, onTime: 92 },
    { route: 'TUN → DXB', flights: 12, avgDelay: 15, onTime: 80 },
];

const delayByWeather = [
    { condition: 'Clear', avgDelay: 6, percentage: 45 },
    { condition: 'Cloudy', avgDelay: 12, percentage: 25 },
    { condition: 'Light Rain', avgDelay: 22, percentage: 15 },
    { condition: 'Heavy Rain', avgDelay: 45, percentage: 8 },
    { condition: 'Fog', avgDelay: 52, percentage: 5 },
    { condition: 'Thunderstorm', avgDelay: 68, percentage: 2 },
];

const weeklyStats = [
    { day: 'Mon', flights: 124, delays: 28 },
    { day: 'Tue', flights: 118, delays: 22 },
    { day: 'Wed', flights: 130, delays: 35 },
    { day: 'Thu', flights: 126, delays: 30 },
    { day: 'Fri', flights: 142, delays: 42 },
    { day: 'Sat', flights: 98, delays: 15 },
    { day: 'Sun', flights: 110, delays: 20 },
];

export default function AdminAnalytics() {
    const { t } = useLanguage();
    const maxDelay = Math.max(...delayByHour.map(d => d.avg));

    return (
        <div className="admin-space-y-6">
            <div className="admin-page-header">
                <h1>{t('admin_analytics_title')}</h1>
                <p>{t('admin_analytics_subtitle')}</p>
            </div>

            {/* Summary Stats */}
            <div className="admin-grid-4">
                <div className="kpi-card">
                    <div className="kpi-card__header">
                        <div>
                            <p className="kpi-card__title">{t('admin_analytics_total_flights')}</p>
                            <span className="kpi-card__value">3,847</span>
                        </div>
                        <div className="kpi-card__icon"><Plane size={32} /></div>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-card__header">
                        <div>
                            <p className="kpi-card__title">{t('admin_analytics_on_time_rate')}</p>
                            <span className="kpi-card__value">76.3<span className="kpi-card__suffix">%</span></span>
                        </div>
                        <div className="kpi-card__icon"><TrendingUp size={32} /></div>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-card__header">
                        <div>
                            <p className="kpi-card__title">{t('admin_analytics_avg_delay')}</p>
                            <span className="kpi-card__value">18.5<span className="kpi-card__suffix">min</span></span>
                        </div>
                        <div className="kpi-card__icon"><Clock size={32} /></div>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-card__header">
                        <div>
                            <p className="kpi-card__title">{t('admin_analytics_cancellations')}</p>
                            <span className="kpi-card__value">23</span>
                        </div>
                        <div className="kpi-card__icon"><AlertTriangle size={32} /></div>
                    </div>
                </div>
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                {/* Delay by Hour - Bar Chart */}
                <div className="admin-card">
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart3 size={18} style={{ color: '#00C2FF' }} /> {t('admin_analytics_avg_delay_by_hour')}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200 }}>
                        {delayByHour.map(d => (
                            <div key={d.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: '0.625rem', color: '#6B7280' }}>{d.avg}</span>
                                <div style={{
                                    width: '100%', borderRadius: '3px 3px 0 0',
                                    height: `${(d.avg / maxDelay) * 160}px`,
                                    background: d.avg > 30 ? '#E53935' : d.avg > 20 ? '#FFB020' : '#00C2FF',
                                    transition: 'height 300ms ease',
                                }} />
                                <span style={{ fontSize: '0.625rem', color: '#6B7280' }}>{d.hour}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Weather Impact */}
                <div className="admin-card">
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                        {t('admin_analytics_weather_impact')}
                    </h3>
                    <div className="admin-space-y-3">
                        {delayByWeather.map(w => (
                            <div key={w.condition}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 4 }}>
                                    <span>{w.condition}</span>
                                    <span style={{ fontWeight: 600, color: w.avgDelay > 40 ? '#E53935' : w.avgDelay > 20 ? '#D97706' : '#2E7D32' }}>
                                        {w.avgDelay} min
                                    </span>
                                </div>
                                <div style={{ height: 6, background: '#F4F6F9', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${(w.avgDelay / 70) * 100}%`, height: '100%', borderRadius: 3,
                                        background: w.avgDelay > 40 ? '#E53935' : w.avgDelay > 20 ? '#FFB020' : '#2E7D32',
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Top Routes */}
                <div className="admin-card">
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>{t('admin_analytics_top_routes')}</h3>
                    <div className="admin-table-wrap" style={{ border: 'none' }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>{t('admin_analytics_route_col')}</th>
                                    <th>{t('admin_analytics_flights_col')}</th>
                                    <th>{t('admin_analytics_avg_delay_col')}</th>
                                    <th>{t('admin_analytics_on_time_col')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topRoutes.map(r => (
                                    <tr key={r.route}>
                                        <td style={{ fontWeight: 500 }}>{r.route}</td>
                                        <td>{r.flights}</td>
                                        <td style={{ color: r.avgDelay > 20 ? '#E53935' : '#1A1A1A' }}>{r.avgDelay} min</td>
                                        <td style={{ color: r.onTime > 80 ? '#2E7D32' : r.onTime > 70 ? '#D97706' : '#E53935', fontWeight: 500 }}>
                                            {r.onTime}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Weekly Summary */}
                <div className="admin-card">
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>{t('admin_analytics_weekly')}</h3>
                    <div className="admin-space-y-3">
                        {weeklyStats.map(w => {
                            const pct = ((w.delays / w.flights) * 100).toFixed(0);
                            return (
                                <div key={w.day}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 500 }}>{w.day}</span>
                                        <span style={{ color: '#6B7280' }}>{w.flights} flights • {w.delays} {t('admin_analytics_delayed')} ({pct}%)</span>
                                    </div>
                                    <div style={{ height: 6, background: '#F4F6F9', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${(w.flights / 150) * 100}%`, height: '100%', borderRadius: 3,
                                            background: 'linear-gradient(90deg, #00C2FF, #0A1F44)',
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

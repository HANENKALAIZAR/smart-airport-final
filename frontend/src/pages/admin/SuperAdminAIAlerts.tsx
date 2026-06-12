import { useEffect, useState, useCallback } from 'react';
import {
    Zap, CheckCircle, Clock, AlertTriangle, Navigation, TrendingUp,
    Users, RefreshCw, ChevronDown, User, Calendar, ShieldAlert
} from 'lucide-react';
import { apiGetAiAlerts } from '../../services/adminApi';
import { useAdminTheme } from '../../hooks/useAdminPrefs';
import { useLanguage } from '../../context/LanguageContext';

interface AIAlert {
    flight_number: string;
    airport_iata: string;
    airport_name: string;
    risk_pct: number;
    cause: string;
    recommendation: string;
    decision: string;
    acted_by_admin_name: string | null;
    decided_at: string | null;
    created_at: string | null;
    route?: string | null;
    delay_formatted?: string | null;
}

const AIRPORTS = ['ALL', 'TUN', 'MIR', 'DJE', 'NBE'] as const;
type AirportFilter = typeof AIRPORTS[number];

// Theme-aware color configurations for the airports
const AIRPORT_THEMES: Record<
    string,
    {
        dark: { bg: string; color: string; border: string };
        light: { bg: string; color: string; border: string };
    }
> = {
    TUN: {
        dark: { bg: 'rgba(59, 130, 246, 0.12)', color: '#60A5FA', border: 'rgba(59, 130, 246, 0.3)' },
        light: { bg: 'rgba(37, 99, 235, 0.08)', color: '#2563EB', border: 'rgba(37, 99, 235, 0.2)' }
    },
    MIR: {
        dark: { bg: 'rgba(139, 92, 246, 0.12)', color: '#A78BFA', border: 'rgba(139, 92, 246, 0.3)' },
        light: { bg: 'rgba(124, 58, 237, 0.08)', color: '#7C3AED', border: 'rgba(124, 58, 237, 0.2)' }
    },
    DJE: {
        dark: { bg: 'rgba(236, 72, 153, 0.12)', color: '#F472B6', border: 'rgba(236, 72, 153, 0.3)' },
        light: { bg: 'rgba(219, 39, 119, 0.08)', color: '#DB2677', border: 'rgba(219, 39, 119, 0.2)' }
    },
    NBE: {
        dark: { bg: 'rgba(20, 184, 166, 0.12)', color: '#2DD4BF', border: 'rgba(20, 184, 166, 0.3)' },
        light: { bg: 'rgba(13, 148, 136, 0.08)', color: '#0D9488', border: 'rgba(13, 148, 136, 0.2)' }
    },
    default: {
        dark: { bg: 'rgba(255, 255, 255, 0.08)', color: '#9CA3AF', border: 'rgba(255, 255, 255, 0.15)' },
        light: { bg: 'rgba(15, 23, 42, 0.06)', color: '#475569', border: 'rgba(15, 23, 42, 0.12)' }
    }
};

function formatDateTime(iso: string | null) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return `${dateStr}, ${timeStr}`;
    } catch {
        return '—';
    }
}

export default function SuperAdminAIAlerts({ selectedDate }: { selectedDate: Date }) {
    const { t } = useLanguage();
    const [theme] = useAdminTheme();
    const isLight = theme === 'light';

    const [alerts, setAlerts] = useState<AIAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<AirportFilter>('ALL');
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        const { data, error } = await apiGetAiAlerts('', 'approved');
        if (!error && data) {
            const sorted = [...data].sort((a, b) => {
                const timeA = new Date(a.decided_at || a.created_at || 0).getTime();
                const timeB = new Date(b.decided_at || b.created_at || 0).getTime();
                return timeB - timeA;
            });
            setAlerts(sorted);
            setLastRefreshed(new Date());
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchAlerts();
        const iv = setInterval(fetchAlerts, 30_000);
        return () => clearInterval(iv);
    }, [fetchAlerts]);

    const toggleExpand = (cardKey: string) => {
        setExpandedCards(prev => {
            const next = new Set(prev);
            next.has(cardKey) ? next.delete(cardKey) : next.add(cardKey);
            return next;
        });
    };

    const filteredAlerts = activeFilter === 'ALL'
        ? alerts
        : alerts.filter(a => a.airport_iata === activeFilter);

    const getCountForFilter = (filter: AirportFilter) => {
        if (filter === 'ALL') return alerts.length;
        return alerts.filter(a => a.airport_iata === filter).length;
    };

    return (
        <div className="ai-alerts-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div className="ai-alerts-panel__header" style={{ flexShrink: 0, borderBottom: '1px solid var(--adm-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Zap size={15} style={{ color: 'var(--adm-accent)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--adm-text)' }}>
                        {t('super_admin_title') || 'Approved AI Recommendations'}
                    </span>
                    {alerts.length > 0 && (
                        <span style={{
                            background: 'var(--adm-accent-light)',
                            color: 'var(--adm-accent)',
                            borderRadius: 999,
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            border: '1px solid var(--adm-accent-light)'
                        }}>
                            {t('super_admin_count', '{count} Approved', { count: String(alerts.length) })}
                        </span>
                    )}
                </div>
                <button onClick={fetchAlerts}
                    style={{ background: 'none', border: 'none', color: 'var(--adm-text-sub)', cursor: 'pointer', padding: 4, borderRadius: 6 }}
                    title={t('super_admin_refresh_title') || 'Refresh Feed'}>
                    <RefreshCw size={13} style={{ opacity: loading ? 0.4 : 1 }} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Airport Filter Tabs */}
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--adm-border)', display: 'flex', gap: 5, flexWrap: 'wrap', flexShrink: 0, background: 'rgba(255,255,255,0.01)' }}>
                {AIRPORTS.map(filter => {
                    const active = activeFilter === filter;
                    const count = getCountForFilter(filter);
                    return (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 9px',
                                borderRadius: 999,
                                border: `1px solid ${active ? 'var(--adm-accent)' : 'var(--adm-border)'}`,
                                background: active ? 'var(--adm-accent-light)' : 'transparent',
                                color: active ? 'var(--adm-accent)' : 'var(--adm-text-sub)',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                        >
                            <span>{filter}</span>
                            <span style={{
                                fontSize: '0.58rem',
                                background: active ? 'var(--adm-accent-glow)' : 'var(--adm-input-bg)',
                                color: active ? 'var(--adm-accent)' : 'var(--adm-text-sub)',
                                padding: '1px 4px',
                                borderRadius: 4,
                                minWidth: 12,
                                textAlign: 'center'
                            }}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Recommendations Feed List */}
            <div className="ai-alerts-panel__list" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                    {loading && alerts.length === 0 && (
                    <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: 'var(--adm-text-sub)', fontSize: '0.76rem' }}>
                        <RefreshCw size={18} style={{ opacity: 0.5, marginBottom: 8 }} className="animate-spin" /><br />
                        {t('super_admin_loading') || 'Loading approved recommendations...'}
                    </div>
                )}

                {!loading && filteredAlerts.length === 0 && (
                    <div className="ai-alerts-panel__empty" style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle size={24} style={{ color: '#22C55E', opacity: 0.8 }} />
                        <p style={{ fontWeight: 600, fontSize: '0.78rem', marginTop: 8, marginBottom: 4, color: 'var(--adm-text)' }}>
                            {t('super_admin_empty_title') || 'No approved recommendations found'}
                        </p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--adm-text-sub)', margin: 0, textAlign: 'center' }}>
                            {activeFilter === 'ALL'
                                ? (t('super_admin_empty_desc_all') || 'Operational recommendations approved by airport admins will appear here.')
                                : (t('super_admin_empty_desc_filter', 'No approvals have been recorded for {airport} yet.', { airport: activeFilter }))}
                        </p>
                    </div>
                )}

                {filteredAlerts.map((a, index) => {
                    const cardKey = `${a.airport_iata}-${a.flight_number}-${index}`;
                    const isExpanded = expandedCards.has(cardKey);
                    const riskKey = a.risk_pct >= 70 ? 'high' : a.risk_pct >= 40 ? 'medium' : 'low';

                    // Theme-aware risk parameters
                    const riskColor = riskKey === 'high' ? '#EF4444' : riskKey === 'medium' ? 'var(--adm-accent)' : '#22C55E';
                    const riskBg = riskKey === 'high' ? 'rgba(239, 68, 68, 0.08)' : riskKey === 'medium' ? 'var(--adm-accent-light)' : 'rgba(34, 197, 94, 0.06)';
                    const riskBorder = riskKey === 'high' ? 'rgba(239, 68, 68, 0.25)' : riskKey === 'medium' ? 'rgba(234, 88, 12, 0.25)' : 'rgba(34, 197, 94, 0.25)';
                    const riskLabel = riskKey === 'high' ? (t('super_admin_risk_high') || 'HIGH RISK') : riskKey === 'medium' ? (t('super_admin_risk_medium') || 'MODERATE') : (t('super_admin_risk_low') || 'LOW RISK');

                    const apTheme = AIRPORT_THEMES[a.airport_iata] || AIRPORT_THEMES.default;
                    const apColor = isLight ? apTheme.light : apTheme.dark;

                    return (
                        <div
                            key={cardKey}
                            style={{
                                background: 'var(--adm-card)',
                                border: '1px solid var(--adm-border)',
                                borderLeft: `4px solid ${riskColor}`,
                                borderRadius: 10,
                                padding: '10px 12px',
                                marginBottom: 10,
                                cursor: 'pointer',
                                transition: 'transform 0.15s, border-color 0.15s',
                                boxShadow: 'var(--adm-shadow)',
                            }}
                            onClick={() => toggleExpand(cardKey)}
                        >
                            {/* Card Top Section: Badges & Identifiers */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {/* Airport Badge */}
                                    <span style={{
                                        fontSize: '0.62rem',
                                        fontWeight: 800,
                                        background: apColor.bg,
                                        color: apColor.color,
                                        border: `1px solid ${apColor.border}`,
                                        padding: '1px 5px',
                                        borderRadius: 4,
                                        letterSpacing: '0.02em'
                                    }}>
                                        {t(`airport_${a.airport_iata}_name`, a.airport_iata)}
                                    </span>
                                    {/* Flight Badge */}
                                    <span style={{
                                        fontFamily: 'monospace',
                                        fontSize: '0.74rem',
                                        fontWeight: 700,
                                        color: 'var(--adm-text)',
                                        background: 'var(--adm-input-bg)',
                                        padding: '1px 5px',
                                        borderRadius: 4,
                                        border: '1px solid var(--adm-border)'
                                    }}>
                                        {a.flight_number}
                                    </span>
                                    {/* Route */}
                                    {a.route && (
                                        <span style={{ fontSize: '0.68rem', color: 'var(--adm-text-sub)', fontWeight: 600 }}>
                                            {a.route}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {/* Delay Info */}
                                    {a.delay_formatted && (
                                        <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            color: riskColor,
                                            background: riskBg,
                                            border: `1px solid ${riskBorder}`,
                                            padding: '1px 5px',
                                            borderRadius: 4,
                                        }}>
                                            {a.delay_formatted}
                                        </span>
                                    )}
                                    {/* Risk level badge */}
                                    <span style={{
                                        fontSize: '0.56rem',
                                        fontWeight: 800,
                                        color: riskColor,
                                        background: riskBg,
                                        border: `1px solid ${riskBorder}`,
                                        padding: '1px 5px',
                                        borderRadius: 999,
                                        letterSpacing: '0.04em'
                                    }}>
                                        {riskLabel}
                                    </span>
                                    <ChevronDown
                                        size={12}
                                        style={{
                                            color: 'var(--adm-text-sub)',
                                            transform: isExpanded ? 'rotate(180deg)' : 'none',
                                            transition: 'transform 0.2s',
                                            marginLeft: 2
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Situation Context */}
                            {a.cause && (
                                <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--adm-text-sub)', lineHeight: 1.45 }}>
                                    <span style={{ fontWeight: 600, color: 'var(--adm-text-muted)' }}>{t('super_admin_situation_label') || 'Situation:'} </span>
                                    {a.cause}
                                </div>
                            )}

                            {/* Collapsible Actionable Recommendation */}
                            <div style={{
                                marginTop: 8,
                                padding: '8px 10px',
                                background: 'var(--adm-input-bg)',
                                border: '1px solid var(--adm-border)',
                                borderRadius: 6,
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                    <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--adm-accent)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                        {t('super_admin_action_plan_label') || 'Approved Action Plan'}
                                    </span>
                                </div>
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.72rem',
                                    color: 'var(--adm-text)',
                                    lineHeight: 1.5,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: isExpanded ? 'none' : 2,
                                    WebkitBoxOrient: 'vertical',
                                }}>
                                    {a.recommendation}
                                </p>
                            </div>

                            {/* Card Footer: Metadata */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: 8,
                                paddingTop: 6,
                                borderTop: '1px solid var(--adm-border)',
                                fontSize: '0.6rem',
                                color: 'var(--adm-text-muted)'
                            }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <User size={10} style={{ opacity: 0.7 }} />
                                    <span style={{ color: 'var(--adm-text-sub)' }}>{a.acted_by_admin_name || 'System'} ({a.airport_name})</span>
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <Calendar size={10} style={{ opacity: 0.7 }} />
                                    <span style={{ color: 'var(--adm-text-sub)' }}>{formatDateTime(a.decided_at || a.created_at)}</span>
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer with last scanned date */}
            {lastRefreshed && (
                <div style={{ padding: '0.4rem 0.75rem', borderTop: '1px solid var(--adm-border)', fontSize: '0.62rem', color: 'var(--adm-text-muted)', flexShrink: 0, background: 'rgba(0,0,0,0.02)' }}>
                    {t('super_admin_footer_label') || 'Feed Active'} &middot; {t('super_admin_footer_updated', 'Updated {time}', { time: lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })}
                </div>
            )}
        </div>
    );
}

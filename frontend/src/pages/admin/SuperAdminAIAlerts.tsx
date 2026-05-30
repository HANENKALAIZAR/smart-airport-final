import { useEffect, useState, useCallback } from 'react';
import { Zap, CheckCircle, Clock, AlertTriangle, Navigation, TrendingUp, Users, RefreshCw, ChevronDown } from 'lucide-react';
import { useAirport } from '../../context/AirportContext';
import { apiGetAllAiSuggestions } from '../../services/adminApi';

interface Suggestion {
    id: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
    title: string;
    message: string;
    recommendedAction: string;
    flightNumber?: string | null;
    airportIata?: string | null;
    route?: string | null;
    predictedDelay?: number | null;
    createdAt: string;
    source: string;
}

interface SuggestionSummary {
    totalSuggestions: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    airportsScanned?: string[];
    generatedAt: string;
}

const PRIORITY_CONFIG = {
    high:   { color: '#EF4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.22)',  label: 'HIGH' },
    medium: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)', label: 'MED' },
    low:    { color: '#22C55E', bg: 'rgba(34,197,94,0.06)',  border: 'rgba(34,197,94,0.18)',  label: 'LOW' },
};

const CATEGORY_ICONS: Record<string, any> = {
    delay:               AlertTriangle,
    coordination:        Users,
    congestion:          TrendingUp,
    prediction:          Zap,
    route_reliability:   Navigation,
    airline_reliability: Navigation,
    operational:         Clock,
};

function formatDelay(min: number | null | undefined) {
    if (!min) return null;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string) {
    try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
    catch { return '—'; }
}

/**
 * SuperAdminAIAlerts
 * ===================
 * Displays AI Operational Suggestions across all Tunisian airports for super admin.
 * Suggestions are generated from real DB conditions — no hardcoded text.
 */
export default function SuperAdminAIAlerts() {
    const { selectedAirport } = useAirport();
    const airportIata = selectedAirport?.iata || '';

    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [summary, setSummary] = useState<SuggestionSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');

    const fetchSuggestions = useCallback(async () => {
        setLoading(true);
        const iata = airportIata || null;
        const { data, error } = await apiGetAllAiSuggestions(iata, null);
        if (!error && data) {
            setSuggestions(data.suggestions || []);
            setSummary(data.summary || null);
        }
        setLoading(false);
    }, [airportIata]);

    useEffect(() => {
        fetchSuggestions();
        const iv = setInterval(fetchSuggestions, 300_000);
        return () => clearInterval(iv);
    }, [fetchSuggestions]);

    const toggleExpanded = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const visible = filterPriority === 'all'
        ? suggestions
        : suggestions.filter(s => s.priority === filterPriority);

    const highCount = (summary?.highPriority) || 0;

    return (
        <div className="ai-alerts-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div className="ai-alerts-panel__header" style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Zap size={15} style={{ color: '#F59E0B' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>AI Operational Suggestions</span>
                    {highCount > 0 && (
                        <span style={{
                            background: '#EF4444', color: '#fff', borderRadius: 999,
                            fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', minWidth: 18, textAlign: 'center'
                        }}>{highCount}</span>
                    )}
                </div>
                <button onClick={fetchSuggestions}
                    style={{ background: 'none', border: 'none', color: 'var(--adm-text-sub)', cursor: 'pointer', padding: 4, borderRadius: 6 }}
                    title="Refresh">
                    <RefreshCw size={13} style={{ opacity: loading ? 0.4 : 1 }} />
                </button>
            </div>

            {/* Priority filter */}
            {summary && (
                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--adm-border)', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
                    {(['all', 'high', 'medium', 'low'] as const).map(p => {
                        const cfg = p === 'all' ? null : PRIORITY_CONFIG[p];
                        const count = p === 'all' ? summary.totalSuggestions
                            : p === 'high' ? summary.highPriority
                            : p === 'medium' ? summary.mediumPriority
                            : summary.lowPriority;
                        const active = filterPriority === p;
                        return (
                            <button key={p} onClick={() => setFilterPriority(p)} style={{
                                padding: '2px 8px', borderRadius: 999,
                                border: `1px solid ${active ? (cfg?.border || 'var(--adm-accent)') : 'var(--adm-border)'}`,
                                background: active ? (cfg?.bg || 'rgba(245,158,11,0.08)') : 'transparent',
                                color: active ? (cfg?.color || 'var(--adm-accent)') : 'var(--adm-text-sub)',
                                fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em'
                            }}>
                                {p === 'all' ? `All (${count})` : `${p} (${count})`}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* List */}
            <div className="ai-alerts-panel__list" style={{ flex: 1, overflowY: 'auto' }}>
                {loading && (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--adm-text-sub)', fontSize: '0.78rem' }}>
                        <RefreshCw size={18} style={{ opacity: 0.4, marginBottom: 8 }} /><br />
                        Scanning all airports…
                    </div>
                )}

                {!loading && visible.length === 0 && (
                    <div className="ai-alerts-panel__empty">
                        <CheckCircle size={24} style={{ color: '#22C55E' }} />
                        <p style={{ fontWeight: 600, marginTop: 8, marginBottom: 4 }}>No operational AI suggestions</p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--adm-text-sub)', margin: 0 }}>
                            No AI suggestions for the selected period.
                        </p>
                    </div>
                )}

                {!loading && visible.map(s => {
                    const cfg = PRIORITY_CONFIG[s.priority] || PRIORITY_CONFIG.low;
                    const Icon = CATEGORY_ICONS[s.category] || AlertTriangle;
                    const isExpanded = expanded.has(s.id);
                    const delayStr = formatDelay(s.predictedDelay);

                    return (
                        <div key={s.id}
                            className="ai-alert-card"
                            style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, cursor: 'pointer' }}
                            onClick={() => toggleExpanded(s.id)}>
                            {/* Top row */}
                            <div className="ai-alert-card__top" style={{ gap: 8, alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                    <Icon size={13} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
                                    <div>
                                        <span className="ai-alert-card__title" style={{ color: 'var(--adm-text)', fontWeight: 700, fontSize: '0.76rem', lineHeight: 1.3 }}>
                                            {s.title}
                                        </span>
                                        {s.airportIata && (
                                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--adm-text-sub)', marginTop: 1 }}>
                                                {s.airportIata}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                    {delayStr && (
                                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: cfg.color, padding: '1px 5px', borderRadius: 5, border: `1px solid ${cfg.border}` }}>
                                            +{delayStr}
                                        </span>
                                    )}
                                    <span style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.07em', color: cfg.color, padding: '1px 5px', borderRadius: 999, border: `1px solid ${cfg.border}`, textTransform: 'uppercase' }}>
                                        {cfg.label}
                                    </span>
                                    <ChevronDown size={11} style={{ color: 'var(--adm-text-sub)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                </div>
                            </div>

                            {/* Context tags */}
                            {(s.flightNumber || s.route) && (
                                <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                                    {s.flightNumber && (
                                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--adm-text-sub)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--adm-border)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>
                                            {s.flightNumber}
                                        </span>
                                    )}
                                    {s.route && (
                                        <span style={{ fontSize: '0.62rem', color: 'var(--adm-text-sub)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--adm-border)', padding: '1px 5px', borderRadius: 4 }}>
                                            {s.route}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Situation */}
                            <div className="ai-alert-card__issue" style={{ marginTop: 8, fontSize: '0.71rem', lineHeight: 1.5, color: 'var(--adm-text-sub)' }}>
                                {s.message}
                            </div>

                            {/* Expanded action */}
                            {isExpanded && (
                                <div style={{ marginTop: 8, padding: '7px 9px', background: 'rgba(255,255,255,0.04)', borderRadius: 7, border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
                                        Recommended Action
                                    </span>
                                    <span style={{ fontSize: '0.71rem', color: 'var(--adm-text)', lineHeight: 1.55 }}>
                                        {s.recommendedAction}
                                    </span>
                                </div>
                            )}

                            {/* Footer */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                                <span style={{ fontSize: '0.6rem', color: 'var(--adm-text-sub)', opacity: 0.55 }}>
                                    {s.source} · {formatTime(s.createdAt)}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

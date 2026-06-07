import { useState, useEffect, useCallback } from 'react';
import {
    AlertTriangle, CheckCircle, Clock, TrendingUp,
    Navigation, Users, Zap, RefreshCw, ChevronDown,
    ThumbsUp, ThumbsDown, X
} from 'lucide-react';
import { apiGetAiSuggestions, apiAiAlertGenerated, apiAiAlertAction } from '../../services/adminApi';
import { useAirport } from '../../context/AirportContext';
import { useLanguage } from '../../context/LanguageContext';

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
    airportIata?: string;
    airportName?: string;
    generatedAt: string;
}

type WorkflowStatus = 'suggested' | 'approved' | 'rejected';
type WorkflowFilter = 'all' | WorkflowStatus;

const PRIORITY_CONFIG = {
    high:   { color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.22)',  label: 'HIGH',   dot: '#EF4444',  order: 0 },
    medium: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.22)', label: 'MEDIUM', dot: '#F59E0B',  order: 1 },
    low:    { color: '#22C55E', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.22)',  label: 'LOW',    dot: '#22C55E',  order: 2 },
};

const WORKFLOW_CONFIG: Record<WorkflowStatus, { color: string; bg: string; border: string; labelKey: string; defaultLabel: string }> = {
    suggested: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', labelKey: 'ai_suggestions_suggested', defaultLabel: 'Suggéré' },
    approved:  { color: '#22C55E', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  labelKey: 'ai_suggestions_approved', defaultLabel: 'Approuvé' },
    rejected:  { color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', labelKey: 'ai_suggestions_rejected', defaultLabel: 'Rejeté' },
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

function formatDelay(min: number | null | undefined): string | null {
    if (min == null || min <= 0) return null;
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0 && m > 0) return `+${h}h ${m}min`;
    if (h > 0) return `+${h}h`;
    return `+${m}min`;
}

function formatTime(iso: string) {
    try {
        return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
}

/**
 * AirportAdminAIAlerts
 * ====================
 * Displays AI Operational Suggestions for the airport admin's airport.
 * Workflow filters: All / Suggested / Approved / Rejected
 * Admin can approve or reject each suggestion.
 * Approved suggestions notify all super admins.
 */
export default function AirportAdminAIAlerts({ selectedDate }: { selectedDate: Date }) {
    const { selectedAirport } = useAirport();
    const { t } = useLanguage();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [summary, setSummary] = useState<SuggestionSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>('all');
    const [decisionMap, setDecisionMap] = useState<Record<string, WorkflowStatus>>({});
    const [pendingAction, setPendingAction] = useState<Record<string, boolean>>({});
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const fetchSuggestions = useCallback(async () => {
        setLoading(true);
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const { data, error } = await apiGetAiSuggestions(dateStr);
        if (!error && data) {
            setSuggestions(data.suggestions || []);
            setSummary(data.summary || null);
            setLastRefreshed(new Date());
        }
        setLoading(false);
    }, [selectedDate]);

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

    const getWorkflowStatus = (s: Suggestion): WorkflowStatus => decisionMap[s.id] || 'suggested';

    const handleApprove = async (s: Suggestion, e: React.MouseEvent) => {
        e.stopPropagation();
        setPendingAction(prev => ({ ...prev, [s.id]: true }));

        try {
            // 1. Register the alert in the system
            const airportIata = selectedAirport?.iata || s.airportIata || '';
            await apiAiAlertGenerated({
                flight_number: s.flightNumber || 'N/A',
                brief_cause: s.message,
                recommendation: s.recommendedAction,
                risk_pct: s.priority === 'high' ? 85 : s.priority === 'medium' ? 55 : 25,
                route: s.route || '',
                delay_formatted: formatDelay(s.predictedDelay) || '0 min',
            });

            // 2. Record the approval decision + ping super admins
            await apiAiAlertAction({
                flight_number: s.flightNumber || 'N/A',
                action: 'approved',
                route: s.route || '',
                delay_formatted: formatDelay(s.predictedDelay) || '0 min',
                recommendation: s.recommendedAction,
            });

            setDecisionMap(prev => ({ ...prev, [s.id]: 'approved' }));
        } catch (err) {
            console.error('Approve failed', err);
        } finally {
            setPendingAction(prev => ({ ...prev, [s.id]: false }));
        }
    };

    const handleReject = (s: Suggestion, e: React.MouseEvent) => {
        e.stopPropagation();
        setDecisionMap(prev => ({ ...prev, [s.id]: 'rejected' }));
    };

    // Sort: suggested → approved → rejected, within each group high→medium→low, then delay desc
    const workflowOrder: WorkflowStatus[] = ['suggested', 'approved', 'rejected'];
    const sortedSuggestions = [...suggestions].sort((a, b) => {
        const wA = workflowOrder.indexOf(getWorkflowStatus(a));
        const wB = workflowOrder.indexOf(getWorkflowStatus(b));
        if (wA !== wB) return wA - wB;
        const pA = (PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.low).order;
        const pB = (PRIORITY_CONFIG[b.priority] || PRIORITY_CONFIG.low).order;
        if (pA !== pB) return pA - pB;
        return (b.predictedDelay || 0) - (a.predictedDelay || 0);
    });

    const visible = workflowFilter === 'all'
        ? sortedSuggestions
        : sortedSuggestions.filter(s => getWorkflowStatus(s) === workflowFilter);

    const countByStatus = (status: WorkflowStatus) =>
        sortedSuggestions.filter(s => getWorkflowStatus(s) === status).length;

    const highCount = suggestions.filter(s => s.priority === 'high').length;

    const filterTabs: { key: WorkflowFilter; labelKey: string; defaultLabel: string; count: number }[] = [
        { key: 'all',       labelKey: 'ai_suggestions_all',      defaultLabel: 'Tous',      count: suggestions.length },
        { key: 'suggested', labelKey: 'ai_suggestions_suggested',  defaultLabel: 'Suggéré',   count: countByStatus('suggested') },
        { key: 'approved',  labelKey: 'ai_suggestions_approved',   defaultLabel: 'Approuvé',  count: countByStatus('approved') },
        { key: 'rejected',  labelKey: 'ai_suggestions_rejected',   defaultLabel: 'Rejeté',    count: countByStatus('rejected') },
    ];

    return (
        <div className="ai-alerts-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div className="ai-alerts-panel__header" style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Zap size={15} style={{ color: '#F59E0B' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{t('ai_suggestions_title') || 'Suggestions IA Opérationnelles'}</span>
                    {highCount > 0 && (
                        <span style={{
                            background: '#EF4444', color: '#fff', borderRadius: 999,
                            fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', minWidth: 18, textAlign: 'center'
                        }}>{highCount}</span>
                    )}
                </div>
                <button
                    onClick={fetchSuggestions}
                    style={{ background: 'none', border: 'none', color: 'var(--adm-text-sub)', cursor: 'pointer', padding: 4, borderRadius: 6 }}
                    title={t('refresh') || 'Actualiser les suggestions'}
                >
                    <RefreshCw size={13} style={{ opacity: loading ? 0.4 : 1 }} />
                </button>
            </div>

            {/* Workflow filter tabs */}
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--adm-border)', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
                {filterTabs.map(tab => {
                    const active = workflowFilter === tab.key;
                    const wCfg = tab.key !== 'all' ? WORKFLOW_CONFIG[tab.key as WorkflowStatus] : null;
                    return (
                        <button key={tab.key} onClick={() => setWorkflowFilter(tab.key)}
                            style={{
                                padding: '2px 10px', borderRadius: 999,
                                border: `1px solid ${active ? (wCfg?.border || 'rgba(245,158,11,0.4)') : 'var(--adm-border)'}`,
                                background: active ? (wCfg?.bg || 'rgba(245,158,11,0.1)') : 'transparent',
                                color: active ? (wCfg?.color || '#F59E0B') : 'var(--adm-text-sub)',
                                fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer',
                                letterSpacing: '0.03em', transition: 'all 0.15s',
                            }}>
                            {t(tab.labelKey) || tab.defaultLabel} ({tab.count})
                        </button>
                    );
                })}
            </div>

            {/* Suggestion list */}
            <div className="ai-alerts-panel__list" style={{ flex: 1, overflowY: 'auto' }}>
                {loading && (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--adm-text-sub)', fontSize: '0.78rem' }}>
                        <RefreshCw size={18} style={{ opacity: 0.4, marginBottom: 8 }} /><br />
                        {t('ai_suggestions_scanning') || 'Analyse des données opérationnelles…'}
                    </div>
                )}

                {!loading && visible.length === 0 && (
                    <div className="ai-alerts-panel__empty">
                        <CheckCircle size={24} style={{ color: '#22C55E' }} />
                        <p style={{ fontWeight: 600, marginTop: 8, marginBottom: 4 }}>
                            {workflowFilter === 'all'
                                ? (t('ai_suggestions_empty_all') || 'Aucune suggestion opérationnelle en direct')
                                : (t('ai_suggestions_empty_filtered') || 'Aucune suggestion dans ce statut pour le moment.')}
                        </p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--adm-text-sub)', margin: 0 }}>
                            {workflowFilter === 'all'
                                ? (t('ai_suggestions_empty_desc') || 'Les suggestions apparaîtront dès que des données temps réel seront disponibles.')
                                : (t('ai_suggestions_empty_filtered') || 'Aucune recommandation dans ce statut pour le moment.')}
                        </p>
                    </div>
                )}

                {!loading && visible.map(s => {
                    const cfg = PRIORITY_CONFIG[s.priority] || PRIORITY_CONFIG.low;
                    const Icon = CATEGORY_ICONS[s.category] || AlertTriangle;
                    const isExpanded = expanded.has(s.id);
                    const delayStr = formatDelay(s.predictedDelay);
                    const workflowStatus = getWorkflowStatus(s);
                    const wCfg = WORKFLOW_CONFIG[workflowStatus];
                    const isActing = pendingAction[s.id];
                    const isSuggested = workflowStatus === 'suggested';

                    return (
                        <div key={s.id}
                            className="ai-alert-card"
                            style={{
                                background: workflowStatus === 'rejected'
                                    ? 'rgba(107,114,128,0.05)'
                                    : cfg.bg,
                                border: `1px solid ${workflowStatus === 'rejected' ? 'rgba(107,114,128,0.2)' : cfg.border}`,
                                cursor: 'pointer',
                                opacity: workflowStatus === 'rejected' ? 0.75 : 1,
                                transition: 'opacity 0.2s',
                            }}
                            onClick={() => toggleExpanded(s.id)}>

                            {/* Top row */}
                            <div className="ai-alert-card__top" style={{ gap: 8, alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                    <Icon size={13} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
                                    <span className="ai-alert-card__title" style={{
                                        color: 'var(--adm-text)', fontWeight: 700,
                                        fontSize: '0.77rem', lineHeight: 1.3,
                                        textDecoration: workflowStatus === 'rejected' ? 'line-through' : 'none',
                                    }}>
                                        {s.title}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                    {delayStr && (
                                        <span style={{
                                            fontSize: '0.65rem', fontWeight: 700, color: cfg.color,
                                            background: cfg.bg, border: `1px solid ${cfg.border}`,
                                            padding: '1px 5px', borderRadius: 6,
                                        }}>
                                            {delayStr}
                                        </span>
                                    )}
                                    {/* Priority badge */}
                                    <span style={{
                                        fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em',
                                        color: cfg.color, padding: '1px 5px', borderRadius: 999,
                                        border: `1px solid ${cfg.border}`, textTransform: 'uppercase'
                                    }}>{cfg.label}</span>
                                    {/* Workflow status badge */}
                                    <span style={{
                                        fontSize: '0.6rem', fontWeight: 700,
                                        color: wCfg.color, padding: '1px 6px', borderRadius: 999,
                                        border: `1px solid ${wCfg.border}`,
                                        background: wCfg.bg,
                                    }}>{t(wCfg.labelKey) || wCfg.defaultLabel}</span>
                                    <ChevronDown size={12} style={{ color: 'var(--adm-text-sub)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                </div>
                            </div>

                            {/* Context tags */}
                            {(s.flightNumber || s.route) && (
                                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                    {s.flightNumber && (
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--adm-text-sub)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--adm-border)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                                            {s.flightNumber}
                                        </span>
                                    )}
                                    {s.route && (
                                        <span style={{ fontSize: '0.65rem', color: 'var(--adm-text-sub)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--adm-border)', padding: '1px 6px', borderRadius: 4 }}>
                                            {s.route}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Situation message */}
                            <div className="ai-alert-card__issue" style={{ marginTop: 8, fontSize: '0.73rem', lineHeight: 1.5, color: 'var(--adm-text-sub)' }}>
                                {s.message}
                            </div>

                            {/* Expanded: recommended action + approve/reject */}
                            {isExpanded && (
                                <div style={{ marginTop: 8 }}>
                                    <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 7, border: '1px solid rgba(255,255,255,0.06)', marginBottom: isSuggested ? 10 : 0 }}>
                                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
                                            {t('ai_suggestions_action_recommended') || 'Action recommandée'}
                                        </span>
                                        <span style={{ fontSize: '0.73rem', color: 'var(--adm-text)', lineHeight: 1.55 }}>
                                            {s.recommendedAction}
                                        </span>
                                    </div>

                                    {/* Action buttons — only for suggested */}
                                    {isSuggested && (
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={e => handleApprove(s, e)}
                                                disabled={isActing}
                                                style={{
                                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                    padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.4)',
                                                    background: isActing ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.1)',
                                                    color: '#22C55E', fontSize: '0.73rem', fontWeight: 700,
                                                    cursor: isActing ? 'not-allowed' : 'pointer',
                                                    opacity: isActing ? 0.6 : 1, transition: 'all 0.15s',
                                                }}
                                            >
                                                <ThumbsUp size={12} />
                                                {isActing ? (t('loading') || 'En cours…') : (t('ai_suggestions_approve_btn') || 'Approuver')}
                                            </button>
                                            <button
                                                onClick={e => handleReject(s, e)}
                                                disabled={isActing}
                                                style={{
                                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                    padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(107,114,128,0.3)',
                                                    background: 'rgba(107,114,128,0.08)',
                                                    color: '#9CA3AF', fontSize: '0.73rem', fontWeight: 700,
                                                    cursor: isActing ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                <X size={12} />
                                                {t('ai_suggestions_reject_btn') || 'Rejeter'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Approved / Rejected state message */}
                                    {workflowStatus === 'approved' && (
                                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
                                            <CheckCircle size={13} style={{ color: '#22C55E', flexShrink: 0 }} />
                                            <span style={{ fontSize: '0.71rem', color: '#22C55E', fontWeight: 600 }}>
                                                {t('ai_suggestions_status_approved') || 'Approuvé — Super Admin notifié'}
                                            </span>
                                        </div>
                                    )}
                                    {workflowStatus === 'rejected' && (
                                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.2)' }}>
                                            <X size={13} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                                            <span style={{ fontSize: '0.71rem', color: '#9CA3AF', fontWeight: 600 }}>
                                                {t('ai_suggestions_status_rejected') || 'Rejeté — Non transmis au Super Admin'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Footer */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                <span style={{ fontSize: '0.62rem', color: 'var(--adm-text-sub)', opacity: 0.6 }}>
                                    {s.source} · {formatTime(s.createdAt)}
                                </span>
                                {!isExpanded && isSuggested && (
                                    <span style={{ fontSize: '0.62rem', color: '#F59E0B', opacity: 0.8 }}>
                                        {t('ai_suggestions_open_action') || 'Ouvrir pour agir →'}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Last refreshed footer */}
            {lastRefreshed && !loading && (
                <div style={{ padding: '0.4rem 0.75rem', borderTop: '1px solid var(--adm-border)', fontSize: '0.62rem', color: 'var(--adm-text-sub)', flexShrink: 0 }}>
                    {t('ai_suggestions_footer_label') || 'IA Opérationnelle'} · {lastRefreshed.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
            )}
        </div>
    );
}

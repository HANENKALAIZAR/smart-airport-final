import { useState, useEffect, useCallback } from 'react';
import {
    AlertTriangle, CheckCircle, Clock, TrendingUp,
    Navigation, Users, Zap, RefreshCw, ChevronDown,
    ThumbsUp, ThumbsDown, X
} from 'lucide-react';
import { apiGetAiSuggestions, apiDecideSuggestion, apiGetSuggestionDecisions } from '../../services/adminApi';
import { useAirport } from '../../context/AirportContext';
import { useLanguage } from '../../context/LanguageContext';

interface Suggestion {
    id: string;
    key: string;
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
    structured?: Record<string, any>;
}

interface DecisionRecord {
    id: number;
    suggestionKey: string;
    airportIata: string;
    suggestionType: string;
    status: 'approved' | 'rejected';
    adminUserId: number | null;
    adminName: string | null;
    timestamp: string;
    suggestionPayload: Record<string, any> | null;
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
    suggested: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', labelKey: 'ai_suggestions_suggested', defaultLabel: 'Pending' },
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

function formatDelayStr(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function formatTime(iso: string) {
    try {
        return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
}

function localizeSuggestion(s: Suggestion, t: (key: string, fallback?: string, vars?: Record<string, any>) => string) {
    const str = s.structured || {};
    const cat = s.category;

    // ── Priority label ──
    const priorityLabel = t(`priority_${s.priority}`, s.priority.toUpperCase());

    // ── Source label ──
    const sourceLabel = t('suggestion_source_label', s.source);

    // ── Category label ──
    const categoryLabel = t(`suggestion_category_${cat}`, cat);

    // ── Delay formatting helper ──
    const delayMin = s.predictedDelay ?? str.delay_minutes ?? str.predicted_delay_min ?? null;

    // ── Localize title ──
    let title: string;
    switch (cat) {
        case 'delay':
            title = t('suggestion_title_delay', s.title, { flightNumber: s.flightNumber || '' });
            break;
        case 'coordination': {
            const count = str.delayed_count ?? 0;
            title = count >= 3
                ? t('suggestion_title_coordination_many', s.title)
                : t('suggestion_title_coordination_two', s.title);
            break;
        }
        case 'congestion': {
            const hour = str.current_hour ?? '';
            title = (str.active_in_window ?? 0) >= 8
                ? t('suggestion_title_congestion_high', s.title, { hour })
                : t('suggestion_title_congestion_moderate', s.title, { hour });
            break;
        }
        case 'prediction':
            title = t('suggestion_title_prediction', s.title, { flightNumber: s.flightNumber || '' });
            break;
        case 'route_reliability':
            title = t('suggestion_title_route_reliability', s.title, { route: s.route || str.route || '' });
            break;
        case 'airline_reliability':
            title = t('suggestion_title_airline_reliability', s.title, { airline: s.flightNumber || str.airline || '' });
            break;
        case 'operational':
            title = t('suggestion_title_stalled', s.title, { flightNumber: s.flightNumber || '' });
            break;
        default:
            title = s.title;
    }

    // ── Localize message ──
    let message: string;
    const delayStr2 = delayMin != null ? formatDelayStr(delayMin) : '';
    const airportName = s.airportIata || '';
    const histRate = str.hist_delay_rate ? String(Math.round(str.hist_delay_rate * 100)) : '';
    const histNote = histRate ? t('suggestion_hist_note', '', { rate: histRate }) : '';

    switch (cat) {
        case 'delay': {
            const dir = t(`direction_${str.direction || 'departure'}`, str.direction || 'departure');
            const other = str.other_delays_count ?? 0;
            if (str.gate) {
                message = t('suggestion_message_delay_with_gate', s.message, {
                    flightNumber: s.flightNumber || '', route: s.route || '', delay: delayStr2,
                    direction: dir, otherCount: String(other), histNote, gate: str.gate,
                });
            } else {
                message = t('suggestion_message_delay_no_gate', s.message, {
                    flightNumber: s.flightNumber || '', route: s.route || '', delay: delayStr2,
                    direction: dir, otherCount: String(other), histNote,
                });
            }
            break;
        }
        case 'coordination': {
            const count = str.delayed_count ?? 0;
            if (count >= 3) {
                message = t('suggestion_message_coordination_many', s.message, {
                    count: String(count), airport: airportName,
                    depCount: String(str.dep_count ?? 0), arrCount: String(str.arr_count ?? 0),
                });
            } else {
                message = t('suggestion_message_coordination_two', s.message, { airport: airportName });
            }
            break;
        }
        case 'congestion': {
            const count = str.active_in_window ?? 0;
            const depC = str.dep_count ?? 0;
            const arrC = str.arr_count ?? 0;
            const hour2 = str.current_hour ?? 0;
            const endH = (Number(hour2) + 2) % 24;
            if (count >= 8) {
                const gates = str.active_gates ?? 0;
                message = t('suggestion_message_congestion_high', s.message, {
                    count: String(count), airport: airportName,
                    depCount: String(depC), arrCount: String(arrC),
                    gateCount: String(gates), startHour: String(hour2).padStart(2, '0'),
                    endHour: String(endH).padStart(2, '0'),
                });
            } else if (count >= 5) {
                message = t('suggestion_message_congestion_medium', s.message, {
                    count: String(count), airport: airportName,
                    startHour: String(hour2).padStart(2, '0'),
                    endHour: String(endH).padStart(2, '0'),
                });
            } else {
                message = t('suggestion_message_congestion_low', s.message, {
                    count: String(count), airport: airportName,
                });
            }
            break;
        }
        case 'prediction': {
            const conf = str.confidence ?? 0;
            const time = str.scheduled_departure ?? '?';
            let gateCtx = '';
            if (str.gate) {
                gateCtx = t('suggestion_gate_ctx', '', { gate: str.gate });
            } else if (str.terminal) {
                gateCtx = t('suggestion_terminal_ctx', '', { terminal: str.terminal });
            }
            message = t('suggestion_message_prediction', s.message, {
                delay: delayStr2, flightNumber: s.flightNumber || '',
                route: s.route || '', time, confidence: String(conf),
                gateCtx, histNote,
            });
            break;
        }
        case 'route_reliability': {
            const avgD = str.avg_delay_min ?? 0;
            const avgStr2 = formatDelayStr(avgD);
            message = t('suggestion_message_route_reliability', s.message, {
                route: s.route || '', rate: String(str.delay_rate_pct ?? 0),
                avgDelay: avgStr2, totalFlights: String(str.total_flights ?? 0),
                todayCount: String(str.today_count ?? 0), airport: airportName,
            });
            break;
        }
        case 'airline_reliability': {
            message = t('suggestion_message_airline_reliability', s.message, {
                airline: s.flightNumber || '', rate: String(str.delay_rate_pct ?? 0),
                totalFlights: String(str.total_flights ?? 0),
                todayCount: String(str.today_count ?? 0), airport: airportName,
            });
            break;
        }
        case 'operational': {
            const ageMin = str.age_minutes ?? 0;
            const hh = Math.floor(ageMin / 60);
            const mm = ageMin % 60;
            message = t('suggestion_message_stalled', s.message, {
                flightNumber: s.flightNumber || '', status: str.status || '',
                hours: String(hh), minutes: String(mm),
            });
            break;
        }
        default:
            message = s.message;
    }

    // ── Localize recommended action ──
    let action: string;
    switch (cat) {
        case 'delay':
            action = str.gate
                ? t('suggestion_action_delay_with_gate', s.recommendedAction, { gate: str.gate })
                : t('suggestion_action_delay_no_gate', s.recommendedAction);
            break;
        case 'coordination': {
            const count = str.delayed_count ?? 0;
            action = count >= 3
                ? t('suggestion_action_coordination_many', s.recommendedAction)
                : t('suggestion_action_coordination_two', s.recommendedAction);
            break;
        }
        case 'congestion': {
            const count = str.active_in_window ?? 0;
            if (count >= 8) action = t('suggestion_action_congestion_high', s.recommendedAction);
            else if (count >= 5) action = t('suggestion_action_congestion_medium', s.recommendedAction);
            else action = t('suggestion_action_congestion_low', s.recommendedAction);
            break;
        }
        case 'prediction':
            action = str.gate
                ? t('suggestion_action_prediction_with_gate', s.recommendedAction, { flightNumber: s.flightNumber || '', delay: delayStr2 })
                : t('suggestion_action_prediction_no_gate', s.recommendedAction);
            break;
        case 'route_reliability':
            action = t('suggestion_action_route_reliability', s.recommendedAction, { route: s.route || '' });
            break;
        case 'airline_reliability':
            action = t('suggestion_action_airline_reliability', s.recommendedAction, { airline: s.flightNumber || '' });
            break;
        case 'operational':
            action = t('suggestion_action_stalled', s.recommendedAction);
            break;
        default:
            action = s.recommendedAction;
    }

    return { title, message, recommendedAction: action, priorityLabel, sourceLabel, categoryLabel };
}

export default function AirportAdminAIAlerts({ selectedDate }: { selectedDate: Date }) {
    const { selectedAirport } = useAirport();
    const { t } = useLanguage();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [decisions, setDecisions] = useState<Record<string, WorkflowStatus>>({});
    const [summary, setSummary] = useState<SuggestionSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>('all');
    const [pendingAction, setPendingAction] = useState<Record<string, boolean>>({});
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const dateStr = useCallback(() => {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, [selectedDate]);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const ds = dateStr();

        // Fetch pending suggestions AND persisted decisions in parallel
        const [sugResult, decResult] = await Promise.all([
            apiGetAiSuggestions(ds),
            apiGetSuggestionDecisions(ds),
        ]);

        if (!sugResult.error && sugResult.data) {
            setSuggestions(sugResult.data.suggestions || []);
            setSummary(sugResult.data.summary || null);
        }

        // Build decision map from persisted DB records
        const decisionMap: Record<string, WorkflowStatus> = {};
        if (!decResult.error && Array.isArray(decResult.data)) {
            for (const d of decResult.data as DecisionRecord[]) {
                decisionMap[d.suggestionKey] = d.status;
            }
        }
        setDecisions(decisionMap);

        setLastRefreshed(new Date());
        setLoading(false);
    }, [dateStr]);

    useEffect(() => {
        fetchAll();
        const iv = setInterval(fetchAll, 300_000);
        return () => clearInterval(iv);
    }, [fetchAll]);

    const toggleExpanded = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const getWorkflowStatus = (s: Suggestion): WorkflowStatus => {
        return decisions[s.key] || 'suggested';
    };

    const handleApprove = async (s: Suggestion, e: React.MouseEvent) => {
        e.stopPropagation();
        setPendingAction(prev => ({ ...prev, [s.id]: true }));

        try {
            const airportIata = selectedAirport?.iata || s.airportIata || '';
            const loc = localizeSuggestion(s, t);
            const payload = {
                suggestion_key: s.key,
                airport_iata: airportIata,
                suggestion_type: s.category,
                status: 'approved',
                suggestion_payload: {
                    title: loc.title,
                    message: loc.message,
                    recommendedAction: loc.recommendedAction,
                    priority: s.priority,
                    flightNumber: s.flightNumber,
                    route: s.route,
                    predictedDelay: s.predictedDelay,
                },
            };

            const { error } = await apiDecideSuggestion(payload);
            if (error) {
                console.error('Approve failed', error);
                return;
            }

            // Update local decision map with persisted status
            setDecisions(prev => ({ ...prev, [s.key]: 'approved' }));
        } catch (err) {
            console.error('Approve failed', err);
        } finally {
            setPendingAction(prev => ({ ...prev, [s.id]: false }));
        }
    };

    const handleReject = async (s: Suggestion, e: React.MouseEvent) => {
        e.stopPropagation();
        setPendingAction(prev => ({ ...prev, [s.id]: true }));

        try {
            const airportIata = selectedAirport?.iata || s.airportIata || '';
            const loc = localizeSuggestion(s, t);
            const payload = {
                suggestion_key: s.key,
                airport_iata: airportIata,
                suggestion_type: s.category,
                status: 'rejected',
                suggestion_payload: {
                    title: loc.title,
                    message: loc.message,
                    recommendedAction: loc.recommendedAction,
                    priority: s.priority,
                    flightNumber: s.flightNumber,
                    route: s.route,
                    predictedDelay: s.predictedDelay,
                },
            };

            const { error } = await apiDecideSuggestion(payload);
            if (error) {
                console.error('Reject failed', error);
                return;
            }

            setDecisions(prev => ({ ...prev, [s.key]: 'rejected' }));
        } catch (err) {
            console.error('Reject failed', err);
        } finally {
            setPendingAction(prev => ({ ...prev, [s.id]: false }));
        }
    };

    // Build full combined list: pending suggestions + any suggestions
    // that have a decision but are no longer returned as pending
    const allItems: Suggestion[] = [...suggestions];

    // Sort suggested → approved → rejected, within each group high→medium→low, then delay desc
    const workflowOrder: WorkflowStatus[] = ['suggested', 'approved', 'rejected'];
    const sortedSuggestions = [...allItems].sort((a, b) => {
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
        { key: 'all',       labelKey: 'ai_suggestions_all',      defaultLabel: 'Tous',      count: allItems.length },
        { key: 'suggested', labelKey: 'ai_suggestions_suggested',  defaultLabel: 'Pending',   count: countByStatus('suggested') },
        { key: 'approved',  labelKey: 'ai_suggestions_approved',   defaultLabel: 'Approuvé',  count: countByStatus('approved') },
        { key: 'rejected',  labelKey: 'ai_suggestions_rejected',   defaultLabel: 'Rejeté',    count: countByStatus('rejected') },
    ];

    return (
        <div className="ai-alerts-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="ai-alerts-panel__header" style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Zap size={15} style={{ color: '#F59E0B' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{t('ai_suggestions_title') || 'Operational Suggestions'}</span>
                    {highCount > 0 && (
                        <span style={{
                            background: '#EF4444', color: '#fff', borderRadius: 999,
                            fontSize: '0.62rem', fontWeight: 800, padding: '1px 6px', minWidth: 18, textAlign: 'center'
                        }}>{highCount}</span>
                    )}
                </div>
                <button
                    onClick={fetchAll}
                    style={{ background: 'none', border: 'none', color: 'var(--adm-text-sub)', cursor: 'pointer', padding: 4, borderRadius: 6 }}
                    title={t('refresh') || 'Actualiser les suggestions'}
                >
                    <RefreshCw size={13} style={{ opacity: loading ? 0.4 : 1 }} />
                </button>
            </div>

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
                    const loc = localizeSuggestion(s, t);

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

                            <div className="ai-alert-card__top" style={{ gap: 8, alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                    <Icon size={13} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
                                    <span className="ai-alert-card__title" style={{
                                        color: 'var(--adm-text)', fontWeight: 700,
                                        fontSize: '0.77rem', lineHeight: 1.3,
                                        textDecoration: workflowStatus === 'rejected' ? 'line-through' : 'none',
                                    }}>
                                        {loc.title}
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
                                    <span style={{
                                        fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em',
                                        color: cfg.color, padding: '1px 5px', borderRadius: 999,
                                        border: `1px solid ${cfg.border}`, textTransform: 'uppercase'
                                    }}>{loc.priorityLabel}</span>
                                    <span style={{
                                        fontSize: '0.6rem', fontWeight: 700,
                                        color: wCfg.color, padding: '1px 6px', borderRadius: 999,
                                        border: `1px solid ${wCfg.border}`,
                                        background: wCfg.bg,
                                    }}>{t(wCfg.labelKey) || wCfg.defaultLabel}</span>
                                    <ChevronDown size={12} style={{ color: 'var(--adm-text-sub)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                </div>
                            </div>

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

                            <div className="ai-alert-card__issue" style={{ marginTop: 8, fontSize: '0.73rem', lineHeight: 1.5, color: 'var(--adm-text-sub)' }}>
                                {loc.message}
                            </div>

                            {isExpanded && (
                                <div style={{ marginTop: 8 }}>
                                    <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 7, border: '1px solid rgba(255,255,255,0.06)', marginBottom: isSuggested ? 10 : 0 }}>
                                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
                                            {t('ai_suggestions_action_recommended') || 'Suggested Action'}
                                        </span>
                                        <span style={{ fontSize: '0.73rem', color: 'var(--adm-text)', lineHeight: 1.55 }}>
                                            {loc.recommendedAction}
                                        </span>
                                    </div>

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

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                <span style={{ fontSize: '0.62rem', color: 'var(--adm-text-sub)', opacity: 0.6 }}>
                                    {loc.sourceLabel} · {formatTime(s.createdAt)}
                                </span>
                                {!isExpanded && isSuggested && (
                                    <span style={{ fontSize: '0.62rem', color: '#F59E0B', opacity: 0.8 }}>
                                        {t('ai_suggestions_open_action') || 'Open to review →'}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {lastRefreshed && !loading && (
                <div style={{ padding: '0.4rem 0.75rem', borderTop: '1px solid var(--adm-border)', fontSize: '0.62rem', color: 'var(--adm-text-sub)', flexShrink: 0 }}>
                    {t('ai_suggestions_footer_label') || 'Ops Monitor'} · {lastRefreshed.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
            )}
        </div>
    );
}

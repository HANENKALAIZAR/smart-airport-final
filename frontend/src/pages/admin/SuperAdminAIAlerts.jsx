import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { useAirport } from '../../context/AirportContext';
import { apiGetAiAlerts } from '../../services/adminApi';

function riskBadgeStyle(riskPct) {
    const risk = Number(riskPct || 0);
    if (risk < 40) return { color: '#34D399', borderColor: 'rgba(52, 211, 153, 0.3)', background: 'rgba(52, 211, 153, 0.10)' };
    if (risk <= 70) return { color: '#FBBF24', borderColor: 'rgba(251, 191, 36, 0.3)', background: 'rgba(251, 191, 36, 0.10)' };
    return { color: '#F87171', borderColor: 'rgba(248, 113, 113, 0.3)', background: 'rgba(248, 113, 113, 0.10)' };
}

function decisionBadge(decision) {
    if (decision === 'approved') return { label: '🟢 Approved', style: { color: '#34D399' } };
    if (decision === 'rejected') return { label: '🔴 Rejected', style: { color: '#F87171' } };
    return { label: '🟡 Pending', style: { color: '#FBBF24' } };
}

export default function SuperAdminAIAlerts() {
    const { selectedAirport } = useAirport();
    const [decisionFilter, setDecisionFilter] = useState('all'); // all | pending_review? (spec: pending/approved/rejected)
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(false);

    const airportIata = selectedAirport?.iata || '';

    const pollIntervalMs = 300000; // same order as dashboard flights polling (5 min)

    async function fetchAlerts() {
        if (!airportIata) return;
        setLoading(true);
        const { data, error } = await apiGetAiAlerts(airportIata, decisionFilter);
        setLoading(false);
        if (error) return; // silent: panel is non-critical
        setAlerts(Array.isArray(data) ? data : []);
    }

    useEffect(() => {
        let cancelled = false;
        if (!airportIata) return;

        const run = async () => {
            if (cancelled) return;
            await fetchAlerts();
        };

        run();
        const iv = setInterval(run, pollIntervalMs);
        return () => {
            cancelled = true;
            clearInterval(iv);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [airportIata, decisionFilter]);

    const count = useMemo(() => alerts.length, [alerts]);

    return (
        <div className="ai-alerts-panel">
            <div className="ai-alerts-panel__header">
                <AlertTriangle size={16} className="ai-alerts-panel__header-icon" />
                <span>AI Activity</span>
                <span className="ai-alerts-panel__count">{loading ? '…' : count}</span>
            </div>

            <div style={{ padding: '0.75rem 1rem 0.5rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                    className="admin-filter-bar__select"
                    style={{ width: '100%' }}
                    value={decisionFilter}
                    onChange={(e) => setDecisionFilter(e.target.value)}
                >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>

            <div className="ai-alerts-panel__list" style={{ paddingTop: 8 }}>
                {alerts.length === 0 && !loading && (
                    <div className="ai-alerts-panel__empty">
                        <Clock size={24} style={{ color: 'rgba(255,255,255,0.35)' }} />
                        <p>No AI alerts for this filter</p>
                    </div>
                )}

                {alerts.map((a) => {
                    const rs = riskBadgeStyle(a.risk_pct);
                    const db = decisionBadge(a.decision);
                    const decidedAt = a.timestamp || a.created_at;
                    return (
                        <div key={a.flight_number + '|' + a.airport_name} className={`ai-alert-card`}>
                            <div className="ai-alert-card__top">
                                <span className="ai-alert-card__title">
                                    {a.flight_number}
                                    <span style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginTop: 2 }}>
                                        {a.airport_name}
                                    </span>
                                </span>
                                <span
                                    className="ai-alert-card__risk"
                                    style={{
                                        color: rs.color,
                                        background: rs.background,
                                        border: `1px solid ${rs.borderColor}`,
                                    }}
                                >
                                    {a.risk_pct}% Risk
                                </span>
                            </div>

                            <div className="ai-alert-card__issue">{a.cause}</div>
                            <div className="ai-alert-card__rec">
                                <span className="ai-alert-card__rec-bullet">•</span>
                                {a.recommendation}
                            </div>

                            <div className="ai-alert-card__approved-badge" style={{ marginTop: 8 }}>
                                <span style={{ fontWeight: 800, ...db.style }}>{db.label}</span>
                                {a.acted_by_admin_name ? (
                                    <span style={{ marginLeft: 10, color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', fontWeight: 600 }}>
                                        by {a.acted_by_admin_name}
                                    </span>
                                ) : null}
                            </div>

                            {decidedAt ? (
                                <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', fontWeight: 600 }}>
                                    {new Date(decidedAt).toLocaleString()}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

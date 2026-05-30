import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { apiGetAiAlerts, apiAiAlertAction } from '../../services/adminApi';
import { useAirport } from '../../context/AirportContext';

/**
 * AirportAdminAIAlerts
 * ====================
 * Displays AI-generated alerts from the backend (GET only).
 * The client NEVER generates/POSTs mock alerts — backend is source of truth.
 */
export default function AirportAdminAIAlerts() {
    const { selectedAirport } = useAirport();
    const airportIata = selectedAirport?.iata || '';

    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchAlerts = useCallback(async () => {
        if (!airportIata) return;
        setLoading(true);
        const { data } = await apiGetAiAlerts(airportIata);
        setLoading(false);
        if (Array.isArray(data)) {
            // Adapt backend alert shape to UI shape
            setAlerts(data.map(a => ({
                id: a.id || a.flight_number,
                title: a.flight_number,
                risk: a.risk_pct || 0,
                riskColor: (a.risk_pct || 0) >= 70 ? '#EF4444' : (a.risk_pct || 0) >= 40 ? '#F59E0B' : '#22C55E',
                issue: a.cause || a.brief_cause || '',
                recommendation: a.recommendation || '',
                dismissed: false,
                approved: a.decision === 'approved',
            })));
        }
    }, [airportIata]);

    useEffect(() => {
        fetchAlerts();
        const iv = setInterval(fetchAlerts, 300000); // refresh every 5 min
        return () => clearInterval(iv);
    }, [fetchAlerts]);



    async function approve(id) {
        const a = alerts.find((x) => x.id === id);
        setAlerts((prev) => prev.map((x) => (x.id === id ? { ...x, approved: true, dismissed: false } : x)));
        if (a) {
            await apiAiAlertAction({ flight_number: a.title, action: 'approved' });
        }
    }

    async function reject(id) {
        const a = alerts.find((x) => x.id === id);
        setAlerts((prev) => prev.map((x) => (x.id === id ? { ...x, dismissed: true } : x)));
        if (a) {
            await apiAiAlertAction({ flight_number: a.title, action: 'rejected' });
        }
    }

    const active = alerts.filter((a) => !a.dismissed);

    return (
        <div className="ai-alerts-panel">
            <div className="ai-alerts-panel__header">
                <AlertTriangle size={16} className="ai-alerts-panel__header-icon" />
                <span>AI Alerts</span>
                <span className="ai-alerts-panel__count">{active.length}</span>
            </div>
            <div className="ai-alerts-panel__list">
                {active.map((alert) => (
                    <div
                        key={alert.id}
                        className={`ai-alert-card${alert.approved ? ' ai-alert-card--approved' : ''}`}
                    >
                        <div className="ai-alert-card__top">
                            <span className="ai-alert-card__title">{alert.title}</span>
                            <span
                                className="ai-alert-card__risk"
                                style={{ color: alert.riskColor }}
                            >
                                {alert.risk}% Risk
                            </span>
                        </div>
                        <div className="ai-alert-card__issue">{alert.issue}</div>
                        <div className="ai-alert-card__rec">
                            <span className="ai-alert-card__rec-bullet">•</span>
                            {alert.recommendation}
                        </div>
                        {!alert.approved && (
                            <div className="ai-alert-card__actions">
                                <button
                                    type="button"
                                    className="ai-alert-btn ai-alert-btn--approve"
                                    onClick={() => approve(alert.id)}
                                >
                                    <CheckCircle size={14} /> Approve
                                </button>
                                <button
                                    type="button"
                                    className="ai-alert-btn ai-alert-btn--reject"
                                    onClick={() => reject(alert.id)}
                                >
                                    Reject
                                </button>
                            </div>
                        )}
                        {alert.approved && (
                            <div className="ai-alert-card__approved-badge">
                                <CheckCircle size={13} /> Approved
                            </div>
                        )}
                    </div>
                ))}
                {active.length === 0 && (
                    <div className="ai-alerts-panel__empty">
                        <CheckCircle size={24} style={{ color: '#22C55E' }} />
                        <p>All alerts resolved</p>
                    </div>
                )}
            </div>
        </div>
    );
}

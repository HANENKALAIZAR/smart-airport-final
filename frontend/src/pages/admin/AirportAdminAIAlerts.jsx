import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { apiAiAlertGenerated, apiAiAlertAction } from '../../services/adminApi';

const MOCK_ALERTS = [
    {
        id: 'AA1234',
        risk: 68,
        riskColor: '#F59E0B',
        title: 'AA1234',
        issue: 'High weather delay probability',
        recommendation: 'Recommend gate change to B15',
    },
    {
        id: 'LH7890',
        risk: 72,
        riskColor: '#EF4444',
        title: 'LH7890',
        issue: 'Aircraft turnaround delay expected',
        recommendation: 'Increase ground crew by 2 staff',
    },
    {
        id: 'UA9012',
        risk: 25,
        riskColor: '#22C55E',
        title: 'UA9012',
        issue: 'Minor schedule deviation',
        recommendation: 'Monitor boarding process',
    },
    {
        id: 'BA5678',
        risk: 45,
        riskColor: '#F59E0B',
        title: 'BA5678',
        issue: 'Slot conflict at Terminal 2',
        recommendation: 'Coordinate with ground ops team',
    },
];

const BATCH_NOTIFIED_KEY = 'ai_alert_batch_notified_v1';

export default function AirportAdminAIAlerts() {
    const [alerts, setAlerts] = useState(MOCK_ALERTS.map((a) => ({ ...a, dismissed: false })));

    useEffect(() => {
        const token = localStorage.getItem('admin_token');
        if (!token || token === 'demo') return;
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(BATCH_NOTIFIED_KEY)) return;
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(BATCH_NOTIFIED_KEY, '1');
        MOCK_ALERTS.forEach((a) => {
            apiAiAlertGenerated({
                flight_number: a.title,
                brief_cause: a.issue,
                recommendation: a.recommendation,
                risk_pct: a.risk,
            });
        });
    }, []);

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

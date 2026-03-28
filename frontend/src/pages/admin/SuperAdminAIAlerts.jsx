import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

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

export default function SuperAdminAIAlerts() {
    const [alerts, setAlerts] = useState(MOCK_ALERTS.map(a => ({ ...a, dismissed: false })));

    function approve(id) {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, approved: true, dismissed: false } : a));
    }
    function reject(id) {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
    }

    const active = alerts.filter(a => !a.dismissed);

    return (
        <div className="ai-alerts-panel">
            <div className="ai-alerts-panel__header">
                <AlertTriangle size={16} className="ai-alerts-panel__header-icon" />
                <span>AI Alerts</span>
                <span className="ai-alerts-panel__count">{active.length}</span>
            </div>
            <div className="ai-alerts-panel__list">
                {active.map(alert => (
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
                                    className="ai-alert-btn ai-alert-btn--approve"
                                    onClick={() => approve(alert.id)}
                                >
                                    <CheckCircle size={14} /> Approve
                                </button>
                                <button
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

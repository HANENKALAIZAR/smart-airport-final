import { useTranslation } from 'react-i18next';

const labels = {
    Low: 'Low Risk',
    Medium: 'Medium Risk',
    High: 'High Risk',
};

export default function AviationBadge({ riskLevel }) {
    const { t } = useTranslation();
    const cls = riskLevel === 'Low' ? 'aviation-badge--low'
        : riskLevel === 'Medium' ? 'aviation-badge--medium'
            : 'aviation-badge--high';
    const key = `admin_predict_risk_${riskLevel?.toLowerCase()}`;
    const label = t(key, labels[riskLevel] || riskLevel || 'Unknown');

    return (
        <span className={`aviation-badge ${cls}`}>
            {label}
        </span>
    );
}

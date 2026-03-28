export default function AviationBadge({ riskLevel }) {
    const cls = riskLevel === 'Low' ? 'aviation-badge--low'
        : riskLevel === 'Medium' ? 'aviation-badge--medium'
            : 'aviation-badge--high';

    return (
        <span className={`aviation-badge ${cls}`}>
            {riskLevel}
        </span>
    );
}

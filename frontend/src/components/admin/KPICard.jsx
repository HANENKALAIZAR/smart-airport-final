import { TrendingUp, TrendingDown } from 'lucide-react';

export default function KPICard({ title, value, icon, trend, suffix = '' }) {
    const isPositive = trend !== undefined && trend > 0;
    const isNegative = trend !== undefined && trend < 0;

    return (
        <div className="kpi-card">
            <div className="kpi-card__header">
                <div>
                    <p className="kpi-card__title">{title}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span className="kpi-card__value">
                            {value}
                            {suffix && <span className="kpi-card__suffix">{suffix}</span>}
                        </span>
                    </div>
                    {trend !== undefined && (
                        <div className={`kpi-card__trend ${isPositive ? 'kpi-card__trend--up' : isNegative ? 'kpi-card__trend--down' : 'kpi-card__trend--neutral'}`}>
                            {isPositive && <TrendingUp size={16} />}
                            {isNegative && <TrendingDown size={16} />}
                            <span>{isPositive ? '+' : ''}{trend}</span>
                        </div>
                    )}
                </div>
                <div className="kpi-card__icon">{icon}</div>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { Target, TrendingUp, BrainCircuit, AlertTriangle, AlertCircle } from 'lucide-react';
import { apiPredict } from '../../services/adminApi';
import { useLanguage } from '../../context/LanguageContext';

const DEFAULT_FEATURES = {
    weather_severity: 0.3,
    origin_weather_severity: 0.2,
    dest_weather_severity: 0.25,
    hour_of_day: 14,
    day_of_week: 1,
    month: 6,
    is_weekend: 0,
    congestion_level: 0.5,
    origin_congestion: 0.45,
    dest_congestion: 0.55,
    airline_reliability: 0.82,
    distance_km: 1500,
    historical_delay_rate: 0.25,
};

const FEATURE_LABELS = {
    weather_severity:        { label: 'Weather Severity',           min: 0, max: 1, step: 0.01, unit: '' },
    origin_weather_severity: { label: 'Origin Weather Severity',    min: 0, max: 1, step: 0.01, unit: '' },
    dest_weather_severity:   { label: 'Destination Weather',        min: 0, max: 1, step: 0.01, unit: '' },
    hour_of_day:             { label: 'Hour of Day',                min: 0, max: 23, step: 1,   unit: 'h' },
    day_of_week:             { label: 'Day of Week (0=Mon)',        min: 0, max: 6,  step: 1,   unit: '' },
    month:                   { label: 'Month',                      min: 1, max: 12, step: 1,   unit: '' },
    is_weekend:              { label: 'Is Weekend',                 min: 0, max: 1,  step: 1,   unit: '' },
    congestion_level:        { label: 'Congestion Level',           min: 0, max: 1,  step: 0.01, unit: '' },
    origin_congestion:       { label: 'Origin Congestion',          min: 0, max: 1,  step: 0.01, unit: '' },
    dest_congestion:         { label: 'Destination Congestion',     min: 0, max: 1,  step: 0.01, unit: '' },
    airline_reliability:     { label: 'Airline Reliability',        min: 0, max: 1,  step: 0.01, unit: '' },
    distance_km:             { label: 'Distance (km)',              min: 0, max: 15000, step: 50, unit: 'km' },
    historical_delay_rate:   { label: 'Historical Delay Rate',      min: 0, max: 1,  step: 0.01, unit: '' },
};

function riskColor(score) {
    if (score >= 70) return '#EF4444';
    if (score >= 40) return '#F59E0B';
    return '#22C55E';
}

function riskLabel(score) {
    if (score >= 70) return 'High Risk';
    if (score >= 40) return 'Medium Risk';
    return 'Low Risk';
}

export default function AdminPredict() {
    const { t } = useLanguage();
    const [features, setFeatures] = useState(DEFAULT_FEATURES);
    const [result, setResult]     = useState(null);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');

    async function handlePredict(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        const { data, error: err } = await apiPredict(features);
        setLoading(false);
        if (err) { setError(err); return; }
        setResult(data);
    }

    function handleReset() {
        setFeatures(DEFAULT_FEATURES);
        setResult(null);
        setError('');
    }

    const sliderStyle = (val, min, max) => ({
        width: '100%',
        accentColor: `hsl(${120 - ((val - min) / (max - min)) * 120}, 70%, 50%)`,
    });

    return (
        <div className="admin-space-y-6">
            <div className="admin-page-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Target size={22} style={{ color: '#6366F1' }} />
                        {t('predictDelay')}
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem' }}>
                        Adjust the flight parameters below and run the AI model to predict delay risk.
                    </p>
                </div>
                <button className="admin-btn admin-btn--outline" onClick={handleReset}>Reset</button>
            </div>

            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '0.84rem' }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 360px' : '1fr', gap: 20 }}>
                {/* ── Feature Inputs ── */}
                <form onSubmit={handlePredict}>
                    <div className="admin-card">
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BrainCircuit size={17} style={{ color: '#8B5CF6' }} /> Flight Parameters
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {Object.entries(FEATURE_LABELS).map(([key, meta]) => (
                                <div key={key}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <label style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                                            {meta.label}
                                        </label>
                                        <span style={{ fontSize: '0.78rem', color: '#A5B4FC', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                            {features[key]}{meta.unit}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={meta.min}
                                        max={meta.max}
                                        step={meta.step}
                                        value={features[key]}
                                        onChange={e => setFeatures(f => ({ ...f, [key]: parseFloat(e.target.value) }))}
                                        style={sliderStyle(features[key], meta.min, meta.max)}
                                    />
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: 10 }}>
                            <button type="submit" className="admin-btn admin-btn--primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Target size={16} />
                                {loading ? 'Running AI model…' : 'Predict Delay Risk'}
                            </button>
                        </div>
                    </div>
                </form>

                {/* ── Result Panel ── */}
                {result && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Risk Score */}
                        <div className="admin-card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
                            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Delay Risk Score</div>
                            <div style={{ fontSize: '4rem', fontWeight: 800, color: riskColor(result.risk_score), lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                                {result.risk_score.toFixed(1)}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: riskColor(result.risk_score), fontWeight: 700, marginTop: 8 }}>
                                {riskLabel(result.risk_score)}
                            </div>
                            {/* Gauge bar */}
                            <div style={{ marginTop: 16, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${result.risk_score}%`, background: riskColor(result.risk_score), borderRadius: 4, transition: 'width 0.6s ease' }} />
                            </div>
                        </div>

                        {/* Predicted delay */}
                        <div className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Predicted Delay</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: result.predicted_delay_min > 0 ? '#F59E0B' : '#22C55E', fontVariantNumeric: 'tabular-nums' }}>
                                    {result.predicted_delay_min > 0 ? `+${result.predicted_delay_min} min` : 'On time'}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confidence</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#A5B4FC' }}>
                                    {(result.confidence * 100).toFixed(0)}%
                                </div>
                            </div>
                        </div>

                        {/* SHAP explanation */}
                        {result.shap_explanation && (
                            <div className="admin-card">
                                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                                    Top Delay Factors
                                </div>
                                {Object.entries(result.shap_explanation)
                                    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                                    .slice(0, 6)
                                    .map(([factor, value]) => {
                                        const absMax = Math.max(...Object.values(result.shap_explanation).map(Math.abs));
                                        const pct = Math.abs(value) / absMax * 100;
                                        const isPositive = value > 0;
                                        return (
                                            <div key={factor} style={{ marginBottom: 10 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.78rem' }}>
                                                    <span style={{ color: 'rgba(255,255,255,0.65)' }}>{factor}</span>
                                                    <span style={{ color: isPositive ? '#EF4444' : '#22C55E', fontWeight: 600 }}>
                                                        {isPositive ? '+' : ''}{value.toFixed(3)}
                                                    </span>
                                                </div>
                                                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)' }}>
                                                    <div style={{ height: '100%', width: `${pct}%`, background: isPositive ? '#EF4444' : '#22C55E', borderRadius: 3, transition: 'width 0.4s ease' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>
                                    Model: {result.model_version || 'xgboost-v1'}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

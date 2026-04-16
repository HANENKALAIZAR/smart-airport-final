import { useState } from 'react';
import { Target, TrendingUp, BrainCircuit, AlertTriangle, CheckCircle } from 'lucide-react';
import { predictCustom } from '../services/api';
import CustomSelect from '../components/ui/CustomSelect';

const WEATHER_OPTIONS = [
    { label: 'Clear', severity: 0.1 },
    { label: 'Cloudy', severity: 0.3 },
    { label: 'Light Rain', severity: 0.5 },
    { label: 'Windy', severity: 0.6 },
    { label: 'Heavy Rain', severity: 0.8 },
    { label: 'Fog', severity: 0.85 },
    { label: 'Snow', severity: 0.9 },
    { label: 'Thunderstorm', severity: 1.0 },
];

export default function PredictionPlayground() {
    const [features, setFeatures] = useState({
        weather_severity: 0.3,
        origin_weather_severity: 0.2,
        dest_weather_severity: 0.4,
        hour_of_day: 14,
        day_of_week: 2,
        month: 2,
        is_weekend: 0,
        congestion_level: 0.5,
        origin_congestion: 0.4,
        dest_congestion: 0.6,
        airline_reliability: 0.8,
        distance_km: 1500,
        historical_delay_rate: 0.25,
    });

    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (key, value) => {
        setFeatures(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const result = await predictCustom(features);
            setPrediction(result);
        } catch (err) {
            setError(err.message || 'Prediction request failed');
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (score) => {
        if (score >= 70) return 'var(--danger)';
        if (score >= 40) return 'var(--warning)';
        return 'var(--success)';
    };

    const getRiskLabel = (score) => {
        if (score >= 70) return 'High Risk';
        if (score >= 40) return 'Medium Risk';
        return 'Low Risk';
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1 className="page-title">🎯 Prediction Playground</h1>
                <p className="page-subtitle">Test the AI model with custom flight parameters</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-lg)' }}>
                {/* Input Form */}
                <div className="card">
                    <div className="card__header">
                        <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Target size={20} style={{ color: 'var(--primary-400)' }} />
                            Flight Parameters
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Weather Section */}
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
                            🌤 Weather Conditions
                        </h3>
                        <div className="form-row form-row--3">
                            <div className="form-group">
                                <label className="form-label">General Weather ({features.weather_severity.toFixed(1)})</label>
                                <input type="range" className="form-range" min="0" max="1" step="0.05"
                                    value={features.weather_severity} onChange={e => handleChange('weather_severity', parseFloat(e.target.value))} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    <span>Clear</span><span>Severe</span>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Origin Weather ({features.origin_weather_severity.toFixed(1)})</label>
                                <input type="range" className="form-range" min="0" max="1" step="0.05"
                                    value={features.origin_weather_severity} onChange={e => handleChange('origin_weather_severity', parseFloat(e.target.value))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Destination Weather ({features.dest_weather_severity.toFixed(1)})</label>
                                <input type="range" className="form-range" min="0" max="1" step="0.05"
                                    value={features.dest_weather_severity} onChange={e => handleChange('dest_weather_severity', parseFloat(e.target.value))} />
                            </div>
                        </div>

                        {/* Time Section */}
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                            🕐 Time & Schedule
                        </h3>
                        <div className="form-row form-row--3">
                            <div className="form-group">
                                <label className="form-label">Hour of Day</label>
                                <CustomSelect
                                    options={[...Array(24)].map((_, i) => ({ value: i, label: `${String(i).padStart(2, '0')}:00` }))}
                                    value={features.hour_of_day}
                                    onChange={(val) => handleChange('hour_of_day', Number(val))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Day of Week</label>
                                <CustomSelect
                                    options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d, i) => ({ value: i, label: d }))}
                                    value={features.day_of_week}
                                    onChange={(val) => handleChange('day_of_week', Number(val))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Month</label>
                                <CustomSelect
                                    options={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => ({ value: i + 1, label: m }))}
                                    value={features.month}
                                    onChange={(val) => handleChange('month', Number(val))}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                Weekend Flight
                                <label className="toggle">
                                    <input type="checkbox" checked={features.is_weekend === 1}
                                        onChange={e => handleChange('is_weekend', e.target.checked ? 1 : 0)} />
                                    <span className="toggle__slider"></span>
                                </label>
                            </label>
                        </div>

                        {/* Traffic Section */}
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                            🚦 Traffic & Airport Congestion
                        </h3>
                        <div className="form-row form-row--3">
                            <div className="form-group">
                                <label className="form-label">Overall Congestion ({features.congestion_level.toFixed(1)})</label>
                                <input type="range" className="form-range" min="0" max="1" step="0.05"
                                    value={features.congestion_level} onChange={e => handleChange('congestion_level', parseFloat(e.target.value))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Origin Congestion ({features.origin_congestion.toFixed(1)})</label>
                                <input type="range" className="form-range" min="0" max="1" step="0.05"
                                    value={features.origin_congestion} onChange={e => handleChange('origin_congestion', parseFloat(e.target.value))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Dest. Congestion ({features.dest_congestion.toFixed(1)})</label>
                                <input type="range" className="form-range" min="0" max="1" step="0.05"
                                    value={features.dest_congestion} onChange={e => handleChange('dest_congestion', parseFloat(e.target.value))} />
                            </div>
                        </div>

                        {/* Airline Section */}
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                            ✈️ Airline & Route
                        </h3>
                        <div className="form-row form-row--3">
                            <div className="form-group">
                                <label className="form-label">Airline Reliability ({features.airline_reliability.toFixed(1)})</label>
                                <input type="range" className="form-range" min="0" max="1" step="0.05"
                                    value={features.airline_reliability} onChange={e => handleChange('airline_reliability', parseFloat(e.target.value))} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    <span>Unreliable</span><span>Excellent</span>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Distance (km)</label>
                                <input className="form-input" type="number" min="100" max="20000"
                                    value={features.distance_km} onChange={e => handleChange('distance_km', parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Hist. Delay Rate ({(features.historical_delay_rate * 100).toFixed(0)}%)</label>
                                <input type="range" className="form-range" min="0" max="1" step="0.01"
                                    value={features.historical_delay_rate} onChange={e => handleChange('historical_delay_rate', parseFloat(e.target.value))} />
                            </div>
                        </div>

                        {error && <div className="alert alert--danger"><AlertTriangle size={16} />{error}</div>}

                        <button className="btn btn--primary" type="submit" disabled={loading} style={{ marginTop: 'var(--space-lg)' }}>
                            {loading ? 'Predicting...' : '🔮 Predict Delay'}
                        </button>
                    </form>
                </div>

                {/* Result */}
                {prediction && (
                    <div className="card">
                        <div className="card__header">
                            <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <TrendingUp size={20} style={{ color: 'var(--primary-400)' }} />
                                Prediction Result
                            </div>
                        </div>

                        <div className="prediction-result" style={{ marginBottom: 'var(--space-lg)' }}>
                            <div className="prediction-result__label">Predicted Delay</div>
                            <div className="prediction-result__value">{prediction.predicted_delay_min}</div>
                            <div className="prediction-result__unit">minutes</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                            <div style={{ padding: 'var(--space-md)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Risk Score</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: getRiskColor(prediction.risk_score) }}>
                                    {prediction.risk_score?.toFixed(1)}%
                                </div>
                            </div>
                            <div style={{ padding: 'var(--space-md)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Risk Level</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: getRiskColor(prediction.risk_score) }}>
                                    {getRiskLabel(prediction.risk_score)}
                                </div>
                            </div>
                        </div>

                        {/* Confidence */}
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Model Confidence</span>
                                <span style={{ fontWeight: 600 }}>{(prediction.confidence * 100).toFixed(1)}%</span>
                            </div>
                            <div className="progress">
                                <div className="progress__bar" style={{
                                    width: `${prediction.confidence * 100}%`,
                                    background: 'var(--primary-500)'
                                }}></div>
                            </div>
                        </div>

                        {/* SHAP */}
                        {prediction.shap_explanation && (
                            <div>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <BrainCircuit size={18} style={{ color: 'var(--primary-400)' }} />
                                    Feature Importance (SHAP)
                                </h3>
                                {Object.entries(prediction.shap_explanation)
                                    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                                    .slice(0, 8)
                                    .map(([key, value]) => (
                                        <div className="shap-bar" key={key}>
                                            <div className="shap-bar__label">{key.replace(/_/g, ' ')}</div>
                                            <div className="shap-bar__track">
                                                <div className="shap-bar__fill" style={{
                                                    width: `${Math.min(100, Math.abs(value) * 200)}%`,
                                                    background: value > 0 ? 'var(--danger)' : 'var(--success)',
                                                }}></div>
                                            </div>
                                            <div className="shap-bar__value">{value > 0 ? '+' : ''}{value.toFixed(3)}</div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

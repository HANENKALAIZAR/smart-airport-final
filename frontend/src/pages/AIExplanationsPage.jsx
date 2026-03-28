import { BrainCircuit, TrendingUp, Zap, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const featureImportanceData = [
    { feature: 'Weather Severity', importance: 35, color: '#EF4444' },
    { feature: 'Traffic Congestion', importance: 25, color: '#F97316' },
    { feature: 'Airline Reliability', importance: 15, color: '#3B82F6' },
    { feature: 'Hour of Day', importance: 10, color: '#6366F1' },
    { feature: 'Historical Delay Rate', importance: 8, color: '#22C55E' },
    { feature: 'Distance (km)', importance: 4, color: '#EAB308' },
    { feature: 'Day of Week', importance: 3, color: '#94A3B8' },
];

const sampleExplanation = {
    flight: 'DL9012',
    route: 'ATL → MIA',
    delay: 68,
    risk: 'High',
    factors: [
        {
            name: 'Weather Conditions',
            impact: 38,
            color: '#EF4444',
            description: 'Heavy rain at the destination airport is the strongest predictor. Historical data shows a 72% delay rate under similar conditions.',
        },
        {
            name: 'Traffic Congestion',
            impact: 28,
            color: '#F97316',
            description: 'High traffic levels at both origin and destination airports. Peak hour operations increase delay probability by 45%.',
        },
        {
            name: 'Airline Performance',
            impact: 15,
            color: '#3B82F6',
            description: 'This airline has a 78% on-time rate on this route. Recent operational issues may contribute to the prediction.',
        },
    ],
};

const tooltipStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '0.8rem',
    color: 'var(--text-primary)',
};

export default function AIExplanationsPage() {
    return (
        <div className="animate-in">
            <div className="page-header">
                <h1 className="page-title">🧠 AI Explanations</h1>
                <p className="page-subtitle">Understanding how the AI model makes delay predictions</p>
            </div>

            {/* Flight Summary Banner */}
            <div className="prediction-result" style={{ marginBottom: 'var(--space-lg)', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <div>
                    <p style={{ opacity: 0.7, fontSize: '0.85rem', marginBottom: 4 }}>Sample Flight Analysis</p>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>Flight {sampleExplanation.flight}</h2>
                    <p style={{ opacity: 0.8 }}>{sampleExplanation.route} • Predicted Delay: {sampleExplanation.delay} min • Risk: {sampleExplanation.risk}</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)' }}>
                    <BrainCircuit size={48} style={{ color: '#00C2FF' }} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-lg)' }}>
                {/* Feature Importance Chart */}
                <div className="card">
                    <div className="card__header">
                        <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TrendingUp size={20} style={{ color: 'var(--primary-400)' }} />
                            Global Feature Importance (SHAP Values)
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={featureImportanceData} layout="vertical" margin={{ left: 20, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                            <YAxis dataKey="feature" type="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={140} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, 'Importance']} />
                            <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                                {featureImportanceData.map((entry, index) => (
                                    <Cell key={index} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>

                    {/* Legend */}
                    <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {featureImportanceData.map((item) => (
                            <div key={item.feature} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color }}></div>
                                    <span style={{ color: 'var(--text-secondary)' }}>{item.feature}</span>
                                </div>
                                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{item.importance}%</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Detailed Analysis */}
                <div className="card">
                    <div className="card__header">
                        <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BrainCircuit size={20} style={{ color: 'var(--primary-400)' }} />
                            Detailed Analysis
                        </div>
                    </div>

                    <h3 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 'var(--space-md)' }}>Primary Contributing Factors</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        {sampleExplanation.factors.map((factor, i) => (
                            <div key={i} style={{
                                borderLeft: `4px solid ${factor.color}`,
                                background: 'var(--bg-input)',
                                borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                                padding: 'var(--space-md)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span style={{ color: factor.color, fontWeight: 700, fontSize: '1.1rem' }}>{i + 1}.</span>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{factor.name} ({factor.impact}%)</span>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{factor.description}</p>
                            </div>
                        ))}
                    </div>

                    {/* Model Confidence */}
                    <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
                        <h3 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 'var(--space-md)' }}>Model Confidence</h3>
                        <div style={{ marginBottom: 'var(--space-md)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Prediction Accuracy</span>
                                <span style={{ fontWeight: 600 }}>94.2%</span>
                            </div>
                            <div className="progress">
                                <div className="progress__bar" style={{ width: '94.2%', background: 'var(--success)' }}></div>
                            </div>
                        </div>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Confidence Level</span>
                                <span style={{ fontWeight: 600 }}>87.5%</span>
                            </div>
                            <div className="progress">
                                <div className="progress__bar" style={{ width: '87.5%', background: 'var(--primary-500)' }}></div>
                            </div>
                        </div>
                    </div>

                    {/* AI Recommendation */}
                    <div style={{
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-md)',
                        marginTop: 'var(--space-lg)',
                    }}>
                        <h3 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Zap size={16} style={{ color: 'var(--primary-400)' }} />
                            AI Recommendation
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            Consider delaying departure by 30–45 minutes to allow weather conditions to improve.
                            Alternative routing through less congested airspace may reduce delay to 35 minutes.
                        </p>
                    </div>
                </div>

                {/* Model Information */}
                <div className="card">
                    <div className="card__header">
                        <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Activity size={20} style={{ color: 'var(--primary-400)' }} />
                            About the AI Model
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-lg)' }}>
                        <div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Model Type</p>
                            <p style={{ fontWeight: 600 }}>Gradient Boosting (XGBoost)</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>with SHAP explainability</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Training Data</p>
                            <p style={{ fontWeight: 600 }}>2.4M flight records</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>from 2020–2026</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Last Updated</p>
                            <p style={{ fontWeight: 600 }}>February 10, 2026</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>daily retraining</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

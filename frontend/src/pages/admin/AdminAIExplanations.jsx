import { BrainCircuit, Layers, BarChart3, Zap, GitBranch } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const models = [
    {
        name: 'Gradient Boosting (XGBoost)',
        accuracy: 89.2,
        precision: 87.5,
        recall: 91.3,
        f1: 89.4,
        description: 'Primary delay prediction model trained on 2 years of historical flight data. Uses weather, traffic, and temporal features.',
        features: ['Weather conditions', 'Airport traffic density', 'Time of day', 'Day of week', 'Historical delay patterns', 'Aircraft type', 'Route distance', 'Season/month'],
    },
    {
        name: 'Random Forest Classifier',
        accuracy: 86.7,
        precision: 84.2,
        recall: 88.9,
        f1: 86.5,
        description: 'Secondary ensemble model for risk classification. Categorizes flights into Low, Medium, and High risk buckets.',
        features: ['Weather severity score', 'Airport congestion index', 'Airline historical reliability', 'Flight distance', 'Time slot'],
    },
    {
        name: 'LSTM Neural Network',
        accuracy: 91.1,
        precision: 89.8,
        recall: 92.4,
        f1: 91.1,
        description: 'Deep learning model for sequential delay pattern recognition. Captures temporal dependencies across flight schedules.',
        features: ['Sequential delay cascading', 'Airport capacity utilization', 'Multi-hop delay propagation', 'Weather forecast sequences'],
    },
];

const shap_features = [
    { name: 'Weather Conditions', importance: 0.32, color: '#E53935' },
    { name: 'Airport Traffic', importance: 0.24, color: '#FFB020' },
    { name: 'Time of Day', importance: 0.18, color: '#00C2FF' },
    { name: 'Historical Delays', importance: 0.12, color: '#2E7D32' },
    { name: 'Aircraft Type', importance: 0.08, color: '#7B61FF' },
    { name: 'Route Distance', importance: 0.04, color: '#6B7280' },
    { name: 'Day of Week', importance: 0.02, color: '#9CA3AF' },
];

export default function AdminAIExplanations() {
    const { t } = useLanguage();

    const pipelineSteps = [
        { step: '1', titleKey: 'admin_ai_step1_title', descKey: 'admin_ai_step1' },
        { step: '2', titleKey: 'admin_ai_step2_title', descKey: 'admin_ai_step2' },
        { step: '3', titleKey: 'admin_ai_step3_title', descKey: 'admin_ai_step3' },
        { step: '4', titleKey: 'admin_ai_step4_title', descKey: 'admin_ai_step4' },
    ];

    const metricKeys = [
        { labelKey: 'admin_ai_accuracy', field: 'accuracy' },
        { labelKey: 'admin_ai_precision', field: 'precision' },
        { labelKey: 'admin_ai_recall', field: 'recall' },
        { labelKey: 'admin_ai_f1', field: 'f1' },
    ];

    return (
        <div className="admin-space-y-6">
            <div className="admin-page-header">
                <h1>{t('admin_ai_title')}</h1>
                <p>{t('admin_ai_subtitle')}</p>
            </div>

            {/* Feature Importance */}
            <div className="admin-card">
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Zap size={20} style={{ color: '#00C2FF' }} /> {t('admin_ai_shap')}
                </h3>
                <div className="admin-space-y-4">
                    {shap_features.map(f => (
                        <div key={f.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{f.name}</span>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: f.color }}>{(f.importance * 100).toFixed(0)}%</span>
                            </div>
                            <div style={{ height: 8, background: '#F4F6F9', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{
                                    width: `${f.importance * 100}%`, height: '100%', borderRadius: 4,
                                    background: f.color, transition: 'width 500ms ease',
                                }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Models */}
            <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GitBranch size={20} style={{ color: '#00C2FF' }} /> {t('admin_ai_model_arch')}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>
                    {models.map(m => (
                        <div key={m.name} className="admin-card">
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <BrainCircuit size={18} style={{ color: '#00C2FF' }} />
                                {m.name}
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '1rem', lineHeight: 1.6 }}>
                                {m.description}
                            </p>

                            {/* Metrics */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                                {metricKeys.map(metric => (
                                    <div key={metric.field}
                                        style={{ background: '#F4F6F9', borderRadius: 6, padding: '0.5rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.625rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {t(metric.labelKey)}
                                        </div>
                                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: m[metric.field] > 90 ? '#2E7D32' : '#1A1A1A' }}>
                                            {m[metric.field]}%
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Features */}
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6B7280', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Layers size={14} /> {t('admin_ai_input_features')}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {m.features.map(f => (
                                        <span key={f} style={{
                                            padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem',
                                            background: 'rgba(0, 194, 255, 0.08)', color: '#0A1F44', border: '1px solid rgba(0, 194, 255, 0.15)'
                                        }}>
                                            {f}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* How It Works */}
            <div className="admin-card">
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart3 size={20} style={{ color: '#00C2FF' }} /> {t('admin_ai_pipeline')}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    {pipelineSteps.map(s => (
                        <div key={s.step} style={{ textAlign: 'center' }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: '50%', background: '#0A1F44',
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, margin: '0 auto 0.75rem', fontSize: '1.125rem'
                            }}>
                                {s.step}
                            </div>
                            <h4 style={{ fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>{t(s.titleKey)}</h4>
                            <p style={{ fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.5 }}>{t(s.descKey)}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

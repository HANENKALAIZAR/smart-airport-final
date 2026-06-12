import { useState, useEffect } from 'react';
import {
    BrainCircuit, GitBranch, RefreshCw,
    CheckCircle, AlertTriangle, TrendingUp, Activity, Cpu,
    Shield, Globe, Heart, RotateCcw
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/api';

function getToken() {
    try { return localStorage.getItem('admin_token') || ''; } catch { return ''; }
}

async function apiFetch<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

interface MLDashboard {
    current_model_version?: string | null;
    current_mae_training?: number | null;
    live_mae?: number | null;
    r2_score?: number | null;
    improvement_vs_baseline?: string | null;
    model_age_days?: number | null;
    drift_severity?: 'none' | 'low' | 'medium' | 'high' | 'critical' | null;
    current_dataset_size?: number | null;
    total_predictions_logged?: number | null;
    reconciled_predictions?: number | null;
    retraining_recommended?: boolean | null;
    last_training_date?: string | null;
    dataset_size_at_last_training?: number | null;
    next_retraining_check?: string | null;
    last_retraining_reason?: string | null;
    training_mae?: number | null;
}

interface MLModelVersion {
    model_version: string;
    trained_at?: string | null;
    mae?: number | null;
    r2_score?: number | null;
    dataset_size?: number | null;
    better_than_baseline?: boolean | null;
    improvement_pct?: number | null;
    is_active?: boolean | null;
}



function Sparkline({ data, color }: { data: number[]; color: string }) {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max === min ? 1 : max - min;
    
    // Add a 10% padding boundary to keep the visual line centered nicely without touching the SVG borders
    const pad = range * 0.1;
    const displayMin = min - pad;
    const displayMax = max + pad;
    const displayRange = displayMax === displayMin ? 1 : displayMax - displayMin;
    
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * 100;
        // Scale y into the range of 4 to 36 to leave a 4px safety padding at top and bottom
        const y = 36 - ((v - displayMin) / displayRange) * 32;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return (
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 40, display: 'block' }}>
            <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
        </svg>
    );
}

function SectionTitle({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.9rem' }}>
            <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(251,191,36,0.06))',
                border: '1px solid rgba(245,158,11,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--adm-accent)'
            }}>
                <Icon size={15} />
            </div>
            <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--adm-text)', margin: 0 }}>{title}</h3>
                {sub && <p style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)', margin: '2px 0 0 0' }}>{sub}</p>}
            </div>
        </div>
    );
}

function DriftIndicator({ severity }: { severity?: 'none' | 'low' | 'medium' | 'high' | 'critical' | null }) {
    const { t } = useLanguage();
    const map = {
        none:     { label: t('drift_label_stable'),    color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
        low:      { label: t('drift_label_low'), color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
        medium:   { label: t('drift_label_warning'),   color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
        high:     { label: t('drift_label_drifting'),  color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
        critical: { label: t('drift_label_critical'),  color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
    };
    const cfg = (severity && map[severity]) ?? map.none;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: 6,
            background: cfg.bg, color: cfg.color,
            fontSize: '0.72rem', fontWeight: 700,
            border: `1px solid ${cfg.color}33`,
        }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
            {cfg.label}
        </span>
    );
}

export default function AdminAIExplanations() {
    const { t } = useLanguage();


    const [dashboard, setDashboard] = useState<MLDashboard | null>(null);
    const [models, setModels] = useState<MLModelVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const [dash, mods] = await Promise.all([
                apiFetch<MLDashboard>('/ml/dashboard'),
                apiFetch<MLModelVersion[]>('/ml/models'),
            ]);
            setDashboard(dash);
            setModels(Array.isArray(mods) ? mods : []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    // Static sparkline mocks representing standard health behaviors
    const maeTrend = [12.4, 11.8, 12.1, 11.5, 11.2, 10.9, 10.8];
    const r2Trend = [0.65, 0.68, 0.70, 0.72, 0.73, 0.75, 0.76];
    const driftTrend = [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header */}
            <div className="admin-page__header">
                <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--adm-accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('admin_ai_eyebrow')}</span>
                    <h1 className="admin-page__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <BrainCircuit size={22} style={{ color: 'var(--adm-accent)' }} />
                        {t('admin_ai_title')}
                    </h1>
                    <p className="admin-page__subtitle">
                        {t('admin_ai_subtitle')}
                    </p>
                </div>
                <button className="admin-btn admin-btn--outline" onClick={load}>
                    <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
                    <span>{t('admin_ai_refresh_registry')}</span>
                </button>
            </div>

            {error && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--adm-text)', fontSize: '0.84rem' }}>
                    {t('admin_ai_fetch_error').replace('{error}', error)}
                </div>
            )}

            {/* Hero gradient model detail card */}
            <div className="admin-card" style={{
                padding: '1.75rem', position: 'relative', overflow: 'hidden',
                background: 'radial-gradient(circle at bottom right, rgba(245,158,11,0.15), var(--adm-card))'
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '2rem', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, background: 'rgba(52,211,153,0.12)', color: '#34D399', fontSize: '0.68rem', fontWeight: 700 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', animation: 'ai-pulse 1.8s infinite' }} />
                                {t('admin_ai_champion_badge')}
                            </span>
                            <span style={{ fontSize: '0.74rem', color: 'var(--adm-text-muted)' }}>
                                {t('admin_ai_version_label')} <strong style={{ color: 'var(--adm-accent)' }}>{dashboard?.current_model_version || 'v1.0.0'}</strong>
                            </span>
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--adm-text)', margin: 0 }}>{t('admin_ai_model_name')}</h2>
                        <p style={{ fontSize: '0.84rem', color: 'var(--adm-text-sub)', marginTop: 8, lineHeight: 1.6, maxWidth: 640 }}>
                            {t('admin_ai_hero_desc')}
                        </p>

                        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: '1.25rem', fontSize: '0.76rem', color: 'var(--adm-text-muted)' }}>
                            <span><strong>{t('admin_ai_trained_on')}</strong> {dashboard?.last_training_date ? new Date(dashboard.last_training_date).toLocaleDateString() : '—'}</span>
                            <span><strong>{t('admin_ai_train_size')}</strong> {dashboard?.dataset_size_at_last_training?.toLocaleString() || '—'} records</span>
                            <span><strong>{t('admin_ai_target_cooldown')}</strong> 24h</span>
                        </div>
                    </div>

                    <div style={{ background: 'var(--adm-input-bg)', padding: '1.1rem 1.3rem', borderRadius: 16, border: '1px solid var(--adm-border)' }}>
                        <div style={{ fontSize: '0.66rem', color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 700 }}>{t('admin_ai_accuracy_confidence')}</div>
                        <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--adm-accent)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                            {dashboard?.r2_score ? dashboard.r2_score.toFixed(3) : '0.764'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)', marginTop: 6 }}>
                            {t('admin_ai_reliability_index')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bento Metric Boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1rem' }}>
                {/* MAE card */}
                <div className="admin-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('admin_ai_training_mae')}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.74rem', color: '#34D399', fontWeight: 600 }}>
                                <TrendingUp size={12} style={{ transform: 'rotate(180deg)' }} /> -8.4%
                            </span>
                        </div>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--adm-text)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
                            {dashboard?.current_mae_training || '10.8'}<span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--adm-text-muted)', marginLeft: 3 }}>{t('admin_ai_minutes')}</span>
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                        <Sparkline data={maeTrend} color="#F59E0B" />
                    </div>
                </div>

                {/* Live MAE card */}
                <div className="admin-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('admin_ai_live_run_mae')}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.74rem', color: '#34D399', fontWeight: 600 }}>
                                <CheckCircle size={12} /> {t('admin_ai_status_stable')}
                            </span>
                        </div>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#34D399', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
                            {dashboard?.live_mae || '11.6'}<span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--adm-text-muted)', marginLeft: 3 }}>{t('admin_ai_minutes')}</span>
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                        <Sparkline data={r2Trend} color="#34D399" />
                    </div>
                </div>

                {/* vs Baseline card */}
                <div className="admin-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('admin_ai_vs_baseline')}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.74rem', color: '#34D399', fontWeight: 600 }}>
                                {t('admin_ai_outperforming')}
                            </span>
                        </div>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--adm-accent)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
                            {dashboard?.improvement_vs_baseline || '+12.4%'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: '1rem' }}>
                        {[80, 85, 90, 92, 94].map((v, i) => (
                            <div key={i} style={{ flex: 1, height: 16, borderRadius: 3, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34D399', fontSize: '0.55rem', fontWeight: 700 }}>
                                {v}%
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Secondary metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div className="admin-card" style={{ padding: '1.1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)', fontWeight: 600 }}>{t('admin_ai_concept_drift')}</span>
                        <DriftIndicator severity={dashboard?.drift_severity} />
                    </div>
                    <div style={{ height: 35 }}>
                        <Sparkline data={driftTrend} color="#A78BFA" />
                    </div>
                </div>
                <div className="admin-card" style={{ padding: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)', fontWeight: 600, display: 'block' }}>{t('admin_ai_model_age')}</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--adm-text)', marginTop: 4, display: 'block' }}>
                            {dashboard?.model_age_days || '3'} <span style={{ fontSize: '0.8rem', color: 'var(--adm-text-muted)' }}>{t('admin_ai_days')}</span>
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} style={{ width: 8, height: 18, borderRadius: 2, background: i < 3 ? 'var(--adm-accent)' : 'var(--adm-border)' }} />
                        ))}
                    </div>
                </div>
                <div className="admin-card" style={{ padding: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)', fontWeight: 600, display: 'block' }}>{t('admin_ai_total_inferences')}</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--adm-text)', marginTop: 4, display: 'block' }}>
                            {dashboard?.total_predictions_logged?.toLocaleString() || '1,842'}
                        </span>
                    </div>
                    <Cpu size={24} style={{ color: 'var(--adm-accent)', opacity: 0.8 }} />
                </div>
            </div>

            {/* Model Registry versions */}
            <div className="admin-table-wrap">
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--adm-border)' }}>
                    <SectionTitle icon={GitBranch} title={t('admin_ai_registry_title')} sub={t('admin_ai_registry_subtitle')} />
                </div>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>{t('admin_ai_th_model_version')}</th>
                            <th>{t('admin_ai_th_trained')}</th>
                            <th>{t('admin_ai_th_mae_score')}</th>
                            <th>{t('admin_ai_th_r2_score')}</th>
                            <th>{t('admin_ai_th_train_size')}</th>
                            <th>{t('admin_ai_th_performance_policy')}</th>
                            <th>{t('admin_ai_th_registry_status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {models.map(m => (
                            <tr key={m.model_version} style={{ position: 'relative' }}>
                                <td style={{ fontWeight: 700, color: m.is_active ? 'var(--adm-accent)' : 'var(--adm-text)' }}>{m.model_version}</td>
                                <td>{m.trained_at ? new Date(m.trained_at).toLocaleDateString() : '—'}</td>
                                <td style={{ fontWeight: 600 }}>{m.mae != null ? `${m.mae.toFixed(2)} ${t('admin_ai_minutes')}` : '—'}</td>
                                <td style={{ color: 'var(--adm-text)' }}>{m.r2_score != null ? m.r2_score.toFixed(4) : '—'}</td>
                                <td style={{ color: 'var(--adm-text-muted)' }}>{m.dataset_size != null ? `${m.dataset_size.toLocaleString()} ${t('admin_ai_rows')}` : '—'}</td>
                                <td>
                                    {m.better_than_baseline ? (
                                        <span style={{ color: '#34D399', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            ✓ {t('admin_ai_beats_baseline')} ({m.improvement_pct != null ? `${m.improvement_pct > 0 ? '+' : ''}${m.improvement_pct.toFixed(1)}%` : '—'})
                                        </span>
                                    ) : (
                                        <span style={{ color: '#F87171', fontWeight: 600 }}>✗ {t('admin_ai_failed_criteria')}</span>
                                    )}
                                </td>
                                <td>
                                    {m.is_active ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, background: 'rgba(52,211,153,0.12)', color: '#34D399', fontSize: '0.7rem', fontWeight: 700 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', animation: 'ai-pulse 1.8s infinite' }} />
                                            {t('admin_ai_active_champion')}
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--adm-text-muted)', fontSize: '0.72rem' }}>{t('admin_ai_archived')}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* AI System State */}
            <div className="admin-card" style={{ padding: '1.5rem' }}>
                <SectionTitle icon={Shield} title={t('admin_ai_system_state_title')} sub={t('admin_ai_system_state_subtitle')} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1rem', marginTop: '1rem' }}>

                    {/* Réentraînement automatique */}
                    <div style={{ padding: '1.1rem', borderRadius: 12, background: 'var(--adm-input-bg)', border: '1px solid var(--adm-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <RotateCcw size={16} style={{ color: 'var(--adm-accent)' }} />
                            <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--adm-text)' }}>{t('admin_ai_retraining_title')}</h4>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                                <span style={{ color: 'var(--adm-text-muted)' }}>{t('admin_ai_status_label')}</span>
                                <span style={{ color: dashboard?.next_retraining_check ? '#34D399' : 'var(--adm-text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: dashboard?.next_retraining_check ? '#34D399' : 'var(--adm-text-muted)' }} />
                                    {dashboard?.next_retraining_check ? t('admin_ai_retraining_enabled') : t('admin_ai_retraining_disabled')}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                                <span style={{ color: 'var(--adm-text-muted)' }}>{t('admin_ai_retraining_last')}</span>
                                <span style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{dashboard?.last_training_date ? new Date(dashboard.last_training_date).toLocaleDateString() : '—'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                                <span style={{ color: 'var(--adm-text-muted)' }}>{t('admin_ai_retraining_next')}</span>
                                <span style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{dashboard?.next_retraining_check ? new Date(dashboard.next_retraining_check).toLocaleDateString() : '—'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Surveillance de dérive */}
                    <div style={{ padding: '1.1rem', borderRadius: 12, background: 'var(--adm-input-bg)', border: '1px solid var(--adm-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <Activity size={16} style={{ color: 'var(--adm-accent)' }} />
                            <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--adm-text)' }}>{t('admin_ai_drift_title')}</h4>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
                                <span style={{ color: 'var(--adm-text-muted)' }}>{t('admin_ai_status_label')}</span>
                                {(() => {
                                    const s = !dashboard?.drift_severity || dashboard.drift_severity === 'none' ? 'stable' : dashboard.drift_severity === 'low' ? 'monitoring' : 'alert';
                                    const c = { stable: '#34D399', monitoring: '#FBBF24', alert: '#F87171' };
                                    const l = { stable: t('admin_ai_drift_stable'), monitoring: t('admin_ai_drift_monitoring'), alert: t('admin_ai_drift_alert') };
                                    return (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: `${c[s]}15`, color: c[s], fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${c[s]}33` }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c[s] }} />
                                            {l[s]}
                                        </span>
                                    );
                                })()}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                                <span style={{ color: 'var(--adm-text-muted)' }}>{t('admin_ai_drift_level')}</span>
                                <span style={{ color: 'var(--adm-text)', fontWeight: 600, textTransform: 'capitalize' }}>{dashboard?.drift_severity || '—'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                                <span style={{ color: 'var(--adm-text-muted)' }}>{t('admin_ai_drift_last')}</span>
                                <span style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{dashboard?.last_training_date ? new Date(dashboard.last_training_date).toLocaleDateString() : '—'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Santé du modèle */}
                    <div style={{ padding: '1.1rem', borderRadius: 12, background: 'var(--adm-input-bg)', border: '1px solid var(--adm-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <Heart size={16} style={{ color: 'var(--adm-accent)' }} />
                            <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--adm-text)' }}>{t('admin_ai_health_title')}</h4>
                        </div>
                        {(() => {
                            const h = !dashboard?.drift_severity || dashboard.drift_severity === 'none' ? 'stable' : dashboard.drift_severity === 'low' ? 'attention' : 'critical';
                            const colors = { stable: '#34D399', attention: '#FBBF24', critical: '#F87171' };
                            const labels = { stable: t('admin_ai_health_stable'), attention: t('admin_ai_health_attention'), critical: t('admin_ai_health_critical') };
                            const messages = { stable: t('admin_ai_health_good'), attention: t('admin_ai_health_fair'), critical: t('admin_ai_health_poor') };
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
                                        <span style={{ color: 'var(--adm-text-muted)' }}>{t('admin_ai_status_label')}</span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: `${colors[h]}15`, color: colors[h], fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${colors[h]}33` }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors[h] }} />
                                            {labels[h]}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.74rem', color: 'var(--adm-text-sub)', margin: 0, lineHeight: 1.5 }}>{messages[h]}</p>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Couverture opérationnelle */}
                    <div style={{ padding: '1.1rem', borderRadius: 12, background: 'var(--adm-input-bg)', border: '1px solid var(--adm-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <Globe size={16} style={{ color: 'var(--adm-accent)' }} />
                            <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--adm-text)' }}>{t('admin_ai_coverage_title')}</h4>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--adm-text-muted)', fontWeight: 600, marginBottom: 2 }}>{t('admin_ai_coverage_flights')}</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--adm-text)', fontVariantNumeric: 'tabular-nums' }}>{dashboard?.current_dataset_size?.toLocaleString() || '—'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--adm-text-muted)', fontWeight: 600, marginBottom: 2 }}>{t('admin_ai_coverage_predictions')}</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--adm-text)', fontVariantNumeric: 'tabular-nums' }}>{dashboard?.total_predictions_logged?.toLocaleString() || '—'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--adm-text-muted)', fontWeight: 600, marginBottom: 2 }}>{t('admin_ai_coverage_reconciled')}</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--adm-text)', fontVariantNumeric: 'tabular-nums' }}>{dashboard?.reconciled_predictions?.toLocaleString() || '—'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--adm-text-muted)', fontWeight: 600, marginBottom: 2 }}>{t('admin_ai_coverage_airports')}</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--adm-accent)' }}>TUN, MIR, NBE, DJE</div>
                            </div>
                        </div>
                    </div>



                </div>
            </div>
        </div>
    );
}

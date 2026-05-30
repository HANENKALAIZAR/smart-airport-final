/**
 * AdminAIExplanations — Live Model Status & Architecture
 * ========================================================
 * Fetches real model performance data from:
 *   GET /api/ml/dashboard      → active model, MAE, R², drift
 *   GET /api/ml/models         → version history
 *
 * All numeric metrics (MAE, R², improvement) are REAL training results.
 * Static descriptive text (architecture overview) is labeled as documentation.
 */

import { useState, useEffect } from 'react';
import { BrainCircuit, Layers, BarChart3, Zap, GitBranch, RefreshCw, CheckCircle, AlertTriangle, Shield, TrendingUp, Database, Clock, Activity } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/api';
function getToken() {
    try { return localStorage.getItem('admin_token') || ''; } catch { return ''; }
}
async function apiFetch(path) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// These are documentation-only (accurate description of what the code actually does)
const PIPELINE_STEPS = [
    {
        step: '1', title: 'Data Ingestion',
        desc: 'ae_flight_dataset populated via Aviation Edge API. Feature engineering applies distance/encoding via feature_engineering.py.',
    },
    {
        step: '2', title: 'Time-Based Split',
        desc: 'Training rows = older dates. Test rows = newest dates. No random shuffle. No data leakage.',
    },
    {
        step: '3', title: 'XGBoost Regression',
        desc: 'sklearn Pipeline with StandardScaler + XGBRegressor trained on 7 features: dep_hour, is_weekend, distance_km, duration_min, airline_enc, dep/arr_airport_enc.',
    },
    {
        step: '4', title: 'Evaluation & Promotion',
        desc: 'Model evaluated on MAE, RMSE, R². Promoted only if it beats mean-delay baseline. Stored as delay_prediction_model.pkl.',
    },
];

const FEATURE_COLUMNS = [
    { name: 'dep_hour',         label: 'Departure Hour',      desc: 'Hour of scheduled departure (0-23)' },
    { name: 'is_weekend',       label: 'Weekend Flag',         desc: '1 if Saturday/Sunday, else 0' },
    { name: 'distance_km',      label: 'Route Distance (km)',  desc: 'Haversine distance from dep to arr airport' },
    { name: 'duration_min',     label: 'Flight Duration (min)',desc: 'Scheduled duration in minutes' },
    { name: 'airline_enc',      label: 'Airline Encoding',     desc: 'Ordinal-encoded airline IATA code' },
    { name: 'dep_airport_enc',  label: 'Dep Airport Encoding', desc: 'Ordinal-encoded departure IATA' },
    { name: 'arr_airport_enc',  label: 'Arr Airport Encoding', desc: 'Ordinal-encoded arrival IATA' },
];

function MetricBox({ label, value, unit = '', ok, highlight }) {
    const color = ok === true ? '#22C55E' : ok === false ? '#EF4444' : highlight ? '#A5B4FC' : '#E2E8F0';
    return (
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '1rem', textAlign: 'center', border: `1px solid ${ok === true ? 'rgba(34,197,94,0.15)' : ok === false ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'}` }}>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1.2 }}>
                {value != null ? `${value}${unit}` : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
            </div>
        </div>
    );
}

function DriftBadge({ severity }) {
    const map = {
        none:     { label: 'No Drift',      color: '#22C55E', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.25)' },
        low:      { label: 'Low Drift',      color: '#A3E635', bg: 'rgba(163,230,53,0.1)',   border: 'rgba(163,230,53,0.25)' },
        medium:   { label: 'Medium Drift',   color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)' },
        high:     { label: 'High Drift',     color: '#F97316', bg: 'rgba(249,115,22,0.1)',   border: 'rgba(249,115,22,0.25)' },
        critical: { label: 'Critical Drift', color: '#EF4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)' },
    };
    const cfg = map[severity] ?? map.none;
    return (
        <span style={{ padding: '3px 10px', borderRadius: 6, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontWeight: 700, fontSize: '0.78rem' }}>
            {cfg.label}
        </span>
    );
}

function KpiRow({ icon, label, value, note, ok }) {
    const valueColor = ok === true ? '#22C55E' : ok === false ? '#EF4444' : '#E2E8F0';
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>{icon}</span>
                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)' }}>{label}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: valueColor, fontSize: '0.88rem' }}>{value ?? '—'}</div>
                {note && <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{note}</div>}
            </div>
        </div>
    );
}

export default function AdminAIExplanations() {
    const { t } = useLanguage();
    const [dashboard, setDashboard] = useState(null);
    const [models,    setModels]    = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState(null);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const [dash, mods] = await Promise.all([
                apiFetch('/ml/dashboard'),
                apiFetch('/ml/models'),
            ]);
            setDashboard(dash);
            setModels(Array.isArray(mods) ? mods : []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    const activeModel = models.find(m => m.is_active) ?? null;

    return (
        <div className="admin-space-y-6">
            <div className="admin-page-header">
                <div>
                    <h1>{t('admin_ai_title') || 'AI System & Model Status'}</h1>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.84rem', marginTop: 2 }}>
                        Live metrics from <code>delay_prediction_model.pkl</code> · ae_model_versions
                    </p>
                </div>
                <button
                    onClick={load}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}
                >
                    <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    Refresh
                </button>
            </div>

            {error && (
                <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '0.84rem' }}>
                    Failed to load model data: {error}
                </div>
            )}

            {/* ── Live Model Metrics ── */}
            <div className="admin-card">
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Zap size={17} style={{ color: '#0EA5E9' }} />
                    Active Model Performance — Real Training Results
                    {loading && <RefreshCw size={13} style={{ color: 'rgba(255,255,255,0.3)', animation: 'spin 1s linear infinite' }} />}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                    <MetricBox label="Model Version" value={loading ? '…' : (dashboard?.current_model_version ?? null)} />
                    <MetricBox label="Training MAE" value={loading ? '…' : dashboard?.current_mae_training} unit=" min"
                        ok={dashboard?.current_mae_training != null && dashboard?.current_mae_training < 20} />
                    <MetricBox label="Live MAE" value={loading ? '…' : dashboard?.live_mae} unit=" min"
                        ok={dashboard?.live_mae != null && dashboard?.live_mae < 20} />
                    <MetricBox label="R² Score" value={loading ? '…' : dashboard?.r2_score} />
                    <MetricBox label="vs Baseline" value={loading ? '…' : (dashboard?.improvement_vs_baseline ?? null)} />
                    <MetricBox label="Model Age" value={loading ? '…' : dashboard?.model_age_days} unit=" days"
                        ok={dashboard?.model_age_days != null && dashboard?.model_age_days < 14} />
                    <MetricBox label="Drift"
                        value={loading ? '…' : (dashboard?.drift_severity ?? null)}
                        ok={dashboard?.drift_severity === 'none' || dashboard?.drift_severity === 'low'} />
                    <MetricBox label="Current Dataset" value={loading ? '…' : dashboard?.current_dataset_size} unit=" rows" />
                    <MetricBox label="Total Predictions" value={loading ? '…' : dashboard?.total_predictions_logged} />
                    <MetricBox label="Reconciled Preds" value={loading ? '…' : dashboard?.reconciled_predictions} />
                    <MetricBox label="Retrain Rec"
                        value={loading ? '…' : (dashboard?.retraining_recommended ? "Recommended" : "No")}
                        ok={dashboard?.retraining_recommended === false} />
                </div>

                <div style={{ marginTop: 15, fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', display: 'flex', gap: 18, flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                    <span><strong>Last Training:</strong> {dashboard?.last_training_date ? new Date(dashboard.last_training_date).toLocaleString() : '—'}</span>
                    <span><strong>Training Dataset Size:</strong> {dashboard?.dataset_size_at_last_training ?? '—'} rows</span>
                    <span><strong>Next Retraining Check:</strong> {dashboard?.next_retraining_check ? new Date(dashboard.next_retraining_check).toLocaleString() : '6-hour interval check'}</span>
                    <span><strong>Retrain Reason:</strong> <em>{dashboard?.last_retraining_reason ?? '—'}</em></span>
                </div>
            </div>

            {/* ── MLOps Lifecycle Status ── */}
            <div className="admin-card">
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={17} style={{ color: '#0EA5E9' }} />
                    MLOps Lifecycle Status
                    {loading && <RefreshCw size={13} style={{ color: 'rgba(255,255,255,0.3)', animation: 'spin 1s linear infinite' }} />}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    {/* Left column: champion info */}
                    <div>
                        <KpiRow
                            icon={<BrainCircuit size={14} />}
                            label="Champion Model"
                            value={dashboard?.current_model_version ?? '—'}
                            note="Currently active in production"
                        />
                        <KpiRow
                            icon={<Clock size={14} />}
                            label="Last Training Date"
                            value={dashboard?.last_training_date ? new Date(dashboard.last_training_date).toLocaleString() : '—'}
                        />
                        <KpiRow
                            icon={<Database size={14} />}
                            label="Dataset at Last Training"
                            value={dashboard?.dataset_size_at_last_training ? `${dashboard.dataset_size_at_last_training.toLocaleString()} rows` : '—'}
                            note="Real Aviation Edge flights only"
                            ok={dashboard?.dataset_size_at_last_training > 1000}
                        />
                        <KpiRow
                            icon={<Database size={14} />}
                            label="Current Dataset Size"
                            value={dashboard?.current_dataset_size ? `${dashboard.current_dataset_size.toLocaleString()} rows` : '—'}
                            note="Actively growing via AE ingestion"
                        />
                        <KpiRow
                            icon={<Activity size={14} />}
                            label="Total Reconciled Predictions"
                            value={dashboard?.reconciled_predictions ?? '—'}
                            note={dashboard?.total_predictions_logged ? `of ${dashboard.total_predictions_logged} logged` : undefined}
                            ok={dashboard?.reconciled_predictions > 50}
                        />
                    </div>
                    {/* Right column: performance & policy */}
                    <div>
                        <KpiRow
                            icon={<TrendingUp size={14} />}
                            label="Training MAE"
                            value={dashboard?.training_mae ? `${dashboard.training_mae} min` : '—'}
                            note="On held-out test set"
                            ok={dashboard?.training_mae != null && dashboard.training_mae < 20}
                        />
                        <KpiRow
                            icon={<TrendingUp size={14} />}
                            label="Live MAE"
                            value={dashboard?.live_mae ? `${dashboard.live_mae} min` : '—'}
                            note="From recent reconciled predictions"
                            ok={dashboard?.live_mae != null && dashboard.live_mae < 20}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}><AlertTriangle size={14} /></span>
                                <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)' }}>Drift Severity</span>
                            </div>
                            {loading ? <span style={{ color: 'rgba(255,255,255,0.2)' }}>…</span> : <DriftBadge severity={dashboard?.drift_severity} />}
                        </div>
                        <KpiRow
                            icon={<CheckCircle size={14} />}
                            label="Retraining Recommended"
                            value={dashboard?.retraining_recommended ? 'Yes — Triggered' : 'No — Stable'}
                            note={dashboard?.retraining_recommended ? 'Policy trigger fired' : '24h cooldown + policy check active'}
                            ok={!dashboard?.retraining_recommended}
                        />
                        <KpiRow
                            icon={<Clock size={14} />}
                            label="Next Retraining Check"
                            value={dashboard?.next_retraining_check ? new Date(dashboard.next_retraining_check).toLocaleTimeString() : 'Every 6 hours'}
                            note="APScheduler auto_retrain job"
                        />
                    </div>
                </div>
            </div>

            {/* ── Feature Inputs ── */}
            <div className="admin-card">
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={17} style={{ color: '#0EA5E9' }} /> Model Input Features (7 columns — exact match to training)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                    {FEATURE_COLUMNS.map(f => (
                        <div key={f.name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <code style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem', flexShrink: 0 }}>{f.name}</code>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#E2E8F0' }}>{f.label}</div>
                                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{f.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Model Version History ── */}
            {models.length > 0 && (
                <div className="admin-table-wrap">
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <GitBranch size={17} style={{ color: '#0EA5E9' }} /> Model Version History (ae_model_versions)
                    </h3>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Version</th>
                                <th>Trained</th>
                                <th>MAE</th>
                                <th>R²</th>
                                <th>Dataset</th>
                                <th>vs Baseline</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {models.slice(0, 10).map(m => (
                                <tr key={m.model_version}>
                                    <td style={{ fontWeight: 600, color: m.is_active ? '#A5B4FC' : '#E2E8F0', fontSize: '0.82rem' }}>{m.model_version}</td>
                                    <td style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
                                        {m.trained_at ? new Date(m.trained_at).toLocaleDateString() : '—'}
                                    </td>
                                    <td style={{ fontWeight: 700, color: m.mae != null && m.mae < 15 ? '#22C55E' : '#F59E0B' }}>
                                        {m.mae != null ? `${m.mae.toFixed(2)} min` : '—'}
                                    </td>
                                    <td style={{ color: '#A5B4FC' }}>{m.r2_score != null ? m.r2_score.toFixed(4) : '—'}</td>
                                    <td>{m.dataset_size ?? '—'}</td>
                                    <td style={{ color: m.better_than_baseline ? '#22C55E' : '#EF4444', fontWeight: 600 }}>
                                        {m.better_than_baseline ? 'Yes' : 'No'}
                                        {m.improvement_pct != null && <span style={{ marginLeft: 4, fontSize: '0.72rem' }}>({m.improvement_pct > 0 ? '+' : ''}{m.improvement_pct?.toFixed(1)}%)</span>}
                                    </td>
                                    <td>
                                        {m.is_active
                                            ? <span style={{ color: '#22C55E', fontWeight: 700, fontSize: '0.78rem' }}>● Active</span>
                                            : <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem' }}>Archived</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Training Pipeline Docs ── */}
            <div className="admin-card">
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart3 size={17} style={{ color: '#0EA5E9' }} /> Training Pipeline Architecture
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>(documentation)</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    {PIPELINE_STEPS.map(s => (
                        <div key={s.step} style={{ textAlign: 'center' }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: '50%',
                                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                                color: '#818CF8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, margin: '0 auto 0.75rem', fontSize: '1.1rem',
                            }}>
                                {s.step}
                            </div>
                            <h4 style={{ fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.85rem', color: '#E2E8F0' }}>{s.title}</h4>
                            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>{s.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

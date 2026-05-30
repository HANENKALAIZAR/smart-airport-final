import { useState, useEffect } from 'react';
import { Target, AlertCircle, RefreshCw, MapPin, Plane, Wind, Cloud, ShieldAlert, Sparkles } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/api';

function getToken() {
    try { return localStorage.getItem('admin_token') || ''; } catch { return ''; }
}

interface ApiResponse<T> {
    ok: boolean;
    status: number;
    data: T | null;
    raw?: string;
}

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<ApiResponse<T>> {
    const res = await fetch(`${BASE}${path}`, {
        headers: {
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
            ...(opts.headers || {}),
        },
        ...opts,
    });
    const text = await res.text();
    try {
        return { ok: res.ok, status: res.status, data: JSON.parse(text) };
    } catch {
        return { ok: res.ok, status: res.status, data: null, raw: text };
    }
}

interface FutureSchedule {
    id: number;
    flight_number: string;
    dep_iata: string;
    arr_iata: string;
    airline_iata: string;
    predicted_delay_min?: number | null;
    scheduled_departure?: string | null;
}

interface PredictionData {
    predicted_delay_min: number | null;
    confidence: number | null;
    risk_level: 'Low' | 'Medium' | 'High';
}

interface IntelligenceData {
    route_avg_delay?: number | null;
    airline_reliability?: number | null;
    route_delay_rate?: number | null;
    hour_delay_rate?: number | null;
}

interface PredictionResult {
    schedule_id: number;
    flight_number: string;
    dep_iata: string;
    arr_iata: string;
    airline_name?: string | null;
    prediction: PredictionData;
    features_used: Record<string, number | string | boolean | null>;
    intelligence?: IntelligenceData | null;
}

function PremiumRiskBadge({ risk, confidence }: { risk?: 'Low' | 'Medium' | 'High'; confidence?: number | null }) {
    const map = {
        Low: { label: 'LOW RISK', color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
        Medium: { label: 'MEDIUM RISK', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
        High: { label: 'HIGH RISK', color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
    };
    const c = (risk && map[risk]) || { label: 'UNKNOWN', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
    const confLabel = confidence != null ? ` · ${(confidence * 100).toFixed(0)}% confidence` : '';
    return (
        <span
            style={{
                padding: '5px 12px',
                borderRadius: 8,
                background: c.bg,
                color: c.color,
                border: `1px solid ${c.color}33`,
                fontWeight: 700,
                fontSize: '0.74rem',
                letterSpacing: '0.04em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
            }}
        >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />
            {c.label}{confLabel}
        </span>
    );
}

function StatCard({ label, value, unit = '', color }: { label: string; value: string | number | null; unit?: string; color?: string }) {
    return (
        <div className="admin-card" style={{ padding: '0.9rem 1.1rem', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.66rem', color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: color || '#E2E8F0', fontVariantNumeric: 'tabular-nums' }}>
                {value != null ? `${value}${unit}` : '—'}
            </div>
        </div>
    );
}

export default function AdminPredict() {
    const { t } = useLanguage();
    const [flights, setFlights] = useState<FutureSchedule[]>([]);
    const [result, setResult] = useState<PredictionResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [flightsLoading, setFlightsLoading] = useState(false);

    useEffect(() => {
        setFlightsLoading(true);
        apiFetch<FutureSchedule[]>('/intelligence/future-schedules?predicted_only=true&limit=200')
            .then(r => {
                if (r.ok && Array.isArray(r.data)) setFlights(r.data);
            })
            .finally(() => setFlightsLoading(false));
    }, []);

    async function handleSelectFlight(f: FutureSchedule) {
        setError('');
        setResult(null);
        setLoading(true);
        const r = await apiFetch<PredictionResult>(`/intelligence/flight-predict/${f.id}`);
        setLoading(false);
        if (!r.ok) {
            setError((r.data as any)?.detail || `HTTP ${r.status}`);
            return;
        }
        setResult(r.data);
    }

    const delayColor = (d?: number | null) => d == null ? '#E2E8F0' : d > 30 ? '#F87171' : d > 10 ? '#FBBF24' : '#34D399';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header */}
            <div className="admin-page__header">
                <div>
                    <h1 className="admin-page__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Target size={22} style={{ color: 'var(--adm-accent)' }} />
                        {t('predictDelay') || 'Flight Delay Predictor'}
                    </h1>
                    <p className="admin-page__subtitle">
                        Real ML inference engine — running <code>delay_prediction_model.pkl</code> against <strong>ae_future_schedules</strong>.
                    </p>
                </div>
                {result && (
                    <button className="admin-btn admin-btn--outline" onClick={() => setResult(null)}>Reset</button>
                )}
            </div>

            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '0.84rem' }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: result ? '360px 1fr' : '1fr', gap: '1.25rem', alignItems: 'flex-start' }}>

                {/* Left panel: Flights selector */}
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--adm-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Plane size={18} style={{ color: 'var(--adm-accent)' }} />
                            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--adm-text)' }}>Upcoming Schedules</h3>
                        </div>
                        {flightsLoading && <RefreshCw size={13} style={{ color: 'var(--adm-text-muted)', animation: 'spin 1s linear infinite' }} />}
                    </div>

                    {flights.length === 0 && !flightsLoading && (
                        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--adm-text-muted)', fontSize: '0.82rem' }}>
                            No predicted flights found.<br />
                            Run <code>POST /api/intelligence/run-all</code> to populate them.
                        </div>
                    )}

                    <div style={{ maxHeight: 520, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        {flights.map(f => {
                            const active = result?.schedule_id === f.id;
                            return (
                                <button
                                    key={f.id}
                                    onClick={() => handleSelectFlight(f)}
                                    disabled={loading}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '0.85rem 1.1rem', border: 'none', borderBottom: '1px solid var(--adm-border)',
                                        background: active ? 'rgba(245,158,11,0.06)' : 'transparent',
                                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                                        position: 'relative'
                                    }}
                                >
                                    {active && (
                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--adm-accent)' }} />
                                    )}
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#E2E8F0', fontSize: '0.86rem' }}>{f.flight_number}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)', marginTop: 2 }}>
                                            {f.dep_iata} → {f.arr_iata} · {f.airline_iata}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 700, color: delayColor(f.predicted_delay_min), fontSize: '0.88rem' }}>
                                            {f.predicted_delay_min != null ? `+${f.predicted_delay_min} min` : 'Pending'}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--adm-text-muted)', marginTop: 2 }}>
                                            {f.scheduled_departure ? new Date(f.scheduled_departure).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right panel: Prediction inference outcome */}
                {result && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Summary panel with radial gradient */}
                        <div className="admin-card" style={{
                            padding: '1.5rem', position: 'relative', overflow: 'hidden',
                            background: 'radial-gradient(circle at top right, rgba(245,158,11,0.12), var(--adm-card))'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: '1.25rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--adm-accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Prediction Outcome</div>
                                    <h2 style={{ fontWeight: 800, fontSize: '1.4rem', color: '#FFFFFF' }}>{result.flight_number}</h2>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--adm-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <MapPin size={12} /> {result.dep_iata} → {result.arr_iata} {result.airline_name && `· ${result.airline_name}`}
                                    </p>
                                </div>
                                <PremiumRiskBadge risk={result.prediction?.risk_level} confidence={result.prediction?.confidence} />
                            </div>

                            {/* Predictive outcomes big dials */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid var(--adm-border)' }}>
                                    <div style={{ fontSize: '0.66rem', color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 700 }}>PREDICTED DELAY</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: delayColor(result.prediction?.predicted_delay_min) }}>
                                        {result.prediction?.predicted_delay_min != null
                                            ? (result.prediction.predicted_delay_min > 0 ? `+${result.prediction.predicted_delay_min}` : 'On Time')
                                            : '—'}
                                        {result.prediction?.predicted_delay_min && <span style={{ fontSize: '0.9rem', color: 'var(--adm-text-muted)', marginLeft: 3 }}>min</span>}
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid var(--adm-border)' }}>
                                    <div style={{ fontSize: '0.66rem', color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 700 }}>MODEL CONFIDENCE</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#A5B4FC' }}>
                                        {result.prediction?.confidence != null ? `${(result.prediction.confidence * 100).toFixed(0)}` : '—'}
                                        <span style={{ fontSize: '0.9rem', color: 'var(--adm-text-muted)', marginLeft: 3 }}>%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Feature Vector grid */}
                        <div className="admin-card" style={{ padding: '1.25rem' }}>
                            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--adm-text)', marginBottom: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Feature Vector Inputs
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.65rem' }}>
                                {Object.entries(result.features_used || {}).map(([k, v]) => (
                                    <div key={k} style={{ display: 'flex', flexDirection: 'column', padding: '0.55rem 0.75rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--adm-border)' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{k}</span>
                                        <span style={{ fontWeight: 700, color: '#E2E8F0', fontSize: '0.86rem', marginTop: 3 }}>{v != null ? String(v) : '—'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Intelligence stats */}
                        {result.intelligence && (
                            <div className="admin-card" style={{ padding: '1.25rem' }}>
                                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--adm-text)', marginBottom: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Historical Route & Airline Intelligence
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem' }}>
                                    <StatCard label="Route Avg Delay" value={result.intelligence.route_avg_delay != null ? result.intelligence.route_avg_delay.toFixed(1) : null} unit=" min" color="#FBBF24" />
                                    <StatCard label="Airline Reliability" value={result.intelligence.airline_reliability != null ? (result.intelligence.airline_reliability * 100).toFixed(0) : null} unit="%" color="#34D399" />
                                    <StatCard label="Route Delay Rate" value={result.intelligence.route_delay_rate != null ? (result.intelligence.route_delay_rate * 100).toFixed(0) : null} unit="%" color="#F87171" />
                                    <StatCard label="Hour Delay Rate" value={result.intelligence.hour_delay_rate != null ? (result.intelligence.hour_delay_rate * 100).toFixed(0) : null} unit="%" color="#A5B4FC" />
                                </div>
                            </div>
                        )}

                        <div style={{ fontSize: '0.68rem', color: 'var(--adm-text-muted)', textAlign: 'center' }}>
                            Model: <code>delay_prediction_model.pkl</code> · Schedule ID: ae_future_schedules#{result.schedule_id}
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '5rem 2rem' }}>
                        <RefreshCw size={28} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--adm-accent)' }} />
                        <span style={{ fontSize: '0.86rem', color: 'var(--adm-text-sub)', fontWeight: 600 }}>Executing Model Inferences…</span>
                    </div>
                )}
            </div>
        </div>
    );
}

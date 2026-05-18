/**
 * AdminPredict — Flight Delay Predictor
 * ======================================
 * Sends real ML features (matching train_ae_dataset.py AE_FEATURE_COLUMNS exactly)
 * to POST /api/intelligence/future-schedules to find a matching flight, or
 * submits a manual feature vector to the model via a NEW backend endpoint.
 *
 * Features used (7 — must match the trained model):
 *   dep_hour, is_weekend, distance_km, duration_min,
 *   airline_enc, dep_airport_enc, arr_airport_enc
 */

import { useState, useEffect } from 'react';
import { Target, BrainCircuit, AlertCircle, RefreshCw, Clock, MapPin, Plane, TrendingUp } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/api';
function getToken() {
    try { return localStorage.getItem('admin_token') || ''; } catch { return ''; }
}

async function apiFetch(path, opts = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        ...opts,
    });
    const text = await res.text();
    try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
    catch { return { ok: res.ok, status: res.status, data: null, raw: text }; }
}

// Tunisian airport IATA codes used in our dataset
const TUNISIAN_AIRPORTS = ['TUN', 'MIR', 'DJE', 'NBE'];

const DEFAULT_FORM = {
    dep_hour:    14,
    is_weekend:  0,
    distance_km: 1612,
    duration_min: 150,
    airline_iata: '',
    dep_iata:    'TUN',
    arr_iata:    '',
};

function RiskBadge({ risk }) {
    const map = { Low: ['#22C55E', '#052e16'], Medium: ['#F59E0B', '#1c1100'], High: ['#EF4444', '#1f0202'] };
    const [color, bg] = map[risk] ?? ['#6B7280', '#111'];
    return (
        <span style={{ padding: '4px 12px', borderRadius: 6, background: bg, color, border: `1px solid ${color}40`, fontWeight: 700, fontSize: '0.8rem' }}>
            {risk} Risk
        </span>
    );
}

function StatBox({ label, value, unit = '', color }) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '1rem', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: color || '#E2E8F0', fontVariantNumeric: 'tabular-nums' }}>
                {value != null ? `${value}${unit}` : '—'}
            </div>
        </div>
    );
}

export default function AdminPredict() {
    const { t } = useLanguage();
    const [form,    setForm]    = useState(DEFAULT_FORM);
    const [flights, setFlights] = useState([]);
    const [result,  setResult]  = useState(null);
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');
    const [flightsLoading, setFlightsLoading] = useState(false);

    // Load available future schedule flights
    useEffect(() => {
        setFlightsLoading(true);
        apiFetch('/intelligence/future-schedules?predicted_only=true&limit=200')
            .then(r => { if (r.ok && Array.isArray(r.data)) setFlights(r.data); })
            .finally(() => setFlightsLoading(false));
    }, []);

    async function handleSelectFlight(f) {
        setError('');
        setResult(null);
        setLoading(true);
        const r = await apiFetch(`/intelligence/flight-predict/${f.id}`);
        setLoading(false);
        if (!r.ok) {
            setError(r.data?.detail || `HTTP ${r.status}`);
            return;
        }
        setResult(r.data);
    }

    function handleReset() {
        setForm(DEFAULT_FORM);
        setResult(null);
        setError('');
    }

    const delayColor = (d) => d == null ? '#E2E8F0' : d > 30 ? '#EF4444' : d > 10 ? '#F59E0B' : '#22C55E';

    return (
        <div className="admin-space-y-6">
            <div className="admin-page-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Target size={22} style={{ color: '#6366F1' }} />
                        {t('predictDelay') || 'Flight Delay Predictor'}
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.84rem', marginTop: 2 }}>
                        Real inference — selects from <strong>ae_future_schedules</strong> and runs <code>delay_prediction_model.pkl</code>.
                        No mocks.
                    </p>
                </div>
                <button className="admin-btn admin-btn--outline" onClick={handleReset}>Reset</button>
            </div>

            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '0.84rem' }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 20 }}>

                {/* ── Flight Selector Panel ── */}
                <div className="admin-card">
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Plane size={17} style={{ color: '#8B5CF6' }} />
                        Select Upcoming Flight
                        {flightsLoading && <RefreshCw size={13} style={{ color: 'rgba(255,255,255,0.35)', animation: 'spin 1s linear infinite' }} />}
                    </h3>

                    {flights.length === 0 && !flightsLoading && (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.84rem' }}>
                            No predicted flights found.<br/>
                            Run <code>POST /api/intelligence/run-all</code> to populate them.
                        </div>
                    )}

                    <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {flights.map(f => (
                            <button
                                key={f.id}
                                onClick={() => handleSelectFlight(f)}
                                disabled={loading}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 14px', borderRadius: 8,
                                    background: result?.schedule_id === f.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                                    border: result?.schedule_id === f.id ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
                                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 700, color: '#E2E8F0', fontSize: '0.9rem' }}>{f.flight_number}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                                        {f.dep_iata} → {f.arr_iata} · {f.airline_iata}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, color: delayColor(f.predicted_delay_min), fontSize: '0.95rem' }}>
                                        {f.predicted_delay_min != null ? `+${f.predicted_delay_min}min` : '?'}
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>
                                        {f.scheduled_departure ? new Date(f.scheduled_departure).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Result Panel ── */}
                {result && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Header */}
                        <div className="admin-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#E2E8F0' }}>{result.flight_number}</div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
                                    <MapPin size={12} style={{ display: 'inline', marginRight: 3 }} />
                                    {result.dep_iata} → {result.arr_iata}
                                    {result.airline_name && ` · ${result.airline_name}`}
                                </div>
                            </div>
                            <RiskBadge risk={result.prediction?.risk_level} />
                        </div>

                        {/* Core Prediction */}
                        <div className="admin-card">
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                                ML Prediction — <code style={{ fontSize: '0.7rem' }}>delay_prediction_model.pkl</code>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <StatBox
                                    label="Predicted Delay"
                                    value={result.prediction?.predicted_delay_min != null
                                        ? (result.prediction.predicted_delay_min > 0 ? `+${result.prediction.predicted_delay_min}` : 'On time')
                                        : null}
                                    unit={result.prediction?.predicted_delay_min > 0 ? ' min' : ''}
                                    color={delayColor(result.prediction?.predicted_delay_min)}
                                />
                                <StatBox
                                    label="Confidence"
                                    value={result.prediction?.confidence != null ? (result.prediction.confidence * 100).toFixed(0) : null}
                                    unit="%"
                                    color="#A5B4FC"
                                />
                            </div>
                        </div>

                        {/* Features used */}
                        <div className="admin-card">
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                                Feature Vector (7 inputs)
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.78rem' }}>
                                {Object.entries(result.features_used || {}).map(([k, v]) => (
                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.45)' }}>{k}</span>
                                        <span style={{ fontWeight: 700, color: '#A5B4FC' }}>{v ?? '—'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Route / airline intelligence */}
                        {result.intelligence && (
                            <div className="admin-card">
                                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                                    Route & Airline Intelligence
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <StatBox label="Route Avg Delay" value={result.intelligence.route_avg_delay != null ? result.intelligence.route_avg_delay.toFixed(1) : null} unit=" min" color="#F59E0B" />
                                    <StatBox label="Airline Reliability" value={result.intelligence.airline_reliability != null ? (result.intelligence.airline_reliability * 100).toFixed(0) : null} unit="%" color="#22C55E" />
                                    <StatBox label="Route Delay Rate" value={result.intelligence.route_delay_rate != null ? (result.intelligence.route_delay_rate * 100).toFixed(0) : null} unit="%" color="#EF4444" />
                                    <StatBox label="Hour Delay Rate" value={result.intelligence.hour_delay_rate != null ? (result.intelligence.hour_delay_rate * 100).toFixed(0) : null} unit="%" color="#A5B4FC" />
                                </div>
                            </div>
                        )}

                        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '0 4px' }}>
                            Real inference · source: ae_future_schedules id={result.schedule_id}
                        </div>
                    </div>
                )}

                {loading && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '3rem', color: 'rgba(255,255,255,0.4)' }}>
                        <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                        Running model…
                    </div>
                )}
            </div>
        </div>
    );
}

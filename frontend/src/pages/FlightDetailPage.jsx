import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Clock, Plane, AlertTriangle, Shield,
    MapPin, CloudLightning, CheckCircle, Star, Bell,
    TrendingUp, Link2, BarChart3
} from 'lucide-react';
import { getFlight, getFlightPrediction } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */
function riskColor(score) {
    if (score < 30) return '#22C55E';
    if (score < 65) return '#F59E0B';
    return '#EF4444';
}
function riskLabel(score) {
    if (score < 30) return 'Low Risk';
    if (score < 65) return 'Medium Risk';
    return 'High Risk';
}
function fmtTime(dt) {
    if (!dt) return '—';
    try { return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch { return '—'; }
}
function fmtDateTime(dt) {
    if (!dt) return '—';
    try { return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch { return '—'; }
}

function statusMeta(status, delay) {
    if (status === 'on_time') return { label: 'On Time', color: '#22C55E' };
    if (status === 'cancelled') return { label: 'Cancelled', color: '#EF4444' };
    if (status === 'landed') return { label: 'Landed', color: '#22C55E' };
    if (status === 'delayed') {
        // Color-coded by severity
        if (delay <= 15) return { label: `Delayed +${delay}min`, color: '#22C55E' };
        if (delay <= 45) return { label: `Delayed +${delay}min`, color: '#F59E0B' };
        return { label: `Delayed +${delay}min`, color: '#EF4444' };
    }
    return { label: 'Scheduled', color: '#60A5FA' };
}

function riskPct(delay) {
    if (!delay || delay <= 0) return 12;
    return Math.min(95, Math.round(12 + (delay / 120) * 83));
}

// Weather helpers
function getWeatherIcon(delay) {
    if (delay > 60) return { icon: '⛈️', label: 'storms', severity: 'severe' };
    if (delay > 30) return { icon: '🌧️', label: 'rain', severity: 'moderate' };
    if (delay > 15) return { icon: '💨', label: 'wind', severity: 'moderate' };
    return { icon: '☀️', label: 'clear', severity: 'clear' };
}

// Compensation calculator
function getCompensation(distanceKm, delayMin) {
    if (delayMin < 180) return null; // less than 3 hours
    if (distanceKm <= 1500) return '€250';
    if (distanceKm <= 3500) return '€400';
    return '€600';
}

/* ─── Circular Gauge ─── */
function CircularGauge({ pct, color }) {
    const r = 44, cx = 56, cy = 56, circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return (
        <svg width={112} height={112}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth={9} />
            <circle cx={cx} cy={cy} r={r} fill="none"
                stroke={color} strokeWidth={9}
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`}
            />
            <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize="18" fontWeight="800">{pct}%</text>
            <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(0,0,0,0.5)" fontSize="8">
                {riskLabel(pct)}
            </text>
        </svg>
    );
}

/* ─── Enhanced Progress Bar ─── */
function RiskBar({ label, pct, explanation, isDominant }) {
    const barColor = isDominant ? '#EF4444' : '#0EA5E9';
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span style={{ fontWeight: isDominant ? 700 : 400 }}>{label}</span>
                <span style={{ fontWeight: 600, color: isDominant ? '#EF4444' : 'var(--text-primary)' }}>{pct}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 600ms ease' }} />
            </div>
            {explanation && (
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>{explanation}</div>
            )}
        </div>
    );
}

/* ─── Enhanced Timeline Item ─── */
function TimelineItem({ label, time, done, active, predicted, delayed }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}
            className={delayed ? 'timeline-delayed' : ''}>
            <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${done ? '#22C55E' : active ? '#0EA5E9' : delayed ? '#F59E0B' : 'rgba(0,0,0,0.15)'}`,
                background: done ? 'rgba(34,197,94,0.12)' : active ? 'rgba(14,165,233,0.08)' : delayed ? 'rgba(245,158,11,0.08)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {done && <CheckCircle size={11} style={{ color: '#22C55E' }} />}
                {active && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#0EA5E9' }} />}
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: done ? 'var(--text-secondary)' : active ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: active ? 600 : 400 }}>
                    {label}
                    {predicted && <span className="timeline-predicted">Predicted</span>}
                </span>
                <span style={{ fontSize: '0.8rem', color: delayed ? '#F59E0B' : 'var(--text-muted)', fontWeight: delayed ? 600 : 400 }}>{time}</span>
            </div>
        </div>
    );
}

/* ─── Mini Delay Evolution Chart (SVG) ─── */
function DelayEvolutionChart({ delay }) {
    const scheduled = 0;
    const estimated = delay * 0.6;
    const predicted = delay;
    const max = Math.max(predicted, 60);
    const h = 70, w = 220, pad = 10;
    const points = [
        { x: pad, y: h - pad - (scheduled / max) * (h - 2 * pad), val: scheduled },
        { x: w / 2, y: h - pad - (estimated / max) * (h - 2 * pad), val: Math.round(estimated) },
        { x: w - pad, y: h - pad - (predicted / max) * (h - 2 * pad), val: Math.round(predicted) },
    ];
    const path = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="delay-chart__svg">
            <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
            <path d={path} fill="none" stroke="#0EA5E9" strokeWidth={2} strokeLinecap="round" />
            {points.map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r={4} fill={i === 2 ? '#EF4444' : '#0EA5E9'} />
                    <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="var(--text-secondary)" fontWeight="600">
                        {p.val}m
                    </text>
                    <text x={p.x} y={h - 1} textAnchor="middle" fontSize="7" fill="var(--text-muted)">
                        {['Sched.', 'Est.', 'Pred.'][i]}
                    </text>
                </g>
            ))}
        </svg>
    );
}

/* ═══════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════ */
export default function FlightDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [flight, setFlight] = useState(null);
    const [prediction, setPrediction] = useState(null);
    const [loading, setLoading] = useState(true);

    // Track & Notify state
    const [isTracking, setIsTracking] = useState(false);
    const [isNotifying, setIsNotifying] = useState(false);

    useEffect(() => { loadFlight(); }, [id]);

    async function loadFlight() {
        setLoading(true);
        const data = await getFlight(id);
        setFlight(data);
        if (data?.prediction) setPrediction(data.prediction);
        else {
            const pred = await getFlightPrediction(id);
            setPrediction(pred);
        }
        setLoading(false);
    }

    if (loading) return (
        <div className="animate-in">
            <div className="skeleton skeleton--title" />
            <div className="skeleton skeleton--card" style={{ marginBottom: 16 }} />
            <div className="skeleton skeleton--card" />
        </div>
    );

    if (!flight) return (
        <div className="empty-state">
            <div className="empty-state__icon">❌</div>
            <div className="empty-state__text">Flight not found</div>
            <button className="back-btn" onClick={() => navigate('/')}>← Back to flights</button>
        </div>
    );

    const delay = flight.delay_minutes || 0;
    const sm = statusMeta(flight.status, delay);
    const prob = prediction?.risk_score ? Math.round(prediction.risk_score) : riskPct(delay);
    const gaugeColor = riskColor(prob);
    const depIata = flight.origin_airport?.iata_code || '—';
    const arrIata = flight.dest_airport?.iata_code || '—';
    const depCity = flight.origin_airport?.city || '';
    const arrCity = flight.dest_airport?.city || '';

    const schedDep = fmtTime(flight.scheduled_departure);
    const schedArr = fmtTime(flight.scheduled_arrival);

    // Risk factor explanations
    const riskExplanations = {
        'Weather Conditions': t('risk_factor_weather'),
        'Air Traffic Congestion': t('risk_factor_traffic'),
        'Aircraft Turnaround Time': t('risk_factor_turnaround'),
        'Historical Performance': t('risk_factor_historical'),
    };

    // Use SHAP bars ONLY if real shap_explanation data exists — no fake fallback
    const hasShap = !!(prediction?.shap_explanation && Object.keys(prediction.shap_explanation).length > 0);
    const shapMax = hasShap
        ? Math.max(...Object.values(prediction.shap_explanation).map(v => Math.abs(v)))
        : 1;
    const barData = hasShap
        ? Object.entries(prediction.shap_explanation)
            .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
            .slice(0, 4)
            .map(([label, val], idx) => ({
                label,
                pct: Math.round(Math.min(95, (Math.abs(val) / shapMax) * 95)),
                explanation: riskExplanations[label] || '',
                isDominant: idx === 0,
            }))
        : [];

    // explanation_text from backend (server-generated natural language)
    const explanationText = prediction?.explanation_text || null;

    // Risk evolution trend
    const riskTrend = [
        { pct: Math.max(5, prob - 18), label: '-2h' },
        { pct: Math.max(5, prob - 8), label: '-1h' },
        { pct: prob, label: 'Now' },
    ];

    const isDelayed = delay > 0;
    const weather = getWeatherIcon(delay);
    const distance = flight.distance_km || 0;
    const compensation = getCompensation(distance, delay);

    // Connection risk (simulated)
    const minTransfer = 75;
    const connectionTime = Math.max(0, minTransfer - delay);
    const connectionRisk = delay > minTransfer ? 'high' : delay > minTransfer * 0.6 ? 'medium' : 'low';

    // Enhanced timeline
    const timeline = [
        { label: 'Flight scheduled', time: schedDep, done: true, active: false, predicted: false, delayed: false },
        { label: 'Boarding started', time: schedDep, done: isDelayed, active: !isDelayed, predicted: false, delayed: false },
        { label: isDelayed ? 'Delay reported' : 'Ready for departure', time: isDelayed ? `+${delay} min` : '—', done: isDelayed, active: false, predicted: false, delayed: isDelayed },
        { label: 'Estimated departure', time: isDelayed ? `+${delay} min` : schedDep, done: false, active: isDelayed, predicted: isDelayed, delayed: isDelayed },
        { label: 'Estimated arrival', time: schedArr, done: false, active: false, predicted: true, delayed: false },
    ];

    // Determine how many "done" items for progress
    const doneCount = timeline.filter(ev => ev.done).length;
    const progressHeight = doneCount > 0 ? `${Math.round((doneCount / timeline.length) * 100)}%` : '0%';

    // AI Recommendations
    const recommendations = [];
    if (prob >= 40) recommendations.push({ text: t('ai_rec_monitor_gate'), icon: '👁️' });
    if (prob >= 50) recommendations.push({ text: t('ai_rec_enable_notifs'), icon: '🔔' });
    if (prob >= 60) recommendations.push({ text: t('ai_rec_flexible_transport'), icon: '🚕' });
    if (prob >= 60) recommendations.push({ text: t('ai_rec_pack_essentials'), icon: '🎒' });
    if (prob >= 80) recommendations.push({ text: t('ai_rec_alt_flights'), icon: '✈️', critical: true });

    return (
        <div className="pfdp animate-in">
            {/* Back button */}
            <button className="back-btn" onClick={() => navigate(-1)}>
                <ArrowLeft size={16} /> {t('back')}
            </button>

            <div className="pfdp__card">
                {/* ── Header ── */}
                <div className="pfdp__header">
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <h1 className="pfdp__title">Flight {flight.flight_number}</h1>
                            <span className="pfdp__status-pill" style={{ background: `${sm.color}18`, color: sm.color, border: `1px solid ${sm.color}35` }}>
                                {sm.label}
                            </span>
                        </div>
                        <p className="pfdp__airline">{flight.airline?.name || flight.airline_name}</p>

                        {/* Track & Notify Buttons */}
                        <div className="pfdp__actions">
                            <button
                                className={`track-btn ${isTracking ? 'track-btn--active' : ''}`}
                                onClick={(e) => { e.preventDefault(); setIsTracking(!isTracking); }}
                            >
                                <Star size={14} /> {isTracking ? t('tracking_flight') : t('track_flight')}
                            </button>
                            <button
                                className={`notify-btn ${isNotifying ? 'notify-btn--active' : ''}`}
                                onClick={(e) => { e.preventDefault(); setIsNotifying(!isNotifying); }}
                            >
                                <Bell size={14} /> {isNotifying ? t('notifications_enabled') : t('enable_notifications')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Route with Mini Flight Path ── */}
                <div className="pfdp__route">
                    <MapPin size={14} style={{ color: '#0EA5E9' }} />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>{depIata}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{depCity}</div>
                        <div className="tz-label">{t('local_time')}</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                        <Plane size={16} style={{ color: 'var(--text-muted)' }} />
                        <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>{arrIata}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{arrCity}</div>
                        <div className="tz-label">{t('local_time')}</div>
                    </div>
                    <MapPin size={14} style={{ color: '#22C55E' }} />
                </div>

                {/* Mini flight path indicator */}
                {flight.actual_departure && flight.status !== 'landed' && (
                    <div className="mini-flight-path">
                        <Plane size={13} className="mini-flight-path__icon" />
                        <span>{t('aircraft_departed_ago')} {Math.round((Date.now() - new Date(flight.actual_departure).getTime()) / 60000)} {t('minutes_ago')}</span>
                    </div>
                )}

                {/* ── Row 1: Departure Times / Gate / AI Gauge ── */}
                <div className="pfdp__row3">
                    {/* Departure Times */}
                    <div className="pfdp__info-card">
                        <div className="pfdp__info-card__header"><Clock size={14} style={{ color: '#0EA5E9' }} /> Departure Times</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>{t('scheduled_label')}</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{schedDep}</div>
                        {delay > 0 && (
                            <>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 10, marginBottom: 2 }}>{t('estimated_label')}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: sm.color, lineHeight: 1 }}>+{delay} min</div>
                                <div style={{ fontSize: '0.73rem', color: sm.color, marginTop: 4 }}>{t('flights_delay')}: {delay} {t('admin_predict_minutes')}</div>
                            </>
                        )}
                    </div>

                    {/* Gate Info – Enhanced */}
                    <div className="pfdp__info-card">
                        <div className="pfdp__info-card__header"><MapPin size={14} style={{ color: '#0EA5E9' }} /> Gate Information</div>
                        <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>Terminal</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                                    {flight.origin_airport?.terminal || 'T1'}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>{t('flights_gate')}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: flight.dep_gate ? 'var(--text-primary)' : '#F59E0B', lineHeight: 1 }}>
                                    {flight.dep_gate || t('gate_not_assigned')}
                                </div>
                                {flight.dep_gate && (
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>
                                        {t('gate_assigned_at')} {schedDep}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {t('boarding_time')}: {flight.boarding_time || (delay > 0 ? `~${schedDep} +${delay}min` : `~${schedDep}`)}
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {flight.aircraft_type || 'Boeing 737-800'}
                        </div>
                    </div>

                    {/* AI Delay Probability */}
                    <div className="pfdp__info-card pfdp__info-card--center">
                        <div className="pfdp__info-card__header" style={{ justifyContent: 'center' }}>AI Delay Probability</div>
                        <CircularGauge pct={prob} color={gaugeColor} />
                        {/* Risk Evolution Indicator */}
                        <div className="risk-evolution">
                            <span className="risk-evolution__title">{t('risk_trend')}:</span>
                            {riskTrend.map((step, i) => (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                    {i > 0 && <span className="risk-evolution__arrow">→</span>}
                                    <span className="risk-evolution__step" style={{ color: riskColor(step.pct) }}>
                                        {step.pct}%
                                    </span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── AI Recommendations ── */}
                {recommendations.length > 0 && (
                    <div className="ai-recommendations">
                        <div className="ai-recommendations__title">
                            {t('ai_recommendations_title')}
                        </div>
                        <ul className="ai-recommendations__list">
                            {recommendations.map((rec, i) => (
                                <li key={i} className={`ai-recommendations__item ${rec.critical ? 'ai-recommendations__item--critical' : ''}`}>
                                    <span>{rec.icon}</span>
                                    <span>{rec.text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* ── Row 2: AI Risk Analysis + Weather Impact ── */}
                <div className="pfdp__row2">
                    {/* AI Risk Analysis */}
                    <div className="pfdp__info-card">
                        <div className="pfdp__info-card__header"><AlertTriangle size={14} style={{ color: '#0EA5E9' }} /> AI Risk Analysis</div>

                        {/* ── "Why does AI predict this?" section ── */}
                        <div style={{
                            margin: '0 0 14px 0',
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: explanationText
                                ? 'rgba(14,165,233,0.07)'
                                : 'rgba(0,0,0,0.04)',
                            border: `1px solid ${explanationText ? 'rgba(14,165,233,0.2)' : 'rgba(0,0,0,0.08)'}`,
                        }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0EA5E9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
                                🤖 {t('ai_why_title')}
                            </div>
                            <p style={{ fontSize: '0.78rem', color: explanationText ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.55, margin: 0, fontStyle: explanationText ? 'normal' : 'italic' }}>
                                {explanationText || t('ai_explanation_unavailable')}
                            </p>
                        </div>

                        {/* SHAP bars — only when real data exists */}
                        {hasShap ? (
                            <>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                                    {t('ai_top_factors')}:
                                </p>
                                {barData.map(f => <RiskBar key={f.label} label={f.label} pct={f.pct} explanation={f.explanation} isDominant={f.isDominant} />)}
                            </>
                        ) : (
                            !explanationText && (
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    {t('ai_explanation_unavailable')}
                                </p>
                            )
                        )}

                        {/* Delay Evolution Chart */}
                        {delay > 0 && (
                            <div className="delay-chart">
                                <div className="delay-chart__title"><BarChart3 size={12} /> {t('delay_evolution_title')}</div>
                                <DelayEvolutionChart delay={delay} />
                            </div>
                        )}
                    </div>

                    {/* Weather Impact – Enhanced with icons */}
                    <div className="pfdp__info-card">
                        <div className="pfdp__info-card__header"><CloudLightning size={14} style={{ color: '#0EA5E9' }} /> Weather Impact</div>
                        {delay > 15 ? (
                            <div className="pfdp__advisory">
                                <AlertTriangle size={13} style={{ color: '#F59E0B', flexShrink: 0 }} />
                                <div>
                                    <strong style={{ fontSize: '0.82rem', color: '#F59E0B' }}>Weather Advisory</strong><br />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {delay > 30 ? 'Thunderstorms reported. Moderate delays expected.' : 'Light weather disturbance. Minor delays possible.'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#22C55E' }}>
                                <CheckCircle size={13} /> {t('weather_clear')} — no weather impact
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 3 }}>Origin ({depIata})</div>
                                <div className={`weather-icon-badge weather-icon-badge--clear`}>
                                    ☀️ Clear, 22°C
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 3 }}>Destination ({arrIata})</div>
                                <div className={`weather-icon-badge weather-icon-badge--${weather.severity}`}>
                                    {weather.icon} {delay > 30 ? 'Storms, 18°C' : delay > 15 ? 'Windy, 20°C' : 'Clear, 20°C'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Connection Risk Module ── */}
                {isDelayed && (
                    <div className={`connection-risk connection-risk--${connectionRisk}`}>
                        <div className="connection-risk__header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Link2 size={14} />
                                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t('connection_risk_title')}</span>
                            </div>
                            <span className="connection-risk__badge" style={{
                                background: connectionRisk === 'high' ? 'rgba(239,68,68,0.12)' : connectionRisk === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
                                color: connectionRisk === 'high' ? '#EF4444' : connectionRisk === 'medium' ? '#F59E0B' : '#22C55E',
                            }}>
                                {t(`connection_risk_${connectionRisk}`)}
                            </span>
                        </div>
                        <div className="connection-risk__details">
                            <div className="connection-risk__row">
                                <span>{t('connection_min_transfer')}</span>
                                <span style={{ fontWeight: 600 }}>{minTransfer} min</span>
                            </div>
                            <div className="connection-risk__row">
                                <span>{t('connection_available_time')}</span>
                                <span style={{ fontWeight: 600, color: connectionRisk === 'high' ? '#EF4444' : connectionRisk === 'medium' ? '#F59E0B' : '#22C55E' }}>
                                    {connectionTime > 0 ? `${connectionTime} min` : 'Missed'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Flight Timeline – Enhanced ── */}
                <div className="pfdp__info-card">
                    <div className="pfdp__info-card__header"><Clock size={14} style={{ color: '#0EA5E9' }} /> Flight Timeline</div>
                    <div style={{ marginTop: 12, position: 'relative', paddingLeft: 4 }}>
                        <div style={{ position: 'absolute', left: 9, top: 10, bottom: 10, width: 2, background: 'var(--border-color)', zIndex: 0 }} />
                        <div className="timeline-progress" style={{ height: progressHeight }} />
                        {timeline.map((ev, i) => <TimelineItem key={i} {...ev} />)}
                    </div>
                </div>

                {/* ── Passenger Rights – Enhanced with compensation ── */}
                <div className="pfdp__info-card pfdp__rights-card">
                    <div className="pfdp__info-card__header"><Shield size={14} style={{ color: '#0EA5E9' }} /> Your Rights as a Passenger</div>
                    {delay >= 45 ? (
                        <>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>
                                Due to the delay exceeding {delay} minutes, you may be entitled to:
                            </p>
                            <ul className="pfdp__rights-list">
                                <li><CheckCircle size={13} style={{ color: '#22C55E' }} /> Complimentary refreshments and meal vouchers</li>
                                <li><CheckCircle size={13} style={{ color: '#22C55E' }} /> Flight rebooking options at no additional charge</li>
                                <li><CheckCircle size={13} style={{ color: '#22C55E' }} /> Compensation eligibility — check with your airline</li>
                            </ul>
                            {/* Distance-based compensation */}
                            {compensation && (
                                <div className="compensation-badge">
                                    <div>
                                        <div className="compensation-badge__amount">{compensation}</div>
                                        <div className="compensation-badge__label">{t('compensation_potential')}</div>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        {t('compensation_eu261')} • {distance} km
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Your flight is on time or has minimal delay. No passenger rights intervention is currently required. Safe travels! ✈️
                        </p>
                    )}
                    {/* Pre-existing passenger rights from API data */}
                    {flight.passenger_rights && flight.passenger_rights.map((right, i) => (
                        <div key={i} className="rights-item" style={{ marginTop: 10 }}>
                            <span className="rights-item__icon">
                                {right.right_type === 'compensation' ? '💰' :
                                    right.right_type === 'refreshment' || right.right_type === 'meal' ? '🍽️' :
                                        right.right_type === 'refund' ? '💳' :
                                            right.right_type === 'hotel' ? '🏨' : '📋'}
                            </span>
                            <div>
                                <div className="rights-item__text">{right.description_en}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    {right.regulation_name} — after {right.delay_threshold_min}+ min
                                </div>
                                {right.compensation_amount && (
                                    <div className="rights-item__amount">{right.compensation_amount}</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

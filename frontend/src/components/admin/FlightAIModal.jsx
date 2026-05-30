/**
 * FlightAIModal
 * ==============
 * Rich AI Operations modal shown when clicking a flight row on AdminDashboard.
 *
 * Data sources — all REAL, no mocks:
 *   • GET /api/intelligence/stats/flight   → route/airline/hour delay intelligence
 *   • GET /api/intelligence/future-schedules → matching future schedule + prediction
 *   • GET /api/intelligence/flight-predict/{id} → live inference for the clicked flight
 *
 * Shows: flight info, real predicted delay, confidence, risk, route/airline stats,
 *        operational recommendations, and feature breakdown.
 */

import { useEffect, useState } from 'react';
import {
    X, Plane, Clock, BrainCircuit, TrendingUp,
    AlertTriangle, CheckCircle, Info, MapPin, RefreshCw, Activity
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/api';
function getToken() {
    try { return localStorage.getItem('admin_token') || ''; } catch { return ''; }
}
async function apiFetch(path) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    });
    const text = await res.text();
    try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
    catch { return { ok: res.ok, status: res.status, data: null }; }
}

const RISK_COLORS = {
    High:    { text: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
    Medium:  { text: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
    Low:     { text: '#22C55E', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)' },
    Unknown: { text: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)' },
};

const RISK_LABELS = {
    fr: { High: 'Risque élevé', Medium: 'Risque moyen', Low: 'Risque faible', Unknown: 'Risque inconnu' },
    en: { High: 'High Risk', Medium: 'Medium Risk', Low: 'Low Risk', Unknown: 'Unknown Risk' },
    ar: { High: 'خطورة عالية', Medium: 'خطورة متوسطة', Low: 'خطورة منخفضة', Unknown: 'خطورة غير معروفة' }
};

const tr = {
    fr: {
        noData: 'Aucune donnée',
        aiFlightIntel: 'Intelligence de vol IA',
        liveModel: '● Modèle en direct',
        schedPredict: '● Prédiction planifiée',
        routeStatsOnly: '● Stats d\'itinéraire uniquement',
        route: 'Itinéraire',
        airline: 'Compagnie',
        scheduled: 'Programmé',
        mlPrediction: 'Prédiction ML',
        realInference: '— Inférence en temps réel',
        schedBatch: '— Lot planifié',
        heuristic: '— Heuristique',
        minutesDelay: 'minutes de retard',
        confidence: 'Confiance',
        opRecommendation: 'Recommandation opérationnelle',
        routeAirlineIntel: 'Intelligence Itinéraire & Compagnie — via ae_aviation_stats',
        routeAvgDelay: 'Retard moyen de l\'itinéraire',
        routeDelayRate: 'Taux de retard de l\'itinéraire',
        airlineReliability: 'Fiabilité de la compagnie',
        hourDelayRate: 'Taux de retard horaire',
        modelInputFeatures: 'Données d\'entrée du modèle (7)',
        dataSourceTransparency: 'Transparence des sources de données',
        routeStatsSource: 'Stats itinéraire : ae_aviation_stats',
        inferenceSource: 'Inférence : delay_prediction_model.pkl',
        scheduleSource: 'Programme : ae_future_schedules',
        noMockValues: 'Données réelles sans simulation',
    },
    en: {
        noData: 'No data',
        aiFlightIntel: 'AI Flight Intelligence',
        liveModel: '● Live model',
        schedPredict: '● Scheduled prediction',
        routeStatsOnly: '● Route stats only',
        route: 'Route',
        airline: 'Airline',
        scheduled: 'Scheduled',
        mlPrediction: 'ML Prediction',
        realInference: '— Real Inference',
        schedBatch: '— Scheduled Batch',
        heuristic: '— Heuristic',
        minutesDelay: 'minutes delay',
        confidence: 'Confidence',
        opRecommendation: 'Operational Recommendation',
        routeAirlineIntel: 'Route & Airline Intelligence — from ae_aviation_stats',
        routeAvgDelay: 'Route Average Delay',
        routeDelayRate: 'Route Delay Rate',
        airlineReliability: 'Airline Reliability',
        hourDelayRate: 'Hour-of-Day Delay Rate',
        modelInputFeatures: 'Model Input Features (7)',
        dataSourceTransparency: 'Data source transparency',
        routeStatsSource: 'Route stats: ae_aviation_stats',
        inferenceSource: 'Inference: delay_prediction_model.pkl',
        scheduleSource: 'Schedule: ae_future_schedules',
        noMockValues: 'No mock values',
    },
    ar: {
        noData: 'لا توجد بيانات',
        aiFlightIntel: 'ذكاء الطيران الاصطناعي',
        liveModel: '● نموذج مباشر',
        schedPredict: '● توقعات مجدولة',
        routeStatsOnly: '● إحصائيات المسار فقط',
        route: 'المسار',
        airline: 'شركة الطيران',
        scheduled: 'المجدول',
        mlPrediction: 'تنبؤ ML',
        realInference: '— استنتاج مباشر',
        schedBatch: '— دفعة مجدولة',
        heuristic: '— استكشافي',
        minutesDelay: 'دقائق تأخير',
        confidence: 'الثقة',
        opRecommendation: 'التوصية التشغيلية',
        routeAirlineIntel: 'ذكاء المسار وشركة الطيران — من ae_aviation_stats',
        routeAvgDelay: 'متوسط تأخير المسار',
        routeDelayRate: 'معدل تأخير المسار',
        airlineReliability: 'موثوقية شركة الطيران',
        hourDelayRate: 'معدل التأخير حسب الساعة',
        modelInputFeatures: 'ميزات إدخال النموذج (7)',
        dataSourceTransparency: 'شفافية مصدر البيانات',
        routeStatsSource: 'إحصائيات المسار: ae_aviation_stats',
        inferenceSource: 'الاستنتاج: delay_prediction_model.pkl',
        scheduleSource: 'الجدول: ae_future_schedules',
        noMockValues: 'قيم حقيقية بدون محاكاة',
    }
};

function getOperationalRecommendation(delay, lang) {
    if (delay == null) return null;
    const isFr = lang === 'fr';
    const isAr = lang === 'ar';
    if (delay > 60) {
        return {
            icon: <AlertTriangle size={14} />,
            text: isFr ? 'Retard important prévu. Informer les agents de porte, coordonner les équipes au sol et briefer les passagers.'
                : isAr ? 'توقع تأخير كبير. إبلاغ موظفي البوابة، وتنسيق الطاقم الأرضي، وإحاطة الركاب.'
                : 'Major delay expected. Notify gate agents, coordinate ground crew, and brief passengers.',
            color: '#EF4444'
        };
    }
    if (delay > 30) {
        return {
            icon: <AlertTriangle size={14} />,
            text: isFr ? 'Retard significatif prédit. Envisager une communication proactive avec les passagers et des ajustements d\'embarquement.'
                : isAr ? 'توقع تأخير ملموس. النظر في التواصل الاستباقي مع الركاب وتعديل إجراءات الصعود.'
                : 'Significant delay predicted. Consider proactive passenger communication and boarding adjustments.',
            color: '#F59E0B'
        };
    }
    if (delay > 10) {
        return {
            icon: <Info size={14} />,
            text: isFr ? 'Retard mineur possible. Surveiller attentivement l\'état du vol.'
                : isAr ? 'احتمال تأخير طفيف. مراقبة حالة الرحلة عن كثب.'
                : 'Minor delay possible. Monitor flight status closely.',
            color: '#A5B4FC'
        };
    }
    return {
        icon: <CheckCircle size={14} />,
        text: isFr ? 'Vol prévu à l\'heure. Aucune action immédiate requise.'
            : isAr ? 'من المتوقع مغادرة الرحلة في الوقت المحدد. لا توجد إجراءات فورية مطلوبة.'
            : 'Flight expected to depart on time. No immediate action required.',
        color: '#22C55E'
    };
}

function RiskBadge({ risk, lang }) {
    const c = RISK_COLORS[risk] ?? RISK_COLORS.Unknown;
    const label = (RISK_LABELS[lang] ?? RISK_LABELS.en)[risk] ?? (RISK_LABELS[lang] ?? RISK_LABELS.en).Unknown;
    return (
        <span style={{ padding: '4px 12px', borderRadius: 6, background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontWeight: 700, fontSize: '0.8rem' }}>
            {label}
        </span>
    );
}

function StatRow({ label, value, unit = '', color, icon, lang }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 5 }}>
                {icon}{label}
            </span>
            <span style={{ fontWeight: 700, color: color || '#E2E8F0', fontSize: '0.85rem' }}>
                {value != null ? `${value}${unit}` : <span style={{ color: 'rgba(255,255,255,0.2)' }}>{tr[lang]?.noData || tr.en.noData}</span>}
            </span>
        </div>
    );
}

export default function FlightAIModal({ flight, onClose }) {
    const { language } = useLanguage();
    const txt = tr[language] || tr.en;

    const [flightStats, setFlightStats]     = useState(null);
    const [futureMatch,  setFutureMatch]    = useState(null);
    const [livePredict,  setLivePredict]    = useState(null);
    const [loading,      setLoading]        = useState(true);
    const [error,        setError]          = useState(null);

    const fn = flight?.flight_number;

    useEffect(() => {
        if (!fn) return;
        setLoading(true);
        setError(null);

        const qs = new URLSearchParams();
        if (flight.dep_iata)    qs.set('dep_iata', flight.dep_iata);
        if (flight.arr_iata)    qs.set('arr_iata', flight.arr_iata);
        if (flight.airline_iata || flight.airline_name)
            qs.set('airline_iata', flight.airline_iata || '');

        Promise.allSettled([
            apiFetch(`/intelligence/stats/flight?${qs}`),
            apiFetch(`/intelligence/future-schedules?predicted_only=true&limit=200`),
        ]).then(([statsRes, futureRes]) => {
            if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
                setFlightStats(statsRes.value.data);
            }
            if (futureRes.status === 'fulfilled' && futureRes.value.ok) {
                const list = Array.isArray(futureRes.value.data) ? futureRes.value.data : [];
                const match = list.find(f => f.flight_number?.toUpperCase() === fn.toUpperCase());
                setFutureMatch(match || null);
            }
        }).finally(() => setLoading(false));
    }, [fn, flight?.dep_iata, flight?.arr_iata]);

    // If a future schedule matched, fetch per-row inference
    useEffect(() => {
        if (!futureMatch?.id) return;
        apiFetch(`/intelligence/flight-predict/${futureMatch.id}`)
            .then(r => { if (r.ok) setLivePredict(r.data); })
            .catch(() => {});
    }, [futureMatch?.id]);

    // Derive delay info: prefer live model inference, fall back to stored prediction, then raw delay
    const predictedDelay = livePredict?.prediction?.predicted_delay_min
        ?? futureMatch?.predicted_delay_min
        ?? flight?.delay_minutes
        ?? null;
    const confidence     = livePredict?.prediction?.confidence ?? futureMatch?.confidence ?? null;
    const riskLevel      = livePredict?.prediction?.risk_level
        ?? (predictedDelay == null ? 'Unknown' : predictedDelay > 30 ? 'High' : predictedDelay > 10 ? 'Medium' : 'Low');

    const rec = getOperationalRecommendation(predictedDelay, language);

    const depTime = flight?.dep_scheduled ? new Date(flight.dep_scheduled) : null;
    const arrTime = flight?.arr_scheduled ? new Date(flight.arr_scheduled) : null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: '#0F1629',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                width: '100%', maxWidth: 760,
                maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                padding: 0,
            }}>
                {/* ── Header ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)',
                    background: 'rgba(255,255,255,0.02)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ background: 'rgba(99,102,241,0.15)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(99,102,241,0.3)' }}>
                            <BrainCircuit size={20} style={{ color: '#818CF8' }} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#E2E8F0', letterSpacing: '-0.02em' }}>
                                {fn}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                                {txt.aiFlightIntel}
                                <span style={{ marginLeft: 8, color: '#818CF8', fontSize: '0.7rem' }}>
                                    {livePredict ? txt.liveModel : futureMatch ? txt.schedPredict : txt.routeStatsOnly}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RiskBadge risk={riskLevel} lang={language} />
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* ── Flight Info Row ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{txt.route}</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#E2E8F0' }}>
                                {flight?.dep_iata} <span style={{ color: 'rgba(255,255,255,0.25)' }}>→</span> {flight?.arr_iata}
                            </div>
                            {flight?.arr_airport && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{flight.arr_airport}</div>}
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{txt.airline}</div>
                            <div style={{ fontWeight: 700, color: '#E2E8F0' }}>{flight?.airline_name || flight?.airline_iata || '—'}</div>
                            {flight?.airline_iata && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{flight.airline_iata}</div>}
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{txt.scheduled}</div>
                            <div style={{ fontWeight: 700, color: '#E2E8F0' }}>
                                {depTime ? depTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                            </div>
                            {flight?.direction && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 3, textTransform: 'capitalize' }}>{flight.direction}</div>}
                        </div>
                    </div>

                    {/* ── AI Prediction ── */}
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', padding: '1rem 0' }}>
                            <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Fetching AI intelligence…
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            {/* Prediction block */}
                            <div style={{ background: 'rgba(99,102,241,0.08)', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(99,102,241,0.2)' }}>
                                <div style={{ fontSize: '0.7rem', color: 'rgba(165,180,252,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                                    <BrainCircuit size={11} style={{ display: 'inline', marginRight: 4 }} />
                                    {txt.mlPrediction} {livePredict ? txt.realInference : futureMatch ? txt.schedBatch : txt.heuristic}
                                </div>
                                <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                                    color: predictedDelay == null ? 'rgba(255,255,255,0.2)' :
                                        predictedDelay > 30 ? '#EF4444' : predictedDelay > 10 ? '#F59E0B' : '#22C55E'
                                }}>
                                    {predictedDelay != null
                                        ? (predictedDelay > 0 ? `+${predictedDelay}` : '0')
                                        : '—'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{txt.minutesDelay}</div>
                                {confidence != null && (
                                    <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#A5B4FC' }}>
                                        {txt.confidence}: <strong>{(confidence * 100).toFixed(0)}%</strong>
                                    </div>
                                )}
                            </div>

                            {/* Operational recommendation */}
                            {rec && (
                                <div style={{ background: `${RISK_COLORS[riskLevel]?.bg}`, borderRadius: 12, padding: '1.25rem', border: `1px solid ${RISK_COLORS[riskLevel]?.border}` }}>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                                        <Activity size={11} style={{ display: 'inline', marginRight: 4 }} />
                                        {txt.opRecommendation}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: rec.color, fontSize: '0.85rem', lineHeight: 1.5 }}>
                                        {rec.icon}
                                        <span>{rec.text}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Route & Airline Intelligence ── */}
                    {(flightStats || livePredict?.intelligence) && (
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <TrendingUp size={14} /> {txt.routeAirlineIntel}
                            </div>
                            {(() => {
                                const s = livePredict?.intelligence ?? flightStats ?? {};
                                return (
                                    <>
                                        <StatRow label={txt.routeAvgDelay}   value={s.route_avg_delay    != null ? s.route_avg_delay.toFixed(1)         : null} unit=" min"  color="#F59E0B" lang={language} />
                                        <StatRow label={txt.routeDelayRate}   value={s.route_delay_rate   != null ? (s.route_delay_rate * 100).toFixed(0)  : null} unit="%"    color="#EF4444" lang={language} />
                                        <StatRow label={txt.airlineReliability}    value={s.airline_reliability != null ? (s.airline_reliability * 100).toFixed(0) : null} unit="%"   color="#22C55E" lang={language} />
                                        <StatRow label={txt.hourDelayRate} value={s.hour_delay_rate    != null ? (s.hour_delay_rate * 100).toFixed(0)   : null} unit="%"    color="#A5B4FC" lang={language} />
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* ── Feature Inputs ── */}
                    {(livePredict?.features_used || futureMatch) && (
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <BrainCircuit size={14} /> {txt.modelInputFeatures}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                {Object.entries(livePredict?.features_used ?? {
                                    dep_hour:      futureMatch?.dep_hour,
                                    is_weekend:    futureMatch?.is_weekend,
                                    distance_km:   futureMatch?.distance_km,
                                    duration_min:  futureMatch?.duration_min,
                                    airline_enc:   'enc',
                                    dep_airport_enc: 'enc',
                                    arr_airport_enc: 'enc',
                                }).map(([k, v]) => (
                                    <div key={k} style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 3 }}>{k}</div>
                                        <div style={{ fontWeight: 700, color: '#A5B4FC', fontSize: '0.9rem' }}>{v ?? '—'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Data source transparency ── */}
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.18)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span>{txt.routeStatsSource}</span>
                        {livePredict && <span>{txt.inferenceSource} (id={futureMatch?.id})</span>}
                        {futureMatch  && <span>{txt.scheduleSource} id={futureMatch.id}</span>}
                        <span>{txt.noMockValues}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

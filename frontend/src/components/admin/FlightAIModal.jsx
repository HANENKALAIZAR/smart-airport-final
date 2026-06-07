/**
 * FlightAIModal — Dark Navy + Amber Design
 * ==========================================
 * Rich AI Operations modal shown when clicking a flight row on AdminDashboard.
 *
 * Data sources — all REAL, no mocks:
 *   • GET /api/intelligence/stats/flight   → route/airline/hour delay intelligence
 *   • GET /api/intelligence/future-schedules → matching future schedule + prediction
 *   • GET /api/intelligence/flight-predict/{id} → live inference for the clicked flight
 */

import { useEffect, useState } from 'react';
import {
    X, Plane, Clock, BrainCircuit, TrendingUp,
    AlertTriangle, CheckCircle, Info, RefreshCw, Activity,
    MapPin, Navigation,
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

// ── Full airport name lookup (common routes + Tunisian airports) ─────────────
const AIRPORT_NAMES = {
    TUN: 'Aéroport International de Tunis-Carthage',
    MIR: 'Aéroport International Monastir Habib Bourguiba',
    NBE: 'Aéroport International Enfidha-Hammamet',
    DJE: 'Aéroport International de Djerba-Zarzis',
    // Common European routes
    CDG: 'Aéroport Charles de Gaulle (Paris)',
    ORY: 'Aéroport de Paris-Orly',
    LYS: 'Aéroport de Lyon-Saint Exupéry',
    NCE: 'Aéroport de Nice Côte d\'Azur',
    MRS: 'Aéroport de Marseille Provence',
    LIL: 'Aéroport de Lille-Lesquin',
    NTE: 'Aéroport de Nantes Atlantique',
    BOD: 'Aéroport de Bordeaux-Mérignac',
    TLS: 'Aéroport de Toulouse-Blagnac',
    LUX: 'Aéroport de Luxembourg',
    BRU: 'Aéroport de Bruxelles',
    AMS: 'Aéroport d\'Amsterdam Schiphol',
    FRA: 'Aéroport de Francfort',
    MUC: 'Aéroport de Munich',
    VIE: 'Aéroport de Vienne',
    FCO: 'Aéroport de Rome Fiumicino',
    MXP: 'Aéroport de Milan Malpensa',
    BCN: 'Aéroport de Barcelone El Prat',
    MAD: 'Aéroport Adolfo Suárez Madrid-Barajas',
    LIS: 'Aéroport International de Lisbonne',
    LHR: 'Aéroport de Londres Heathrow',
    STN: 'Aéroport de Londres Stansted',
    LED: 'Aéroport de Saint-Pétersbourg Pulkovo',
    OTP: 'Aéroport International Henri Coandă (Bucarest)',
    SOF: 'Aéroport de Sofia',
    PRG: 'Aéroport Václav Havel (Prague)',
    WAW: 'Aéroport de Varsovie Chopin',
    ATH: 'Aéroport International d\'Athènes Elefthérios Venizélos',
    IST: 'Aéroport de Istanbul',
    CAI: 'Aéroport International du Caire',
    CMN: 'Aéroport International Mohammed V (Casablanca)',
    RAK: 'Aéroport Marrakech-Menara',
    ALG: 'Aéroport International Houari Boumédiène (Alger)',
};

function getAirportName(iata) {
    return AIRPORT_NAMES[iata] || null;
}

// ── Delay formatter ──────────────────────────────────────────────────────────
function formatDelay(minutes) {
    if (minutes == null || minutes <= 0) return '0 min';
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    if (h > 0 && m > 0) return `+${h}h ${m}min`;
    if (h > 0) return `+${h}h`;
    return `+${m}min`;
}

// ── Colour system ────────────────────────────────────────────────────────────
const RISK_COLORS = {
    High:    { text: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  ring: '#EF4444' },
    Medium:  { text: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', ring: '#F59E0B' },
    Low:     { text: '#22C55E', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  ring: '#22C55E' },
    Unknown: { text: '#94A3B8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', ring: '#94A3B8' },
};

const RISK_LABELS = {
    fr: { High: 'Risque élevé', Medium: 'Risque moyen', Low: 'Risque faible', Unknown: 'Risque inconnu' },
    en: { High: 'High Risk',   Medium: 'Medium Risk',  Low: 'Low Risk',     Unknown: 'Unknown Risk' },
    ar: { High: 'خطورة عالية',   Medium: 'خطورة متوسطة',  Low: 'خطورة منخفضة', Unknown: 'خطورة غير معروفة' },
};

// ── Localised strings ────────────────────────────────────────────────────────
const tr = {
    fr: {
        noData: 'Données insuffisantes',
        aiFlightIntel: 'Intelligence de vol IA',
        liveModel: '● Modèle en direct',
        schedPredict: '● Prédiction planifiée',
        routeStatsOnly: '● Stats d\'itinéraire uniquement',
        departure: 'Départ',
        arrival: 'Arrivée',
        airline: 'Compagnie',
        scheduled: 'Heure programmée',
        terminal: 'Terminal',
        gate: 'Porte',
        delay: 'Retard',
        notAssigned: 'Non assignée',
        mlPrediction: 'Prédiction ML',
        realInference: '— Inférence en direct',
        schedBatch: '— Lot planifié',
        heuristic: '— Heuristique',
        delayLabel: 'de retard prédit',
        confidence: 'Confiance',
        opRecommendation: 'Recommandation opérationnelle',
        routeAirlineIntel: 'Intelligence Itinéraire & Compagnie — ae_aviation_stats',
        routeAvgDelay: 'Retard moyen de l\'itinéraire',
        routeDelayRate: 'Taux de retard de l\'itinéraire',
        airlineReliability: 'Fiabilité de la compagnie',
        hourDelayRate: 'Taux de retard horaire',
        aiDelayProb: 'Probabilité de retard IA',
        routeStatsSource: 'Stats itinéraire : ae_aviation_stats',
        inferenceSource: 'Inférence : delay_prediction_model.pkl',
        scheduleSource: 'Programme : ae_future_schedules',
        noMockValues: 'Données réelles sans simulation',
        lastUpdated: 'Dernière mise à jour',
    },
    en: {
        noData: 'Insufficient data',
        aiFlightIntel: 'AI Flight Intelligence',
        liveModel: '● Live model',
        schedPredict: '● Scheduled prediction',
        routeStatsOnly: '● Route stats only',
        departure: 'Departure',
        arrival: 'Arrival',
        airline: 'Airline',
        scheduled: 'Scheduled Time',
        terminal: 'Terminal',
        gate: 'Gate',
        delay: 'Delay',
        notAssigned: 'Not assigned',
        mlPrediction: 'ML Prediction',
        realInference: '— Real Inference',
        schedBatch: '— Scheduled Batch',
        heuristic: '— Heuristic',
        delayLabel: 'predicted delay',
        confidence: 'Confidence',
        opRecommendation: 'Operational Recommendation',
        routeAirlineIntel: 'Route & Airline Intelligence — ae_aviation_stats',
        routeAvgDelay: 'Route Average Delay',
        routeDelayRate: 'Route Delay Rate',
        airlineReliability: 'Airline Reliability',
        hourDelayRate: 'Hour-of-Day Delay Rate',
        aiDelayProb: 'AI Delay Probability',
        routeStatsSource: 'Route stats: ae_aviation_stats',
        inferenceSource: 'Inference: delay_prediction_model.pkl',
        scheduleSource: 'Schedule: ae_future_schedules',
        noMockValues: 'No mock values',
        lastUpdated: 'Last updated',
    },
    ar: {
        noData: 'بيانات غير كافية',
        aiFlightIntel: 'ذكاء الطيران الاصطناعي',
        liveModel: '● نموذج مباشر',
        schedPredict: '● توقعات مجدولة',
        routeStatsOnly: '● إحصائيات المسار فقط',
        departure: 'المغادرة',
        arrival: 'الوصول',
        airline: 'شركة الطيران',
        scheduled: 'الوقت المجدول',
        terminal: 'المحطة',
        gate: 'البوابة',
        delay: 'التأخير',
        notAssigned: 'غير مخصص',
        mlPrediction: 'تنبؤ ML',
        realInference: '— استنتاج مباشر',
        schedBatch: '— دفعة مجدولة',
        heuristic: '— استكشافي',
        delayLabel: 'تأخير متوقع',
        confidence: 'الثقة',
        opRecommendation: 'التوصية التشغيلية',
        routeAirlineIntel: 'ذكاء المسار وشركة الطيران — ae_aviation_stats',
        routeAvgDelay: 'متوسط تأخير المسار',
        routeDelayRate: 'معدل تأخير المسار',
        airlineReliability: 'موثوقية شركة الطيران',
        hourDelayRate: 'معدل التأخير حسب الساعة',
        aiDelayProb: 'احتمالية تأخير ذكاء اصطناعي',
        routeStatsSource: 'إحصائيات المسار: ae_aviation_stats',
        inferenceSource: 'الاستنتاج: delay_prediction_model.pkl',
        scheduleSource: 'الجدول: ae_future_schedules',
        noMockValues: 'قيم حقيقية بدون محاكاة',
        lastUpdated: 'آخر تحديث',
    },
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
            color: '#F59E0B'
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

// ── Circular Progress Widget ─────────────────────────────────────────────────
function CircularProgress({ pct, risk }) {
    const c = RISK_COLORS[risk] ?? RISK_COLORS.Unknown;
    const riskLabels = {
        High: 'Risque élevé', Medium: 'Risque moyen',
        Low: 'Risque faible', Unknown: 'Risque inconnu',
    };

    const radius = 44;
    const stroke = 7;
    const circ = 2 * Math.PI * radius;
    const safePct = Math.max(0, Math.min(100, pct ?? 0));
    const dash = (safePct / 100) * circ;

    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 14,
            padding: '1.25rem', border: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, minWidth: 140,
        }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                Probabilité de retard IA
            </div>
            <div style={{ position: 'relative', width: 110, height: 110 }}>
                <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
                    {/* Track */}
                    <circle cx="55" cy="55" r={radius} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
                    {/* Progress */}
                    <circle
                        cx="55" cy="55" r={radius}
                        stroke={c.ring}
                        strokeWidth={stroke}
                        fill="none"
                        strokeDasharray={`${dash} ${circ - dash}`}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 6px ${c.ring}88)`, transition: 'stroke-dasharray 0.6s ease' }}
                    />
                </svg>
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: c.text, lineHeight: 1 }}>
                        {safePct}%
                    </span>
                    <span style={{ fontSize: '0.62rem', color: c.text, fontWeight: 600, marginTop: 2, opacity: 0.8 }}>
                        {riskLabels[risk] || 'Inconnu'}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ── Subcomponents ────────────────────────────────────────────────────────────
function RiskBadge({ risk, lang }) {
    const c = RISK_COLORS[risk] ?? RISK_COLORS.Unknown;
    const label = (RISK_LABELS[lang] ?? RISK_LABELS.en)[risk] ?? (RISK_LABELS[lang] ?? RISK_LABELS.en).Unknown;
    return (
        <span style={{ padding: '4px 12px', borderRadius: 6, background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontWeight: 700, fontSize: '0.8rem' }}>
            {label}
        </span>
    );
}

function InfoCard({ label, value, sub, accent }) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '0.85rem 1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5 }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: accent || '#E2E8F0', lineHeight: 1.25 }}>{value}</div>
            {sub && <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{sub}</div>}
        </div>
    );
}

function StatRow({ label, value, unit = '', color }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>{label}</span>
            <span style={{ fontWeight: 700, color: color || '#E2E8F0', fontSize: '0.83rem' }}>
                {value != null ? `${value}${unit}` : <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, fontStyle: 'italic' }}>Données insuffisantes</span>}
            </span>
        </div>
    );
}

// ── Main Modal ───────────────────────────────────────────────────────────────
export default function FlightAIModal({ flight, onClose }) {
    const { language } = useLanguage();
    const txt = tr[language] || tr.fr;

    const [flightStats, setFlightStats]  = useState(null);
    const [futureMatch,  setFutureMatch] = useState(null);
    const [livePredict,  setLivePredict] = useState(null);
    const [loading,      setLoading]     = useState(true);

    const fn = flight?.flight_number;

    useEffect(() => {
        if (!fn) return;
        setLoading(true);

        const qs = new URLSearchParams();
        if (flight.dep_iata)    qs.set('dep_iata', flight.dep_iata);
        if (flight.arr_iata)    qs.set('arr_iata', flight.arr_iata);
        if (flight.airline_iata) qs.set('airline_iata', flight.airline_iata);

        Promise.allSettled([
            apiFetch(`/intelligence/stats/flight?${qs}`),
            apiFetch(`/intelligence/future-schedules?predicted_only=true&limit=200`),
        ]).then(([statsRes, futureRes]) => {
            if (statsRes.status === 'fulfilled' && statsRes.value.ok) setFlightStats(statsRes.value.data);
            if (futureRes.status === 'fulfilled' && futureRes.value.ok) {
                const list = Array.isArray(futureRes.value.data) ? futureRes.value.data : [];
                setFutureMatch(list.find(f => f.flight_number?.toUpperCase() === fn.toUpperCase()) || null);
            }
        }).finally(() => setLoading(false));
    }, [fn, flight?.dep_iata, flight?.arr_iata]);

    useEffect(() => {
        if (!futureMatch?.id) return;
        apiFetch(`/intelligence/flight-predict/${futureMatch.id}`)
            .then(r => { if (r.ok) setLivePredict(r.data); })
            .catch(() => {});
    }, [futureMatch?.id]);

    // Derive data
    const predictedDelay = livePredict?.prediction?.predicted_delay_min
        ?? futureMatch?.predicted_delay_min
        ?? flight?.delay_minutes
        ?? null;
    const confidence = livePredict?.prediction?.confidence ?? futureMatch?.confidence ?? null;
    const riskLevel  = livePredict?.prediction?.risk_level
        ?? (predictedDelay == null ? 'Unknown' : predictedDelay > 30 ? 'High' : predictedDelay > 10 ? 'Medium' : 'Low');
    const riskPct    = confidence != null ? Math.round(confidence * 100)
        : (predictedDelay == null ? 0 : predictedDelay > 30 ? 85 : predictedDelay > 10 ? 55 : 20);

    const rec = getOperationalRecommendation(predictedDelay, language);

    // Airport display
    const depIata     = flight?.dep_iata || '—';
    const arrIata     = flight?.arr_iata || '—';
    const depName     = getAirportName(depIata) || flight?.dep_airport || depIata;
    const arrName     = getAirportName(arrIata) || flight?.arr_airport || arrIata;

    const depTime     = flight?.dep_scheduled ? new Date(flight.dep_scheduled).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    const arrTime     = flight?.arr_scheduled ? new Date(flight.arr_scheduled).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

    // Terminal / Gate
    const isArr   = flight?.direction === 'arrival';
    const terminal = (isArr ? (flight?.arr_terminal || flight?.fa_arr_terminal) : (flight?.dep_terminal || flight?.fa_dep_terminal)) || null;
    const gate     = (isArr ? (flight?.arr_gate || flight?.fa_arr_gate) : (flight?.dep_gate || flight?.fa_dep_gate)) || null;

    const rc = RISK_COLORS[riskLevel] ?? RISK_COLORS.Unknown;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        }} onClick={e => e.target === e.currentTarget && onClose()}>

            <div style={{
                background: 'linear-gradient(160deg, #0C1526 0%, #0F1E35 100%)',
                border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: 18,
                width: '100%', maxWidth: 800,
                maxHeight: '92vh', overflowY: 'auto',
                boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.08)',
                padding: 0,
            }}>

                {/* ── Header ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid rgba(245,158,11,0.12)',
                    background: 'rgba(245,158,11,0.04)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ background: 'rgba(245,158,11,0.12)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(245,158,11,0.25)' }}>
                            <BrainCircuit size={20} style={{ color: '#F59E0B' }} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#F8FAFC', letterSpacing: '-0.02em' }}>
                                {fn}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                                {txt.aiFlightIntel}
                                <span style={{ marginLeft: 8, color: '#F59E0B', fontSize: '0.68rem' }}>
                                    {livePredict ? txt.liveModel : futureMatch ? txt.schedPredict : txt.routeStatsOnly}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RiskBadge risk={riskLevel} lang={language} />
                        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div style={{ padding: '1.4rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* ── Route Header ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'stretch' }}>
                        {/* Origin */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '1rem', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Navigation size={10} style={{ color: '#60A5FA' }} /> {txt.departure}
                            </div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#F8FAFC', lineHeight: 1 }}>{depIata}</div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 1.3 }}>{depName}</div>
                            <div style={{ marginTop: 8, fontSize: '0.85rem', fontWeight: 700, color: '#F59E0B' }}>{depTime}</div>
                        </div>

                        {/* Arrow + flight info */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 0.5rem' }}>
                            <Plane size={20} style={{ color: '#F59E0B' }} />
                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.3 }}>
                                {flight?.airline_name || '—'}
                            </span>
                            {flight?.direction && (
                                <span style={{ fontSize: '0.6rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '1px 5px', color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>
                                    {flight.direction === 'arrival' ? '↓ Arrivée' : '↑ Départ'}
                                </span>
                            )}
                        </div>

                        {/* Destination */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '1rem', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <MapPin size={10} style={{ color: '#34D399' }} /> {txt.arrival}
                            </div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#F8FAFC', lineHeight: 1 }}>{arrIata}</div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 1.3 }}>{arrName}</div>
                            <div style={{ marginTop: 8, fontSize: '0.85rem', fontWeight: 700, color: '#F59E0B' }}>{arrTime}</div>
                        </div>
                    </div>

                    {/* ── Core Info Row ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        <InfoCard
                            label={txt.terminal}
                            value={terminal || txt.notAssigned}
                            accent={terminal ? '#F8FAFC' : 'rgba(255,255,255,0.25)'}
                        />
                        <InfoCard
                            label={txt.gate}
                            value={gate || txt.notAssigned}
                            accent={gate ? '#F59E0B' : 'rgba(255,255,255,0.25)'}
                        />
                        <InfoCard
                            label={txt.delay}
                            value={formatDelay(flight?.delay_minutes)}
                            accent={flight?.delay_minutes > 30 ? '#EF4444' : flight?.delay_minutes > 10 ? '#F59E0B' : '#22C55E'}
                        />
                        <InfoCard
                            label={txt.airline}
                            value={flight?.airline_name || flight?.airline_iata || '—'}
                            sub={flight?.airline_iata}
                            accent="#E2E8F0"
                        />
                    </div>

                    {/* ── AI Prediction + Circular Progress ── */}
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem', padding: '1rem 0' }}>
                            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            Chargement de l'intelligence IA…
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 14, alignItems: 'stretch' }}>
                            {/* Circular AI probability */}
                            <CircularProgress pct={riskPct} risk={riskLevel} />

                            {/* ML Prediction block */}
                            <div style={{ background: 'rgba(245,158,11,0.05)', borderRadius: 12, padding: '1.1rem', border: '1px solid rgba(245,158,11,0.15)' }}>
                                <div style={{ fontSize: '0.62rem', color: 'rgba(245,158,11,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <BrainCircuit size={11} />
                                    {txt.mlPrediction} {livePredict ? txt.realInference : futureMatch ? txt.schedBatch : txt.heuristic}
                                </div>
                                <div style={{
                                    fontSize: '2.4rem', fontWeight: 800, lineHeight: 1,
                                    color: predictedDelay == null ? 'rgba(255,255,255,0.2)'
                                        : predictedDelay > 30 ? '#EF4444'
                                        : predictedDelay > 10 ? '#F59E0B'
                                        : '#22C55E',
                                }}>
                                    {predictedDelay != null ? formatDelay(predictedDelay) : '—'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{txt.delayLabel}</div>
                                {confidence != null && (
                                    <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: '#F59E0B', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '3px 8px' }}>
                                        {txt.confidence}: <strong>{(confidence * 100).toFixed(0)}%</strong>
                                    </div>
                                )}
                            </div>

                            {/* Operational recommendation */}
                            {rec && (
                                <div style={{ background: `${rc.bg}`, borderRadius: 12, padding: '1.1rem', border: `1px solid ${rc.border}` }}>
                                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <Activity size={11} />
                                        {txt.opRecommendation}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: rec.color, fontSize: '0.8rem', lineHeight: 1.55 }}>
                                        <span style={{ flexShrink: 0, marginTop: 1 }}>{rec.icon}</span>
                                        <span>{rec.text}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Route & Airline Intelligence ── */}
                    {(flightStats || livePredict?.intelligence) && (
                        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '1.1rem 1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <TrendingUp size={13} style={{ color: '#F59E0B' }} /> {txt.routeAirlineIntel}
                            </div>
                            {(() => {
                                const s = livePredict?.intelligence ?? flightStats ?? {};
                                return (
                                    <>
                                        <StatRow label={txt.routeAvgDelay}      value={s.route_avg_delay    != null ? s.route_avg_delay.toFixed(1)         : null} unit=" min"  color="#F59E0B" />
                                        <StatRow label={txt.routeDelayRate}      value={s.route_delay_rate   != null ? (s.route_delay_rate * 100).toFixed(0)  : null} unit="%"    color="#EF4444" />
                                        <StatRow label={txt.airlineReliability}  value={s.airline_reliability != null ? (s.airline_reliability * 100).toFixed(0) : null} unit="%"  color="#22C55E" />
                                        <StatRow label={txt.hourDelayRate}       value={s.hour_delay_rate    != null ? (s.hour_delay_rate * 100).toFixed(0)   : null} unit="%"    color="#94A3B8" />
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* ── Data source footer ── */}
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.15)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>{txt.routeStatsSource}</span>
                        {livePredict && <span>{txt.inferenceSource}</span>}
                        {futureMatch  && <span>{txt.scheduleSource}</span>}
                        <span style={{ marginLeft: 'auto', color: 'rgba(245,158,11,0.4)', fontWeight: 600 }}>{txt.noMockValues}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

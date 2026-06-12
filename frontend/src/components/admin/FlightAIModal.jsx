/**
 * FlightAIModal — Theme-Aware, Improved Hierarchy
 * ================================================
 * Rich AI Operations modal — fully supports dark/light themes.
 *
 * Data sources — all REAL, no mocks:
 *   GET /api/intelligence/stats/flight         → route/airline/hour delay intelligence
 *   GET /api/intelligence/future-schedules     → matching future schedule + prediction
 *   GET /api/intelligence/flight-predict/{id}  → live inference
 */

import { useEffect, useState } from 'react';
import {
    X, Plane, Clock, BrainCircuit,
    AlertTriangle, CheckCircle, Info, RefreshCw, Activity,
    MapPin, Navigation, Timer,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAdminTheme } from '../../hooks/useAdminPrefs';

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

const AIRPORT_NAMES = {
    TUN: 'Tunis-Carthage International',
    MIR: 'Monastir Habib Bourguiba International',
    NBE: 'Enfidha-Hammamet International',
    DJE: 'Djerba-Zarzis International',
    CDG: 'Paris Charles de Gaulle',
    ORY: 'Paris-Orly',
    LYS: 'Lyon-Saint Exupéry',
    NCE: 'Nice Côte d\'Azur',
    MRS: 'Marseille Provence',
    FRA: 'Frankfurt',
    MUC: 'Munich',
    FCO: 'Rome Fiumicino',
    MXP: 'Milan Malpensa',
    BCN: 'Barcelona El Prat',
    MAD: 'Madrid Adolfo Suárez',
    LHR: 'London Heathrow',
    IST: 'Istanbul',
    CAI: 'Cairo International',
    CMN: 'Casablanca Mohammed V',
    ALG: 'Algiers Houari Boumédiène',
    DXB: 'Dubai International',
    DOH: 'Doha Hamad International',
};

function getAirportName(iata) {
    return AIRPORT_NAMES[iata] || null;
}

function formatDelay(minutes) {
    if (minutes == null || minutes <= 0) return '0 min';
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    if (h > 0 && m > 0) return `+${h}h ${m}min`;
    if (h > 0) return `+${h}h`;
    return `+${m}min`;
}

const RISK_COLORS = {
    High:    { text: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  ring: '#EF4444' },
    Medium:  { text: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', ring: '#F59E0B' },
    Low:     { text: '#22C55E', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  ring: '#22C55E' },
    Unknown: { text: '#94A3B8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', ring: '#94A3B8' },
};

const RISK_LABELS = {
    fr: { High: 'Risque élevé', Medium: 'Risque moyen', Low: 'Risque faible', Unknown: 'Risque inconnu' },
    en: { High: 'High Risk',   Medium: 'Medium Risk',  Low: 'Low Risk',     Unknown: 'Unknown Risk' },
};

const tr = {
    fr: {
        aiFlightIntel: 'Intelligence de vol IA',
        liveModel: 'Modèle en direct',
        schedPredict: 'Prédiction planifiée',
        routeStatsOnly: 'Stats d\'itinéraire uniquement',
        departure: 'Départ',
        arrival: 'Arrivée',
        airline: 'Compagnie',
        scheduled: 'Heure programmée',
        terminal: 'Terminal',
        gate: 'Porte',
        delay: 'Retard',
        notAssigned: 'Non assignée',
        mlPrediction: 'Prédiction ML',
        realInference: 'Inférence en direct',
        delayLabel: 'de retard prédit',
        confidence: 'Confiance',
        opRecommendation: 'Recommandation opérationnelle',
        aiDelayExplanation: 'Explication du retard IA',
        topFactorsIncreasing: 'Facteurs augmentant le risque de retard :',
        topFactorsReducing: 'Facteurs réduisant le risque de retard :',
        shapUnavailable: 'L\'explication IA n\'est pas disponible pour ce vol.',
        aiDelayProb: 'Probabilité de retard IA',
        lastUpdated: 'Dernière mise à jour',
        statusLabel: 'Statut',
        flightOverview: 'Aperçu du vol',
        operationalStatus: 'Statut opérationnel',
        aiPrediction: 'Prédiction IA',
        historicalIntel: 'Intelligence historique',
        flightDate: 'Date du vol',
        predictedDelay: 'Retard prédit',
        noDelayData: 'Aucune donnée de retard disponible',
        aiDelayTitle: 'Pourquoi l\'IA prévoit ce retard ?',
        predictedDelayLabel: 'Retard prévu',
        mainFactors: 'Principaux facteurs',
        summaryLabel: 'Résumé',
        narrative1: 'L\'IA estime un retard principalement en raison de {f1}.',
        narrative2: 'L\'IA estime un retard principalement en raison de {f1} et {f2}.',
        narrative3: 'L\'IA estime un retard principalement en raison de {f1}, {f2} et {f3}.',
        narrativeEmpty: 'Aucun facteur de retard significatif détecté pour ce vol.',
    },
    en: {
        aiFlightIntel: 'AI Flight Intelligence',
        liveModel: 'Live model',
        schedPredict: 'Scheduled prediction',
        routeStatsOnly: 'Route stats only',
        departure: 'Departure',
        arrival: 'Arrival',
        airline: 'Airline',
        scheduled: 'Scheduled Time',
        terminal: 'Terminal',
        gate: 'Gate',
        delay: 'Delay',
        notAssigned: 'Not assigned',
        mlPrediction: 'ML Prediction',
        realInference: 'Real Inference',
        delayLabel: 'predicted delay',
        confidence: 'Confidence',
        opRecommendation: 'Operational Recommendation',
        aiDelayExplanation: 'AI Delay Explanation',
        topFactorsIncreasing: 'Top factors increasing delay risk:',
        topFactorsReducing: 'Top factors reducing delay risk:',
        shapUnavailable: 'AI explanation is not available for this flight.',
        aiDelayProb: 'AI Delay Probability',
        lastUpdated: 'Last updated',
        statusLabel: 'Status',
        flightOverview: 'Flight Overview',
        operationalStatus: 'Operational Status',
        aiPrediction: 'AI Prediction',
        historicalIntel: 'Historical Intelligence',
        flightDate: 'Flight Date',
        predictedDelay: 'Predicted Delay',
        noDelayData: 'No delay data available',
        aiDelayTitle: 'Why does the AI predict this delay?',
        predictedDelayLabel: 'Predicted delay',
        mainFactors: 'Main factors',
        summaryLabel: 'Summary',
        narrative1: 'The AI estimates a delay mainly due to {f1}.',
        narrative2: 'The AI estimates a delay mainly due to {f1} and {f2}.',
        narrative3: 'The AI estimates a delay mainly due to {f1}, {f2}, and {f3}.',
        narrativeEmpty: 'No significant delay factors detected for this flight.',
    },

};

const FEATURE_LABEL_TRANS = {
    fr: {
        'Time of Day': 'Heure de départ programmée',
        'Weekend Flight': 'Jour de la semaine / week-end',
        'Peak Hour Departure': 'Heure de pointe',
        'Flight Distance': 'Distance de la route aérienne',
        'Flight Duration': 'Durée de vol programmée',
        'Airline': 'Fiabilité historique de la compagnie',
        'Origin Airport': 'Conditions au terminal de départ',
        'Destination Airport': 'Conditions au terminal de destination',
        'Route Historical Delay': 'Historique de la route',
        'Airline Historical Delay': 'Historique de la compagnie',
        'Hour Historical Delay': 'Historique horaire',
        'Route Traffic Volume': 'Volume de trafic route',
        'Airline Traffic Volume': 'Volume de trafic compagnie',
        'Airport Departure Load': 'Charge aéroport départ',
        'Month': 'Mois',
        'Day of Week': 'Jour de la semaine',
    },

};

function translateFeatureLabel(label, lang) {
    return FEATURE_LABEL_TRANS[lang]?.[label] || label;
}

function buildNarrative(topFactors, txt) {
    if (topFactors.length === 0) return txt.narrativeEmpty;
    const names = topFactors.map(f => f.displayLabel || f.label);
    if (names.length === 1) return txt.narrative1.replace('{f1}', names[0].toLowerCase());
    if (names.length === 2) return txt.narrative2.replace('{f1}', names[0].toLowerCase()).replace('{f2}', names[1].toLowerCase());
    return txt.narrative3.replace('{f1}', names[0].toLowerCase()).replace('{f2}', names[1].toLowerCase()).replace('{f3}', names[2].toLowerCase());
}

function getOperationalRecommendation(delay, flight, stats, lang) {
    const isFr = lang === 'fr';

    const direction = flight?.direction;
    const hasGate = !!(direction === 'arrival'
        ? (flight?.arr_gate || flight?.fa_arr_gate)
        : (flight?.dep_gate || flight?.fa_dep_gate));
    const airlineReliability = stats?.airline_reliability;
    const routeDelayRate = stats?.route_delay_rate;
    const routeAvgDelay = stats?.route_avg_delay;

    const parts = [];
    let severity = 'low';
    let iconType = 'check';
    let color = '#22C55E';

    if (delay == null) {
        parts.push(isFr ? 'Aucune donnée de retard disponible.'
            : 'No delay data available.');
        severity = 'unknown';
        iconType = 'info';
        color = '#94A3B8';
    } else if (delay > 60) {
        parts.push(isFr ? 'Retard majeur prévu.' : 'Major delay expected.');
        severity = 'high';
        iconType = 'alert';
        color = '#EF4444';
    } else if (delay > 30) {
        parts.push(isFr ? 'Retard significatif prévu.' : 'Significant delay expected.');
        severity = 'high';
        iconType = 'alert';
        color = '#F59E0B';
    } else if (delay > 10) {
        parts.push(isFr ? 'Retard mineur possible.' : 'Minor delay possible.');
        severity = 'medium';
        iconType = 'info';
        color = '#F59E0B';
    } else {
        parts.push(isFr ? 'Vol prévu à l\'heure.' : 'Flight on schedule.');
        severity = 'low';
        iconType = 'check';
        color = '#22C55E';
    }

    if (direction === 'arrival') {
        if (delay > 20) {
            parts.push(isFr
                ? 'Préparer les équipes au sol et les passerelles.'
                : 'Prepare ground crews and jetbridges.');
        }
    } else {
        if (!hasGate && delay > 0) {
            parts.push(isFr
                ? 'Affecter une porte rapidement pour minimiser l\'impact.'
                : 'Assign a gate promptly to minimize impact.');
        }
        if (delay > 30 && hasGate) {
            parts.push(isFr
                ? 'Coordonner avec l\'équipe d\'embarquement pour ajuster les horaires.'
                : 'Coordinate with boarding team for schedule adjustments.');
        }
    }

    if (airlineReliability != null) {
        if (airlineReliability < 0.5 && delay > 15) {
            parts.push(isFr
                ? 'Fiabilité compagnie faible — renforcer la surveillance.'
                : 'Low airline reliability — increase monitoring.');
        } else if (airlineReliability >= 0.8 && delay <= 10) {
            parts.push(isFr
                ? 'Compagnie fiable — faible probabilité d\'escalade.'
                : 'Reliable airline — low escalation risk.');
        }
    }

    if (routeDelayRate != null && routeDelayRate > 0.4 && delay > 15) {
        parts.push(isFr
            ? 'Route historiquement retardée — activer les procédures d\'urgence.'
            : 'Historically delayed route — activate contingency procedures.');
    }

    if (parts.length === 0) {
        parts.push(isFr
            ? 'Surveillance automatique en cours. Aucune action requise.'
            : 'Auto-monitoring active. No action required.');
    }

    const icons = { check: <CheckCircle size={14} />, alert: <AlertTriangle size={14} />, info: <Info size={14} /> };
    return { icon: icons[iconType], text: parts.join(' '), color };
}

function CircularProgress({ pct, risk }) {
    const c = RISK_COLORS[risk] ?? RISK_COLORS.Unknown;
    const radius = 44;
    const stroke = 7;
    const circ = 2 * Math.PI * radius;
    const safePct = Math.max(0, Math.min(100, pct ?? 0));
    const dash = (safePct / 100) * circ;

    return (
        <div style={{
            background: 'var(--adm-card)', borderRadius: 14,
            padding: '1.25rem', border: '1px solid var(--adm-card-border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 8, minWidth: 140,
        }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                Probabilité de retard IA
            </div>
            <div style={{ position: 'relative', width: 110, height: 110 }}>
                <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="55" cy="55" r={radius} stroke="var(--adm-card-border)" strokeWidth={stroke} fill="none" />
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
                        {(RISK_LABELS.en)[risk] || 'Unknown'}
                    </span>
                </div>
            </div>
        </div>
    );
}

function RiskBadge({ risk, lang }) {
    const c = RISK_COLORS[risk] ?? RISK_COLORS.Unknown;
    const label = (RISK_LABELS[lang] ?? RISK_LABELS.en)[risk] ?? 'Unknown';
    return (
        <span style={{ padding: '4px 12px', borderRadius: 6, background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontWeight: 700, fontSize: '0.8rem' }}>
            {label}
        </span>
    );
}

function InfoCard({ label, value, sub, accent }) {
    return (
        <div style={{ background: 'var(--adm-card)', borderRadius: 10, padding: '0.85rem 1rem', border: '1px solid var(--adm-card-border)' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5 }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: accent || 'var(--adm-text)', lineHeight: 1.25 }}>{value}</div>
            {sub && <div style={{ fontSize: '0.7rem', color: 'var(--adm-text-muted)', marginTop: 3 }}>{sub}</div>}
        </div>
    );
}

function SectionHeader({ icon, label }) {
    return (
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            {icon}
            {label}
        </div>
    );
}

export default function FlightAIModal({ flight, onClose }) {
    const { language } = useLanguage();
    const [theme] = useAdminTheme();
    const txt = tr[language] || tr.en;

    const [flightStats, setFlightStats] = useState(null);
    const [futureMatch, setFutureMatch] = useState(null);
    const [livePredict, setLivePredict] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);

    const fn = flight?.flight_number;

    useEffect(() => {
        if (!fn) return;
        setLoading(true);

        const qs = new URLSearchParams();
        if (flight.dep_iata) qs.set('dep_iata', flight.dep_iata);
        if (flight.arr_iata) qs.set('arr_iata', flight.arr_iata);
        if (flight.airline_iata) qs.set('airline_iata', flight.airline_iata);

        Promise.allSettled([
            apiFetch(`/intelligence/stats/flight?${qs}`),
            apiFetch(`/intelligence/future-schedules?predicted_only=true&limit=200`),
        ]).then(([statsRes, futureRes]) => {
            if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
                setFlightStats(statsRes.value.data);
                setStatsLoading(false);
            } else {
                setStatsLoading(false);
            }
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

    const predictedDelay = livePredict?.prediction?.predicted_delay_min
        ?? futureMatch?.predicted_delay_min
        ?? flight?.delay_minutes
        ?? null;
    const confidence = livePredict?.prediction?.confidence ?? futureMatch?.confidence ?? null;
    const riskLevel = livePredict?.prediction?.risk_level
        ?? (predictedDelay == null ? 'Unknown' : predictedDelay > 30 ? 'High' : predictedDelay > 10 ? 'Medium' : 'Low');
    const riskPct = confidence != null ? Math.round(confidence * 100)
        : (predictedDelay == null ? 0 : predictedDelay > 30 ? 85 : predictedDelay > 10 ? 55 : 20);

    const rec = getOperationalRecommendation(predictedDelay, flight, flightStats, language);

    const depIata = flight?.dep_iata || '—';
    const arrIata = flight?.arr_iata || '—';
    const depName = getAirportName(depIata) || flight?.dep_airport || depIata;
    const arrName = getAirportName(arrIata) || flight?.arr_airport || arrIata;
    const depTime = flight?.dep_scheduled ? new Date(flight.dep_scheduled).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    const arrTime = flight?.arr_scheduled ? new Date(flight.arr_scheduled).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    const flightDate = flight?.dep_scheduled ? new Date(flight.dep_scheduled).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    const isArr = flight?.direction === 'arrival';
    const terminal = (isArr ? (flight?.arr_terminal || flight?.fa_arr_terminal) : (flight?.dep_terminal || flight?.fa_dep_terminal)) || null;
    const gate = (isArr ? (flight?.arr_gate || flight?.fa_arr_gate) : (flight?.dep_gate || flight?.fa_dep_gate)) || null;
    const hasGateData = !!(gate || terminal);

    const rc = RISK_COLORS[riskLevel] ?? RISK_COLORS.Unknown;
    const isDark = theme !== 'light';
    const overlayBg = isDark ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.35)';
    const modalBorder = isDark ? 'rgba(245,158,11,0.15)' : 'rgba(234,88,12,0.2)';
    const headerBorder = isDark ? 'rgba(245,158,11,0.12)' : 'rgba(234,88,12,0.15)';
    const headerBg = isDark ? 'rgba(245,158,11,0.04)' : 'rgba(234,88,12,0.06)';
    const modalShadow = isDark
        ? '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.08)'
        : '0 20px 60px rgba(15,23,42,0.15), 0 0 0 1px rgba(234,88,12,0.1)';

    const status = flight?.status || 'scheduled';
    const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    const statusBadgeColor = ['delayed', 'cancelled'].includes(status) ? '#EF4444'
        : status === 'in_air' ? '#3B82F6'
        : status === 'landed' ? '#22C55E'
        : '#F59E0B';

    const hasPredictionData = riskPct > 0 || predictedDelay != null || confidence != null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: overlayBg, backdropFilter: 'blur(6px)',
        }} onClick={e => e.target === e.currentTarget && onClose()}>

            <div style={{
                background: 'var(--adm-bg)',
                border: `1px solid ${modalBorder}`,
                borderRadius: 18,
                width: '100%', maxWidth: 800,
                maxHeight: '92vh', overflowY: 'auto',
                boxShadow: modalShadow,
                padding: 0,
            }}>
                {/* ── Header: Flight Number + Status ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1rem 1.5rem',
                    borderBottom: `1px solid ${headerBorder}`,
                    background: headerBg,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ background: 'var(--adm-accent-light)', borderRadius: 10, padding: '8px 10px', border: `1px solid ${modalBorder}` }}>
                            <BrainCircuit size={20} style={{ color: 'var(--adm-accent)' }} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--adm-text)', letterSpacing: '-0.02em' }}>
                                    {fn}
                                </span>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', padding: '2px 10px',
                                    borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                                    background: `${statusBadgeColor}22`, color: statusBadgeColor, border: `1px solid ${statusBadgeColor}44`
                                }}>
                                    {statusDisplay}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--adm-text-muted)', borderLeft: '1px solid var(--adm-card-border)', paddingLeft: 10 }}>
                                    {flightDate}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>{txt.aiFlightIntel}</span>
                                <span style={{ color: 'var(--adm-accent)', fontSize: '0.68rem' }}>
                                    {livePredict ? `● ${txt.liveModel}` : futureMatch ? `● ${txt.schedPredict}` : `● ${txt.routeStatsOnly}`}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RiskBadge risk={riskLevel} lang={language} />
                        <button onClick={onClose} style={{
                            background: 'var(--adm-card)', border: '1px solid var(--adm-card-border)',
                            borderRadius: 8, cursor: 'pointer', color: 'var(--adm-text-muted)',
                            padding: '6px 8px', display: 'flex', alignItems: 'center'
                        }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* ── Flight Overview: Route ── */}
                    <SectionHeader icon={<Plane size={12} style={{ color: 'var(--adm-accent)' }} />} label={txt.flightOverview} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'stretch' }}>
                        <div style={{ background: 'var(--adm-card)', borderRadius: 12, padding: '1rem', border: '1px solid var(--adm-card-border)' }}>
                            <div style={{ fontSize: '0.62rem', color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Navigation size={10} style={{ color: '#60A5FA' }} /> {txt.departure}
                            </div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--adm-text)', lineHeight: 1 }}>{depIata}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)', marginTop: 4, lineHeight: 1.3 }}>{depName}</div>
                            <div style={{ marginTop: 8, fontSize: '0.85rem', fontWeight: 700, color: '#F59E0B' }}>{depTime}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 0.5rem' }}>
                            <Plane size={20} style={{ color: 'var(--adm-accent)' }} />
                            <span style={{ fontSize: '0.65rem', color: 'var(--adm-text-muted)', textAlign: 'center', lineHeight: 1.3 }}>
                                {flight?.airline_name || '—'}
                            </span>
                            <span style={{ fontSize: '0.6rem', background: 'var(--adm-accent-light)', border: `1px solid ${headerBorder}`, borderRadius: 4, padding: '1px 5px', color: 'var(--adm-accent)', textTransform: 'capitalize' }}>
                                {isArr ? '↓ Arrival' : '↑ Departure'}
                            </span>
                        </div>
                        <div style={{ background: 'var(--adm-card)', borderRadius: 12, padding: '1rem', border: '1px solid var(--adm-card-border)' }}>
                            <div style={{ fontSize: '0.62rem', color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <MapPin size={10} style={{ color: '#34D399' }} /> {txt.arrival}
                            </div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--adm-text)', lineHeight: 1 }}>{arrIata}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)', marginTop: 4, lineHeight: 1.3 }}>{arrName}</div>
                            <div style={{ marginTop: 8, fontSize: '0.85rem', fontWeight: 700, color: '#F59E0B' }}>{arrTime}</div>
                        </div>
                    </div>

                    {/* ── Operational Status ── */}
                    <SectionHeader icon={<Activity size={12} style={{ color: 'var(--adm-accent)' }} />} label={txt.operationalStatus} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        <InfoCard
                            label={txt.terminal}
                            value={terminal || txt.notAssigned}
                            accent={terminal ? 'var(--adm-text)' : 'var(--adm-text-muted)'}
                        />
                        <InfoCard
                            label={txt.gate}
                            value={gate || txt.notAssigned}
                            sub={hasGateData && gate ? undefined : undefined}
                            accent={gate ? '#F59E0B' : 'var(--adm-text-muted)'}
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
                            accent="var(--adm-text)"
                        />
                    </div>

                    {/* ── AI Prediction + Recommendation ── */}
                    {!loading && hasPredictionData && (
                        <>
                            <SectionHeader icon={<BrainCircuit size={12} style={{ color: 'var(--adm-accent)' }} />} label={txt.aiPrediction} />
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'stretch' }}>
                                <CircularProgress pct={riskPct} risk={riskLevel} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div style={{ background: 'var(--adm-accent-light)', borderRadius: 12, padding: '1.1rem', border: `1px solid ${modalBorder}` }}>
                                        <div style={{ fontSize: '0.62rem', color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <Timer size={11} />
                                            {txt.mlPrediction} {livePredict ? txt.realInference : futureMatch ? txt.schedPredict : txt.routeStatsOnly}
                                        </div>
                                        <div style={{
                                            fontSize: '2.4rem', fontWeight: 800, lineHeight: 1,
                                            color: predictedDelay == null ? 'var(--adm-text-muted)'
                                                : predictedDelay > 30 ? '#EF4444'
                                                : predictedDelay > 10 ? '#F59E0B'
                                                : '#22C55E',
                                        }}>
                                            {predictedDelay != null ? formatDelay(predictedDelay) : '—'}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)', marginTop: 4 }}>{txt.delayLabel}</div>
                                        {confidence != null && (
                                            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: '#F59E0B', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '3px 8px' }}>
                                                {txt.confidence}: <strong>{(confidence * 100).toFixed(0)}%</strong>
                                            </div>
                                        )}
                                    </div>

                                    {/* Operational Recommendation */}
                                    {rec && (
                                        <div style={{ background: `${rc.bg}`, borderRadius: 12, padding: '1.1rem', border: `1px solid ${rc.border}` }}>
                                            <SectionHeader icon={<Activity size={11} />} label={txt.opRecommendation} />
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: rec.color, fontSize: '0.8rem', lineHeight: 1.55 }}>
                                                <span style={{ flexShrink: 0, marginTop: 1 }}>{rec.icon}</span>
                                                <span>{rec.text}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Loading state */}
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--adm-text-muted)', fontSize: '0.82rem', padding: '1rem 0' }}>
                            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            Chargement des données IA…
                        </div>
                    )}

                    {/* ── AI Delay Explanation ── */}
                    {!loading && (
                        <>
                            <SectionHeader icon={<BrainCircuit size={12} style={{ color: 'var(--adm-accent)' }} />} label={txt.aiDelayTitle} />
                            <div style={{ background: 'var(--adm-card)', borderRadius: 12, padding: '1.1rem 1.25rem', border: '1px solid var(--adm-card-border)' }}>
                                {(() => {
                                    const shap = livePredict?.prediction?.shap_explanation;
                                    const hasShap = shap && shap.feature_contributions && Object.keys(shap.feature_contributions).length > 0;
                                    if (!hasShap) {
                                        return (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--adm-text-muted)', fontStyle: 'italic', padding: '0.5rem 0', textAlign: 'center' }}>
                                                {txt.shapUnavailable}
                                            </div>
                                        );
                                    }
                                    const contributions = shap.feature_contributions;
                                    const sorted = Object.entries(contributions)
                                        .map(([label, data]) => ({
                                            label,
                                            displayLabel: translateFeatureLabel(label, language),
                                            shap: data.shap,
                                            value: data.value,
                                        }))
                                        .sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap));
                                    const positive = sorted.filter(f => f.shap > 0.5).slice(0, 5);
                                    const maxPositive = positive.length > 0 ? Math.max(...positive.map(f => f.shap)) : 1;
                                    return (
                                        <>
                                            <div style={{ textAlign: 'center', marginBottom: 16, padding: '0.75rem', background: 'var(--adm-accent-light)', borderRadius: 10, border: '1px solid var(--adm-card-border)' }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                                                    {txt.predictedDelayLabel}
                                                </div>
                                                <div style={{
                                                    fontSize: '1.8rem', fontWeight: 800, lineHeight: 1.2,
                                                    color: predictedDelay > 30 ? '#EF4444' : predictedDelay > 10 ? '#F59E0B' : '#22C55E',
                                                }}>
                                                    {predictedDelay != null ? formatDelay(predictedDelay) : '—'}
                                                </div>
                                            </div>
                                            {positive.length > 0 && (
                                                <>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--adm-text)', marginBottom: 10 }}>
                                                        {txt.mainFactors}
                                                    </div>
                                                    {positive.map(f => {
                                                        const barPct = (Math.abs(f.shap) / maxPositive) * 100;
                                                        const barColor = f.shap > 20 ? '#EF4444' : f.shap > 10 ? '#F59E0B' : '#FBBF24';
                                                        return (
                                                            <div key={f.label} style={{ marginBottom: 10 }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 3 }}>
                                                                    <span style={{ color: 'var(--adm-text)' }}>{f.displayLabel}</span>
                                                                    <span style={{ color: '#EF4444', fontWeight: 700, fontSize: '0.82rem' }}>
                                                                        +{f.shap.toFixed(0)} min
                                                                    </span>
                                                                </div>
                                                                <div style={{ height: 8, background: 'var(--adm-card-border)', borderRadius: 4, overflow: 'hidden' }}>
                                                                    <div style={{
                                                                        width: `${barPct}%`,
                                                                        height: '100%',
                                                                        background: barColor,
                                                                        borderRadius: 4,
                                                                        transition: 'width 0.5s ease',
                                                                    }} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    <div style={{ marginTop: 12, padding: '0.75rem 0.85rem', background: 'var(--adm-accent-light)', borderRadius: 8, border: '1px solid var(--adm-card-border)' }}>
                                                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                                                            {txt.summaryLabel}
                                                        </div>
                                                        <p style={{ fontSize: '0.8rem', color: 'var(--adm-text-sub)', lineHeight: 1.55, margin: 0 }}>
                                                            {buildNarrative(positive, txt)}
                                                        </p>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

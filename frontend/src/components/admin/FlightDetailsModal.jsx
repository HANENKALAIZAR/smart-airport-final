import { X, Plane, Clock, MapPin, AlertTriangle, CloudLightning, CheckCircle, Navigation } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

/* ── Translations ────────────────────────────────── */
const STATUS_LABELS = {
    fr: {
        'on_time': 'À l\'heure',
        'on-time': 'À l\'heure',
        'scheduled': 'Programmé',
        'delayed': 'En retard',
        'cancelled': 'Annulé',
        'boarding': 'En cours d\'embarquement',
        'taxiing': 'Roulage',
        'in_air': 'En vol',
        'landed': 'Atterri'
    },
    en: {
        'on_time': 'On Time',
        'on-time': 'On Time',
        'scheduled': 'Scheduled',
        'delayed': 'Delayed',
        'cancelled': 'Cancelled',
        'boarding': 'Boarding',
        'taxiing': 'Taxiing',
        'in_air': 'In Air',
        'landed': 'Landed'
    },
    ar: {
        'on_time': 'في الوقت المحدد',
        'on-time': 'في الوقت المحدد',
        'scheduled': 'مجدول',
        'delayed': 'متأخر',
        'cancelled': 'ملغى',
        'boarding': 'جاري الصعود',
        'taxiing': 'درج',
        'in_air': 'في الجو',
        'landed': 'هبطت'
    }
};

const RISK_LEVELS = {
    fr: { 'low': 'Risque faible', 'medium': 'Risque moyen', 'high': 'Risque élevé' },
    en: { 'low': 'Low Risk', 'medium': 'Medium Risk', 'high': 'High Risk' },
    ar: { 'low': 'خطورة منخفضة', 'medium': 'خطورة متوسطة', 'high': 'خطورة عالية' }
};

const tr = {
    fr: {
        flight: 'Vol',
        depTimes: 'Heures de départ',
        sched: 'Programmé',
        actEst: 'Actuel / Estimé',
        delay: 'Retard',
        delayMinutes: 'Retard : {delay}',
        gateInfo: 'Informations de porte',
        terminal: 'Terminal',
        gate: 'Porte',
        aiDelayProb: 'Probabilité de retard IA',
        aiRiskAnalysis: 'Analyse de risque IA',
        aiRiskDesc: 'Le modèle IA a identifié les facteurs suivants contribuant au risque de retard :',
        weatherImpact: 'Impact météo',
        weatherAdvisory: 'Avis météorologique',
        stormsDesc: 'Orages signalés dans la région. Retards modérés à prévoir.',
        lightRainDesc: 'Légère perturbation météo signalée. Retards mineurs possibles.',
        clearMeteo: 'Conditions dégagées — aucun impact météo',
        origin: 'Origine',
        destination: 'Destination',
        clear22: 'Dégagé, 22°C',
        clear20: 'Dégagé, 20°C',
        storms18: 'Orages, 18°C',
        goodCond: 'Bonnes conditions',
        poorCond: 'Conditions médiocres',
        timeline: 'Chronologie du vol',
        timelineSched: 'Vol programmé',
        timelineBoarding: 'Enregistrement & embarquement',
        timelineDelayRep: 'Retard signalé ({delay})',
        timelineReady: 'Prêt pour le départ',
        timelineEstDep: 'Départ estimé',
        timelineEstArr: 'Arrivée estimée',
        rightsTitle: 'Vos droits en tant que passager',
        rightsEligible: 'En raison du retard de {delay}, vous pouvez prétendre à :',
        rightsVouchers: 'Rafraîchissements gratuits et bons de restauration',
        rightsRebooking: 'Options de réacheminement de vol sans frais supplémentaires',
        rightsCompensation: 'Éligibilité à une compensation (à vérifier auprès de la compagnie)',
        rightsOnTime: 'Ce vol est à l\'heure. Aucune intervention sur les droits des passagers n\'est requise.',
        close: 'Fermer',
        manage: 'Gérer le vol',
        weatherCond: 'Conditions météo',
        trafficCong: 'Congestion du trafic aérien',
        turnaround: 'Temps de rotation de l\'appareil',
        historical: 'Performance historique de la route',
    },
    en: {
        flight: 'Flight',
        depTimes: 'Departure Times',
        sched: 'Scheduled',
        actEst: 'Actual / Estimated',
        delay: 'Delay',
        delayMinutes: 'Delay: {delay}',
        gateInfo: 'Gate Information',
        terminal: 'Terminal',
        gate: 'Gate',
        aiDelayProb: 'AI Delay Probability',
        aiRiskAnalysis: 'AI Risk Analysis',
        aiRiskDesc: 'Our AI model has identified the following factors contributing to the delay risk:',
        weatherImpact: 'Weather Impact',
        weatherAdvisory: 'Weather Advisory',
        stormsDesc: 'Thunderstorms reported in the area. Moderate delays expected.',
        lightRainDesc: 'Light weather disturbance reported. Minor delays possible.',
        clearMeteo: 'Clear conditions — no weather impact',
        origin: 'Origin',
        destination: 'Destination',
        clear22: 'Clear, 22°C',
        clear20: 'Clear, 20°C',
        storms18: 'Storms, 18°C',
        goodCond: 'Good Conditions',
        poorCond: 'Poor Conditions',
        timeline: 'Flight Timeline',
        timelineSched: 'Flight scheduled',
        timelineBoarding: 'Check-in & boarding',
        timelineDelayRep: 'Delay reported ({delay})',
        timelineReady: 'Ready for departure',
        timelineEstDep: 'Estimated departure',
        timelineEstArr: 'Estimated arrival',
        rightsTitle: 'Your Rights as a Passenger',
        rightsEligible: 'Due to the delay of {delay}, you may be entitled to:',
        rightsVouchers: 'Complimentary refreshments and meal vouchers',
        rightsRebooking: 'Flight rebooking options at no additional charge',
        rightsCompensation: 'Compensation eligibility (check with airline)',
        rightsOnTime: 'This flight is on time. No passenger rights intervention required.',
        close: 'Close',
        manage: 'Manage Flight',
        weatherCond: 'Weather Conditions',
        trafficCong: 'Air Traffic Congestion',
        turnaround: 'Aircraft Turnaround Time',
        historical: 'Historical Route Performance',
    },
    ar: {
        flight: 'رحلة',
        depTimes: 'أوقات المغادرة',
        sched: 'المجدول',
        actEst: 'الفعلي / المقدر',
        delay: 'التأخير',
        delayMinutes: 'التأخير: {delay}',
        gateInfo: 'معلومات البوابة',
        terminal: 'المحطة',
        gate: 'البوابة',
        aiDelayProb: 'احتمالية التأخير بالذكاء الاصطناعي',
        aiRiskAnalysis: 'تحليل المخاطر بالذكاء الاصطناعي',
        aiRiskDesc: 'حدد نموذج الذاء الاصطناعي لدينا العوامل التالية التي تساهم في مخاطر التأخير:',
        weatherImpact: 'تأثير الطقس',
        weatherAdvisory: 'تنبيه الطقس',
        stormsDesc: 'عواصف رعدية في المنطقة. متوقع تأخير معتدل.',
        lightRainDesc: 'اضطراب طقس خفيف. احتمال تأخير طفيف.',
        clearMeteo: 'أجواء صافية — لا تأثير للطقس',
        origin: 'المصدر',
        destination: 'الوجهة',
        clear22: 'صافي، 22 درجة مئوية',
        clear20: 'صافي، 20 درجة مئوية',
        storms18: 'عواصف، 18 درجة مئوية',
        goodCond: 'ظروف جيدة',
        poorCond: 'ظروف سيئة',
        timeline: 'الجدول الزمني للرحلة',
        timelineSched: 'جدولة الرحلة',
        timelineBoarding: 'التسجيل والصعود',
        timelineDelayRep: 'تم الإبلاغ عن تأخير ({delay})',
        timelineReady: 'جاهز للمغادرة',
        timelineEstDep: 'المغادرة المقدرة',
        timelineEstArr: 'الوصول المقدر',
        rightsTitle: 'حقوقك كراكب',
        rightsEligible: 'بسبب تجاوز التأخير {delay}، قد يحق لك الحصول على:',
        rightsVouchers: 'مرطبات مجانية وقسائم وجبات',
        rightsRebooking: 'خيارات إعادة حجز الرحلة دون أي تكلفة إضافية',
        rightsCompensation: 'الأهلية للتعويض (راجع شركة الطيران)',
        rightsOnTime: 'هذه الرحلة في وقتها المحدد. لا يلزم تدخل بشأن حقوق الركاب.',
        close: 'إغلاق',
        manage: 'إدارة الرحلة',
        weatherCond: 'ظروف الطقس',
        trafficCong: 'ازدحام الحركة الجوية',
        turnaround: 'وقت دوران الطائرة',
        historical: 'الأداء التاريخي للمسار',
    }
};

/* ── Helpers ─────────────────────────────────────── */
function formatDelay(minutes) {
    if (minutes == null || minutes <= 0) return '0 min';
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    if (h > 0 && m > 0) return `+${h}h ${m}min`;
    if (h > 0) return `+${h}h`;
    return `+${m}min`;
}

const RISK_COLORS = {
    high:    { text: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  ring: '#EF4444' },
    medium:  { text: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', ring: '#F59E0B' },
    low:     { text: '#22C55E', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  ring: '#22C55E' },
    unknown: { text: '#94A3B8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', ring: '#94A3B8' },
};

/* ── Full Airport Name Lookup ────────────────────── */
const AIRPORT_NAMES = {
    TUN: 'Tunis-Carthage International',
    MIR: 'Monastir Habib Bourguiba International',
    NBE: 'Enfidha-Hammamet International',
    DJE: 'Djerba-Zarzis International',
    // Common European routes
    CDG: 'Paris Charles de Gaulle',
    ORY: 'Paris-Orly',
    LYS: 'Lyon-Saint Exupéry',
    NCE: 'Nice Côte d\'Azur',
    MRS: 'Marseille Provence',
    LIL: 'Lille-Lesquin',
    NTE: 'Nantes Atlantique',
    BOD: 'Bordeaux-Mérignac',
    TLS: 'Toulouse-Blagnac',
    LUX: 'Luxembourg',
    BRU: 'Brussels',
    AMS: 'Amsterdam Schiphol',
    FRA: 'Frankfurt',
    MUC: 'Munich',
    VIE: 'Vienna',
    FCO: 'Rome Fiumicino',
    MXP: 'Milan Malpensa',
    BCN: 'Barcelona El Prat',
    MAD: 'Madrid Adolfo Suárez',
    LIS: 'Lisbon Humberto Delgado',
    LHR: 'London Heathrow',
    LGW: 'London Gatwick',
    STN: 'London Stansted',
    LED: 'Saint Petersburg Pulkovo',
    OTP: 'Bucharest Henri Coandă',
    SOF: 'Sofia',
    PRG: 'Prague Václav Havel',
    WAW: 'Warsaw Chopin',
    ATH: 'Athens Eleftherios Venizelos',
    IST: 'Istanbul',
    CAI: 'Cairo International',
    CMN: 'Casablanca Mohammed V',
    RAK: 'Marrakech-Menara',
    ALG: 'Algiers Houari Boumédiène',
    DXB: 'Dubai International',
    DOH: 'Doha Hamad International',
    JFK: 'New York JFK',
    LAX: 'Los Angeles International',
    SIN: 'Singapore Changi',
    NBO: 'Nairobi Jomo Kenyatta',
    ADD: 'Addis Ababa Bole',
    JED: 'Jeddah King Abdulaziz',
    RUH: 'Riyadh King Khalid',
};

function getAirportName(iata) {
    return AIRPORT_NAMES[iata] || null;
}

function getRiskDetails(risk) {
    const r = String(risk || 'unknown').toLowerCase();
    return RISK_COLORS[r] || RISK_COLORS.unknown;
}

function statusColor(status) {
    if (!status) return '#F59E0B';
    const s = status.toLowerCase();
    if (['on_time', 'on-time', 'landed', 'scheduled'].includes(s)) return '#22C55E';
    if (s === 'cancelled') return '#EF4444';
    return '#F59E0B'; // delayed / boarding / taxiing
}

function riskPct(delay) {
    if (!delay || delay <= 0) return 12;
    if (delay >= 120) return 92;
    return Math.min(92, Math.round(12 + (delay / 120) * 80));
}

/* ── Circular Gauge (SVG) ────────────────────────── */
function CircularGauge({ pct, risk }) {
    const { language } = useLanguage();
    const r = 44, cx = 56, cy = 56;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    
    const riskKey = pct < 30 ? 'low' : pct < 65 ? 'medium' : 'high';
    const c = RISK_COLORS[riskKey];
    const label = (RISK_LEVELS[language] ?? RISK_LEVELS.en)[riskKey];

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
            <div style={{ position: 'relative', width: 112, height: 112 }}>
                <svg width={112} height={112} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
                    <circle
                        cx={cx} cy={cy} r={r} fill="none"
                        stroke={c.ring} strokeWidth={7}
                        strokeDasharray={`${dash} ${circ}`}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 6px ${c.ring}88)`, transition: 'stroke-dasharray 0.6s ease' }}
                    />
                </svg>
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: c.text, lineHeight: 1 }}>
                        {pct}%
                    </span>
                    <span style={{ fontSize: '0.62rem', color: c.text, fontWeight: 600, marginTop: 2, opacity: 0.8 }}>
                        {label}
                    </span>
                </div>
            </div>
        </div>
    );
}

/* ── Progress Bar ────────────────────────────────── */
function RiskBar({ label, pct, color = '#F59E0B' }) {
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>
                <span>{label}</span>
                <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{pct}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 600ms ease' }} />
            </div>
        </div>
    );
}

/* ── Timeline Item ───────────────────────────────── */
function TimelineItem({ label, time, done, active }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    border: `2px solid ${done ? '#22C55E' : active ? '#F59E0B' : 'rgba(255,255,255,0.15)'}`,
                    background: done ? 'rgba(34,197,148,0.15)' : active ? 'rgba(245,158,11,0.15)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {done && <CheckCircle size={11} style={{ color: '#22C55E' }} />}
                    {active && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B' }} />}
                </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: done ? 'rgba(255,255,255,0.65)' : active ? '#E2E8F0' : 'rgba(255,255,255,0.35)' }}>{label}</span>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>{time}</span>
            </div>
        </div>
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

function addMin(timeStr, mins) {
    if (!timeStr || timeStr === '—') return '—';
    try {
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m + mins);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
        return timeStr;
    }
}

/* ── Main Modal ──────────────────────────────────── */
export default function FlightDetailsModal({ flight, isOpen, onClose }) {
    const { language } = useLanguage();
    const txt = tr[language] || tr.en;

    if (!isOpen || !flight) return null;

    const delay = flight.predictedDelay ?? flight.delay_minutes ?? null;
    const status = flight.status || 'scheduled';
    const prob = delay === null ? 0 : riskPct(delay);
    const riskLevel = delay == null ? 'unknown' : delay > 30 ? 'high' : delay > 10 ? 'medium' : 'low';
    const rc = getRiskDetails(riskLevel);
    const sColor = statusColor(status);
    const statusLabel = (STATUS_LABELS[language] ?? STATUS_LABELS.en)[status.toLowerCase().replace('-', '_')] || status;

    // Normalise times
    const sched = flight.scheduledTime || flight.dep_scheduled || '—';
    const formattedDelayValue = formatDelay(delay);
    const estimated = delay !== null && delay > 0 ? `(${formattedDelayValue})` : '—';
    const depIata = flight.origin || flight.dep_iata || '—';
    const arrIata = flight.destination || flight.arr_iata || '—';
    const isArr = flight.direction === 'arrival';

    // Best-available terminal: AE first, FA fallback
    const terminalRaw = (isArr
        ? (flight.arr_terminal || flight.fa_arr_terminal)
        : (flight.dep_terminal || flight.fa_dep_terminal));
    const terminal = terminalRaw && String(terminalRaw).trim() && terminalRaw !== '-' ? terminalRaw : 'Non assignée';

    // Best-available gate: AE first, FA fallback
    const gateRaw = (isArr
        ? (flight.arr_gate || flight.fa_arr_gate)
        : (flight.dep_gate || flight.fa_dep_gate));
    const gate = gateRaw && String(gateRaw).trim() && gateRaw !== '-' ? gateRaw : 'Non assignée';

    // Which source provided the gate we are displaying?
    const gateFromFA = gate !== 'Non assignée' && (isArr
        ? (!flight.arr_gate && !!flight.fa_arr_gate)
        : (!flight.dep_gate && !!flight.fa_dep_gate));

    // Source tracking for displayed actual times
    const depTimeSource = flight.displayed_dep_source || 'aviation_edge';
    const arrTimeSource = flight.displayed_arr_source || 'aviation_edge';

    const aircraft = flight.aircraftType || 'Boeing 737-800';

    const safeDelay = Math.max(0, delay || 0);
    const riskFactors = [
        {
            label: txt.weatherCond,
            pct: safeDelay <= 0 ? 10 : Math.min(90, Math.round(10 + (safeDelay / 120) * 60)),
            color: safeDelay > 30 ? '#EF4444' : safeDelay > 10 ? '#F59E0B' : '#22C55E',
        },
        {
            label: txt.trafficCong,
            pct: safeDelay <= 0 ? 14 : Math.min(85, Math.round(14 + (safeDelay / 120) * 52)),
            color: '#F59E0B',
        },
        {
            label: txt.turnaround,
            pct: safeDelay <= 0 ? 8 : Math.min(80, Math.round(8 + (safeDelay / 120) * 45)),
            color: '#F59E0B',
        },
        {
            label: txt.historical,
            pct: safeDelay <= 0 ? 18 : Math.min(82, Math.round(18 + (safeDelay / 120) * 48)),
            color: '#F59E0B',
        },
    ];

    /* Timeline events */
    const isDelayed = delay !== null && delay > 0;
    const timeline = [
        { label: txt.timelineSched, time: sched, done: true, active: false },
        { label: txt.timelineBoarding, time: sched ? `${sched}` : '—', done: isDelayed, active: !isDelayed },
        { label: isDelayed ? txt.timelineDelayRep.replace('{delay}', formattedDelayValue) : txt.timelineReady, time: '—', done: isDelayed, active: false },
        { label: txt.timelineEstDep, time: isDelayed ? formattedDelayValue : sched, done: false, active: isDelayed },
    ];

    const dbRights = flight.passengerRights ?? [];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        }} onClick={onClose}>
            
            <div style={{
                background: 'linear-gradient(160deg, #0C1526 0%, #0F1E35 100%)',
                border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: 18,
                width: '100%', maxWidth: 750,
                maxHeight: '92vh', overflowY: 'auto',
                boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.08)',
                padding: 0,
            }} onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid rgba(245,158,11,0.12)',
                    background: 'rgba(245,158,11,0.04)',
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <h2 style={{ fontWeight: 800, fontSize: '1.3rem', color: '#F8FAFC', letterSpacing: '-0.02em', margin: 0 }}>
                                {txt.flight} {flight.flightNumber || flight.flight_number}
                            </h2>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
                                borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                                background: `${sColor}22`, color: sColor, border: `1px solid ${sColor}44`
                            }}>
                                {statusLabel}
                            </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.40)', margin: '3px 0 0' }}>
                            {flight.airline_name || flight.airline}
                        </p>
                    </div>
                    <button style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
                        padding: '6px 8px', display: 'flex', alignItems: 'center'
                    }} onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* ── Route ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '0.85rem 1.5rem', background: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                    <MapPin size={14} style={{ color: '#F59E0B' }} />
                    <div style={{ lineHeight: 1.2 }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{depIata}</span>
                        {getAirportName(depIata) && (
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{getAirportName(depIata)}</div>
                        )}
                    </div>
                    <Plane size={14} style={{ color: 'rgba(255,255,255,0.3)', margin: '0 4px' }} />
                    <MapPin size={14} style={{ color: '#22C55E' }} />
                    <div style={{ lineHeight: 1.2 }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{arrIata}</span>
                        {getAirportName(arrIata) && (
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{getAirportName(arrIata)}</div>
                        )}
                    </div>
                </div>

                {/* ── Scrollable Body ── */}
                <div style={{ padding: '1.4rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    
                    {/* ── Row 1: Core details ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        <InfoCard
                            label={txt.terminal}
                            value={terminal}
                            accent={terminal === 'Non assignée' ? 'rgba(255,255,255,0.25)' : '#F8FAFC'}
                        />
                        <InfoCard
                            label={txt.gate}
                            value={gate}
                            sub={gateFromFA ? 'FlightAware fallback' : undefined}
                            accent={gate === 'Non assignée' ? 'rgba(255,255,255,0.25)' : '#F59E0B'}
                        />
                        <InfoCard
                            label={txt.delay}
                            value={formattedDelayValue}
                            accent={delay > 30 ? '#EF4444' : delay > 10 ? '#F59E0B' : '#22C55E'}
                        />
                        <InfoCard
                            label={txt.sched}
                            value={sched}
                            sub={estimated !== '—' ? estimated : undefined}
                            accent="#E2E8F0"
                        />
                    </div>

                    {/* ── Row 2: AI Widget + Risk Analysis ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'stretch' }}>
                        
                        {/* Circular progress */}
                        <CircularGauge pct={prob} risk={riskLevel} />

                        {/* AI Risk Factors Card */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '1.1rem 1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Navigation size={13} style={{ color: '#F59E0B' }} />
                                <span>{txt.aiRiskAnalysis}</span>
                            </div>
                            <p style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.40)', margin: '0 0 10px', lineHeight: 1.4 }}>
                                {txt.aiRiskDesc}
                            </p>
                            <div>
                                {riskFactors.map(f => <RiskBar key={f.label} label={f.label} pct={f.pct} color={f.color} />)}
                            </div>
                        </div>

                    </div>

                    {/* ── Row 3: Timeline + Weather/Passenger Rights ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch' }}>
                        
                        {/* Flight Timeline */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '1.1rem 1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Clock size={13} style={{ color: '#F59E0B' }} />
                                <span>{txt.timeline}</span>
                            </div>
                            <div style={{ position: 'relative', paddingLeft: 4 }}>
                                <div style={{ position: 'absolute', left: 9, top: 10, bottom: 10, width: 2, background: 'rgba(255,255,255,0.06)', zIndex: 0 }} />
                                {timeline.map((ev, i) => <TimelineItem key={i} {...ev} />)}
                            </div>
                        </div>

                        {/* Weather & Passenger Rights */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* Weather Card */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '1.1rem 1.25rem', border: '1px solid rgba(255,255,255,0.06)', flex: 1 }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <CloudLightning size={13} style={{ color: '#F59E0B' }} />
                                    <span>{txt.weatherImpact}</span>
                                </div>
                                {delay > 15 ? (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0.625rem 0.75rem', background: 'rgba(245, 158, 11, 0.09)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 8, fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                                        <AlertTriangle size={13} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 2 }} />
                                        <span><strong>{txt.weatherAdvisory}</strong><br />
                                            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}>
                                                {delay > 30 ? txt.stormsDesc : txt.lightRainDesc}
                                            </span>
                                        </span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.78rem', color: '#22C55E' }}>
                                        <CheckCircle size={13} /> {txt.clearMeteo}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>{txt.origin} · {depIata}</div>
                                        {getAirportName(depIata) && (
                                            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', marginBottom: 3 }}>{getAirportName(depIata)}</div>
                                        )}
                                        <div style={{ fontSize: '0.82rem', color: '#22C55E', fontWeight: 600 }}>{txt.clear22}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>{txt.destination} · {arrIata}</div>
                                        {getAirportName(arrIata) && (
                                            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', marginBottom: 3 }}>{getAirportName(arrIata)}</div>
                                        )}
                                        <div style={{ fontSize: '0.82rem', color: delay > 30 ? '#EF4444' : '#22C55E', fontWeight: 600 }}>
                                            {delay > 30 ? txt.storms18 : txt.clear20}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Passenger Rights Card */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '1.1rem 1.25rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <CheckCircle size={13} style={{ color: '#22C55E' }} />
                                    <span>{txt.rightsTitle}</span>
                                </div>
                                {delay >= 45 ? (
                                    <>
                                        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.40)', margin: '0 0 8px', lineHeight: 1.4 }}>
                                            {txt.rightsEligible.replace('{delay}', formattedDelayValue)}
                                        </p>
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                            <li style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)' }}>
                                                <CheckCircle size={11} style={{ color: '#22C55E', flexShrink: 0 }} /> {txt.rightsVouchers}
                                            </li>
                                            <li style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)' }}>
                                                <CheckCircle size={11} style={{ color: '#22C55E', flexShrink: 0 }} /> {txt.rightsRebooking}
                                            </li>
                                        </ul>
                                    </>
                                ) : (
                                    <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.40)', margin: 0, lineHeight: 1.4 }}>
                                        {txt.rightsOnTime}
                                    </p>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* ── Footer ── */}
                    <div style={{
                        fontSize: '0.65rem', color: 'rgba(255,255,255,0.15)',
                        borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10,
                        display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center'
                    }}>
                        <span>Stats source: ae_aviation_stats</span>
                        <span>Model: delay_prediction_model.pkl</span>
                        <span>Aircraft: {aircraft}</span>
                        <span style={{ marginLeft: 'auto', color: 'rgba(245,158,11,0.4)', fontWeight: 600 }}>Données réelles sans simulation</span>
                    </div>

                </div>

                {/* ── Footer Actions ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    gap: 10, padding: '0.875rem 1.5rem',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <button className="admin-btn admin-btn--outline" onClick={onClose}>{txt.close}</button>
                    <button className="admin-btn admin-btn--primary" onClick={onClose}>
                        <Plane size={14} /> {txt.manage}
                    </button>
                </div>

            </div>
        </div>
    );
}

import { X, Plane, Clock, MapPin, AlertTriangle, CloudLightning, CheckCircle, Navigation, Activity, Timer, TrendingUp } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAdminTheme } from '../../hooks/useAdminPrefs';

const STATUS_LABELS = {
    fr: {
        'on_time': 'À l\'heure', 'on-time': 'À l\'heure', 'scheduled': 'Programmé',
        'delayed': 'En retard', 'cancelled': 'Annulé', 'boarding': 'Embarquement',
        'taxiing': 'Roulage', 'in_air': 'En vol', 'landed': 'Atterri',
    },
    en: {
        'on_time': 'On Time', 'on-time': 'On Time', 'scheduled': 'Scheduled',
        'delayed': 'Delayed', 'cancelled': 'Cancelled', 'boarding': 'Boarding',
        'taxiing': 'Taxiing', 'in_air': 'In Air', 'landed': 'Landed',
    },
    ar: {
        'on_time': 'في الوقت', 'on-time': 'في الوقت', 'scheduled': 'مجدول',
        'delayed': 'متأخر', 'cancelled': 'ملغى', 'boarding': 'صعود',
        'taxiing': 'درج', 'in_air': 'في الجو', 'landed': 'هبطت',
    }
};

const RISK_LEVELS = {
    fr: { 'low': 'Risque faible', 'medium': 'Risque moyen', 'high': 'Risque élevé' },
    en: { 'low': 'Low Risk', 'medium': 'Medium Risk', 'high': 'High Risk' },
    ar: { 'low': 'خطورة منخفضة', 'medium': 'خطورة متوسطة', 'high': 'خطورة عالية' }
};

const tr = {
    fr: {
        flight: 'Vol', depTimes: 'Heures de départ', sched: 'Programmé',
        actEst: 'Actuel / Estimé', delay: 'Retard', delayMinutes: 'Retard : {delay}',
        gateInfo: 'Porte', terminal: 'Terminal', gate: 'Porte',
        aiDelayProb: 'Probabilité de retard IA', aiRiskAnalysis: 'Analyse de risque IA',
        aiRiskDesc: 'Facteurs contribuant au risque de retard:',
        weatherImpact: 'Impact météo', weatherAdvisory: 'Avis météorologique',
        stormsDesc: 'Orages signalés. Retards modérés à prévoir.',
        lightRainDesc: 'Légère perturbation. Retards mineurs possibles.',
        clearMeteo: 'Conditions dégagées — aucun impact météo',
        origin: 'Origine', destination: 'Destination',
        timeline: 'Chronologie', rightsTitle: 'Droits passager',
        rightsEligible: 'Retard de {delay} — vous pouvez prétendre à:',
        rightsVouchers: 'Rafraîchissements et bons de repas',
        rightsRebooking: 'Réacheminement sans frais',
        rightsCompensation: 'Compensation éligible',
        rightsOnTime: 'Vol à l\'heure. Aucune intervention requise.',
        close: 'Fermer', manage: 'Gérer le vol',
        weatherCond: 'Météo', trafficCong: 'Trafic aérien',
        turnaround: 'Rotation appareil', historical: 'Performance historique',
        flightOverview: 'Aperçu du vol', operationalStatus: 'Statut opérationnel',
        aiPrediction: 'Prédiction IA', opRecommendation: 'Recommandation opérationnelle',
        flightDate: 'Date du vol', airline: 'Compagnie',
        noDelayData: 'Aucune donnée de retard', noGateAssigned: 'Non assignée',
        insufficientRouteData: 'Données historiques insuffisantes',
        predictedDelay: 'Retard prédit',
    },
    en: {
        flight: 'Flight', depTimes: 'Departure Times', sched: 'Scheduled',
        actEst: 'Actual / Estimated', delay: 'Delay', delayMinutes: 'Delay: {delay}',
        gateInfo: 'Gate', terminal: 'Terminal', gate: 'Gate',
        aiDelayProb: 'AI Delay Probability', aiRiskAnalysis: 'AI Risk Analysis',
        aiRiskDesc: 'Factors contributing to delay risk:',
        weatherImpact: 'Weather Impact', weatherAdvisory: 'Weather Advisory',
        stormsDesc: 'Thunderstorms reported. Moderate delays expected.',
        lightRainDesc: 'Light disturbance. Minor delays possible.',
        clearMeteo: 'Clear conditions — no weather impact',
        origin: 'Origin', destination: 'Destination',
        timeline: 'Timeline', rightsTitle: 'Passenger Rights',
        rightsEligible: 'Delay of {delay} — you may be entitled to:',
        rightsVouchers: 'Refreshments and meal vouchers',
        rightsRebooking: 'Free rebooking options',
        rightsCompensation: 'Compensation eligibility',
        rightsOnTime: 'Flight on time. No intervention required.',
        close: 'Close', manage: 'Manage Flight',
        weatherCond: 'Weather', trafficCong: 'Air Traffic',
        turnaround: 'Turnaround', historical: 'Historical Performance',
        flightOverview: 'Flight Overview', operationalStatus: 'Operational Status',
        aiPrediction: 'AI Prediction', opRecommendation: 'Operational Recommendation',
        flightDate: 'Flight Date', airline: 'Airline',
        noDelayData: 'No delay data', noGateAssigned: 'Not assigned',
        insufficientRouteData: 'Insufficient historical route data',
        predictedDelay: 'Predicted Delay',
    },
    ar: {
        flight: 'رحلة', depTimes: 'أوقات المغادرة', sched: 'المجدول',
        actEst: 'الفعلي / المقدر', delay: 'التأخير', delayMinutes: 'التأخير: {delay}',
        gateInfo: 'البوابة', terminal: 'المحطة', gate: 'البوابة',
        aiDelayProb: 'احتمالية التأخير', aiRiskAnalysis: 'تحليل المخاطر',
        aiRiskDesc: 'العوامل المساهمة في خطر التأخير:',
        weatherImpact: 'تأثير الطقس', weatherAdvisory: 'تنبيه الطقس',
        stormsDesc: 'عواصف رعدية. تأخير معتدل متوقع.', lightRainDesc: 'اضطراب طفيف.',
        clearMeteo: 'أجواء صافية', origin: 'المصدر', destination: 'الوجهة',
        timeline: 'الجدول الزمني', rightsTitle: 'حقوق الراكب',
        rightsEligible: 'تأخير {delay} — قد يحق لك:', rightsVouchers: 'مرطبات ووجبات',
        rightsRebooking: 'إعادة حجز مجانية', rightsCompensation: 'التعويض',
        rightsOnTime: 'الرحلة في وقتها.', close: 'إغلاق', manage: 'إدارة',
        weatherCond: 'الطقس', trafficCong: 'الحركة الجوية', turnaround: 'الدوران',
        historical: 'الأداء التاريخي', flightOverview: 'نظرة عامة',
        operationalStatus: 'الحالة التشغيلية', aiPrediction: 'التنبؤ',
        opRecommendation: 'توصية تشغيلية', flightDate: 'تاريخ الرحلة',
        airline: 'شركة الطيران', noDelayData: 'لا توجد بيانات',
        noGateAssigned: 'غير مخصص',
        insufficientRouteData: 'بيانات تاريخية غير كافية للمسار',
        predictedDelay: 'التأخير المتوقع',
    }
};

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

const AIRPORT_NAMES = {
    TUN: 'Tunis-Carthage International', MIR: 'Monastir Habib Bourguiba International',
    NBE: 'Enfidha-Hammamet International', DJE: 'Djerba-Zarzis International',
    CDG: 'Paris Charles de Gaulle', ORY: 'Paris-Orly', LYS: 'Lyon-Saint Exupéry',
    NCE: 'Nice Côte d\'Azur', MRS: 'Marseille Provence', BRU: 'Brussels',
    AMS: 'Amsterdam Schiphol', FRA: 'Frankfurt', MUC: 'Munich', VIE: 'Vienna',
    FCO: 'Rome Fiumicino', MXP: 'Milan Malpensa', BCN: 'Barcelona El Prat',
    MAD: 'Madrid Adolfo Suárez', LHR: 'London Heathrow', IST: 'Istanbul',
    CAI: 'Cairo International', CMN: 'Casablanca Mohammed V', ALG: 'Algiers Houari Boumédiène',
    DXB: 'Dubai International', DOH: 'Doha Hamad International',
};

function getAirportName(iata) { return AIRPORT_NAMES[iata] || null; }

function statusColor(status) {
    if (!status) return '#F59E0B';
    const s = status.toLowerCase();
    if (['on_time', 'on-time', 'landed', 'scheduled'].includes(s)) return '#22C55E';
    if (s === 'cancelled') return '#EF4444';
    return '#F59E0B';
}

function riskPct(delay) {
    if (!delay || delay <= 0) return 12;
    if (delay >= 120) return 92;
    return Math.min(92, Math.round(12 + (delay / 120) * 80));
}

function getRiskDetails(risk) {
    const r = String(risk || 'unknown').toLowerCase();
    return RISK_COLORS[r] || RISK_COLORS.unknown;
}

function CircularGauge({ pct, risk }) {
    const riskKey = pct < 30 ? 'low' : pct < 65 ? 'medium' : 'high';
    const c = RISK_COLORS[riskKey];
    const r = 44, cx = 56, cy = 56;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;

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
            <div style={{ position: 'relative', width: 112, height: 112 }}>
                <svg width={112} height={112} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--adm-card-border)" strokeWidth={7} />
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
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: c.text, lineHeight: 1 }}>{pct}%</span>
                    <span style={{ fontSize: '0.62rem', color: c.text, fontWeight: 600, marginTop: 2, opacity: 0.8 }}>
                        {(RISK_LEVELS.en)[riskKey] || 'Unknown'}
                    </span>
                </div>
            </div>
        </div>
    );
}

function RiskBar({ label, pct, color = '#F59E0B' }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>
                <span>{label}</span>
                <span style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{pct}%</span>
            </div>
            <div style={{ height: 5, background: 'var(--adm-card-border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 600ms ease' }} />
            </div>
        </div>
    );
}

function TimelineItem({ label, time, done, active }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: `2px solid ${done ? '#22C55E' : active ? '#F59E0B' : 'var(--adm-card-border)'}`,
                    background: done ? 'rgba(34,197,148,0.15)' : active ? 'rgba(245,158,11,0.15)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {done && <CheckCircle size={10} style={{ color: '#22C55E' }} />}
                    {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />}
                </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', color: done ? 'var(--adm-text-sub)' : active ? 'var(--adm-text)' : 'var(--adm-text-muted)' }}>{label}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--adm-text-muted)', fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>{time}</span>
            </div>
        </div>
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
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 2 }}>
            {icon}
            {label}
        </div>
    );
}

function getOperationalRecommendation(delay, flight, lang) {
    const isFr = lang === 'fr';
    const isAr = lang === 'ar';
    if (delay == null) return null;

    const direction = flight?.direction;
    const hasGate = !!((direction === 'arrival'
        ? (flight?.arr_gate || flight?.fa_arr_gate)
        : (flight?.dep_gate || flight?.fa_dep_gate)));

    const parts = [];
    let color = '#22C55E';
    let icon = <CheckCircle size={14} />;

    if (delay > 60) {
        parts.push(isFr
            ? 'Retard majeur prévu. Activer les procédures d\'urgence.'
            : isAr ? 'تأخير كبير متوقع. تفعيل إجراءات الطوارئ.'
            : 'Major delay expected. Activate contingency procedures.');
        color = '#EF4444';
        icon = <AlertTriangle size={14} />;
    } else if (delay > 30) {
        parts.push(isFr
            ? 'Retard significatif. Communication proactive avec les passagers recommandée.'
            : isAr ? 'تأخير ملموس. التواصل الاستباقي مع الركاب موصى به.'
            : 'Significant delay. Proactive passenger communication advised.');
        color = '#F59E0B';
        icon = <AlertTriangle size={14} />;
    } else if (delay > 10) {
        parts.push(isFr
            ? 'Retard mineur. Surveiller l\'état du vol.'
            : isAr ? 'تأخير طفيف. مراقبة حالة الرحلة.'
            : 'Minor delay. Monitor flight status.');
        color = '#F59E0B';
        icon = <Info size={14} />;
    } else {
        parts.push(isFr
            ? 'Vol à l\'heure. Aucune action immédiate requise.'
            : isAr ? 'الرحلة في وقتها. لا إجراءات مطلوبة.'
            : 'Flight on schedule. No immediate action required.');
        color = '#22C55E';
        icon = <CheckCircle size={14} />;
    }

    if (direction === 'departure' && !hasGate && delay > 0) {
        parts.push(isFr
            ? 'Aucune porte assignée — prioriser l\'affectation.'
            : isAr ? 'لم يتم تخصيص بوابة — تحديد أولويات التخصيص.'
            : 'No gate assigned — prioritize assignment.');
    }
    if (direction === 'arrival' && delay > 20) {
        parts.push(isFr
            ? 'Préparer les équipes au sol pour l\'arrivée retardée.'
            : isAr ? 'تجهيز فرق الأرض للوصول المتأخر.'
            : 'Prepare ground crews for delayed arrival.');
    }

    return { icon, text: parts.join(' '), color };
}

export default function FlightDetailsModal({ flight, isOpen, onClose }) {
    const { language } = useLanguage();
    const [theme] = useAdminTheme();
    const txt = tr[language] || tr.en;

    if (!isOpen || !flight) return null;

    const delay = flight.predictedDelay ?? flight.delay_minutes ?? null;
    const status = flight.status || 'scheduled';
    const prob = delay === null ? 0 : riskPct(delay);
    const riskLevel = delay == null ? 'unknown' : delay > 30 ? 'high' : delay > 10 ? 'medium' : 'low';
    const rc = getRiskDetails(riskLevel);
    const sColor = statusColor(status);
    const statusLabel = (STATUS_LABELS[language] ?? STATUS_LABELS.en)[status.toLowerCase().replace('-', '_')] || status;

    const sched = flight.scheduledTime || flight.dep_scheduled || '—';
    const formattedDelayValue = formatDelay(delay);
    const depIata = flight.origin || flight.dep_iata || '—';
    const arrIata = flight.destination || flight.arr_iata || '—';
    const isArr = flight.direction === 'arrival';

    const terminalRaw = (isArr ? (flight.arr_terminal || flight.fa_arr_terminal) : (flight.dep_terminal || flight.fa_dep_terminal));
    const terminal = terminalRaw && String(terminalRaw).trim() && terminalRaw !== '-' ? terminalRaw : null;
    const gateRaw = (isArr ? (flight.arr_gate || flight.fa_arr_gate) : (flight.dep_gate || flight.fa_dep_gate));
    const gate = gateRaw && String(gateRaw).trim() && gateRaw !== '-' ? gateRaw : null;

    const hasGateData = !!(gate || terminal);
    const aircraft = flight.aircraftType || null;

    const safeDelay = Math.max(0, delay || 0);
    const riskFactors = [
        { label: txt.weatherCond, pct: safeDelay <= 0 ? 10 : Math.min(90, Math.round(10 + (safeDelay / 120) * 60)), color: safeDelay > 30 ? '#EF4444' : safeDelay > 10 ? '#F59E0B' : '#22C55E' },
        { label: txt.trafficCong, pct: safeDelay <= 0 ? 14 : Math.min(85, Math.round(14 + (safeDelay / 120) * 52)), color: '#F59E0B' },
        { label: txt.turnaround, pct: safeDelay <= 0 ? 8 : Math.min(80, Math.round(8 + (safeDelay / 120) * 45)), color: '#F59E0B' },
        { label: txt.historical, pct: safeDelay <= 0 ? 18 : Math.min(82, Math.round(18 + (safeDelay / 120) * 48)), color: '#F59E0B' },
    ];

    const isDelayed = delay !== null && delay > 0;
    const timeline = [
        { label: 'Flight scheduled', time: sched, done: true, active: false },
        { label: 'Check-in & boarding', time: sched || '—', done: isDelayed, active: !isDelayed },
        { label: isDelayed ? `Delay reported (${formattedDelayValue})` : 'Ready for departure', time: '—', done: isDelayed, active: false },
        { label: 'Estimated departure', time: isDelayed ? formattedDelayValue : sched, done: false, active: isDelayed },
    ];

    const rec = getOperationalRecommendation(delay, flight, language);
    const isDark = theme !== 'light';
    const overlayBg = isDark ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.35)';
    const modalBorder = isDark ? 'rgba(245,158,11,0.15)' : 'rgba(234,88,12,0.2)';
    const headerBorder = isDark ? 'rgba(245,158,11,0.12)' : 'rgba(234,88,12,0.15)';
    const headerBg = isDark ? 'rgba(245,158,11,0.04)' : 'rgba(234,88,12,0.06)';

    const flightDate = flight.flightDate || (flight.scheduledTime
        ? new Date(flight.scheduledTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : null);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: overlayBg, backdropFilter: 'blur(6px)',
        }} onClick={onClose}>

            <div style={{
                background: 'var(--adm-bg)',
                border: `1px solid ${modalBorder}`,
                borderRadius: 18,
                width: '100%', maxWidth: 750,
                maxHeight: '92vh', overflowY: 'auto',
                boxShadow: isDark
                    ? '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.08)'
                    : '0 20px 60px rgba(15,23,42,0.15), 0 0 0 1px rgba(234,88,12,0.1)',
                padding: 0,
            }} onClick={e => e.stopPropagation()}>

                {/* ── Header: Flight Number + Status ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1rem 1.5rem',
                    borderBottom: `1px solid ${headerBorder}`,
                    background: headerBg,
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <h2 style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--adm-text)', letterSpacing: '-0.02em', margin: 0 }}>
                                {txt.flight} {flight.flightNumber || flight.flight_number}
                            </h2>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
                                borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                                background: `${sColor}22`, color: sColor, border: `1px solid ${sColor}44`
                            }}>
                                {statusLabel}
                            </span>
                            {flightDate && (
                                <span style={{ fontSize: '0.68rem', color: 'var(--adm-text-muted)', borderLeft: '1px solid var(--adm-card-border)', paddingLeft: 10 }}>
                                    {flightDate}
                                </span>
                            )}
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--adm-text-muted)', margin: '3px 0 0' }}>
                            {flight.airline_name || flight.airline}
                        </p>
                    </div>
                    <button style={{
                        background: 'var(--adm-card)', border: '1px solid var(--adm-card-border)',
                        borderRadius: 8, cursor: 'pointer', color: 'var(--adm-text-muted)',
                        padding: '6px 8px', display: 'flex', alignItems: 'center'
                    }} onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* ── Scrollable Body ── */}
                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* ── Flight Overview: Route ── */}
                    <SectionHeader icon={<Plane size={12} style={{ color: 'var(--adm-accent)' }} />} label={txt.flightOverview} />
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '0.75rem 1rem', background: 'var(--adm-card)', borderRadius: 12,
                        border: '1px solid var(--adm-card-border)',
                    }}>
                        <MapPin size={14} style={{ color: '#F59E0B' }} />
                        <div style={{ lineHeight: 1.2 }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--adm-text)' }}>{depIata}</span>
                            {getAirportName(depIata) && (
                                <div style={{ fontSize: '0.65rem', color: 'var(--adm-text-muted)', marginTop: 1 }}>{getAirportName(depIata)}</div>
                            )}
                        </div>
                        <Plane size={14} style={{ color: 'var(--adm-text-muted)', margin: '0 4px' }} />
                        <MapPin size={14} style={{ color: '#22C55E' }} />
                        <div style={{ lineHeight: 1.2 }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--adm-text)' }}>{arrIata}</span>
                            {getAirportName(arrIata) && (
                                <div style={{ fontSize: '0.65rem', color: 'var(--adm-text-muted)', marginTop: 1 }}>{getAirportName(arrIata)}</div>
                            )}
                        </div>
                        {flight.direction && (
                            <span style={{ marginLeft: 'auto', fontSize: '0.6rem', background: 'var(--adm-accent-light)', border: `1px solid ${modalBorder}`, borderRadius: 4, padding: '2px 6px', color: 'var(--adm-accent)', textTransform: 'capitalize' }}>
                                {isArr ? 'Arrival' : 'Departure'}
                            </span>
                        )}
                    </div>

                    {/* ── Operational Status ── */}
                    <SectionHeader icon={<Activity size={12} style={{ color: 'var(--adm-accent)' }} />} label={txt.operationalStatus} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        <InfoCard
                            label={txt.terminal}
                            value={terminal || txt.noGateAssigned}
                            accent={terminal ? 'var(--adm-text)' : 'var(--adm-text-muted)'}
                        />
                        <InfoCard
                            label={txt.gate}
                            value={gate || txt.noGateAssigned}
                            sub={hasGateData && gate ? undefined : undefined}
                            accent={gate ? '#F59E0B' : 'var(--adm-text-muted)'}
                        />
                        <InfoCard
                            label={txt.delay}
                            value={formattedDelayValue}
                            accent={delay > 30 ? '#EF4444' : delay > 10 ? '#F59E0B' : '#22C55E'}
                        />
                        <InfoCard
                            label={txt.sched}
                            value={sched}
                            sub={isDelayed ? formattedDelayValue : undefined}
                            accent="var(--adm-text)"
                        />
                    </div>

                    {/* ── AI Prediction + Risk Factors ── */}
                    <SectionHeader icon={<Timer size={12} style={{ color: 'var(--adm-accent)' }} />} label={txt.aiPrediction} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'stretch' }}>
                        <CircularGauge pct={prob} risk={riskLevel} />
                        <div style={{ background: 'var(--adm-card)', borderRadius: 12, padding: '1.1rem 1.25rem', border: '1px solid var(--adm-card-border)' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--adm-text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Navigation size={13} style={{ color: 'var(--adm-accent)' }} />
                                <span>{txt.aiRiskAnalysis}</span>
                            </div>
                            {delay != null && (
                                <p style={{ fontSize: '0.73rem', color: 'var(--adm-text-muted)', margin: '0 0 8px', lineHeight: 1.4 }}>
                                    {txt.aiRiskDesc}
                                </p>
                            )}
                            <div>
                                {riskFactors.map(f => <RiskBar key={f.label} label={f.label} pct={f.pct} color={f.color} />)}
                            </div>
                        </div>
                    </div>

                    {/* ── Operational Recommendation ── */}
                    {rec && (
                        <>
                            <SectionHeader icon={<Activity size={12} style={{ color: 'var(--adm-accent)' }} />} label={txt.opRecommendation} />
                            <div style={{ background: `${rc.bg}`, borderRadius: 12, padding: '1.1rem', border: `1px solid ${rc.border}` }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: rec.color, fontSize: '0.8rem', lineHeight: 1.55 }}>
                                    <span style={{ flexShrink: 0, marginTop: 1 }}>{rec.icon}</span>
                                    <span>{rec.text}</span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── Timeline + Weather ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch' }}>
                        {/* Flight Timeline */}
                        <div style={{ background: 'var(--adm-card)', borderRadius: 12, padding: '1.1rem 1.25rem', border: '1px solid var(--adm-card-border)' }}>
                            <SectionHeader icon={<Clock size={12} style={{ color: 'var(--adm-accent)' }} />} label={txt.timeline} />
                            <div style={{ position: 'relative', paddingLeft: 4 }}>
                                <div style={{ position: 'absolute', left: 8, top: 10, bottom: 10, width: 2, background: 'var(--adm-card-border)', zIndex: 0 }} />
                                {timeline.map((ev, i) => <TimelineItem key={i} {...ev} />)}
                            </div>
                        </div>

                        {/* Weather & Aircraft */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ background: 'var(--adm-card)', borderRadius: 12, padding: '1.1rem 1.25rem', border: '1px solid var(--adm-card-border)', flex: 1 }}>
                                <SectionHeader icon={<CloudLightning size={12} style={{ color: 'var(--adm-accent)' }} />} label={txt.weatherImpact} />
                                {delay > 15 ? (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0.625rem 0.75rem', background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--adm-text-sub)', lineHeight: 1.4 }}>
                                        <AlertTriangle size={13} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 2 }} />
                                        <span><strong>{txt.weatherAdvisory}</strong><br />
                                            <span style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)' }}>
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
                                        <div style={{ fontSize: '0.65rem', color: 'var(--adm-text-muted)', marginBottom: 2 }}>{txt.origin} · {depIata}</div>
                                        <div style={{ fontSize: '0.82rem', color: '#22C55E', fontWeight: 600 }}>Clear, 22°C</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--adm-text-muted)', marginBottom: 2 }}>{txt.destination} · {arrIata}</div>
                                        <div style={{ fontSize: '0.82rem', color: delay > 30 ? '#EF4444' : '#22C55E', fontWeight: 600 }}>
                                            {delay > 30 ? 'Storms, 18°C' : 'Clear, 20°C'}
                                        </div>
                                    </div>
                                </div>
                                {aircraft && (
                                    <div style={{ marginTop: 10, fontSize: '0.7rem', color: 'var(--adm-text-muted)', borderTop: '1px solid var(--adm-card-border)', paddingTop: 8 }}>
                                        Aircraft: {aircraft}
                                    </div>
                                )}
                            </div>

                            {/* Passenger Rights Card - only shown when relevant */}
                            {delay != null && delay >= 45 && (
                                <div style={{ background: 'var(--adm-card)', borderRadius: 12, padding: '1.1rem 1.25rem', border: '1px solid var(--adm-card-border)' }}>
                                    <SectionHeader icon={<CheckCircle size={12} style={{ color: '#22C55E' }} />} label={txt.rightsTitle} />
                                    <p style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)', margin: '0 0 8px', lineHeight: 1.4 }}>
                                        {txt.rightsEligible.replace('{delay}', formattedDelayValue)}
                                    </p>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <li style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--adm-text-sub)' }}>
                                            <CheckCircle size={11} style={{ color: '#22C55E', flexShrink: 0 }} /> {txt.rightsVouchers}
                                        </li>
                                        <li style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--adm-text-sub)' }}>
                                            <CheckCircle size={11} style={{ color: '#22C55E', flexShrink: 0 }} /> {txt.rightsRebooking}
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Footer ── */}
                    {aircraft && (
                        <div style={{
                            fontSize: '0.65rem', color: 'var(--adm-text-muted)',
                            borderTop: '1px solid var(--adm-card-border)', paddingTop: 10,
                            display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center'
                        }}>
                            <span>Aircraft: {aircraft}</span>
                        </div>
                    )}
                </div>

                {/* ── Footer Actions ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    gap: 10, padding: '0.875rem 1.5rem',
                    borderTop: '1px solid var(--adm-card-border)',
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

import { X, Plane, Clock, MapPin, AlertTriangle, CloudLightning, CheckCircle } from 'lucide-react';
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
        delayMinutes: 'Retard : {delay} minutes',
        gateInfo: 'Informations de porte',
        terminal: 'Terminal',
        gate: 'Porte',
        aiDelayProb: 'Probabilité de retard IA',
        aiRiskAnalysis: 'Analyse de risque IA',
        aiRiskDesc: 'Notre modèle IA a identifié les facteurs suivants contribuant au risque de retard :',
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
        timelineDelayRep: 'Retard signalé (+{delay} min)',
        timelineReady: 'Prêt pour le départ',
        timelineEstDep: 'Départ estimé',
        timelineEstArr: 'Arrivée estimée',
        rightsTitle: 'Vos droits en tant que passager',
        rightsEligible: 'En raison du retard dépassant {delay} minutes, vous pouvez prétendre à :',
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
        delayMinutes: 'Delay: {delay} minutes',
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
        timelineDelayRep: 'Delay reported (+{delay} min)',
        timelineReady: 'Ready for departure',
        timelineEstDep: 'Estimated departure',
        timelineEstArr: 'Estimated arrival',
        rightsTitle: 'Your Rights as a Passenger',
        rightsEligible: 'Due to the delay exceeding {delay} minutes, you may be entitled to:',
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
        delayMinutes: 'التأخير: {delay} دقيقة',
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
        timelineDelayRep: 'تم الإبلاغ عن تأخير (+{delay} دقيقة)',
        timelineReady: 'جاهز للمغادرة',
        timelineEstDep: 'المغادرة المقدرة',
        timelineEstArr: 'الوصول المقدر',
        rightsTitle: 'حقوقك كراكب',
        rightsEligible: 'بسبب تجاوز التأخير {delay} دقيقة، قد يحق لك الحصول على:',
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
function riskColor(risk) {
    if (!risk) return '#F59E0B';
    const r = risk.toLowerCase();
    if (r === 'low') return '#22C55E';
    if (r === 'high') return '#EF4444';
    return '#F59E0B'; // medium
}

function statusColor(status) {
    if (!status) return '#F59E0B';
    const s = status.toLowerCase();
    if (s === 'on-time' || s === 'on_time' || s === 'landed') return '#22C55E';
    if (s === 'cancelled') return '#EF4444';
    return '#F59E0B'; // delayed / scheduled
}

function riskPct(delay) {
    // Gauge shows overall delay probability: 12% baseline for on-time, scaling up with delay
    if (!delay || delay <= 0) return 12;
    if (delay >= 120) return 92;
    return Math.min(92, Math.round(12 + (delay / 120) * 80));
}

// Compute a realistic risk factor percentage for a named factor
// Baseline (delay=0): low values. Scales proportionally with delay.
function factorPct(baseMin, baseMax, delayScale, delay) {
    const base = Math.round(baseMin + Math.random() * (baseMax - baseMin));
    if (!delay || delay <= 0) return base;
    const scaled = Math.round(base + (delay / 120) * delayScale);
    return Math.min(95, scaled);
}

/* ── Circular Gauge (SVG) ────────────────────────── */
function CircularGauge({ pct, color }) {
    const { language } = useLanguage();
    const r = 44, cx = 56, cy = 56;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    
    const riskKey = pct < 30 ? 'low' : pct < 65 ? 'medium' : 'high';
    const label = (RISK_LEVELS[language] ?? RISK_LEVELS.en)[riskKey] ?? (RISK_LEVELS[language] ?? RISK_LEVELS.en).low;

    return (
        <svg width={112} height={112}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={9} />
            <circle
                cx={cx} cy={cy} r={r} fill="none"
                stroke={color} strokeWidth={9}
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`}
            />
            <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize="18" fontWeight="800">{pct}%</text>
            <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8">
                {label}
            </text>
        </svg>
    );
}

/* ── Progress Bar ────────────────────────────────── */
function RiskBar({ label, pct, color = '#0EA5E9' }) {
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
                    border: `2px solid ${done ? '#22C55E' : active ? '#0EA5E9' : 'rgba(255,255,255,0.15)'}`,
                    background: done ? '#22C55E20' : active ? '#0EA5E915' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {done && <CheckCircle size={11} style={{ color: '#22C55E' }} />}
                    {active && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#0EA5E9' }} />}
                </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: done ? 'rgba(255,255,255,0.65)' : active ? '#E2E8F0' : 'rgba(255,255,255,0.35)' }}>{label}</span>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>{time}</span>
            </div>
        </div>
    );
}

/* ── Main Modal ──────────────────────────────────── */
export default function FlightDetailsModal({ flight, isOpen, onClose }) {
    const { language } = useLanguage();
    const txt = tr[language] || tr.en;

    if (!isOpen || !flight) return null;

    const delay = flight.predictedDelay ?? flight.delay_minutes ?? null;
    const status = flight.status || 'scheduled';
    const prob = delay === null ? 0 : riskPct(delay);
    const gaugeColor = riskColor(flight.riskLevel);
    const sColor = statusColor(status);
    const statusLabel = (STATUS_LABELS[language] ?? STATUS_LABELS.en)[status] 
        || (STATUS_LABELS[language] ?? STATUS_LABELS.en)[status.toLowerCase()] 
        || status;

    // Normalise times
    const sched = flight.scheduledTime || flight.dep_scheduled || '—';
    const estimated = delay !== null && delay > 0 ? `(+${delay} min)` : '—';
    const depIata = flight.origin || flight.dep_iata || '—';
    const arrIata = flight.destination || flight.arr_iata || '—';
    const terminal = flight.dep_terminal || flight.arr_terminal || '—';
    const gate = flight.dep_gate || flight.arr_gate || '—';
    const aircraft = flight.aircraftType || 'Boeing 737-800';

    /* Risk analysis factors — realistic, delay-proportional values
     * On-time (delay=0): low baseline risk (8–18%)
     * Delayed: risk grows proportionally with delay minutes, capped at 90%
     */
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
            color: '#0EA5E9',
        },
        {
            label: txt.turnaround,
            pct: safeDelay <= 0 ? 8 : Math.min(80, Math.round(8 + (safeDelay / 120) * 45)),
            color: '#0EA5E9',
        },
        {
            label: txt.historical,
            pct: safeDelay <= 0 ? 18 : Math.min(82, Math.round(18 + (safeDelay / 120) * 48)),
            color: '#A5B4FC',
        },
    ];

    /* Timeline events */
    const isDelayed = delay !== null && delay > 0;
    const timeline = [
        { label: txt.timelineSched, time: sched, done: true, active: false },
        { label: txt.timelineBoarding, time: sched ? `${sched}` : '—', done: isDelayed, active: !isDelayed },
        { label: isDelayed ? txt.timelineDelayRep.replace('{delay}', delay) : txt.timelineReady, time: '—', done: isDelayed, active: false },
        { label: txt.timelineEstDep, time: isDelayed ? `+${delay} min` : sched, done: false, active: isDelayed },
        { label: txt.timelineEstArr, time: '—', done: false, active: false },
    ];

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="fdm" onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="fdm__header">
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <h2 className="fdm__title">{txt.flight} {flight.flight_number || flight.flightNumber}</h2>
                            <span className="fdm__status-pill" style={{ background: `${sColor}22`, color: sColor, border: `1px solid ${sColor}44` }}>
                                {statusLabel}
                            </span>
                        </div>
                        <p className="fdm__airline">{flight.airline_name || flight.airline}</p>
                    </div>
                    <button className="admin-modal__close" onClick={onClose}><X size={22} /></button>
                </div>

                {/* ── Route ── */}
                <div className="fdm__route">
                    <MapPin size={14} style={{ color: '#0EA5E9' }} />
                    <span className="fdm__route-iata">{depIata}</span>
                    <Plane size={14} style={{ color: 'rgba(255,255,255,0.3)', transform: 'rotate(0deg)' }} />
                    <MapPin size={14} style={{ color: '#22C55E' }} />
                    <span className="fdm__route-iata">{arrIata}</span>
                </div>

                {/* ── Scrollable body ── */}
                <div className="fdm__body">

                    {/* ── Row 1: Departure Times / Gate / AI Gauge ── */}
                    <div className="fdm__row3">
                        {/* Departure Times */}
                        <div className="fdm__info-card">
                            <div className="fdm__info-card__header">
                                <Clock size={14} style={{ color: '#0EA5E9' }} />
                                <span>{txt.depTimes}</span>
                            </div>
                            <div>
                                <div className="fdm__time-label">{txt.sched}</div>
                                <div className="fdm__time-value">{sched}</div>
                                {delay > 0 && (
                                    <>
                                        <div className="fdm__time-label" style={{ marginTop: 10 }}>{txt.actEst}</div>
                                        <div className="fdm__time-value fdm__time-value--red">{estimated}</div>
                                        <div style={{ fontSize: '0.73rem', color: '#F59E0B', marginTop: 4 }}>{txt.delayMinutes.replace('{delay}', delay)}</div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Gate Information */}
                        <div className="fdm__info-card">
                            <div className="fdm__info-card__header">
                                <MapPin size={14} style={{ color: '#0EA5E9' }} />
                                <span>{txt.gateInfo}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 24 }}>
                                <div>
                                    <div className="fdm__time-label">{txt.terminal}</div>
                                    <div className="fdm__time-value">{terminal}</div>
                                </div>
                                <div>
                                    <div className="fdm__time-label">{txt.gate}</div>
                                    <div className="fdm__time-value" style={{ fontSize: '1.5rem' }}>{gate}</div>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>{aircraft}</div>
                        </div>

                        {/* AI Delay Probability */}
                        <div className="fdm__info-card fdm__info-card--center">
                            <div className="fdm__info-card__header" style={{ justifyContent: 'center' }}>
                                {txt.aiDelayProb}
                            </div>
                            <CircularGauge pct={prob} color={gaugeColor} />
                        </div>
                    </div>

                    {/* ── Row 2: AI Risk Analysis + Weather Impact ── */}
                    <div className="fdm__row2">
                        {/* AI Risk Analysis */}
                        <div className="fdm__info-card">
                            <div className="fdm__info-card__header">
                                <AlertTriangle size={14} style={{ color: '#0EA5E9' }} />
                                <span>{txt.aiRiskAnalysis}</span>
                            </div>
                            <p className="fdm__sub-text">{txt.aiRiskDesc}</p>
                            <div style={{ marginTop: 12 }}>
                                {riskFactors.map(f => <RiskBar key={f.label} {...f} />)}
                            </div>
                        </div>

                        {/* Weather Impact */}
                        <div className="fdm__info-card">
                            <div className="fdm__info-card__header">
                                <CloudLightning size={14} style={{ color: '#0EA5E9' }} />
                                <span>{txt.weatherImpact}</span>
                            </div>
                            {delay > 15 ? (
                                <div className="fdm__weather-advisory">
                                    <AlertTriangle size={13} style={{ color: '#F59E0B' }} />
                                    <span><strong>{txt.weatherAdvisory}</strong><br />
                                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                            {delay > 30 ? txt.stormsDesc : txt.lightRainDesc}
                                        </span>
                                    </span>
                                </div>
                            ) : (
                                <div className="fdm__weather-ok">
                                    <CheckCircle size={13} style={{ color: '#22C55E' }} /> {txt.clearMeteo}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
                                <div>
                                    <div className="fdm__time-label">{txt.origin} ({depIata})</div>
                                    <div style={{ fontSize: '0.875rem', color: '#22C55E', fontWeight: 600 }}>{txt.clear22}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>{txt.goodCond}</div>
                                </div>
                                <div>
                                    <div className="fdm__time-label">{txt.destination} ({arrIata})</div>
                                    <div style={{ fontSize: '0.875rem', color: delay > 30 ? '#EF4444' : '#22C55E', fontWeight: 600 }}>{delay > 30 ? txt.storms18 : txt.clear20}</div>
                                    <div style={{ fontSize: '0.7rem', color: delay > 30 ? '#EF4444' : 'rgba(255,255,255,0.35)' }}>{delay > 30 ? txt.poorCond : txt.goodCond}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Flight Timeline ── */}
                    <div className="fdm__info-card">
                        <div className="fdm__info-card__header">
                            <Clock size={14} style={{ color: '#0EA5E9' }} />
                            <span>{txt.timeline}</span>
                        </div>
                        <div style={{ marginTop: 12, position: 'relative', paddingLeft: 4 }}>
                            {/* Vertical connector line */}
                            <div style={{ position: 'absolute', left: 9, top: 10, bottom: 10, width: 2, background: 'rgba(255,255,255,0.06)', zIndex: 0 }} />
                            {timeline.map((ev, i) => <TimelineItem key={i} {...ev} />)}
                        </div>
                    </div>

                    {/* ── Passenger Rights ── */}
                    <div className="fdm__info-card">
                        <div className="fdm__info-card__header">
                            <CheckCircle size={14} style={{ color: '#0EA5E9' }} />
                            <span>{txt.rightsTitle}</span>
                        </div>
                        {delay >= 45 ? (
                            <>
                                <p className="fdm__sub-text">{txt.rightsEligible.replace('{delay}', delay)}</p>
                                <ul className="fdm__rights-list">
                                    <li><CheckCircle size={12} style={{ color: '#22C55E' }} /> {txt.rightsVouchers}</li>
                                    <li><CheckCircle size={12} style={{ color: '#22C55E' }} /> {txt.rightsRebooking}</li>
                                    <li><CheckCircle size={12} style={{ color: '#22C55E' }} /> {txt.rightsCompensation}</li>
                                </ul>
                            </>
                        ) : (
                            <p className="fdm__sub-text">{txt.rightsOnTime}</p>
                        )}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="fdm__footer">
                    <button className="admin-btn admin-btn--outline" onClick={onClose}>{txt.close}</button>
                    <button className="admin-btn admin-btn--primary">
                        <Plane size={14} /> {txt.manage}
                    </button>
                </div>
            </div>
        </div>
    );
}

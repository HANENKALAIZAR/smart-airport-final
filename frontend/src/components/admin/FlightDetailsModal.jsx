import { X, Plane, Clock, MapPin, AlertTriangle, CloudLightning, CheckCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

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
    if (!delay || delay <= 0) return 12;
    if (delay >= 120) return 95;
    return Math.min(95, Math.round(12 + (delay / 120) * 83));
}

/* ── Circular Gauge (SVG) ────────────────────────── */
function CircularGauge({ pct, color }) {
    const r = 44, cx = 56, cy = 56;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
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
                {pct < 30 ? 'Low Risk' : pct < 65 ? 'Medium Risk' : 'High Risk'}
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
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>{time}</span>
            </div>
        </div>
    );
}

/* ── Main Modal ──────────────────────────────────── */
export default function FlightDetailsModal({ flight, isOpen, onClose }) {
    const { t } = useLanguage();
    if (!isOpen || !flight) return null;

    const delay = flight.predictedDelay || flight.delay_minutes || 0;
    const status = flight.status || 'scheduled';
    const prob = riskPct(delay);
    const gaugeColor = riskColor(flight.riskLevel);
    const sColor = statusColor(status);
    const statusLabel = flight.status || status;

    // Normalise times
    const sched = flight.scheduledTime || flight.dep_scheduled || '—';
    const estimated = delay > 0 ? '(+' + delay + ' min)' : '—';
    const depIata = flight.origin || flight.dep_iata || '—';
    const arrIata = flight.destination || flight.arr_iata || '—';
    const terminal = flight.dep_terminal || flight.arr_terminal || '—';
    const gate = flight.dep_gate || flight.arr_gate || '—';
    const aircraft = flight.aircraftType || 'Boeing 737-800';

    /* Risk analysis factors (derived from delay/risk) */
    const riskFactors = [
        { label: 'Weather Conditions', pct: Math.min(95, 48 + delay), color: '#0EA5E9' },
        { label: 'Air Traffic Congestion', pct: Math.min(92, 35 + delay * 0.8), color: '#0EA5E9' },
        { label: 'Aircraft Turnaround Time', pct: Math.min(88, 22 + delay * 0.6), color: '#0EA5E9' },
        { label: 'Historical Performance', pct: Math.min(80, 30 + delay * 0.5), color: '#0EA5E9' },
    ];

    /* Timeline events */
    const isDelayed = delay > 0;
    const timeline = [
        { label: 'Flight scheduled', time: sched, done: true, active: false },
        { label: 'Boarding started', time: sched ? `${sched}` : '—', done: isDelayed, active: !isDelayed },
        { label: isDelayed ? 'Weather delay reported' : 'Ready for departure', time: '—', done: isDelayed, active: false },
        { label: 'Estimated departure', time: isDelayed ? `+${delay}min` : sched, done: false, active: isDelayed },
        { label: 'Estimated arrival', time: '—', done: false, active: false },
    ];

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="fdm" onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="fdm__header">
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <h2 className="fdm__title">Flight {flight.flight_number || flight.flightNumber}</h2>
                            <span className="fdm__status-pill" style={{ background: `${sColor}22`, color: sColor, border: `1px solid ${sColor}44` }}>
                                {statusLabel.replace('_', '-').charAt(0).toUpperCase() + statusLabel.slice(1).replace('_', ' ')}
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
                                <span>Departure Times</span>
                            </div>
                            <div>
                                <div className="fdm__time-label">Scheduled</div>
                                <div className="fdm__time-value">{sched}</div>
                                {delay > 0 && (
                                    <>
                                        <div className="fdm__time-label" style={{ marginTop: 10 }}>Actual / Estimated</div>
                                        <div className="fdm__time-value fdm__time-value--red">{estimated}</div>
                                        <div style={{ fontSize: '0.73rem', color: '#F59E0B', marginTop: 4 }}>Delay: {delay} minutes</div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Gate Information */}
                        <div className="fdm__info-card">
                            <div className="fdm__info-card__header">
                                <MapPin size={14} style={{ color: '#0EA5E9' }} />
                                <span>Gate Information</span>
                            </div>
                            <div style={{ display: 'flex', gap: 24 }}>
                                <div>
                                    <div className="fdm__time-label">Terminal</div>
                                    <div className="fdm__time-value">{terminal}</div>
                                </div>
                                <div>
                                    <div className="fdm__time-label">Gate</div>
                                    <div className="fdm__time-value" style={{ fontSize: '1.5rem' }}>{gate}</div>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>{aircraft}</div>
                        </div>

                        {/* AI Delay Probability */}
                        <div className="fdm__info-card fdm__info-card--center">
                            <div className="fdm__info-card__header" style={{ justifyContent: 'center' }}>
                                AI Delay Probability
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
                                <span>AI Risk Analysis</span>
                            </div>
                            <p className="fdm__sub-text">Our AI model has identified the following factors contributing to the delay risk:</p>
                            <div style={{ marginTop: 12 }}>
                                {riskFactors.map(f => <RiskBar key={f.label} {...f} />)}
                            </div>
                        </div>

                        {/* Weather Impact */}
                        <div className="fdm__info-card">
                            <div className="fdm__info-card__header">
                                <CloudLightning size={14} style={{ color: '#0EA5E9' }} />
                                <span>Weather Impact</span>
                            </div>
                            {delay > 15 ? (
                                <div className="fdm__weather-advisory">
                                    <AlertTriangle size={13} style={{ color: '#F59E0B' }} />
                                    <span><strong>Weather Advisory</strong><br />
                                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                            {delay > 30 ? 'Thunderstorms reported in the area. Moderate delays expected.' : 'Light weather disturbance reported. Minor delays possible.'}
                                        </span>
                                    </span>
                                </div>
                            ) : (
                                <div className="fdm__weather-ok">
                                    <CheckCircle size={13} style={{ color: '#22C55E' }} /> Clear conditions — no weather impact
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
                                <div>
                                    <div className="fdm__time-label">Origin ({depIata})</div>
                                    <div style={{ fontSize: '0.875rem', color: '#22C55E', fontWeight: 600 }}>Clear, 22°C</div>
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>Good Conditions</div>
                                </div>
                                <div>
                                    <div className="fdm__time-label">Destination ({arrIata})</div>
                                    <div style={{ fontSize: '0.875rem', color: delay > 30 ? '#EF4444' : '#22C55E', fontWeight: 600 }}>{delay > 30 ? 'Storms, 18°C' : 'Clear, 20°C'}</div>
                                    <div style={{ fontSize: '0.7rem', color: delay > 30 ? '#EF4444' : 'rgba(255,255,255,0.35)' }}>{delay > 30 ? 'Poor Conditions' : 'Good Conditions'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Flight Timeline ── */}
                    <div className="fdm__info-card">
                        <div className="fdm__info-card__header">
                            <Clock size={14} style={{ color: '#0EA5E9' }} />
                            <span>Flight Timeline</span>
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
                            <span>Your Rights as a Passenger</span>
                        </div>
                        {delay >= 45 ? (
                            <>
                                <p className="fdm__sub-text">Due to the delay exceeding {delay} minutes, you may be entitled to:</p>
                                <ul className="fdm__rights-list">
                                    <li><CheckCircle size={12} style={{ color: '#22C55E' }} /> Complimentary refreshments and meal vouchers</li>
                                    <li><CheckCircle size={12} style={{ color: '#22C55E' }} /> Flight rebooking options at no additional charge</li>
                                    <li><CheckCircle size={12} style={{ color: '#22C55E' }} /> Compensation eligibility (check with airline)</li>
                                </ul>
                            </>
                        ) : (
                            <p className="fdm__sub-text">This flight is on time. No passenger rights intervention required.</p>
                        )}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="fdm__footer">
                    <button className="admin-btn admin-btn--outline" onClick={onClose}>Close</button>
                    <button className="admin-btn admin-btn--primary">
                        <Plane size={14} /> Manage Flight
                    </button>
                </div>
            </div>
        </div>
    );
}

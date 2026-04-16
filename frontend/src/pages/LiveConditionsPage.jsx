import { useState, useEffect } from 'react';
import { Cloud, Wind, Eye, Droplets, Thermometer, AlertTriangle, CheckCircle, Plane, RefreshCw } from 'lucide-react';
import { useAirport, TUNISIAN_AIRPORTS } from '../context/AirportContext';
import { useLanguage } from '../context/LanguageContext';

/* ── Destination airports shown in weather grid ──────────────── */
const DESTINATION_AIRPORTS = [
    { code: 'CDG', name: 'Charles de Gaulle', city: 'Paris', flag: '🇫🇷' },
    { code: 'ORY', name: 'Orly', city: 'Paris', flag: '🇫🇷' },
    { code: 'FCO', name: 'Fiumicino', city: 'Rome', flag: '🇮🇹' },
    { code: 'IST', name: 'Istanbul', city: 'Istanbul', flag: '🇹🇷' },
    { code: 'LHR', name: 'Heathrow', city: 'London', flag: '🇬🇧' },
    { code: 'FRA', name: 'Frankfurt', city: 'Frankfurt', flag: '🇩🇪' },
    { code: 'DXB', name: 'Dubai Intl', city: 'Dubai', flag: '🇦🇪' },
    { code: 'DOH', name: 'Hamad Intl', city: 'Doha', flag: '🇶🇦' },
    { code: 'CAI', name: 'Cairo Intl', city: 'Cairo', flag: '🇪🇬' },
    { code: 'CMN', name: 'Mohammed V', city: 'Casablanca', flag: '🇲🇦' },
];

/* ── Per-airport runway data ──────────────────────────────────── */
const RUNWAY_DATA = {
    TUN: [
        { id: 'RWY 01/19', status: 'Active', note: 'Main runway – 3100m × 45m' },
        { id: 'RWY 11/29', status: 'Active', note: 'Secondary – 2850m × 45m' },
    ],
    DJE: [
        { id: 'RWY 09/27', status: 'Active', note: 'Main runway – 3200m × 45m' },
    ],
    NBE: [
        { id: 'RWY 01/19', status: 'Active', note: 'Single runway – 3000m' },
    ],
    MIR: [
        { id: 'RWY 07/25', status: 'Active', note: 'Main runway – 2850m' },
    ],
};

function seededRandom(seed) {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function generateWeather(code, now) {
    const seed = code.charCodeAt(0) * 1000 + code.charCodeAt(1) * 100 + now.getHours() + now.getDate();
    const rand = seededRandom(seed);
    const conditions = ['☀️ Clear', '⛅ Partly Cloudy', '☁️ Overcast', '🌧️ Light Rain', '⛈️ Thunderstorm', '🌫️ Fog', '💨 Windy', '🌤️ Fair'];
    const condition = conditions[Math.floor(rand() * conditions.length)];
    const temp = Math.round(8 + rand() * 30);
    const wind = Math.round(5 + rand() * 40);
    const visibility = Math.round(2 + rand() * 13);
    const humidity = Math.round(30 + rand() * 60);
    const isBadWeather = ['⛈️ Thunderstorm', '🌫️ Fog', '💨 Windy'].some(w => condition.includes(w.split(' ')[1]));
    const delayRisk = isBadWeather ? (rand() > 0.3 ? 'High' : 'Medium') : wind > 30 ? 'Medium' : 'Low';
    return { condition, temp, wind, visibility, humidity, delayRisk };
}

export default function LiveConditionsPage() {
    const { selectedAirport } = useAirport();
    const { t } = useLanguage();
    const [now, setNow] = useState(new Date());
    const [loading, setLoading] = useState(false);

    function refresh() {
        setLoading(true);
        setTimeout(() => { setNow(new Date()); setLoading(false); }, 600);
    }

    const airportCode = selectedAirport.iata;
    const airportName = selectedAirport.name;
    const homeWeather = generateWeather(airportCode, now);
    const riskColor = { Low: '#22C55E', Medium: '#F59E0B', High: '#EF4444' };
    const RISK_LABELS = { Low: t('conditions_risk_low'), Medium: t('conditions_risk_medium'), High: t('conditions_risk_high') };
    const runways = RUNWAY_DATA[airportCode] || RUNWAY_DATA.TUN;

    const seed2 = airportCode.charCodeAt(0) * 500 + airportCode.charCodeAt(2) * 50 + now.getHours();
    const rand2 = seededRandom(seed2);
    const secWait = Math.round(5 + rand2() * 25);
    const checkin = Math.round(5 + rand2() * 20);
    const immig = Math.round(10 + rand2() * 25);
    const baggage = Math.round(10 + rand2() * 30);
    const ops = [
        { label: t('conditions_security_wait'), value: `~${secWait} min`, status: secWait > 20 ? t('conditions_moderate') : t('conditions_normal') },
        { label: t('conditions_checkin_queues'), value: `~${checkin} min`, status: checkin > 15 ? t('conditions_moderate') : t('conditions_normal') },
        { label: t('conditions_immigration'), value: `~${immig} min`, status: immig > 25 ? t('conditions_moderate') : t('conditions_normal') },
        { label: t('conditions_baggage_reclaim'), value: `~${baggage} min`, status: baggage > 25 ? t('conditions_moderate') : t('conditions_normal') },
    ];

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {/* Header */}
            <div className="card" style={{ padding: '24px', marginBottom: 16, background: 'linear-gradient(135deg, #EFF6FF, #E0F2FE)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>{t('conditions_title')}</h1>
                        <p style={{ color: '#1E40AF', fontSize: '0.85rem' }}>{t('conditions_subtitle')} {airportCode}</p>
                    </div>
                    <button onClick={refresh} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#fff', border: '1px solid #93C5FD', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, color: '#3B82F6' }}>
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('refresh')}
                    </button>
                </div>
            </div>

            {/* Main Weather */}
            <div className="card" style={{ padding: '24px', marginBottom: 16, borderLeft: `4px solid ${riskColor[homeWeather.delayRisk]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>🇹🇳 {airportName} ({airportCode})</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 4 }}>{homeWeather.condition}</div>
                        <div style={{ fontSize: '2rem', fontWeight: 300 }}>{homeWeather.temp}°C</div>
                    </div>
                    <div style={{ padding: '8px 14px', borderRadius: 12, background: riskColor[homeWeather.delayRisk] + '1A', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', color: '#64748B', marginBottom: 2 }}>{t('conditions_delay_risk')}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: riskColor[homeWeather.delayRisk] }}>{RISK_LABELS[homeWeather.delayRisk]}</div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    <div style={{ textAlign: 'center', padding: '10px 8px', background: '#F8FAFC', borderRadius: 8 }}>
                        <Wind size={16} style={{ color: '#3B82F6', margin: '0 auto 4px' }} />
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{homeWeather.wind} km/h</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{t('conditions_wind')}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '10px 8px', background: '#F8FAFC', borderRadius: 8 }}>
                        <Eye size={16} style={{ color: '#8B5CF6', margin: '0 auto 4px' }} />
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{homeWeather.visibility} km</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{t('conditions_visibility')}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '10px 8px', background: '#F8FAFC', borderRadius: 8 }}>
                        <Droplets size={16} style={{ color: '#06B6D4', margin: '0 auto 4px' }} />
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{homeWeather.humidity}%</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{t('conditions_humidity')}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '10px 8px', background: '#F8FAFC', borderRadius: 8 }}>
                        <Thermometer size={16} style={{ color: '#F59E0B', margin: '0 auto 4px' }} />
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{homeWeather.temp}°C</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{t('conditions_temperature')}</div>
                    </div>
                </div>
            </div>

            {/* Runway Status */}
            <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plane size={18} style={{ color: '#3B82F6' }} /> {t('conditions_runway_status')} — {airportCode}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {runways.map(r => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 8, background: '#F8FAFC' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.id}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.note}</div>
                            </div>
                            <span style={{ padding: '4px 10px', borderRadius: 8, background: '#DCFCE7', color: '#166534', fontWeight: 600, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle size={12} /> {r.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Airport Operations */}
            <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>{t('conditions_airport_ops')} — {airportCode}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {ops.map(s => (
                        <div key={s.label} style={{ padding: '12px 14px', borderRadius: 8, background: '#F8FAFC', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{s.value}</div>
                            <div style={{ fontSize: '0.65rem', color: s.status === t('conditions_normal') ? '#22C55E' : '#F59E0B', fontWeight: 600 }}>{s.status}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Destination Weather */}
            <div className="card" style={{ padding: '20px 24px', marginBottom: 24 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>{t('conditions_destinations_weather')}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {DESTINATION_AIRPORTS.map(a => {
                        const w = generateWeather(a.code, now);
                        return (
                            <div key={a.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: '#F8FAFC' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: '1rem' }}>{a.flag}</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{a.code} – {a.city}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{w.condition}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{w.temp}°C</span>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: riskColor[w.delayRisk] }} title={`${RISK_LABELS[w.delayRisk]} delay risk`} />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
                    {t('conditions_risk_legend')} | {t('conditions_updated_at')} {now.toLocaleTimeString()}
                </div>
            </div>
        </div>
    );
}

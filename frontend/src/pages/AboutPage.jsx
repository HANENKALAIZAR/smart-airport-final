import { Plane, Cpu, Users, Globe, BarChart3, Shield, Clock, MapPin } from 'lucide-react';
import { useAirport } from '../context/AirportContext';
import { useLanguage } from '../context/LanguageContext';

/* ── Per-airport data ────────────────────────────────────────── */
const AIRPORT_DATA = {
    TUN: {
        icao: 'DTTA',
        locationKey: 'about_tun_location',
        stats: [
            { icon: <Plane size={28} />, value: '6,400+', labelKey: 'about_flights_year', color: '#3B82F6' },
            { icon: <Users size={28} />, value: '5.2M', labelKey: 'about_passengers_year', color: '#8B5CF6' },
            { icon: <Globe size={28} />, value: '45+', labelKey: 'about_destinations', color: '#10B981' },
            { icon: <BarChart3 size={28} />, value: '20', labelKey: 'about_airlines_served', color: '#F59E0B' },
        ],
        about: `Tunis–Carthage International Airport is the main international airport of Tunisia, serving the capital city of Tunis and its metropolitan area. Originally built in 1940, it has undergone several expansions and modernizations to become the country's busiest aviation hub.`,
        about2: `The airport features two terminals handling both domestic and international flights to destinations across Europe, the Middle East, North Africa, and Sub-Saharan Africa. It serves as the primary hub for Tunisair and Nouvelair.`,
        airlines: [
            { code: 'TU', name: 'Tunisair', flag: '🇹🇳' }, { code: 'UG', name: 'Tunisair Express', flag: '🇹🇳' },
            { code: 'BJ', name: 'Nouvelair', flag: '🇹🇳' }, { code: 'AF', name: 'Air France', flag: '🇫🇷' },
            { code: 'TO', name: 'Transavia France', flag: '🇫🇷' }, { code: 'TK', name: 'Turkish Airlines', flag: '🇹🇷' },
            { code: 'LH', name: 'Lufthansa', flag: '🇩🇪' }, { code: 'EK', name: 'Emirates', flag: '🇦🇪' },
            { code: 'QR', name: 'Qatar Airways', flag: '🇶🇦' }, { code: 'SV', name: 'Saudia', flag: '🇸🇦' },
            { code: 'MS', name: 'EgyptAir', flag: '🇪🇬' }, { code: 'AT', name: 'Royal Air Maroc', flag: '🇲🇦' },
            { code: 'RJ', name: 'Royal Jordanian', flag: '🇯🇴' }, { code: 'AH', name: 'Air Algérie', flag: '🇩🇿' },
            { code: 'IZ', name: 'ITA Airways', flag: '🇮🇹' }, { code: 'NB', name: 'Berniq Airways', flag: '🇱🇾' },
            { code: 'UZ', name: 'BuraqAir', flag: '🇱🇾' }, { code: 'LW', name: 'Libyan Wings', flag: '🇱🇾' },
        ],
    },
    DJE: {
        icao: 'DTTJ', locationKey: 'about_dje_location',
        stats: [
            { icon: <Plane size={28} />, value: '2,800+', labelKey: 'about_flights_year', color: '#3B82F6' },
            { icon: <Users size={28} />, value: '2.1M', labelKey: 'about_passengers_year', color: '#8B5CF6' },
            { icon: <Globe size={28} />, value: '25+', labelKey: 'about_destinations', color: '#10B981' },
            { icon: <BarChart3 size={28} />, value: '12', labelKey: 'about_airlines_served', color: '#F59E0B' },
        ],
        about: `Djerba–Zarzis International Airport is Tunisia's second busiest airport, serving the popular tourist island of Djerba and the nearby town of Zarzis.`,
        about2: `The airport handles a high volume of seasonal charter traffic from European destinations, particularly France, Germany, and the UK.`,
        airlines: [
            { code: 'TU', name: 'Tunisair', flag: '🇹🇳' }, { code: 'BJ', name: 'Nouvelair', flag: '🇹🇳' },
            { code: 'TO', name: 'Transavia', flag: '🇫🇷' }, { code: 'TK', name: 'Turkish Airlines', flag: '🇹🇷' },
            { code: 'LH', name: 'Lufthansa', flag: '🇩🇪' }, { code: 'NB', name: 'Berniq Airways', flag: '🇱🇾' },
        ],
    },
    NBE: {
        icao: 'DTNH', locationKey: 'about_nbe_location',
        stats: [
            { icon: <Plane size={28} />, value: '1,500+', labelKey: 'about_flights_year', color: '#3B82F6' },
            { icon: <Users size={28} />, value: '1.8M', labelKey: 'about_passengers_year', color: '#8B5CF6' },
            { icon: <Globe size={28} />, value: '20+', labelKey: 'about_destinations', color: '#10B981' },
            { icon: <BarChart3 size={28} />, value: '10', labelKey: 'about_airlines_served', color: '#F59E0B' },
        ],
        about: `Enfidha–Hammamet International Airport is Tunisia's newest international airport, opened in 2009. It serves the popular resort towns of Hammamet and Sousse.`,
        about2: `Designed to relieve congestion at Tunis and Monastir airports, Enfidha features modern facilities and a single large terminal with capacity for 5 million passengers per year.`,
        airlines: [
            { code: 'TU', name: 'Tunisair', flag: '🇹🇳' }, { code: 'BJ', name: 'Nouvelair', flag: '🇹🇳' },
            { code: 'TO', name: 'Transavia', flag: '🇫🇷' }, { code: 'FR', name: 'Ryanair', flag: '🇮🇪' },
            { code: 'TK', name: 'Turkish Airlines', flag: '🇹🇷' },
        ],
    },
    MIR: {
        icao: 'DTMB', locationKey: 'about_mir_location',
        stats: [
            { icon: <Plane size={28} />, value: '1,200+', labelKey: 'about_flights_year', color: '#3B82F6' },
            { icon: <Users size={28} />, value: '1.0M', labelKey: 'about_passengers_year', color: '#8B5CF6' },
            { icon: <Globe size={28} />, value: '15+', labelKey: 'about_destinations', color: '#10B981' },
            { icon: <BarChart3 size={28} />, value: '8', labelKey: 'about_airlines_served', color: '#F59E0B' },
        ],
        about: `Monastir Habib Bourguiba International Airport is one of Tunisia's oldest international airports, named after Tunisia's first president.`,
        about2: `Once Tunisia's busiest charter airport, it now shares traffic with nearby Enfidha. It remains important for domestic flights and Hajj/Umrah charter services.`,
        airlines: [
            { code: 'TU', name: 'Tunisair', flag: '🇹🇳' }, { code: 'UG', name: 'Tunisair Express', flag: '🇹🇳' },
            { code: 'BJ', name: 'Nouvelair', flag: '🇹🇳' }, { code: 'SV', name: 'Saudia', flag: '🇸🇦' },
        ],
    },
};


export default function AboutPage() {
    const { selectedAirport } = useAirport();
    const { t } = useLanguage();
    const airportCode = selectedAirport.iata;
    const data = AIRPORT_DATA[airportCode] || AIRPORT_DATA.TUN;

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {/* Hero */}
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px', background: 'linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)', marginBottom: 24 }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🛫</div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 8 }}>{selectedAirport.name}</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    IATA: <strong>{airportCode}</strong> · ICAO: <strong>{data.icao}</strong>
                </p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                {data.stats.map(s => (
                    <div key={s.labelKey} className="card" style={{ textAlign: 'center', padding: '20px 12px' }}>
                        <div style={{ color: s.color, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{s.value}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t(s.labelKey)}</div>
                    </div>
                ))}
            </div>

            {/* About */}
            <div className="card" style={{ padding: '24px', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={20} style={{ color: '#3B82F6' }} /> {t('about_section_about')}
                </h2>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 12 }}>{data.about}</p>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}>{data.about2}</p>
            </div>

            {/* Airlines */}
            <div className="card" style={{ padding: '24px', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plane size={20} style={{ color: '#8B5CF6' }} /> {t('about_section_airlines')} {airportCode}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    {data.airlines.map((a, i) => (
                        <div key={`${a.code}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                            <span style={{ fontSize: '1.3rem' }}>{a.flag}</span>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.code}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* AI Prediction System */}
            <div className="card" style={{ padding: '24px', marginBottom: 16, border: '1px solid #DBEAFE' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Cpu size={20} style={{ color: '#6366F1' }} /> {t('about_section_ai')}
                </h2>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 16 }}
                    dangerouslySetInnerHTML={{ __html: t('about_ai_intro') }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {[
                        { icon: '🌤️', labelKey: 'about_ai_weather', descKey: 'about_ai_weather_desc' },
                        { icon: '📊', labelKey: 'about_ai_congestion', descKey: 'about_ai_congestion_desc' },
                        { icon: '✈️', labelKey: 'about_ai_airline', descKey: 'about_ai_airline_desc' },
                        { icon: '🕐', labelKey: 'about_ai_time', descKey: 'about_ai_time_desc' },
                    ].map(f => (
                        <div key={f.labelKey} style={{ padding: '12px', borderRadius: 8, background: '#F5F3FF' }}>
                            <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{f.icon}</div>
                            <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 2 }}>{t(f.labelKey)}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t(f.descKey)}</div>
                        </div>
                    ))}
                </div>
                <div style={{ background: '#EFF6FF', padding: '12px 16px', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <Shield size={18} style={{ color: '#3B82F6', flexShrink: 0, marginTop: 2 }} />
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1E40AF', marginBottom: 4 }}>{t('about_explainable_ai')}</div>
                        <div style={{ fontSize: '0.8rem', color: '#1E3A5F', lineHeight: 1.6 }}>
                            {t('about_explainable_ai_desc')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mission */}
            <div className="card" style={{ padding: '24px', marginBottom: 24, background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={20} style={{ color: '#10B981' }} /> {t('about_section_mission')}
                </h2>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--text-secondary)' }}
                    dangerouslySetInnerHTML={{ __html: t('about_mission_text') }} />
            </div>
        </div>
    );
}

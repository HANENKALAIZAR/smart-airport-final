import { useState } from 'react';
import { Search, MapPin, Clock } from 'lucide-react';
import { useAirport } from '../context/AirportContext';
import { useLanguage } from '../context/LanguageContext';

const CATEGORY_KEYS = {
    'All': 'services_cat_all',
    'Food & Drink': 'services_cat_food',
    'Shopping': 'services_cat_shopping',
    'Lounges': 'services_cat_lounges',
    'Essential': 'services_cat_essential',
    'Transport': 'services_cat_transport',
    'Business': 'services_cat_business',
};
const CATEGORIES = Object.keys(CATEGORY_KEYS);

/* ── Per-airport service data ─────────────────────────────────── */
const AIRPORT_SERVICES = {
    TUN: [
        { name: 'Café de Carthage', category: 'Food & Drink', icon: '☕', location: 'Terminal 1 – Departure Hall', hours: '05:00 – 22:00', description: 'Tunisian coffee, pastries, and light meals. Free Wi-Fi available.' },
        { name: 'Le Méditerranée Restaurant', category: 'Food & Drink', icon: '🍽️', location: 'Terminal 1 – Airside', hours: '06:00 – 23:00', description: 'Full-service restaurant with Tunisian and Mediterranean cuisine.' },
        { name: 'Burger Express', category: 'Food & Drink', icon: '🍔', location: 'Terminal 2 – Gate Area', hours: '06:00 – 22:00', description: 'Fast food burgers, fries, and drinks.' },
        { name: 'Duty Free TUN', category: 'Shopping', icon: '🛍️', location: 'Terminal 1 – Airside, after Security', hours: '05:00 – 23:00', description: 'Tax-free perfumes, cosmetics, alcohol, tobacco, and Tunisian souvenirs.' },
        { name: 'Artisanat de Tunisie', category: 'Shopping', icon: '🏺', location: 'Terminal 1 – Arrivals Hall', hours: '08:00 – 20:00', description: 'Handmade Tunisian crafts, ceramics, and olive wood products.' },
        { name: 'Primeclass Lounge', category: 'Lounges', icon: '✈️', location: 'Terminal 1 – Airside Level 1', hours: '24/7', description: 'Premium lounge with hot meals, drinks, showers, Wi-Fi. Priority Pass accepted.' },
        { name: 'Carthage VIP Lounge', category: 'Lounges', icon: '👑', location: 'Terminal 1 – CIP Area', hours: '24/7', description: 'Exclusive lounge for VIP and business passengers. Walk-in from €35.' },
        { name: 'Currency Exchange', category: 'Essential', icon: '💱', location: 'Terminal 1 – Arrivals & Departures', hours: '06:00 – 22:00', description: 'Bureau de change. Major currencies: EUR, USD, GBP, TRY.' },
        { name: 'ATMs', category: 'Essential', icon: '🏧', location: 'Both Terminals', hours: '24/7', description: 'Visa, Mastercard accepted. Multiple ATMs in arrivals and departures.' },
        { name: 'Pharmacy', category: 'Essential', icon: '💊', location: 'Terminal 1 – Departure Hall', hours: '07:00 – 21:00', description: 'Over-the-counter medication and health essentials.' },
        { name: 'Airport Bus 635', category: 'Transport', icon: '🚌', location: 'Exit – Ground Level', hours: '06:00 – 21:00', description: 'Direct bus to Avenue Habib Bourguiba downtown. ~1 TND, every 30 min.' },
        { name: 'Official Taxi Stand', category: 'Transport', icon: '🚕', location: 'Exit – Arrivals Hall', hours: '24/7', description: 'Official yellow taxis with meters. ~15 TND to Tunis city center.' },
        { name: 'Car Rental Agencies', category: 'Transport', icon: '🚗', location: 'Terminal 1 – Arrivals Hall', hours: '06:00 – 23:00', description: 'Europcar, Hertz, Avis, and local agencies available.' },
        { name: 'Business Center', category: 'Business', icon: '💼', location: 'Terminal 1 – Level 1', hours: '07:00 – 20:00', description: 'Meeting rooms, printing, fax, and high-speed Wi-Fi.' },
    ],
    DJE: [
        { name: 'Café Djerba', category: 'Food & Drink', icon: '☕', location: 'Terminal – Departure Hall', hours: '05:30 – 22:00', description: 'Coffee, freshly squeezed juices, and Tunisian pastries.' },
        { name: 'Le Palmier Restaurant', category: 'Food & Drink', icon: '🍽️', location: 'Terminal – Airside', hours: '06:00 – 22:00', description: 'Mediterranean cuisine with local Djerbian specialties.' },
        { name: 'Duty Free DJE', category: 'Shopping', icon: '🛍️', location: 'Terminal – After Security', hours: '06:00 – 22:00', description: 'Perfumes, alcohol, souvenirs, and local olive oil.' },
        { name: 'Currency Exchange', category: 'Essential', icon: '💱', location: 'Terminal – Arrivals Hall', hours: '07:00 – 21:00', description: 'EUR, USD, GBP exchange. Best rates for tourist currencies.' },
        { name: 'Official Taxi', category: 'Transport', icon: '🚕', location: 'Exit', hours: '24/7', description: 'Taxis to Houmt Souk (~15 TND), Zone Touristique (~20 TND).' },
        { name: 'Car Rental', category: 'Transport', icon: '🚗', location: 'Terminal – Arrivals', hours: '06:00 – 22:00', description: 'Europcar, Avis, and local agencies.' },
    ],
    NBE: [
        { name: 'Café Hammamet', category: 'Food & Drink', icon: '☕', location: 'Terminal – Central Hall', hours: '05:00 – 23:00', description: 'Coffee, pastries, and sandwiches in the modern terminal.' },
        { name: 'Duty Free NBE', category: 'Shopping', icon: '🛍️', location: 'Terminal – After Security', hours: '06:00 – 23:00', description: 'Large duty-free area with international and Tunisian products.' },
        { name: 'SkyLounge', category: 'Lounges', icon: '✈️', location: 'Terminal – Level 2', hours: '24/7', description: 'Modern lounge with refreshments and Wi-Fi. Priority Pass.' },
        { name: 'Car Rental', category: 'Transport', icon: '🚗', location: 'Terminal – Arrivals', hours: '24/7', description: 'All major car rental companies available.' },
        { name: 'Shuttle Bus', category: 'Transport', icon: '🚌', location: 'Exit – Bus Stop', hours: '06:00 – 22:00', description: 'Direct shuttle to Hammamet and Sousse resorts.' },
    ],
    MIR: [
        { name: 'Café Monastir', category: 'Food & Drink', icon: '☕', location: 'Terminal', hours: '06:00 – 21:00', description: 'Coffee and light refreshments.' },
        { name: 'Duty Free MIR', category: 'Shopping', icon: '🛍️', location: 'Terminal – After Security', hours: '06:00 – 21:00', description: 'Duty-free shopping with Tunisian specialties.' },
        { name: 'Taxi Stand', category: 'Transport', icon: '🚕', location: 'Exit', hours: '24/7', description: 'Taxis to Monastir center (~8 TND), Sousse (~25 TND).' },
    ],
};


export default function ServicesPage() {
    const { selectedAirport } = useAirport();
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');

    const airportCode = selectedAirport.iata;
    const services = AIRPORT_SERVICES[airportCode] || AIRPORT_SERVICES.TUN;

    const filtered = services.filter(s => {
        if (category !== 'All' && s.category !== category) return false;
        if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.description.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {/* Header */}
            <div className="card" style={{ padding: '24px', marginBottom: 16, background: 'linear-gradient(135deg, #FFF7ED, #FEF3C7)' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>{t('services_title')}</h1>
                <p style={{ color: '#92400E', fontSize: '0.85rem' }}>{t('services_subtitle')} {selectedAirport.name}</p>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input type="text" placeholder={t('services_search_placeholder')} value={search} onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: 12, border: '1px solid #E2E8F0', fontSize: '0.9rem', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
            </div>

            {/* Category Tabs */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, marginBottom: 8 }}>
                {CATEGORIES.map(c => (
                    <button key={c} onClick={() => setCategory(c)} style={{
                        padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                        fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s',
                        background: category === c ? '#1E293B' : '#F1F5F9',
                        color: category === c ? '#fff' : '#64748B',
                    }}>{t(CATEGORY_KEYS[c])}</button>
                ))}
            </div>

            {/* Service Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map(s => (
                    <div key={s.name} className="card" style={{ padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '1.8rem', flexShrink: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', borderRadius: 10 }}>{s.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{s.name}</h3>
                                <span style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: 8, background: '#F1F5F9', color: '#64748B', fontWeight: 500 }}>{t(CATEGORY_KEYS[s.category])}</span>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>{s.description}</p>
                            <div style={{ display: 'flex', gap: 16, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {s.location}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {s.hours}</span>
                            </div>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
                        <p>{t('services_no_results')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

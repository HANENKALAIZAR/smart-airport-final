import { useState } from 'react';
import { Phone, Mail, MapPin, Send, AlertTriangle, Plane } from 'lucide-react';
import { useAirport } from '../context/AirportContext';
import { useLanguage } from '../context/LanguageContext';

/* ── Per-airport contact data ──────────────────────────────── */
const AIRPORT_CONTACTS = {
    TUN: {
        phone: '+216 71 755 000',
        email: 'info@tun.airport.tn',
        address: ['Tunis–Carthage International Airport', 'Route de l\'aéroport, 2035 Tunis Carthage', 'Tunis, Tunisia'],
        emergency: [
            { name: 'Airport Emergency', number: '+216 71 755 000', icon: '🚨', available: '24/7' },
            { name: 'Medical Emergency', number: '190', icon: '🏥', available: '24/7' },
            { name: 'Police', number: '193', icon: '👮', available: '24/7' },
            { name: 'Fire Department', number: '198', icon: '🚒', available: '24/7' },
            { name: 'Civil Protection', number: '+216 71 780 000', icon: '🛡️', available: '24/7' },
        ],
        airlines: [
            { airline: 'Tunisair', phone: '+216 71 330 100', desk: 'Terminal 1 – Check-in Hall', flag: '🇹🇳' },
            { airline: 'Nouvelair', phone: '+216 70 018 200', desk: 'Terminal 1 – Counter 12–15', flag: '🇹🇳' },
            { airline: 'Air France', phone: '+216 71 251 515', desk: 'Terminal 1 – Counter 20–22', flag: '🇫🇷' },
            { airline: 'Turkish Airlines', phone: '+216 71 351 700', desk: 'Terminal 1 – Counter 25–27', flag: '🇹🇷' },
            { airline: 'Lufthansa', phone: '+216 71 941 250', desk: 'Terminal 2 – Counter 5–6', flag: '🇩🇪' },
            { airline: 'Emirates', phone: '+216 71 167 700', desk: 'Terminal 2 – Counter 10–12', flag: '🇦🇪' },
        ],
        lostFound: { location: 'Terminal 1 – Arrivals Hall (near exit)', hours: '06:00 – 22:00', phone: '+216 71 755 200', email: 'lostandfound@tun.airport.tn' },
    },
    DJE: {
        phone: '+216 75 650 233',
        email: 'info@djerba.airport.tn',
        address: ['Djerba–Zarzis International Airport', 'Route de l\'aéroport, 4116 Mellita', 'Djerba, Tunisia'],
        emergency: [
            { name: 'Airport Emergency', number: '+216 75 650 233', icon: '🚨', available: '24/7' },
            { name: 'Medical Emergency', number: '190', icon: '🏥', available: '24/7' },
            { name: 'Police', number: '193', icon: '👮', available: '24/7' },
            { name: 'Fire Department', number: '198', icon: '🚒', available: '24/7' },
        ],
        airlines: [
            { airline: 'Tunisair', phone: '+216 75 650 100', desk: 'Terminal – Check-in Hall', flag: '🇹🇳' },
            { airline: 'Nouvelair', phone: '+216 75 650 150', desk: 'Terminal – Counter 5–7', flag: '🇹🇳' },
            { airline: 'Transavia', phone: '+216 75 650 200', desk: 'Terminal – Counter 10–11', flag: '🇫🇷' },
        ],
        lostFound: { location: 'Terminal – Arrivals Hall', hours: '06:00 – 22:00', phone: '+216 75 650 250', email: 'lostandfound@djerba.airport.tn' },
    },
    NBE: {
        phone: '+216 73 521 000',
        email: 'info@enfidha.airport.tn',
        address: ['Enfidha–Hammamet International Airport', 'Route Enfidha, 4030 Enfidha', 'Sousse, Tunisia'],
        emergency: [
            { name: 'Airport Emergency', number: '+216 73 521 000', icon: '🚨', available: '24/7' },
            { name: 'Medical Emergency', number: '190', icon: '🏥', available: '24/7' },
            { name: 'Police', number: '193', icon: '👮', available: '24/7' },
            { name: 'Fire Department', number: '198', icon: '🚒', available: '24/7' },
        ],
        airlines: [
            { airline: 'Tunisair', phone: '+216 73 521 100', desk: 'Terminal – Check-in Hall', flag: '🇹🇳' },
            { airline: 'Nouvelair', phone: '+216 73 521 150', desk: 'Terminal – Counter 8–10', flag: '🇹🇳' },
        ],
        lostFound: { location: 'Terminal – Arrivals Hall', hours: '06:00 – 22:00', phone: '+216 73 521 200', email: 'lostandfound@enfidha.airport.tn' },
    },
    MIR: {
        phone: '+216 73 521 300',
        email: 'info@monastir.airport.tn',
        address: ['Monastir Habib Bourguiba International Airport', 'Route de l\'aéroport, 5000 Monastir', 'Monastir, Tunisia'],
        emergency: [
            { name: 'Airport Emergency', number: '+216 73 521 300', icon: '🚨', available: '24/7' },
            { name: 'Medical Emergency', number: '190', icon: '🏥', available: '24/7' },
            { name: 'Police', number: '193', icon: '👮', available: '24/7' },
            { name: 'Fire Department', number: '198', icon: '🚒', available: '24/7' },
        ],
        airlines: [
            { airline: 'Tunisair', phone: '+216 73 521 400', desk: 'Terminal', flag: '🇹🇳' },
            { airline: 'Nouvelair', phone: '+216 73 521 450', desk: 'Terminal', flag: '🇹🇳' },
        ],
        lostFound: { location: 'Terminal – Arrivals Hall', hours: '06:00 – 21:00', phone: '+216 73 521 500', email: 'lostandfound@monastir.airport.tn' },
    },
    SFA: {
        phone: '+216 74 278 000',
        email: 'info@sfax.airport.tn',
        address: ['Sfax–Thyna International Airport', 'Route de l\'aéroport, 3000 Sfax', 'Sfax, Tunisia'],
        emergency: [
            { name: 'Airport Emergency', number: '+216 74 278 000', icon: '🚨', available: '24/7' },
            { name: 'Medical Emergency', number: '190', icon: '🏥', available: '24/7' },
            { name: 'Police', number: '193', icon: '👮', available: '24/7' },
            { name: 'Fire Department', number: '198', icon: '🚒', available: '24/7' },
        ],
        airlines: [
            { airline: 'Tunisair', phone: '+216 74 278 100', desk: 'Terminal', flag: '🇹🇳' },
        ],
        lostFound: { location: 'Terminal', hours: '07:00 – 20:00', phone: '+216 74 278 200', email: 'lostandfound@sfax.airport.tn' },
    },
    TOE: {
        phone: '+216 76 452 000',
        email: 'info@tozeur.airport.tn',
        address: ['Tozeur–Nefta International Airport', 'Route de Nefta, 2200 Tozeur', 'Tozeur, Tunisia'],
        emergency: [
            { name: 'Airport Emergency', number: '+216 76 452 000', icon: '🚨', available: '24/7' },
            { name: 'Medical Emergency', number: '190', icon: '🏥', available: '24/7' },
            { name: 'Police', number: '193', icon: '👮', available: '24/7' },
            { name: 'Fire Department', number: '198', icon: '🚒', available: '24/7' },
        ],
        airlines: [
            { airline: 'Tunisair', phone: '+216 76 452 100', desk: 'Terminal', flag: '🇹🇳' },
        ],
        lostFound: { location: 'Terminal', hours: '07:00 – 19:00', phone: '+216 76 452 200', email: 'lostandfound@tozeur.airport.tn' },
    },
    TBJ: {
        phone: '+216 78 670 000',
        email: 'info@tabarka.airport.tn',
        address: ['Tabarka–Aïn Draham International Airport', 'Route de l\'aéroport, 8110 Tabarka', 'Jendouba, Tunisia'],
        emergency: [
            { name: 'Airport Emergency', number: '+216 78 670 000', icon: '🚨', available: '24/7' },
            { name: 'Medical Emergency', number: '190', icon: '🏥', available: '24/7' },
            { name: 'Police', number: '193', icon: '👮', available: '24/7' },
            { name: 'Fire Department', number: '198', icon: '🚒', available: '24/7' },
        ],
        airlines: [
            { airline: 'Tunisair', phone: '+216 78 670 100', desk: 'Terminal', flag: '🇹🇳' },
        ],
        lostFound: { location: 'Terminal', hours: '07:00 – 19:00', phone: '+216 78 670 200', email: 'lostandfound@tabarka.airport.tn' },
    },
    GAF: {
        phone: '+216 76 226 000',
        email: 'info@gafsa.airport.tn',
        address: ['Gafsa–Ksar International Airport', 'Route de l\'aéroport, 2100 Gafsa', 'Gafsa, Tunisia'],
        emergency: [
            { name: 'Airport Emergency', number: '+216 76 226 000', icon: '🚨', available: '24/7' },
            { name: 'Medical Emergency', number: '190', icon: '🏥', available: '24/7' },
            { name: 'Police', number: '193', icon: '👮', available: '24/7' },
            { name: 'Fire Department', number: '198', icon: '🚒', available: '24/7' },
        ],
        airlines: [
            { airline: 'Tunisair', phone: '+216 76 226 100', desk: 'Terminal', flag: '🇹🇳' },
        ],
        lostFound: { location: 'Terminal', hours: '07:00 – 19:00', phone: '+216 76 226 200', email: 'lostandfound@gafsa.airport.tn' },
    },
};

export default function ContactPage() {
    const { selectedAirport } = useAirport();
    const { t } = useLanguage();
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
    const [submitted, setSubmitted] = useState(false);

    const airportCode = selectedAirport.iata;
    const contact = AIRPORT_CONTACTS[airportCode] || AIRPORT_CONTACTS.TUN;

    function handleSubmit(e) {
        e.preventDefault();
        setSubmitted(true);
    }

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {/* Header */}
            <div className="card" style={{ padding: '24px', marginBottom: 16, background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6 }}>{t('contact_title')}</h1>
                <p style={{ color: '#166534', fontSize: '0.85rem' }}>{t('contact_subtitle')} {selectedAirport.name}</p>
            </div>

            {/* Emergency Contacts */}
            <div className="card" style={{ padding: '20px 24px', marginBottom: 16, border: '1px solid #FCA5A5' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#DC2626' }}>
                    <AlertTriangle size={18} /> {t('contact_emergency')}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                    {contact.emergency.map(c => (
                        <a key={c.name} href={`tel:${c.number.replace(/\s/g, '')}`} style={{ textDecoration: 'none', display: 'block', padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{c.icon}</div>
                            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1E293B' }}>{c.name}</div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#DC2626', marginTop: 2 }}>{c.number}</div>
                            <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: 2 }}>{c.available}</div>
                        </a>
                    ))}
                </div>
            </div>

            {/* Airline Desks */}
            <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plane size={18} style={{ color: '#3B82F6' }} /> {t('contact_airline_desks')} {airportCode}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {contact.airlines.map(a => (
                        <div key={a.airline} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 10, background: '#F8FAFC' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: '1.2rem' }}>{a.flag}</span>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.airline}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.desk}</div>
                                </div>
                            </div>
                            <a href={`tel:${a.phone.replace(/\s/g, '')}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#3B82F6', fontWeight: 600, textDecoration: 'none' }}>
                                <Phone size={14} /> {a.phone}
                            </a>
                        </div>
                    ))}
                </div>
            </div>

            {/* Lost & Found */}
            <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>{t('contact_lost_found')}</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
                    {t('contact_lost_found_text').replace('{airport}', selectedAirport.name)}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ padding: '12px 14px', borderRadius: 8, background: '#F8FAFC' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>{t('contact_location')}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{contact.lostFound.location}</div>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: 8, background: '#F8FAFC' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>{t('contact_hours')}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{contact.lostFound.hours}</div>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: 8, background: '#F8FAFC' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>{t('contact_phone')}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{contact.lostFound.phone}</div>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: 8, background: '#F8FAFC' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>{t('contact_email')}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{contact.lostFound.email}</div>
                    </div>
                </div>
            </div>

            {/* Airport Address */}
            <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={18} style={{ color: '#10B981' }} /> {t('contact_address')}
                </h2>
                <div style={{ fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    <strong>{contact.address[0]}</strong><br />
                    {contact.address[1]}<br />
                    {contact.address[2]}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                        <Phone size={14} /> {contact.phone}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                        <Mail size={14} /> {contact.email}
                    </div>
                </div>
            </div>

            {/* Contact Form */}
            <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Send size={18} style={{ color: '#8B5CF6' }} /> {t('contact_send_message')}
                </h2>
                {!submitted ? (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <input type="text" placeholder={t('contact_your_name')} value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required
                                style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.85rem', outline: 'none' }} />
                            <input type="email" placeholder={t('contact_email_address')} value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} required
                                style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.85rem', outline: 'none' }} />
                        </div>
                        <select value={formData.subject} onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))} required
                            style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.85rem', outline: 'none', background: '#fff' }}>
                            <option value="">{t('contact_select_subject')}</option>
                            <option value="lost">{t('contact_subject_lost')}</option>
                            <option value="complaint">{t('contact_subject_complaint')}</option>
                            <option value="feedback">{t('contact_subject_feedback')}</option>
                            <option value="accessibility">{t('contact_subject_accessibility')}</option>
                            <option value="other">{t('contact_subject_other')}</option>
                        </select>
                        <textarea placeholder={t('contact_your_message')} value={formData.message} onChange={e => setFormData(p => ({ ...p, message: e.target.value }))} required rows={4}
                            style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.85rem', outline: 'none', resize: 'vertical' }} />
                        <button type="submit" style={{ padding: '14px', borderRadius: 10, background: '#1E293B', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <Send size={16} /> {t('contact_send_btn')}
                        </button>
                    </form>
                ) : (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>✅</div>
                        <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 4 }}>{t('contact_success_title')}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('contact_success_text').replace('{airport}', selectedAirport.name)}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

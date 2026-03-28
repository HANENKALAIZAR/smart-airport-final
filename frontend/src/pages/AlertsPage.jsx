import { useState } from 'react';
import { Bell, Search, Plane, Clock, CheckCircle, AlertTriangle, Mail, BellRing, MessageCircle, Phone } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const MOCK_FLIGHT_STATUS = {
    'TU720': { flight: 'TU720', route: 'TUN → CDG', status: 'On Time', departure: '06:30', gate: 'A12', aircraft: 'A320' },
    'TU216': { flight: 'TU216', route: 'TUN → FCO', status: 'Delayed +1h35', departure: '09:35', gate: 'B5', aircraft: 'A320' },
    'AF1395': { flight: 'AF1395', route: 'CDG → TUN', status: 'On Time', departure: '10:15', gate: 'C8', aircraft: 'A321' },
    'TK693': { flight: 'TK693', route: 'IST → TUN', status: 'On Time', departure: '12:10', gate: 'A3', aircraft: 'B738' },
    'TU724': { flight: 'TU724', route: 'TUN → ORY', status: 'Delayed +45m', departure: '14:20', gate: 'B12', aircraft: 'A320' },
    'TU722': { flight: 'TU722', route: 'TUN → LHR', status: 'On Time', departure: '16:05', gate: 'A7', aircraft: 'A320' },
};

export default function AlertsPage() {
    const { t } = useLanguage();
    const [flightInput, setFlightInput] = useState('');
    const [looked, setLookedUp] = useState(null);
    const [subscribed, setSubscribed] = useState(false);
    const [channel, setChannel] = useState('email'); // 'email' | 'whatsapp'
    const [emailInput, setEmailInput] = useState('');
    const [emailError, setEmailError] = useState('');
    const [phoneInput, setPhoneInput] = useState('');
    const [phoneError, setPhoneError] = useState('');

    const TIMELINE_EVENTS = [
        { time: '-3h', icon: '📋', event: t('alerts_checkin_opens') },
        { time: '-45m', icon: '🚶', event: t('alerts_boarding_begins') },
        { time: '-15m', icon: '⚠️', event: t('alerts_final_boarding') },
        { time: '0', icon: '✈️', event: t('alerts_scheduled_departure') },
        { time: '+3h', icon: '🛬', event: t('alerts_estimated_arrival') },
    ];

    function handleLookup() {
        const key = flightInput.trim().toUpperCase().replace(/\s+/g, '');
        const found = MOCK_FLIGHT_STATUS[key];
        setLookedUp(found || 'not_found');
        setSubscribed(false);
        setEmailInput('');
        setEmailError('');
        setPhoneInput('');
        setPhoneError('');
    }

    function handleSubscribe() {
        if (channel === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailInput.trim() || !emailRegex.test(emailInput.trim())) {
                setEmailError('Please enter a valid email address.');
                return;
            }
            setEmailError('');
        } else {
            // WhatsApp: international format, e.g. +21698000000
            const phoneRegex = /^\+?[1-9]\d{7,14}$/;
            const cleaned = phoneInput.replace(/[\s\-().]/g, '');
            if (!cleaned || !phoneRegex.test(cleaned)) {
                setPhoneError('Enter a valid international phone number (e.g. +21698123456).');
                return;
            }
            setPhoneError('');
        }
        setSubscribed(true);
    }

    const isDelayed = looked && looked !== 'not_found' && looked.status.includes('Delayed');

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {/* Header */}
            <div className="card" style={{ padding: '24px', marginBottom: 16, background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Bell size={24} style={{ color: '#3B82F6' }} /> {t('alerts_title')}
                </h1>
                <p style={{ color: '#1E40AF', fontSize: '0.85rem' }}>{t('alerts_subtitle')}</p>
            </div>

            {/* Flight Lookup */}
            <div className="card" style={{ padding: '24px', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>{t('alerts_lookup_title')}</h2>
                <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                        <input
                            type="text"
                            placeholder={t('alerts_search_placeholder')}
                            value={flightInput}
                            onChange={e => setFlightInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleLookup()}
                            style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                    <button onClick={handleLookup} style={{ padding: '12px 24px', borderRadius: 10, background: '#1E293B', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                        {t('alerts_track_btn')}
                    </button>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8 }}>
                    {t('alerts_try')} TU720, TU216, AF1395, TK693, TU724, TU722
                </div>
            </div>

            {/* Result */}
            {looked === 'not_found' && (
                <div className="card" style={{ padding: '32px 20px', textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>😕</div>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>{t('alerts_not_found_title')}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('alerts_not_found_text')}</p>
                </div>
            )}

            {looked && looked !== 'not_found' && (
                <>
                    {/* Flight Status Card */}
                    <div className="card" style={{ padding: '20px 24px', marginBottom: 16, borderLeft: `4px solid ${isDelayed ? '#F59E0B' : '#22C55E'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Plane size={20} /> {looked.flight}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{looked.route}</div>
                            </div>
                            <div style={{
                                padding: '6px 14px', borderRadius: 20, fontWeight: 600, fontSize: '0.8rem',
                                background: isDelayed ? '#FEF3C7' : '#DCFCE7',
                                color: isDelayed ? '#B45309' : '#166534',
                            }}>
                                {isDelayed ? <AlertTriangle size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> : <CheckCircle size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                                {looked.status}
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                            {[
                                { label: t('alerts_departure'), value: looked.departure },
                                { label: t('alerts_gate'), value: looked.gate },
                                { label: t('alerts_aircraft'), value: looked.aircraft },
                            ].map(d => (
                                <div key={d.label} style={{ background: '#F8FAFC', padding: '10px', borderRadius: 8, textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>{d.label}</div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 16 }}>{t('alerts_timeline')}</h3>
                        <div style={{ position: 'relative', paddingLeft: 28 }}>
                            <div style={{ position: 'absolute', left: 9, top: 4, bottom: 4, width: 2, background: '#E2E8F0' }} />
                            {TIMELINE_EVENTS.map((e, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < TIMELINE_EVENTS.length - 1 ? 16 : 0, position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: -22, width: 20, height: 20, borderRadius: '50%', background: '#fff', border: '2px solid #3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>
                                        {e.icon}
                                    </div>
                                    <span style={{ fontWeight: 600, fontSize: '0.8rem', minWidth: 48, color: '#3B82F6' }}>{e.time}</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{e.event}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Subscribe */}
                    <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BellRing size={18} style={{ color: '#8B5CF6' }} /> Get Alerts for {looked.flight}
                        </h3>
                        {!subscribed ? (
                            <>
                                {/* Channel selector tabs */}
                                <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #E2E8F0', marginBottom: 16 }}>
                                    <button
                                        type="button"
                                        onClick={() => { setChannel('email'); setPhoneError(''); }}
                                        style={{
                                            flex: 1, padding: '10px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s',
                                            background: channel === 'email' ? '#1E293B' : '#F8FAFC',
                                            color: channel === 'email' ? '#fff' : '#64748B'
                                        }}
                                    >
                                        <Mail size={14} /> Email
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setChannel('whatsapp'); setEmailError(''); }}
                                        style={{
                                            flex: 1, padding: '10px', border: 'none', borderLeft: '1px solid #E2E8F0', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s',
                                            background: channel === 'whatsapp' ? '#25D366' : '#F8FAFC',
                                            color: channel === 'whatsapp' ? '#fff' : '#64748B'
                                        }}
                                    >
                                        <MessageCircle size={14} /> WhatsApp
                                    </button>
                                </div>

                                {/* WhatsApp badge */}
                                {channel === 'whatsapp' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', marginBottom: 12 }}>
                                        <CheckCircle size={14} style={{ color: '#22C55E', flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 500 }}>
                                            Powered by <strong>WhatsApp Business Cloud API</strong> (Official · Meta-verified)
                                        </span>
                                    </div>
                                )}

                                {/* Email input */}
                                {channel === 'email' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                                            We'll email you real-time updates for delays, gate changes, and boarding calls.
                                        </p>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, background: '#EFF6FF', border: `1px solid ${emailError ? '#EF4444' : '#93C5FD'}`, transition: 'border-color 0.15s' }}>
                                            <Mail size={15} style={{ color: '#3B82F6', flexShrink: 0 }} />
                                            <input
                                                type="email"
                                                placeholder="your@email.com"
                                                value={emailInput}
                                                onChange={e => { setEmailInput(e.target.value); setEmailError(''); }}
                                                onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
                                                style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '0.88rem', color: '#1E293B' }}
                                            />
                                        </label>
                                        {emailError && <p style={{ fontSize: '0.73rem', color: '#EF4444', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>⚠ {emailError}</p>}
                                    </div>
                                )}

                                {/* WhatsApp input */}
                                {channel === 'whatsapp' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                                            You'll receive instant WhatsApp messages for delays, gate changes, and boarding calls.
                                        </p>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, background: '#F0FDF4', border: `1px solid ${phoneError ? '#EF4444' : '#86EFAC'}`, transition: 'border-color 0.15s' }}>
                                            <Phone size={15} style={{ color: '#22C55E', flexShrink: 0 }} />
                                            <input
                                                type="tel"
                                                placeholder="+216 98 000 000"
                                                value={phoneInput}
                                                onChange={e => { setPhoneInput(e.target.value); setPhoneError(''); }}
                                                onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
                                                style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '0.88rem', color: '#1E293B' }}
                                            />
                                        </label>
                                        {phoneError && <p style={{ fontSize: '0.73rem', color: '#EF4444', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>⚠ {phoneError}</p>}
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Include country code · e.g. +216 for Tunisia</p>
                                    </div>
                                )}

                                <button
                                    onClick={handleSubscribe}
                                    style={{
                                        width: '100%', padding: '13px', borderRadius: 10,
                                        background: channel === 'whatsapp' ? '#25D366' : '#1E293B',
                                        color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity 0.15s'
                                    }}
                                >
                                    {channel === 'whatsapp'
                                        ? <><MessageCircle size={16} /> Subscribe via WhatsApp</>
                                        : <><Mail size={16} /> Subscribe via Email</>}
                                </button>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                <div style={{ width: 56, height: 56, borderRadius: '50%', background: channel === 'whatsapp' ? '#DCFCE7' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '1.6rem' }}>
                                    {channel === 'whatsapp' ? '✅' : '📧'}
                                </div>
                                <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>You're subscribed!</p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                    {channel === 'whatsapp'
                                        ? <>WhatsApp alerts for <strong>{looked.flight}</strong> will be sent to <strong>{phoneInput}</strong>.</>
                                        : <>Email alerts for <strong>{looked.flight}</strong> will be sent to <strong>{emailInput}</strong>.</>}
                                </p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                                    You'll be notified about delays, gate changes, and boarding calls in real time.
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

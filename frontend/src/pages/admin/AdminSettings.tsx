import { useState, useEffect, useMemo, useRef } from 'react';
import {
    Settings as SettingsIcon, User, Bell, ShieldCheck, Plug, Palette,
    Globe2, Database, KeyRound, Save, Lock, Eye, EyeOff, Check, AlertCircle,
    Loader,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAirport } from '../../context/AirportContext';
import { apiChangePassword, apiGetMe, apiPatchSettings } from '../../services/adminApi';

/* ── Types ── */
interface Profile {
    id?: number;
    email?: string;
    role?: string;
    airport_iata?: string | null;
    full_name?: string | null;
    phone_number?: string | null;
    employee_id?: string | null;
    department?: string | null;
}

/* ── Helpers ── */
function calcStrength(pw: string) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    const map = [
        { label: 'TOO WEAK', color: '#EF4444' },
        { label: 'WEAK', color: '#F97316' },
        { label: 'FAIR', color: '#F59E0B' },
        { label: 'STRONG', color: '#10B981' },
        { label: 'VERY STRONG', color: '#059669' },
    ];
    return { score: s, ...map[Math.min(s, 4)] };
}

/* ── Sub-components ── */
function SectionHeader({ title, sub }: { title: string; sub: string }) {
    return (
        <>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--adm-text)', marginBottom: '0.25rem', marginTop: 0 }}>{title}</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--adm-text-muted)', marginBottom: '1.5rem', marginTop: 0 }}>{sub}</p>
        </>
    );
}

function Field({ l, v, type = 'text', onChange, readOnly }: { l: string; v?: string; type?: string; onChange?: (val: string) => void; readOnly?: boolean }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--adm-text-muted)', marginBottom: 6 }}>{l}</label>
            <input
                type={type}
                defaultValue={v}
                readOnly={readOnly}
                onChange={onChange ? e => onChange(e.target.value) : undefined}
                style={{
                    width: '100%', padding: '0.6rem 0.85rem', borderRadius: 8,
                    border: '1px solid var(--adm-border)',
                    background: readOnly ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                    color: 'var(--adm-text)', fontSize: '0.88rem', outline: 'none',
                    boxSizing: 'border-box',
                    cursor: readOnly ? 'default' : 'text',
                    opacity: readOnly ? 0.7 : 1,
                }}
            />
        </div>
    );
}

function ToggleRow({ l, sub, on = true }: { l: string; sub: string; on?: boolean }) {
    const [v, setV] = useState(on);
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 0', borderBottom: '1px solid var(--adm-border)' }}>
            <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--adm-text)' }}>{l}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--adm-text-muted)' }}>{sub}</div>
            </div>
            <button onClick={() => setV(s => !s)} style={{
                width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: v ? 'linear-gradient(135deg,#F59E0B,#FBBF24)' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'all 180ms', flexShrink: 0,
            }}>
                <span style={{ position: 'absolute', top: 2, left: v ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'all 180ms' }} />
            </button>
        </div>
    );
}

/* ── Profile Section (CONNECTED to apiGetMe + apiPatchSettings) ── */
function ProfileSection() {
    const { role } = useAirport();
    const isSuperAdmin = role === 'super_admin';
    const [profile, setProfile] = useState<Profile>({});
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        apiGetMe().then(({ data }) => {
            if (data) {
                setProfile(data);
                setFullName(data.full_name || '');
                setPhone(data.phone_number || '');
                setPhotoUrl(data.profile_photo_url || null);
            }
        });
    }, []);

    const getInitials = () => {
        return (fullName || profile.full_name || 'AD').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    };

    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate format
        if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
            setMsg({ type: 'error', text: 'Only JPG, PNG or JPEG files are accepted.' });
            return;
        }

        // Validate size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            setMsg({ type: 'error', text: 'File size must be under 2MB.' });
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            setPhotoUrl(result);
        };
        reader.onerror = () => {
            setMsg({ type: 'error', text: 'Failed to read file.' });
        };
        reader.readAsDataURL(file);
    };

    const save = async () => {
        setSaving(true);
        const payload: Record<string, any> = {};
        if (fullName !== profile.full_name) payload.full_name = fullName;
        if (phone !== profile.phone_number) payload.phone_number = phone;
        if (photoUrl !== profile.profile_photo_url) payload.profile_photo_url = photoUrl;
        
        const { error } = await apiPatchSettings(payload);
        setSaving(false);
        if (error) { 
            setMsg({ type: 'error', text: error }); 
        } else { 
            setMsg({ type: 'success', text: 'Profile updated successfully.' }); 
            setProfile(p => ({ ...p, full_name: fullName, phone_number: phone, profile_photo_url: photoUrl })); 
            window.dispatchEvent(new CustomEvent('admin-header-refresh-me'));
        }
        setTimeout(() => setMsg(null), 3000);
    };

    return (
        <>
            <SectionHeader title="Profile information" sub="How you appear to other operators." />
            {msg && (
                <div style={{ marginBottom: '1rem', padding: '0.6rem 0.85rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, background: msg.type === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: msg.type === 'success' ? '#10B981' : '#DC2626', border: `1px solid ${msg.type === 'success' ? 'rgba(52,211,153,0.35)' : 'rgba(248,113,113,0.35)'}` }}>
                    {msg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />} {msg.text}
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '1.5rem' }}>
                {photoUrl ? (
                    <img src={photoUrl} alt="Preview" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--adm-accent)', flexShrink: 0 }} />
                ) : (
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700, color: '#0A1628', flexShrink: 0 }}>
                        {getInitials()}
                    </div>
                )}
                <div>
                    <button onClick={triggerFileSelect} className="admin-btn admin-btn--outline admin-btn--compact" style={{ cursor: 'pointer' }}>Change photo</button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/png, image/jpeg, image/jpg"
                        style={{ display: 'none' }}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)', marginTop: 6, marginBottom: 0 }}>JPG or PNG, max 2 MB.</p>
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Field l="Full name" v={fullName} onChange={setFullName} />
                <Field l="Email" v={profile.email} readOnly />
                <Field l="Phone" v={phone} onChange={setPhone} />
                <Field l="Role" v={profile.role === 'super_admin' ? 'Super Admin' : 'Airport Admin'} readOnly />
                {!isSuperAdmin && (
                    <>
                        <Field l="Airport" v={profile.airport_iata || 'HQ'} readOnly />
                        <Field l="Employee ID" v={profile.employee_id || '—'} readOnly />
                    </>
                )}
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--adm-border)', paddingTop: '1rem' }}>
                <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving} style={{ cursor: 'pointer' }}>
                    {saving ? <><Loader size={14} className="su-spin" /> Saving…</> : <><Save size={15} /><span>Save changes</span></>}
                </button>
            </div>
        </>
    );
}

/* ── Security Section (CONNECTED to apiChangePassword) ── */
function SecuritySection() {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showC, setShowC] = useState(false);
    const [showN, setShowN] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const strength = useMemo(() => calcStrength(next), [next]);
    const pwMatch = confirm.length > 0 && confirm === next;
    const pwMismatch = confirm.length > 0 && confirm !== next;

    const submit = async () => {
        if (!current) return setMsg({ type: 'error', text: 'Enter your current password.' });
        if (next.length < 8) return setMsg({ type: 'error', text: 'New password must be ≥ 8 characters.' });
        if (strength.score < 2) return setMsg({ type: 'error', text: 'Choose a stronger password.' });
        if (next !== confirm) return setMsg({ type: 'error', text: 'Passwords do not match.' });
        setSaving(true);
        const { error } = await apiChangePassword(current, next);
        setSaving(false);
        if (error) { setMsg({ type: 'error', text: error }); }
        else { setCurrent(''); setNext(''); setConfirm(''); setMsg({ type: 'success', text: 'Password updated successfully.' }); }
        setTimeout(() => setMsg(null), 3500);
    };

    const PwField = ({ label, v, setV, show, toggle, state, hint }: any) => {
        const borderColor = state === 'error' ? 'rgba(239,68,68,0.6)' : state === 'ok' ? 'rgba(16,185,129,0.5)' : 'var(--adm-border)';
        return (
            <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--adm-text-muted)', marginBottom: 6 }}>{label}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.85rem', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${borderColor}`, transition: 'all 180ms' }}>
                    <Lock size={14} style={{ color: 'var(--adm-text-muted)', flexShrink: 0 }} />
                    <input type={show ? 'text' : 'password'} value={v} onChange={e => setV(e.target.value)} placeholder="••••••••"
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--adm-text)', fontSize: '0.88rem', letterSpacing: show ? 'normal' : '0.18em' }} />
                    <button type="button" onClick={toggle} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--adm-text-muted)', display: 'flex' }}>
                        {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                </div>
                {hint && <div style={{ marginTop: 4, fontSize: '0.72rem', color: state === 'error' ? '#EF4444' : '#10B981', fontWeight: 600 }}>{hint}</div>}
            </div>
        );
    };

    return (
        <>
            <SectionHeader title="Security" sub="Protect your account and active sessions." />
            {msg && (
                <div style={{ marginBottom: '1rem', padding: '0.6rem 0.85rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, background: msg.type === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: msg.type === 'success' ? '#10B981' : '#DC2626', border: `1px solid ${msg.type === 'success' ? 'rgba(52,211,153,0.35)' : 'rgba(248,113,113,0.35)'}` }}>
                    {msg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />} {msg.text}
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <PwField label="Current password" v={current} setV={setCurrent} show={showC} toggle={() => setShowC(s => !s)} />
                <div />
                <PwField label="New password" v={next} setV={setNext} show={showN} toggle={() => setShowN(s => !s)} />
                <PwField label="Confirm new password" v={confirm} setV={setConfirm} show={false}
                    toggle={() => {}} state={pwMismatch ? 'error' : pwMatch ? 'ok' : undefined}
                    hint={pwMismatch ? "Passwords don't match" : pwMatch ? 'Passwords match' : undefined}
                />
            </div>
            {next && (
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: i < strength.score ? strength.color : 'var(--adm-border)', transition: 'background 180ms' }} />
                        ))}
                    </div>
                    <div style={{ marginTop: 5, fontSize: '0.72rem', color: strength.color, fontWeight: 700, letterSpacing: '0.04em' }}>{strength.label}</div>
                </div>
            )}
            <ToggleRow l="Two-factor authentication" sub="Require a TOTP code on every login." />
            <ToggleRow l="Trusted devices" sub="Skip 2FA on devices you've marked as trusted." />
            <ToggleRow l="Session timeout (15 min)" sub="Sign out automatically after inactivity." />
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--adm-border)', paddingTop: '1rem' }}>
                <button className="admin-btn admin-btn--outline" onClick={() => { setCurrent(''); setNext(''); setConfirm(''); setMsg(null); }}>Discard</button>
                <button className="admin-btn admin-btn--primary" onClick={submit} disabled={saving}>
                    {saving ? <><Loader size={14} className="su-spin" /> Updating…</> : <><Lock size={14} /><span>Update password</span></>}
                </button>
            </div>
        </>
    );
}

/* ── Notifications Section (TODO: connect to backend notification prefs endpoint) ── */
// TODO: Backend endpoint needed: GET/PATCH /api/users/notification-preferences
// Expected response: { high_risk_alerts: bool, weather_advisories: bool, cancellations: bool, daily_digest: bool, marketing: bool }
function NotificationsSection() {
    return (
        <>
            <SectionHeader title="Notifications" sub="Choose which alerts you want to receive." />
            <ToggleRow l="High-risk delay predictions" sub="Push + email when a flight is flagged HIGH risk." />
            <ToggleRow l="Weather advisories" sub="METAR severity above moderate." />
            <ToggleRow l="Cancellations" sub="Any flight cancelled at TUN or partner airports." />
            <ToggleRow l="Daily digest" sub="Morning summary at 06:00 local time." on={false} />
            <ToggleRow l="Marketing & product updates" sub="Occasional release notes." on={false} />
        </>
    );
}

/* ── Integrations Section (TODO: no backend endpoint yet) ── */
// TODO: Backend endpoint needed: GET/PATCH /api/settings/integrations
// Expected response: { flightaware: bool, oag: bool, openweather: bool, slack: bool, pagerduty: bool }
function IntegrationsSection() {
    const items = [
        { l: 'FlightAware', s: 'Live ADS-B feed', on: true },
        { l: 'OAG Schedules', s: 'Global schedules + IATA codes', on: true },
        { l: 'OpenWeather', s: 'METAR / TAF data', on: true },
        { l: 'Slack', s: 'Push alerts to #ops-tun', on: false },
        { l: 'PagerDuty', s: 'On-call escalations', on: false },
    ];
    return (
        <>
            <SectionHeader title="Integrations" sub="Third-party services connected to this airport." />
            {items.map(i => <ToggleRow key={i.l} l={i.l} sub={i.s} on={i.on} />)}
        </>
    );
}

/* ── Appearance Section (TODO: no backend endpoint yet) ── */
// TODO: Backend endpoint needed: GET/PATCH /api/settings/appearance
function AppearanceSection() {
    const [theme, setTheme] = useState('Aviation Navy');
    const themes = [
        { l: 'Aviation Navy', g: 'linear-gradient(135deg,#0A1628,#132544)' },
        { l: 'Midnight', g: 'linear-gradient(135deg,#0a0a1a,#1e1e5a)' },
        { l: 'Carbon', g: 'linear-gradient(135deg,#1a1a1a,#2d2d2d)' },
    ];
    return (
        <>
            <SectionHeader title="Appearance" sub="Theme, density, and accent." />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.25rem' }}>
                {themes.map(t => (
                    <div key={t.l} onClick={() => setTheme(t.l)} style={{ padding: 12, borderRadius: 12, border: theme === t.l ? '2px solid var(--adm-accent)' : '1px solid var(--adm-border)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                        <div style={{ height: 64, borderRadius: 8, background: t.g, marginBottom: 8 }} />
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--adm-text)' }}>{t.l}</div>
                    </div>
                ))}
            </div>
            <ToggleRow l="Compact density" sub="Reduce padding in tables and cards." on={false} />
            <ToggleRow l="High-contrast mode" sub="Stronger borders for low-light cockpits." on={false} />
        </>
    );
}

/* ── Language Section (TODO: connect to backend for locale prefs) ── */
// TODO: Backend endpoint needed: GET/PATCH /api/settings/locale
// Expected response: { language: string, region: string, timezone: string, date_format: string, time_format: string, distance_units: string }
function LanguageSection() {
    return (
        <>
            <SectionHeader title="Language & Region" sub="Localization, timezone, and units." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Field l="Language" v="English" />
                <Field l="Region" v="Tunisia (TN)" />
                <Field l="Timezone" v="Africa/Tunis (UTC+1)" />
                <Field l="Date format" v="DD MMM YYYY" />
                <Field l="Time format" v="24-hour" />
                <Field l="Distance units" v="Nautical miles" />
            </div>
        </>
    );
}

/* ── Data & Privacy (TODO: no backend endpoint) ── */
// TODO: Backend endpoint needed: GET/PATCH /api/settings/privacy
function DataSection() {
    return (
        <>
            <SectionHeader title="Data & Privacy" sub="Control how your data is stored and shared." />
            <ToggleRow l="Anonymous usage analytics" sub="Help us improve the console." />
            <ToggleRow l="Share crash reports" sub="Auto-send stack traces on errors." />
            <ToggleRow l="Retain logs for 90 days" sub="After 90 days, audit logs are purged." />
            <div style={{ marginTop: '1rem', display: 'flex', gap: 8 }}>
                <button className="admin-btn admin-btn--outline">Export my data</button>
                <button className="admin-btn admin-btn--outline" style={{ color: '#F87171' }}>Delete account</button>
            </div>
        </>
    );
}

/* ── API & Tokens (TODO: no backend endpoint yet) ── */
// TODO: Backend endpoint needed: GET /api/settings/tokens, POST /api/settings/tokens, DELETE /api/settings/tokens/:id
function ApiSection() {
    return (
        <>
            <SectionHeader title="API & Tokens" sub="Personal access tokens for programmatic access." />
            <div className="admin-table-wrap">
                <table className="admin-table">
                    <thead><tr><th>Name</th><th>Scope</th><th>Created</th><th>Last used</th></tr></thead>
                    <tbody>
                        <tr><td style={{ fontWeight: 600 }}>Ops Bot</td><td className="admin-table__muted">read:flights</td><td>Mar 12, 2026</td><td>2 min ago</td></tr>
                        <tr><td style={{ fontWeight: 600 }}>Reporting</td><td className="admin-table__muted">read:analytics</td><td>Jan 04, 2026</td><td>1 day ago</td></tr>
                        <tr><td style={{ fontWeight: 600 }}>CI/CD</td><td className="admin-table__muted">write:deploy</td><td>Dec 22, 2025</td><td>Never</td></tr>
                    </tbody>
                </table>
            </div>
            <div style={{ marginTop: '1rem' }}>
                <button className="admin-btn admin-btn--primary"><KeyRound size={15} /> Create new token</button>
            </div>
        </>
    );
}

/* ═══════════════════════════════════════
   MAIN SETTINGS PAGE
   ═══════════════════════════════════════ */
const SECTIONS = [
    { k: 'profile', l: 'Profile', icon: User },
    { k: 'notifications', l: 'Notifications', icon: Bell },
    { k: 'security', l: 'Security', icon: ShieldCheck },
    { k: 'integrations', l: 'Integrations', icon: Plug },
    { k: 'appearance', l: 'Appearance', icon: Palette },
    { k: 'language', l: 'Language & Region', icon: Globe2 },
    { k: 'data', l: 'Data & Privacy', icon: Database },
    { k: 'api', l: 'API & Tokens', icon: KeyRound },
];

function renderSection(k: string) {
    switch (k) {
        case 'profile': return <ProfileSection />;
        case 'notifications': return <NotificationsSection />;
        case 'security': return <SecuritySection />;
        case 'integrations': return <IntegrationsSection />;
        case 'appearance': return <AppearanceSection />;
        case 'language': return <LanguageSection />;
        case 'data': return <DataSection />;
        case 'api': return <ApiSection />;
        default: return null;
    }
}

export default function AdminSettings() {
    const { t } = useLanguage();
    const { role } = useAirport();
    const isSuperAdmin = role === 'super_admin';
    const [section, setSection] = useState('profile');

    const sections = useMemo(() => {
        if (isSuperAdmin) {
            return [
                { k: 'profile', l: 'Profile', icon: User },
            ];
        }
        return SECTIONS;
    }, [isSuperAdmin]);

    const activeSection = sections.find(s => s.k === section);
    const isProfileOrSecurity = section === 'profile' || section === 'security';

    return (
        <div className="admin-content__inner">
            {/* Page header */}
            <div className="admin-page__header">
                <div>
                    <h1 className="admin-page__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <SettingsIcon size={22} style={{ color: 'var(--adm-accent)' }} /> {t('settings') || 'Settings'}
                    </h1>
                    <p className="admin-page__subtitle">Manage your account, alerts, and integrations.</p>
                </div>
            </div>

            {/* Layout: content-only for Super Admin, sidebar+content for Airport Admin */}
            {isSuperAdmin ? (
                <div className="admin-card" style={{ padding: '1.75rem' }}>
                    <ProfileSection />
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1rem', alignItems: 'flex-start' }}>
                    {/* Sidebar nav */}
                    <div className="admin-card" style={{ padding: '0.5rem', height: 'fit-content' }}>
                        {sections.map(s => {
                            const Ic = s.icon;
                            const active = section === s.k;
                            return (
                                <button key={s.k} onClick={() => setSection(s.k)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                        textAlign: 'left', padding: '0.6rem 0.85rem', borderRadius: 8, border: 'none',
                                        background: active ? 'var(--adm-accent-light, rgba(245,158,11,0.12))' : 'transparent',
                                        color: active ? 'var(--adm-accent)' : 'var(--adm-text-sub)',
                                        fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', marginBottom: 2, transition: 'all 180ms',
                                    }}
                                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <Ic size={15} /> {s.l}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content panel */}
                    <div className="admin-card" style={{ padding: '1.75rem' }}>
                        {renderSection(section)}
                        {/* Save/Cancel footer only for non-self-saving sections */}
                        {!isProfileOrSecurity && section !== 'data' && section !== 'api' && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: '1rem', marginTop: '1.25rem', borderTop: '1px solid var(--adm-border)' }}>
                                <button className="admin-btn admin-btn--outline">Cancel</button>
                                <button className="admin-btn admin-btn--primary"><Save size={15} /><span>Save changes</span></button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

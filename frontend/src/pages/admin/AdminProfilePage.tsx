import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    UserCircle, Mail, Phone, MapPin, IdCard, FileText, Plane, Calendar,
    Globe, ShieldCheck, Lock, Eye, EyeOff, Pencil, Save, X, Check,
    AlertCircle, Camera, Download, ShieldAlert, Loader, RefreshCw,
} from 'lucide-react';
import { apiGetMe, apiPatchSettings, apiChangePassword } from '../../services/adminApi';
import { useLanguage } from '../../context/LanguageContext';
import { formatTunisiaPhoneInput, isValidTunisiaPhone } from '../../utils/tunisiaPhone';

/* ─────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────── */
interface ProfileData {
    fullName: string;
    dateOfBirth: string;
    gender: string;
    nationality: string;
    residentialAddress: string;
    cinNumber: string;
    passportNumber: string;
    passportExpiry: string;
    phoneNumber: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelationship: string;
    email: string;
    personalEmail: string;
    airport: string;
    employeeId: string;
    verificationStatus: string;
    profilePhotoUrl: string | null;
    cinDocumentUrl: string | null;
    cinDocumentBackUrl: string | null;
    passportDocumentUrl: string | null;
    role: string;
    profileEditUnlocked: boolean;
    profileUnlockIdentity: boolean;
    profileUnlockPassport: boolean;
    profileUnlockCinDoc: boolean;
    profileUnlockContact: boolean;
}

const EMPTY: ProfileData = {
    fullName: '', dateOfBirth: '', gender: '', nationality: '',
    residentialAddress: '', cinNumber: '', passportNumber: '', passportExpiry: '',
    phoneNumber: '', emergencyContactName: '', emergencyContactPhone: '',
    emergencyContactRelationship: '', email: '', personalEmail: '',
    airport: '', employeeId: '', verificationStatus: 'pending_review',
    profilePhotoUrl: null, cinDocumentUrl: null, cinDocumentBackUrl: null, passportDocumentUrl: null,
    role: 'admin',
    profileEditUnlocked: false,
    profileUnlockIdentity: false,
    profileUnlockPassport: false,
    profileUnlockCinDoc: false,
    profileUnlockContact: false,
};

// Fields that can be edited by the admin themselves (per backend rules)
const EDITABLE = new Set<keyof ProfileData>([
    'phoneNumber', 'residentialAddress', 'emergencyContactName',
    'emergencyContactPhone', 'emergencyContactRelationship',
    'profilePhotoUrl',
]);

/* ─────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────── */
function fmtDate(d?: string | null) {
    if (!d) return '—';
    try {
        return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
}

function getInitials(name?: string | null) {
    return (name || 'AD').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function calcStrength(pw: string): { score: number; label: string; color: string } {
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

/* ─────────────────────────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────────────────────────── */
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="admin-card" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1.1rem' }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--adm-text)', margin: '0 0 4px' }}>{title}</h2>
                {subtitle && <p style={{ fontSize: '0.82rem', color: 'var(--adm-text-muted)', margin: 0 }}>{subtitle}</p>}
            </div>
            {children}
        </div>
    );
}

function Grid({ cols, children }: { cols: 1 | 2; children: React.ReactNode }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: cols === 2 ? '1fr 1fr' : '1fr', gap: '0.9rem', marginTop: '0.5rem' }}>
            {children}
        </div>
    );
}

function FieldShell({ label, children, fullWidth }: { label: string; children: React.ReactNode; fullWidth?: boolean }) {
    return (
        <div style={{ gridColumn: fullWidth ? '1 / -1' : undefined }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--adm-text-muted)', marginBottom: 6 }}>
                {label}
            </label>
            {children}
        </div>
    );
}

function ReadField({ label, value, icon: Icon, verified, status, fullWidth }: {
    label: string; value?: string | null; icon: any; verified?: boolean; status?: 'processing' | 'rejected'; fullWidth?: boolean;
}) {
    return (
        <FieldShell label={label} fullWidth={fullWidth}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '0.65rem 0.85rem', borderRadius: 10,
                background: 'var(--adm-input-bg)', border: '1px solid var(--adm-border)',
                color: 'var(--adm-text)', fontSize: '0.88rem', fontWeight: 500,
            }}>
                <Icon size={15} style={{ color: 'var(--adm-text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '—'}</span>
                {verified && <span title="Verified" style={{ color: '#10B981' }}><Check size={14} /></span>}
                {status === 'processing' && <span title="Processing" style={{ color: '#F59E0B' }}><AlertCircle size={14} /></span>}
                {status === 'rejected' && <span title="Rejected" style={{ color: '#EF4444' }}><X size={14} /></span>}
            </div>
        </FieldShell>
    );
}

function EditField({ label, value, editable, editing, error, onChange, icon: Icon, fullWidth, type = 'text', options }: {
    label: string; value?: string | null; editable: boolean; editing: boolean;
    error?: string; onChange: (v: string) => void; icon: any; fullWidth?: boolean; type?: string; options?: string[];
}) {
    const active = editable && editing;
    return (
        <FieldShell label={label} fullWidth={fullWidth}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: active && options ? '0.35rem 0.85rem' : '0.5rem 0.85rem', borderRadius: 10,
                background: active ? 'var(--adm-card)' : 'var(--adm-input-bg)',
                border: `1px solid ${error ? 'rgba(239,68,68,0.6)' : active ? 'var(--adm-accent)' : 'var(--adm-border)'}`,
                boxShadow: active ? '0 0 0 3px var(--adm-accent-light)' : 'none',
                transition: 'all 180ms ease',
            }}>
                <Icon size={15} style={{ color: active ? 'var(--adm-accent)' : 'var(--adm-text-muted)', flexShrink: 0 }} />
                {active && options ? (
                    <select
                        value={value || ''}
                        onChange={e => onChange(e.target.value)}
                        style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            color: 'var(--adm-text)', fontSize: '0.88rem', fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        <option value="" disabled>Select {label.toLowerCase()}</option>
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                ) : (
                    <input
                        type={type}
                        value={value || ''}
                        readOnly={!active}
                        onChange={e => onChange(e.target.value)}
                        style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            color: 'var(--adm-text)', fontSize: '0.88rem', fontWeight: 500,
                            cursor: active ? 'text' : 'default',
                        }}
                    />
                )}
                {editable && !editing && (
                    <span title="Editable in edit mode" style={{ color: 'var(--adm-text-muted)' }}><Pencil size={12} /></span>
                )}
            </div>
            {error && <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#EF4444' }}>{error}</div>}
        </FieldShell>
    );
}

function DocumentPreview({ label, url, accent }: { label: string; url?: string | null; accent: string }) {
    if (!url) return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '0.85rem 1rem', borderRadius: 12,
            background: 'var(--adm-input-bg)', border: '1px solid var(--adm-border)',
        }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: `${accent}22`, color: accent }}>
                <FileText size={18} />
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--adm-text)' }}>{label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)' }}>No document on file</div>
            </div>
        </div>
    );
    const isPdf = url.startsWith('data:application/pdf');
    return (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--adm-border)' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '0.6rem 0.85rem', background: 'var(--adm-input-bg)',
                borderBottom: '1px solid var(--adm-border)',
            }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: `${accent}22`, color: accent }}>
                    <FileText size={14} />
                </div>
                <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: 'var(--adm-text)' }}>{label}</span>
                <a href={url} download={`${label.replace(/\s/g, '_')}.${isPdf ? 'pdf' : 'jpg'}`}
                    style={{ color: 'var(--adm-text-muted)', display: 'grid', placeItems: 'center' }}>
                    <Download size={14} />
                </a>
            </div>
            {isPdf
                ? <iframe title={label} src={url} style={{ width: '100%', height: 200, border: 'none', background: '#fff' }} />
                : <img src={url} alt={label} style={{ maxWidth: '100%', maxHeight: 200, display: 'block', objectFit: 'contain' }} />
            }
        </div>
    );
}

function DocumentUploadField({ label, url, accent, editing, onChange }: {
    label: string; url?: string | null; accent: string; editing: boolean; onChange: (v: string) => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const handlePick = () => { if (editing) fileRef.current?.click(); };
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
        if (!allowed.includes(file.type)) { alert('Only JPG, PNG or PDF files are accepted.'); return; }
        if (file.size > 5 * 1024 * 1024) { alert('File must be under 5MB.'); return; }
        const reader = new FileReader();
        reader.onload = () => onChange(reader.result as string);
        reader.readAsDataURL(file);
        // reset input so same file can be re-selected
        e.target.value = '';
    };
    const isPdf = url ? url.startsWith('data:application/pdf') : false;
    return (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${editing ? accent + '55' : 'var(--adm-border)'}`, boxShadow: editing ? `0 0 0 3px ${accent}18` : 'none', transition: 'all 180ms ease' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '0.6rem 0.85rem', background: editing ? `${accent}12` : 'var(--adm-input-bg)',
                borderBottom: url ? '1px solid var(--adm-border)' : 'none',
                cursor: editing ? 'pointer' : 'default',
            }} onClick={handlePick}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: `${accent}22`, color: accent }}>
                    <FileText size={14} />
                </div>
                <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: 'var(--adm-text)' }}>{label}</span>
                {editing && (
                    <span style={{ fontSize: '0.72rem', color: accent, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Camera size={12} /> {url ? 'Replace' : 'Upload'}
                    </span>
                )}
                {!editing && url && (
                    <a href={url} download={`${label.replace(/\s/g, '_')}.${isPdf ? 'pdf' : 'jpg'}`}
                        style={{ color: 'var(--adm-text-muted)', display: 'grid', placeItems: 'center' }}
                        onClick={e => e.stopPropagation()}>
                        <Download size={14} />
                    </a>
                )}
            </div>
            {url ? (
                isPdf
                    ? <iframe title={label} src={url} style={{ width: '100%', height: 200, border: 'none', background: '#fff' }} />
                    : <img src={url} alt={label} style={{ maxWidth: '100%', maxHeight: 200, display: 'block', objectFit: 'contain' }} />
            ) : (
                editing ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--adm-text-muted)', fontSize: '0.8rem' }}>
                        Click to upload a document (JPG, PNG, PDF · max 5MB)
                    </div>
                ) : null
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,application/pdf" style={{ display: 'none' }} onChange={handleFile} />
        </div>
    );
}

function PwField({ label, v, setV, show, toggle, state, hint }: {
    label: string; v: string; setV: (s: string) => void; show: boolean; toggle: () => void;
    state?: 'error' | 'ok'; hint?: string;
}) {
    const borderColor = state === 'error' ? 'rgba(239,68,68,0.6)' : state === 'ok' ? 'rgba(16,185,129,0.5)' : 'var(--adm-border)';
    return (
        <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--adm-text-muted)', marginBottom: 6 }}>
                {label}
            </label>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '0.5rem 0.85rem', borderRadius: 10,
                background: 'var(--adm-input-bg)', border: `1px solid ${borderColor}`,
                transition: 'all 180ms ease',
            }}>
                <Lock size={14} style={{ color: 'var(--adm-text-muted)', flexShrink: 0 }} />
                <input
                    type={show ? 'text' : 'password'}
                    value={v}
                    onChange={e => setV(e.target.value)}
                    placeholder="••••••••"
                    style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        color: 'var(--adm-text)', fontSize: '0.88rem',
                        letterSpacing: show ? 'normal' : '0.18em',
                    }}
                />
                <button type="button" onClick={toggle} aria-label={show ? 'Hide password' : 'Show password'}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--adm-text-muted)', display: 'flex' }}>
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
            </div>
            {hint && (
                <div style={{ marginTop: 4, fontSize: '0.72rem', color: state === 'error' ? '#EF4444' : '#10B981', fontWeight: 600 }}>
                    {hint}
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────
   VERIFICATION STATUS CONFIG
   ───────────────────────────────────────────────────────────────── */
const VERIF_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    approved: { label: 'Identity Verified', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
    verified: { label: 'Identity Verified', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },
    pending_review: { label: 'Pending Review', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
    pending: { label: 'Pending Review', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
    under_review: { label: 'Under Review', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.3)' },
    rejected: { label: 'ID Rejected', color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
    expired_verification: { label: 'Verification Expired', color: '#EF4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.30)' },
};

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function AdminProfilePage() {
    const { t } = useLanguage();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate format
        if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
            showToast('error', 'Only JPG, PNG or JPEG files are accepted.');
            return;
        }

        // Validate size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast('error', 'File size must be under 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            if (!editing) {
                setDraft({
                    ...data,
                    profilePhotoUrl: result
                });
                setErrors({});
                setEditing(true);
            } else {
                setDraft(d => ({ ...d, profilePhotoUrl: result }));
            }
        };
        reader.onerror = () => {
            showToast('error', 'Failed to read file.');
        };
        reader.readAsDataURL(file);
    };

    /* Data state */
    const [data, setData] = useState<ProfileData>(EMPTY);
    const [draft, setDraft] = useState<ProfileData>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof ProfileData, string>>>({});
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    /* Password section state */
    const [pwCurrent, setPwCurrent] = useState('');
    const [pwNext, setPwNext] = useState('');
    const [pwConfirm, setPwConfirm] = useState('');
    const [pwShow, setPwShow] = useState({ c: false, n: false, r: false });
    const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [pwSaving, setPwSaving] = useState(false);

    const strength = useMemo(() => calcStrength(pwNext), [pwNext]);
    const pwMatch = pwConfirm.length > 0 && pwConfirm === pwNext;
    const pwMismatch = pwConfirm.length > 0 && pwConfirm !== pwNext;

    const showToast = useCallback((type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    }, []);

    /* Load profile from backend */
    const loadProfile = useCallback(async () => {
        setLoading(true);
        const { data: me, error } = await apiGetMe();
        setLoading(false);
        if (error || !me) {
            showToast('error', 'Failed to load profile. Please refresh.');
            return;
        }
        const mapped: ProfileData = {
            fullName: me.full_name || '',
            dateOfBirth: me.date_of_birth || '',
            gender: me.gender || '',
            nationality: me.nationality || '',
            residentialAddress: me.residential_address || '',
            cinNumber: me.cin_number || '',
            passportNumber: me.passport_number || '',
            passportExpiry: me.passport_expiry_date || '',
            phoneNumber: formatTunisiaPhoneInput(me.phone_number),
            emergencyContactName: me.emergency_contact_name || '',
            emergencyContactPhone: formatTunisiaPhoneInput(me.emergency_contact_phone),
            emergencyContactRelationship: me.emergency_contact_relationship || '',
            email: me.email || '',
            personalEmail: me.personal_email || '',
            airport: me.airport_iata || '',
            employeeId: me.employee_id || '',
            verificationStatus: me.id_document_status || 'pending_review',
            profilePhotoUrl: me.profile_photo_url || null,
            cinDocumentUrl: me.cin_document_url || null,
            cinDocumentBackUrl: me.cin_document_back_url || null,
            passportDocumentUrl: me.passport_document_url || null,
            role: me.role || 'admin',
            profileEditUnlocked: me.profile_edit_unlocked || false,
            profileUnlockIdentity: me.profile_unlock_identity || false,
            profileUnlockPassport: me.profile_unlock_passport || false,
            profileUnlockCinDoc: me.profile_unlock_cin_doc || false,
            profileUnlockContact: me.profile_unlock_contact || false,
        };
        setData(mapped);
        setDraft(mapped);
    }, [showToast]);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    const isEditable = useCallback((key: keyof ProfileData) => {
        if (data.verificationStatus === "expired_verification") return false;
        if (EDITABLE.has(key)) return true;
        const IDENTITY_FIELDS: (keyof ProfileData)[] = ['fullName', 'dateOfBirth', 'gender', 'nationality'];
        const PASSPORT_FIELDS: (keyof ProfileData)[] = ['passportNumber', 'passportExpiry', 'passportDocumentUrl'];
        const CIN_DOC_FIELDS: (keyof ProfileData)[] = ['cinNumber', 'cinDocumentUrl', 'cinDocumentBackUrl'];
        const CONTACT_FIELDS: (keyof ProfileData)[] = ['phoneNumber', 'residentialAddress', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship'];
        if ((data.profileUnlockIdentity || data.profileEditUnlocked) && IDENTITY_FIELDS.includes(key)) return true;
        if ((data.profileUnlockPassport || data.profileEditUnlocked) && PASSPORT_FIELDS.includes(key)) return true;
        if ((data.profileUnlockCinDoc || data.profileEditUnlocked) && CIN_DOC_FIELDS.includes(key)) return true;
        if ((data.profileUnlockContact || data.profileEditUnlocked) && CONTACT_FIELDS.includes(key)) return true;
        return false;
    }, [data.profileUnlockIdentity, data.profileUnlockPassport, data.profileUnlockCinDoc, data.profileUnlockContact, data.profileEditUnlocked, data.verificationStatus]);

    /* Edit handlers */
    const startEdit = () => { setDraft(data); setErrors({}); setEditing(true); };
    const cancelEdit = () => { setDraft(data); setErrors({}); setEditing(false); };

    const passportNumberError = (s: string): string => {
        const t = String(s || '').trim();
        if (t.length < 6) return 'Passport number must be at least 6 characters';
        if (!/^[A-Za-z]+[0-9][A-Za-z0-9]*$/.test(t))
            return 'Use letter(s) followed by digits (e.g. AB123456)';
        return '';
    };

    const validate = (d: ProfileData) => {
        const e: Partial<Record<keyof ProfileData, string>> = {};
        if (isEditable('phoneNumber') && !isValidTunisiaPhone(d.phoneNumber))
            e.phoneNumber = 'Please enter a valid Tunisian phone number (e.g. +216 9X XXX XXX)';
        if (isEditable('residentialAddress') && d.residentialAddress.trim().length < 6)
            e.residentialAddress = 'Address is too short';
        if (isEditable('emergencyContactName') && d.emergencyContactName.trim().length < 2)
            e.emergencyContactName = 'Contact name required';
        if (isEditable('emergencyContactPhone') && !isValidTunisiaPhone(d.emergencyContactPhone))
            e.emergencyContactPhone = 'Please enter a valid Tunisian phone number (e.g. +216 9X XXX XXX)';

        if (isEditable('fullName') && d.fullName.trim().length < 2)
            e.fullName = 'Full name must be at least 2 characters';
        if (isEditable('dateOfBirth')) {
            if (!d.dateOfBirth) e.dateOfBirth = 'Date of birth is required';
            else {
                const age = (Date.now() - new Date(d.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365);
                if (age < 18) e.dateOfBirth = 'Must be at least 18 years old';
            }
        }
        if (isEditable('nationality') && d.nationality.trim().length < 2)
            e.nationality = 'Nationality is required';
        if (isEditable('gender') && !d.gender)
            e.gender = 'Gender is required';
        if (isEditable('cinNumber') && !/^\d{8}$/.test(d.cinNumber.trim()))
            e.cinNumber = 'CIN must be exactly 8 digits';
        if (isEditable('passportNumber')) {
            const pe = passportNumberError(d.passportNumber);
            if (pe) e.passportNumber = pe;
        }
        if (isEditable('passportExpiry')) {
            if (!d.passportExpiry) e.passportExpiry = 'Passport expiry is required';
            else if (new Date(d.passportExpiry) <= new Date())
                e.passportExpiry = 'Passport must not be expired';
        }
        return e;
    };

    const FRONTEND_TO_BACKEND: Partial<Record<keyof ProfileData, string>> = {
        phoneNumber: 'phone_number',
        residentialAddress: 'residential_address',
        emergencyContactName: 'emergency_contact_name',
        emergencyContactPhone: 'emergency_contact_phone',
        emergencyContactRelationship: 'emergency_contact_relationship',
        profilePhotoUrl: 'profile_photo_url',
        fullName: 'full_name',
        dateOfBirth: 'date_of_birth',
        gender: 'gender',
        nationality: 'nationality',
        cinNumber: 'cin_number',
        cinDocumentUrl: 'cin_document_url',
        cinDocumentBackUrl: 'cin_document_back_url',
        passportNumber: 'passport_number',
        passportExpiry: 'passport_expiry_date',
        passportDocumentUrl: 'passport_document_url',
    };

    const save = async () => {
        const e = validate(draft);
        setErrors(e);
        if (Object.keys(e).length > 0) { showToast('error', 'Please correct the highlighted fields.'); return; }
        setSaving(true);
        const payload: Record<string, string | null> = {};

        // Always include editable contact/photo fields
        const keysToSave = new Set<keyof ProfileData>(EDITABLE);

        // Add per-section fields based on which sections are unlocked
        if (data.profileUnlockIdentity || data.profileEditUnlocked) {
            (['fullName', 'dateOfBirth', 'gender', 'nationality'] as (keyof ProfileData)[]).forEach(k => keysToSave.add(k));
        }
        if (data.profileUnlockPassport || data.profileEditUnlocked) {
            (['passportNumber', 'passportExpiry', 'passportDocumentUrl'] as (keyof ProfileData)[]).forEach(k => keysToSave.add(k));
        }
        if (data.profileUnlockCinDoc || data.profileEditUnlocked) {
            (['cinNumber', 'cinDocumentUrl', 'cinDocumentBackUrl'] as (keyof ProfileData)[]).forEach(k => keysToSave.add(k));
        }
        if (data.profileUnlockContact || data.profileEditUnlocked) {
            (['phoneNumber', 'residentialAddress', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship'] as (keyof ProfileData)[]).forEach(k => keysToSave.add(k));
        }

        keysToSave.forEach(k => {
            const v = draft[k] as string | null;
            if (v !== data[k]) {
                const backendKey = FRONTEND_TO_BACKEND[k];
                if (backendKey) {
                    const cleanVal = (k === 'phoneNumber' || k === 'emergencyContactPhone')
                        ? (v ? v.replace(/\s/g, '') : '')
                        : v;
                    payload[backendKey] = cleanVal;
                }
            }
        });

        if (Object.keys(payload).length === 0) { setEditing(false); setSaving(false); return; }
        const { error } = await apiPatchSettings(payload);
        setSaving(false);
        if (error) { showToast('error', error); return; }
        setData(draft);
        setEditing(false);
        showToast('success', 'Profile updated successfully.');
        window.dispatchEvent(new CustomEvent('admin-header-refresh-me'));
        await loadProfile();
    };

    const onChange = (k: keyof ProfileData, v: string) => {
        if (k === 'phoneNumber' || k === 'emergencyContactPhone') {
            setDraft(d => ({ ...d, [k]: formatTunisiaPhoneInput(v) }));
        } else {
            setDraft(d => ({ ...d, [k]: v }));
        }
    };

    /* Password change */
    const submitPassword = async () => {
        if (!pwCurrent) { setPwMsg({ type: 'error', text: 'Enter your current password.' }); return; }
        if (pwNext.length < 8) { setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' }); return; }
        if (strength.score < 2) { setPwMsg({ type: 'error', text: 'Choose a stronger password.' }); return; }
        if (pwNext !== pwConfirm) { setPwMsg({ type: 'error', text: 'Passwords do not match.' }); return; }
        setPwSaving(true);
        const { error } = await apiChangePassword(pwCurrent, pwNext);
        setPwSaving(false);
        if (error) { setPwMsg({ type: 'error', text: error }); setTimeout(() => setPwMsg(null), 3500); return; }
        setPwCurrent(''); setPwNext(''); setPwConfirm('');
        setPwMsg({ type: 'success', text: 'Password updated successfully.' });
        setTimeout(() => setPwMsg(null), 3500);
    };

    const verifCfg = VERIF_CFG[data.verificationStatus] || VERIF_CFG.pending_review;

    return (
        <div className="admin-content__inner">

            {/* Toast */}
            {toast && (
                <div style={{
                    marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 10,
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: toast.type === 'success' ? 'rgba(52,211,153,0.10)' : 'rgba(248,113,113,0.10)',
                    border: `1px solid ${toast.type === 'success' ? 'rgba(52,211,153,0.35)' : 'rgba(248,113,113,0.35)'}`,
                    color: toast.type === 'success' ? '#10B981' : '#DC2626',
                    fontSize: '0.85rem', fontWeight: 600,
                }}>
                    {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Page header */}
            <div className="admin-page__header">
                <div>
                    <h1 className="admin-page__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UserCircle size={22} style={{ color: 'var(--adm-accent)' }} />
                        {t('profile') || 'Profile Settings'}
                    </h1>
                    <p className="admin-page__subtitle">
                        Manage your identity documents and administrative contact information.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={loadProfile} className="admin-btn admin-btn--outline admin-btn--compact" style={{ minWidth: 40, padding: 0 }} title="Refresh">
                        <RefreshCw size={15} className={loading ? 'su-spin' : ''} />
                    </button>
                    {data.verificationStatus !== "expired_verification" && (
                        !editing ? (
                            <button className="admin-btn admin-btn--primary" onClick={startEdit} disabled={loading}>
                                <Pencil size={14} /> <span>Edit Profile</span>
                            </button>
                        ) : (
                            <>
                                <button className="admin-btn admin-btn--outline" onClick={cancelEdit}>
                                    <X size={14} /> <span>Cancel</span>
                                </button>
                                <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving}>
                                    {saving ? <><Loader size={14} className="su-spin" /> Saving…</> : <><Save size={14} /> <span>Save Changes</span></>}
                                </button>
                            </>
                        )
                    )}
                </div>
            </div>

            {/* Per-Section Unlock Banners */}
            {!loading && (data.profileUnlockIdentity || data.profileUnlockPassport || data.profileUnlockCinDoc || data.profileUnlockContact || data.profileEditUnlocked) && (
                <div style={{
                    marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 10,
                    display: 'flex', alignItems: 'start', gap: 10,
                    background: 'rgba(245,158,11,0.10)',
                    border: '1px solid rgba(245,158,11,0.35)',
                    color: '#F59E0B',
                    fontSize: '0.85rem',
                }}>
                    <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2, color: '#F59E0B' }} />
                    <div>
                        <strong style={{ display: 'block', marginBottom: 4 }}>Temporary Edit Access Granted</strong>
                        <div style={{ fontSize: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {(data.profileUnlockIdentity || data.profileEditUnlocked) && (
                                <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.20)', border: '1px solid rgba(245,158,11,0.40)', fontWeight: 600 }}>Identity (Name, DOB, Gender, Nationality)</span>
                            )}
                            {(data.profileUnlockPassport || data.profileEditUnlocked) && (
                                <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.20)', border: '1px solid rgba(245,158,11,0.40)', fontWeight: 600 }}>Passport (Number, Expiry, Document)</span>
                            )}
                            {(data.profileUnlockCinDoc || data.profileEditUnlocked) && (
                                <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.20)', border: '1px solid rgba(245,158,11,0.40)', fontWeight: 600 }}>CIN (Number, Front &amp; Back Documents)</span>
                            )}
                            {(data.profileUnlockContact || data.profileEditUnlocked) && (
                                <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.20)', border: '1px solid rgba(245,158,11,0.40)', fontWeight: 600 }}>Contact &amp; Emergency Info</span>
                            )}
                        </div>
                        <div style={{ marginTop: 4, fontSize: '0.75rem', opacity: 0.85 }}>These sections will automatically relock once you save.</div>
                    </div>
                </div>
            )}

            {/* Expired Verification Banner */}
            {!loading && data.verificationStatus === "expired_verification" && (
                <div style={{
                    marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 10,
                    display: 'flex', alignItems: 'start', gap: 10,
                    background: 'rgba(239,68,68,0.10)',
                    border: '1px solid rgba(239,68,68,0.35)',
                    color: '#EF4444',
                    fontSize: '0.85rem',
                }}>
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2, color: '#EF4444' }} />
                    <div>
                        <strong style={{ display: 'block', marginBottom: 2 }}>Verification Expired</strong>
                        Your verification request has expired due to inactivity. Please contact the Super Admin.
                    </div>
                </div>
            )}

            {/* Loading skeleton */}
            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2rem', color: 'var(--adm-text-muted)', fontSize: '0.9rem' }}>
                    <Loader size={18} className="su-spin" /> Loading profile…
                </div>
            )}

            {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.25rem', alignItems: 'flex-start' }}>

                    {/* LEFT — avatar card + integrity card */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* Avatar card */}
                        <div className="admin-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                            <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 1rem' }}>
                                {(editing ? draft.profilePhotoUrl : data.profilePhotoUrl) ? (
                                    <img
                                        src={editing ? draft.profilePhotoUrl! : data.profilePhotoUrl!}
                                        alt="Profile"
                                        style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--adm-card)', boxShadow: '0 8px 24px rgba(245,158,11,0.22)' }}
                                    />
                                ) : (
                                    <div style={{
                                        width: 100, height: 100, borderRadius: '50%',
                                        background: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '2rem', fontWeight: 700, color: '#0A1628',
                                        border: '3px solid var(--adm-card)',
                                        boxShadow: '0 8px 24px rgba(245,158,11,0.25)',
                                    }}>
                                        {getInitials(data.fullName)}
                                    </div>
                                )}
                                {data.verificationStatus !== "expired_verification" && (
                                    <button 
                                        onClick={triggerFileSelect}
                                        aria-label="Change photo" 
                                        style={{
                                            position: 'absolute', bottom: 0, right: 2, width: 30, height: 30,
                                            borderRadius: '50%', border: '2px solid var(--adm-card)',
                                            background: 'var(--adm-accent)', color: '#0A1628', cursor: 'pointer',
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        }}
                                    >
                                        <Camera size={13} />
                                    </button>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handlePhotoChange}
                                    accept="image/png, image/jpeg, image/jpg"
                                    style={{ display: 'none' }}
                                />
                            </div>

                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--adm-text)', marginBottom: 4 }}>
                                {data.fullName || 'Administrator'}
                            </div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--adm-accent)', letterSpacing: '0.08em', marginBottom: 4 }}>
                                {data.role === 'super_admin' ? 'SUPER ADMIN' : 'AIRPORT ADMIN'}
                            </div>
                            {data.airport && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--adm-text-muted)', marginBottom: '1rem' }}>
                                    {data.airport}
                                </div>
                            )}

                            {/* Verification status pill */}
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                                background: verifCfg.bg, color: verifCfg.color, border: `1px solid ${verifCfg.border}`,
                            }}>
                                <ShieldCheck size={12} /> {verifCfg.label}
                            </span>
                        </div>

                        {/* Identity integrity card */}
                        <div className="admin-card" style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 700, color: 'var(--adm-text)' }}>
                                    <ShieldCheck size={15} style={{ color: 'var(--adm-accent)' }} /> Identity Integrity
                                </div>
                                <span style={{ color: '#10B981' }}><Check size={16} /></span>
                            </div>
                            {[
                                { label: 'Employee ID', value: data.employeeId || '—' },
                                { label: 'Work Email', value: data.email || '—' },
                                { label: 'Personal Email', value: data.personalEmail || '—' },
                            ].map(r => (
                                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--adm-border)' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>{r.label}</span>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--adm-text)', textAlign: 'right', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--adm-text-muted)' }}>Status</span>
                                <span style={{
                                    fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em',
                                    padding: '3px 8px', borderRadius: 6,
                                    background: verifCfg.bg, color: verifCfg.color,
                                    border: `1px solid ${verifCfg.border}`,
                                }}>
                                    {verifCfg.label.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT — sections */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* Personal Information */}
                        <Section title="Personal Information" subtitle="Identity and demographics on file.">
                            <Grid cols={2}>
                                {isEditable('fullName') ? (
                                    <EditField
                                        label="Full Name"
                                        value={editing ? draft.fullName : data.fullName}
                                        editable={true}
                                        editing={editing}
                                        error={errors.fullName}
                                        onChange={v => onChange('fullName', v)}
                                        icon={UserCircle}
                                    />
                                ) : (
                                    <ReadField label="Full Name" value={data.fullName} icon={UserCircle} />
                                )}
                                
                                {isEditable('dateOfBirth') ? (
                                    <EditField
                                        label="Date of Birth"
                                        value={editing ? draft.dateOfBirth : data.dateOfBirth}
                                        editable={true}
                                        editing={editing}
                                        error={errors.dateOfBirth}
                                        onChange={v => onChange('dateOfBirth', v)}
                                        icon={Calendar}
                                        type="date"
                                    />
                                ) : (
                                    <ReadField label="Date of Birth" value={fmtDate(data.dateOfBirth)} icon={Calendar} />
                                )}

                                {isEditable('gender') ? (
                                    <EditField
                                        label="Gender"
                                        value={editing ? draft.gender : data.gender}
                                        editable={true}
                                        editing={editing}
                                        error={errors.gender}
                                        onChange={v => onChange('gender', v)}
                                        icon={UserCircle}
                                        options={['Male', 'Female', 'Other', 'na']}
                                    />
                                ) : (
                                    <ReadField label="Gender" value={data.gender} icon={UserCircle} />
                                )}

                                {isEditable('nationality') ? (
                                    <EditField
                                        label="Nationality"
                                        value={editing ? draft.nationality : data.nationality}
                                        editable={true}
                                        editing={editing}
                                        error={errors.nationality}
                                        onChange={v => onChange('nationality', v)}
                                        icon={Globe}
                                    />
                                ) : (
                                    <ReadField label="Nationality" value={data.nationality} icon={Globe} />
                                )}

                                <EditField
                                    label="Residential Address"
                                    value={editing ? draft.residentialAddress : data.residentialAddress}
                                    editable={isEditable('residentialAddress')}
                                    editing={editing}
                                    error={errors.residentialAddress}
                                    onChange={v => onChange('residentialAddress', v)}
                                    icon={MapPin}
                                    fullWidth
                                />
                            </Grid>
                        </Section>

                        {/* Legal Identification */}
                        <Section title="Legal Identification" subtitle="Sensitive document data for authority verification.">
                            <Grid cols={2}>
                                {isEditable('cinNumber') ? (
                                    <EditField
                                        label="CIN (National ID Card)"
                                        value={editing ? draft.cinNumber : data.cinNumber}
                                        editable={true}
                                        editing={editing}
                                        error={errors.cinNumber}
                                        onChange={v => onChange('cinNumber', v)}
                                        icon={IdCard}
                                    />
                                ) : (
                                    <ReadField label="CIN (National ID Card)" value={data.cinNumber} icon={IdCard}
                                        verified={data.verificationStatus === 'approved' || data.verificationStatus === 'verified'} />
                                )}

                                {isEditable('passportNumber') ? (
                                    <EditField
                                        label="Passport Number"
                                        value={editing ? draft.passportNumber : data.passportNumber}
                                        editable={true}
                                        editing={editing}
                                        error={errors.passportNumber}
                                        onChange={v => onChange('passportNumber', v)}
                                        icon={Plane}
                                    />
                                ) : (
                                    <ReadField label="Passport Number" value={data.passportNumber} icon={Plane}
                                        status={data.verificationStatus === 'pending_review' ? 'processing' : data.verificationStatus === 'rejected' ? 'rejected' : undefined} />
                                )}

                                {isEditable('passportExpiry') ? (
                                    <EditField
                                        label="Passport Expiry"
                                        value={editing ? draft.passportExpiry : data.passportExpiry}
                                        editable={true}
                                        editing={editing}
                                        error={errors.passportExpiry}
                                        onChange={v => onChange('passportExpiry', v)}
                                        icon={Calendar}
                                        type="date"
                                    />
                                ) : (
                                    <ReadField label="Passport Expiry" value={fmtDate(data.passportExpiry)} icon={Calendar} />
                                )}
                            </Grid>
                            {/* CIN Document Upload (shown when cin_doc section unlocked) */}
                            {(data.profileUnlockCinDoc || data.profileEditUnlocked) && (
                                <div style={{ marginTop: '1rem' }}>
                                    <div style={{ marginBottom: 8, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.10em', color: 'var(--adm-accent)', textTransform: 'uppercase' }}>
                                        CIN Document Upload (Unlocked)
                                    </div>
                                    <Grid cols={2}>
                                        <div>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--adm-text-muted)', marginBottom: 6 }}>CIN Front</div>
                                            <DocumentUploadField
                                                label="CIN Front Document"
                                                url={editing ? (draft.cinDocumentUrl || null) : data.cinDocumentUrl}
                                                accent="#34D399"
                                                editing={editing}
                                                onChange={v => setDraft(d => ({ ...d, cinDocumentUrl: v }))}
                                            />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--adm-text-muted)', marginBottom: 6 }}>CIN Back</div>
                                            <DocumentUploadField
                                                label="CIN Back Document"
                                                url={editing ? (draft.cinDocumentBackUrl || null) : data.cinDocumentBackUrl}
                                                accent="#10B981"
                                                editing={editing}
                                                onChange={v => setDraft(d => ({ ...d, cinDocumentBackUrl: v }))}
                                            />
                                        </div>
                                    </Grid>
                                </div>
                            )}
                            {/* Passport Document Upload (shown when passport section unlocked) */}
                            {(data.profileUnlockPassport || data.profileEditUnlocked) && (
                                <div style={{ marginTop: '1rem' }}>
                                    <div style={{ marginBottom: 8, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.10em', color: 'var(--adm-accent)', textTransform: 'uppercase' }}>
                                        Passport Document Upload (Unlocked)
                                    </div>
                                    <div style={{ maxWidth: 'calc(50% - 0.45rem)' }}>
                                        <DocumentUploadField
                                            label="Passport Document"
                                            url={editing ? (draft.passportDocumentUrl || null) : data.passportDocumentUrl}
                                            accent="#FBBF24"
                                            editing={editing}
                                            onChange={v => setDraft(d => ({ ...d, passportDocumentUrl: v }))}
                                        />
                                    </div>
                                </div>
                            )}
                            {/* Read-only document previews when sections are locked */}
                            {!(data.profileUnlockCinDoc || data.profileUnlockPassport || data.profileEditUnlocked) && (data.cinDocumentUrl || data.cinDocumentBackUrl || data.passportDocumentUrl) && (
                                <div style={{ marginTop: '1rem' }}>
                                    <div style={{ marginBottom: 8, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.10em', color: 'var(--adm-text-muted)', textTransform: 'uppercase' }}>
                                        Uploaded Documents
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {(data.cinDocumentUrl || data.cinDocumentBackUrl) && (
                                            <div>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--adm-text-muted)', marginBottom: 6 }}>CIN National ID Card</div>
                                                <Grid cols={2}>
                                                    <DocumentPreview label="CIN Front" url={data.cinDocumentUrl} accent="#34D399" />
                                                    <DocumentPreview label="CIN Back" url={data.cinDocumentBackUrl} accent="#10B981" />
                                                </Grid>
                                            </div>
                                        )}
                                        {data.passportDocumentUrl && (
                                            <div>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--adm-text-muted)', marginBottom: 6 }}>Passport</div>
                                                <div style={{ maxWidth: 'calc(50% - 0.45rem)' }}>
                                                    <DocumentPreview label="Passport Document" url={data.passportDocumentUrl} accent="#FBBF24" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </Section>

                        {/* Contact Registry */}
                        <Section title="Contact Registry" subtitle="Communication channels for official notifications.">
                            <Grid cols={2}>
                                <ReadField label="Email Address" value={data.email} icon={Mail} />
                                <EditField
                                    label="Phone Number"
                                    value={editing ? draft.phoneNumber : data.phoneNumber}
                                    editable={EDITABLE.has('phoneNumber')}
                                    editing={editing}
                                    error={errors.phoneNumber}
                                    onChange={v => onChange('phoneNumber', v)}
                                    icon={Phone}
                                />
                                <EditField
                                    label="Emergency Contact Name"
                                    value={editing ? draft.emergencyContactName : data.emergencyContactName}
                                    editable={EDITABLE.has('emergencyContactName')}
                                    editing={editing}
                                    error={errors.emergencyContactName}
                                    onChange={v => onChange('emergencyContactName', v)}
                                    icon={UserCircle}
                                />
                                <EditField
                                    label="Emergency Contact Phone"
                                    value={editing ? draft.emergencyContactPhone : data.emergencyContactPhone}
                                    editable={EDITABLE.has('emergencyContactPhone')}
                                    editing={editing}
                                    error={errors.emergencyContactPhone}
                                    onChange={v => onChange('emergencyContactPhone', v)}
                                    icon={Phone}
                                />
                                <EditField
                                    label="Emergency Relationship"
                                    value={editing ? draft.emergencyContactRelationship : data.emergencyContactRelationship}
                                    editable={EDITABLE.has('emergencyContactRelationship')}
                                    editing={editing}
                                    onChange={v => onChange('emergencyContactRelationship', v)}
                                    icon={UserCircle}
                                />
                            </Grid>
                        </Section>

                        {/* Password & Security */}
                        <div className="admin-card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <ShieldAlert size={18} style={{ color: 'var(--adm-accent)' }} />
                                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--adm-text)', margin: 0 }}>Password & Security</h2>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: 'var(--adm-text-muted)', marginBottom: '1.1rem', marginTop: '4px' }}>
                                Update your password to keep your administrator account secure.
                            </p>

                            {pwMsg && (
                                <div style={{
                                    marginBottom: '0.9rem', padding: '0.65rem 0.85rem', borderRadius: 10,
                                    background: pwMsg.type === 'success' ? 'rgba(52,211,153,0.10)' : 'rgba(248,113,113,0.10)',
                                    border: `1px solid ${pwMsg.type === 'success' ? 'rgba(52,211,153,0.35)' : 'rgba(248,113,113,0.35)'}`,
                                    color: pwMsg.type === 'success' ? '#10B981' : '#DC2626',
                                    fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                                }}>
                                    {pwMsg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />} {pwMsg.text}
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                                <PwField label="Current Password" v={pwCurrent} setV={setPwCurrent}
                                    show={pwShow.c} toggle={() => setPwShow(s => ({ ...s, c: !s.c }))} />
                                <div /> {/* spacer */}
                                <PwField label="New Password" v={pwNext} setV={setPwNext}
                                    show={pwShow.n} toggle={() => setPwShow(s => ({ ...s, n: !s.n }))} />
                                <PwField
                                    label="Confirm New Password" v={pwConfirm} setV={setPwConfirm}
                                    show={pwShow.r} toggle={() => setPwShow(s => ({ ...s, r: !s.r }))}
                                    state={pwMismatch ? 'error' : pwMatch ? 'ok' : undefined}
                                    hint={pwMismatch ? "Passwords don't match" : pwMatch ? 'Passwords match' : undefined}
                                />
                            </div>

                            {pwNext && (
                                <div style={{ marginTop: '0.9rem' }}>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        {[0, 1, 2, 3].map(i => (
                                            <div key={i} style={{
                                                flex: 1, height: 5, borderRadius: 999,
                                                background: i < strength.score ? strength.color : 'var(--adm-border)',
                                                transition: 'background 180ms ease',
                                            }} />
                                        ))}
                                    </div>
                                    <div style={{ marginTop: 6, fontSize: '0.72rem', color: strength.color, fontWeight: 700, letterSpacing: '0.04em' }}>
                                        {strength.label}
                                    </div>
                                </div>
                            )}

                            <div style={{ marginTop: '1.1rem', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className="admin-btn admin-btn--outline"
                                    onClick={() => { setPwCurrent(''); setPwNext(''); setPwConfirm(''); setPwMsg(null); }}>
                                    Discard
                                </button>
                                <button className="admin-btn admin-btn--primary" onClick={submitPassword} disabled={pwSaving}>
                                    {pwSaving
                                        ? <><Loader size={14} className="su-spin" /> Updating…</>
                                        : <><Lock size={14} /> <span>Update Password</span></>
                                    }
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}

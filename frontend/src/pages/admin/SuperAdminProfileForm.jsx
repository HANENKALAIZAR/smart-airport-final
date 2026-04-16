import { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Upload, FileText, Calendar } from 'lucide-react';
import { apiPatchSuperAdminProfile } from '../../services/adminApi';
import {
    formatTunisiaPhoneInput,
    tunisiaPhoneFieldError,
    isValidTunisiaPhone,
} from '../../utils/tunisiaPhone';
import { validateProfilePhotoFile, validateIdDocumentFile, PHOTO_ACCEPT, ID_DOC_ACCEPT } from '../../utils/uploadValidation';

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const MAX_DOB_STRING = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
})();

function passportErr(s) {
    const t = String(s || '').trim();
    if (t.length < 6) return 'Min. 6 characters';
    if (!/^[A-Za-z]+[0-9][A-Za-z0-9]*$/.test(t)) return 'Letters then digits';
    return '';
}

export default function SuperAdminProfileForm({ profile, onSaved }) {
    const [fullName, setFullName] = useState('');
    const [personalEmail, setPersonalEmail] = useState('');
    const [phoneDraft, setPhoneDraft] = useState('+216 ');
    const [dob, setDob] = useState('');
    const [cinNumber, setCinNumber] = useState('');
    const [passportNumber, setPassportNumber] = useState('');
    const [passportExpiry, setPassportExpiry] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [cinDocUrl, setCinDocUrl] = useState('');
    const [passportDocUrl, setPassportDocUrl] = useState('');
    const [photoErr, setPhotoErr] = useState('');
    const [docErr, setDocErr] = useState('');
    const [formErr, setFormErr] = useState('');
    const [ok, setOk] = useState('');
    const [saving, setSaving] = useState(false);
    const photoRef = useRef(null);
    const cinRef = useRef(null);
    const passRef = useRef(null);

    useEffect(() => {
        if (!profile) return;
        setFullName(profile.full_name || '');
        setPersonalEmail(profile.personal_email || '');
        setPhoneDraft(formatTunisiaPhoneInput(profile.phone_number || '+216 '));
        setDob(profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : '');
        setCinNumber(profile.cin_number || '');
        setPassportNumber(profile.passport_number || '');
        setPassportExpiry(profile.passport_expiry_date ? String(profile.passport_expiry_date).slice(0, 10) : '');
        setPhotoUrl(profile.profile_photo_url || '');
        setCinDocUrl(profile.cin_document_url || '');
        setPassportDocUrl(profile.passport_document_url || '');
        setPhotoErr('');
        setDocErr('');
        setFormErr('');
        setOk('');
    }, [profile?.id]);

    async function onPhotoPick(e) {
        const file = e.target.files?.[0];
        setPhotoErr('');
        if (!file) return;
        const fe = validateProfilePhotoFile(file);
        if (fe) {
            setPhotoErr(fe);
            return;
        }
        setPhotoUrl(await fileToDataUrl(file));
    }

    async function onCinPick(e) {
        const file = e.target.files?.[0];
        setDocErr('');
        if (!file) return;
        const fe = validateIdDocumentFile(file);
        if (fe) {
            setDocErr(fe);
            return;
        }
        setCinDocUrl(await fileToDataUrl(file));
    }

    async function onPassportPick(e) {
        const file = e.target.files?.[0];
        setDocErr('');
        if (!file) return;
        const fe = validateIdDocumentFile(file);
        if (fe) {
            setDocErr(fe);
            return;
        }
        setPassportDocUrl(await fileToDataUrl(file));
    }

    async function saveProfile(e) {
        e.preventDefault();
        setFormErr('');
        setOk('');
        const pe = tunisiaPhoneFieldError(phoneDraft);
        if (pe || !isValidTunisiaPhone(phoneDraft)) {
            setFormErr(pe || 'Please enter a valid Tunisian phone number (+216 2/4/5/9 …).');
            return;
        }
        if (cinNumber && !/^\d{8}$/.test(cinNumber)) {
            setFormErr('CIN must be exactly 8 digits.');
            return;
        }
        const perr = passportNumber ? passportErr(passportNumber) : '';
        if (perr) {
            setFormErr(perr);
            return;
        }
        if (!fullName.trim()) {
            setFormErr('Full name is required.');
            return;
        }

        setSaving(true);
        const payload = {
            full_name: fullName.trim(),
            personal_email: personalEmail.trim() || null,
            phone_number: phoneDraft.replace(/\s/g, ''),
            date_of_birth: dob || null,
            cin_number: cinNumber || null,
            passport_number: passportNumber ? passportNumber.trim().toUpperCase() : null,
            passport_expiry_date: passportExpiry || null,
        };
        if (photoUrl && photoUrl.startsWith('data:')) payload.profile_photo_url = photoUrl;
        if (cinDocUrl && cinDocUrl.startsWith('data:')) payload.cin_document_url = cinDocUrl;
        if (passportDocUrl && passportDocUrl.startsWith('data:')) payload.passport_document_url = passportDocUrl;
        const { error } = await apiPatchSuperAdminProfile(payload);
        setSaving(false);
        if (error) {
            setFormErr(error);
            return;
        }
        setOk('Profile saved.');
        onSaved?.();
        setTimeout(() => setOk(''), 4000);
    }

    const labelStyle = {
        display: 'block',
        fontSize: '0.78rem',
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 6,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    };

    return (
        <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                Edit your personal information. Changes are saved to your account immediately.
            </p>
            {formErr && (
                <div
                    style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#FCA5A5',
                        fontSize: '0.84rem',
                    }}
                >
                    {formErr}
                </div>
            )}
            {ok && (
                <div
                    style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'rgba(34,197,94,0.12)',
                        border: '1px solid rgba(34,197,94,0.25)',
                        color: '#86EFAC',
                        fontSize: '0.84rem',
                    }}
                >
                    {ok}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
                {photoUrl ? (
                    <img
                        src={photoUrl}
                        alt=""
                        style={{
                            width: 96,
                            height: 96,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid rgba(14,165,233,0.4)',
                        }}
                    />
                ) : (
                    <div
                        style={{
                            width: 96,
                            height: 96,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: '#94A3B8',
                        }}
                    >
                        {(fullName || '?')
                            .split(/\s+/)
                            .map((w) => w[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                    </div>
                )}
                <input ref={photoRef} type="file" accept={PHOTO_ACCEPT} style={{ display: 'none' }} onChange={onPhotoPick} />
                <button
                    type="button"
                    className="admin-btn admin-btn--outline"
                    style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}
                    onClick={() => photoRef.current?.click()}
                >
                    <ImageIcon size={14} /> Upload profile photo
                </button>
                {photoErr && <p style={{ marginTop: 8, fontSize: '0.75rem', color: '#f87171' }}>{photoErr}</p>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Full name</label>
                    <input className="admin-form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Personal email (recovery)</label>
                    <input className="admin-form-input" type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} required />
                </div>
                <div>
                    <label style={labelStyle}>Work email</label>
                    <div
                        style={{
                            padding: '10px 14px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: 8,
                            fontSize: '0.9rem',
                            color: 'rgba(255,255,255,0.45)',
                        }}
                    >
                        {profile?.email}
                    </div>
                </div>
                <div>
                    <label style={labelStyle}>Phone number</label>
                    <input
                        className="admin-form-input"
                        value={phoneDraft}
                        onChange={(e) => setPhoneDraft(formatTunisiaPhoneInput(e.target.value))}
                    />
                </div>
                <div>
                    <label style={labelStyle}>Date of birth</label>
                    <div style={{ position: 'relative' }}>
                        <Calendar
                            size={16}
                            style={{
                                position: 'absolute',
                                left: 12,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'rgba(255,255,255,0.3)',
                                pointerEvents: 'none',
                            }}
                        />
                        <input
                            type="date"
                            className="admin-form-input"
                            style={{ paddingLeft: 36, colorScheme: 'dark' }}
                            max={MAX_DOB_STRING}
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                        />
                    </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>CIN number</label>
                    <input
                        className="admin-form-input"
                        style={{ fontFamily: 'monospace' }}
                        value={cinNumber}
                        maxLength={8}
                        onChange={(e) => setCinNumber(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder="12345678"
                    />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Passport number</label>
                    <input
                        className="admin-form-input"
                        style={{ fontFamily: 'monospace' }}
                        value={passportNumber}
                        onChange={(e) => setPassportNumber(e.target.value)}
                        placeholder="AB123456"
                    />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Passport expiry</label>
                    <input
                        type="date"
                        className="admin-form-input"
                        style={{ colorScheme: 'dark' }}
                        value={passportExpiry}
                        onChange={(e) => setPassportExpiry(e.target.value)}
                    />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>CIN document</label>
                    <input ref={cinRef} type="file" accept={ID_DOC_ACCEPT} style={{ display: 'none' }} onChange={onCinPick} />
                    <button
                        type="button"
                        className="admin-btn admin-btn--outline"
                        onClick={() => cinRef.current?.click()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                        <Upload size={16} /> Upload CIN (JPG, PNG, PDF)
                    </button>
                    {docErr && <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#f87171' }}>{docErr}</p>}
                    {cinDocUrl && String(cinDocUrl).startsWith('data:application/pdf') ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: '#93c5fd' }}>
                            <FileText size={24} /> PDF attached
                        </div>
                    ) : cinDocUrl ? (
                        <img
                            src={cinDocUrl}
                            alt=""
                            style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, marginTop: 10 }}
                        />
                    ) : null}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Passport document</label>
                    <input ref={passRef} type="file" accept={ID_DOC_ACCEPT} style={{ display: 'none' }} onChange={onPassportPick} />
                    <button
                        type="button"
                        className="admin-btn admin-btn--outline"
                        onClick={() => passRef.current?.click()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                        <Upload size={16} /> Upload passport (JPG, PNG, PDF)
                    </button>
                    {passportDocUrl && String(passportDocUrl).startsWith('data:application/pdf') ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: '#93c5fd' }}>
                            <FileText size={24} /> PDF attached
                        </div>
                    ) : passportDocUrl ? (
                        <img
                            src={passportDocUrl}
                            alt=""
                            style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, marginTop: 10 }}
                        />
                    ) : null}
                </div>
            </div>

            <button type="submit" className="admin-btn admin-btn--primary" disabled={saving} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                {saving ? 'Saving…' : 'Save profile'}
            </button>
        </form>
    );
}

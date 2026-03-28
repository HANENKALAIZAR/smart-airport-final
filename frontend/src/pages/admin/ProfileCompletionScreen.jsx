/**
 * ProfileCompletionScreen — Phase 3
 * ===================================
 * Shown after password change when profile_complete=false.
 * Admin fills in profile details (photo, phone, DOB, ID).
 * Full-page, non-skippable. Step 2 of 2.
 */
import { useState, useRef, createElement } from 'react';
import { Camera, Phone, Calendar, CreditCard, Upload, CheckCircle, AlertCircle, Loader, User, FileText } from 'lucide-react';
import { apiCompleteProfile } from '../../services/adminApi';
import {
  formatTunisiaPhoneInput,
  tunisiaPhoneFieldError,
  isValidTunisiaPhone,
} from '../../utils/tunisiaPhone';
import {
  validateIdDocumentFile,
  validateProfilePhotoFile,
  ID_DOC_ACCEPT,
  PHOTO_ACCEPT,
} from '../../utils/uploadValidation';

/** Max date-of-birth (18+); computed once at module load to avoid impure Date.now() in render. */
const MAX_DOB_STRING = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
})();

/* ── Password strength util ── */
function ProgressStep({ step, current }) {
    const done = current > step;
    const active = current === step;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700,
                background: done ? '#22c55e' : active ? '#1E90FF' : 'rgba(255,255,255,0.1)',
                color: done || active ? '#fff' : 'rgba(255,255,255,0.3)',
                border: `2px solid ${done ? '#22c55e' : active ? '#1E90FF' : 'rgba(255,255,255,0.1)'}`,
                transition: 'all 0.3s ease',
            }}>
                {done ? <CheckCircle size={14} /> : step}
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: active ? 700 : 400, color: active ? '#fff' : done ? '#4ade80' : 'rgba(255,255,255,0.35)' }}>
                {step === 1 ? 'Change Password' : 'Complete Profile'}
            </span>
        </div>
    );
}

function FileUploadField({ label, icon, value, onChange, accept, hint, error }) {
    const ref = useRef();
    const isPdf = value && String(value).startsWith('data:application/pdf');
    const borderBad = error ? 'rgba(239,68,68,0.45)' : undefined;
    return (
        <div>
            <label style={labelStyle}>{label}</label>
            <div
                onClick={() => ref.current.click()}
                style={{
                    marginTop: 8, border: `2px dashed ${borderBad || 'rgba(30,144,255,0.3)'}`, borderRadius: 12,
                    padding: '16px', cursor: 'pointer', textAlign: 'center',
                    background: value ? 'rgba(30,144,255,0.05)' : 'rgba(255,255,255,0.02)',
                    transition: 'border-color 0.2s, background 0.2s',
                    position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => { if (!error) e.currentTarget.style.borderColor = 'rgba(30,144,255,0.6)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = borderBad || (value ? 'rgba(30,144,255,0.4)' : 'rgba(30,144,255,0.3)'); }}
            >
                <input ref={ref} type="file" accept={accept} style={{ display: 'none' }} onChange={onChange} />
                {value ? (
                    <div>
                        {isPdf ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                <FileText size={36} color="#60a5fa" />
                                <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#93c5fd' }}>PDF ready</p>
                            </div>
                        ) : (
                            <img src={value} alt="preview" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 8, objectFit: 'cover' }} />
                        )}
                        <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#60a5fa' }}>Click to change</p>
                    </div>
                ) : (
                    <div style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {createElement(icon, { size: 28, style: { marginBottom: 8 } })}
                        <p style={{ margin: 0, fontSize: '0.82rem' }}>Click to upload</p>
                        {hint && <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)' }}>{hint}</p>}
                    </div>
                )}
            </div>
            {error && <ErrMsg msg={error} />}
        </div>
    );
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function ProfileCompletionScreen({ user, onComplete }) {
    const [form, setForm] = useState({
        phone: '+216 ', dob: '', idType: 'CIN', idNumber: '',
        photoUrl: '', docUrl: '',
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [apiError, setApiError] = useState('');
    const [success, setSuccess] = useState(false);

    const firstName = user?.full_name?.split(' ')[0] || 'Admin';

    /* ── File handlers ── */
    async function handlePhotoChange(e) {
        const file = e.target.files[0];
        if (!file) return;
        const fe = validateProfilePhotoFile(file);
        if (fe) {
            setErrors(er => ({ ...er, photoUrl: fe }));
            return;
        }
        const url = await fileToDataUrl(file);
        setForm(f => ({ ...f, photoUrl: url }));
        setErrors(er => ({ ...er, photoUrl: '' }));
    }

    async function handleDocChange(e) {
        const file = e.target.files[0];
        if (!file) return;
        const fe = validateIdDocumentFile(file);
        if (fe) {
            setErrors(er => ({ ...er, docUrl: fe }));
            return;
        }
        const url = await fileToDataUrl(file);
        setForm(f => ({ ...f, docUrl: url }));
        setErrors(er => ({ ...er, docUrl: '' }));
    }

    /* ── Validation ── */
    function validate() {
        const errs = {};
        if (!form.photoUrl) errs.photoUrl = 'Profile photo is required';
        if (!isValidTunisiaPhone(form.phone)) {
            errs.phone =
                tunisiaPhoneFieldError(form.phone) ||
                'Please enter a valid Tunisian phone number (e.g. +216 9X XXX XXX)';
        }
        if (!form.dob) errs.dob = 'Date of birth is required';
        else {
            const age = (Date.now() - new Date(form.dob)) / (1000 * 60 * 60 * 24 * 365);
            if (age < 18) errs.dob = 'Must be at least 18 years old';
        }
        if (form.idType === 'CIN' && !form.idNumber.match(/^\d{8}$/)) errs.idNumber = 'CIN must be exactly 8 digits';
        if (form.idType === 'Passport' && !form.idNumber.match(/^[A-Z0-9]{8,9}$/i)) errs.idNumber = 'Passport must be 8-9 alphanumeric characters';
        if (!form.docUrl) errs.docUrl = 'ID document scan is required';
        return errs;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setSubmitting(true);
        setApiError('');
        const { error } = await apiCompleteProfile({
            phone_number: form.phone.replace(/\s/g, ''),
            date_of_birth: form.dob,
            id_type: form.idType,
            id_number: form.idNumber.toUpperCase(),
            id_document_url: form.docUrl,
            profile_photo_url: form.photoUrl,
        });
        setSubmitting(false);

        if (error) { setApiError(error); return; }
        setSuccess(true);
        setTimeout(() => onComplete(), 1500);
    }

    return (
        <div style={{
            minHeight: '100vh', background: '#0F172A',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-start', padding: '40px 16px 60px',
        }}>
            {/* Progress indicator */}
            <p style={{ margin: '0 0 12px', fontSize: '0.8rem', fontWeight: 600, color: '#1E90FF', letterSpacing: '0.04em' }}>
                Step 2 of 2 — Complete Your Profile
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 36 }}>
                <ProgressStep step={1} current={2} />
                <div style={{ width: 40, height: 2, background: 'rgba(34,197,94,0.5)', borderRadius: 1 }} />
                <ProgressStep step={2} current={2} />
            </div>

            <div style={{
                width: '100%', maxWidth: 560,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20, overflow: 'hidden',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #1E90FF22)', padding: '28px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(30,144,255,0.15)', border: '2px solid rgba(30,144,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                        <User size={24} color="#60a5fa" />
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Complete Your Profile</h1>
                    <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
                        Welcome, {firstName}! Please complete your profile to access the dashboard.
                    </p>
                </div>

                {success ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#4ade80' }}>
                        <CheckCircle size={48} style={{ marginBottom: 12 }} />
                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Profile complete!</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: 6 }}>Redirecting to dashboard…</div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>
                        {apiError && (
                            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: '0.84rem' }}>
                                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /><span>{apiError}</span>
                            </div>
                        )}

                        {/* Profile Photo */}
                        <FileUploadField
                            label="Profile Photo *"
                            icon={Camera}
                            value={form.photoUrl}
                            onChange={handlePhotoChange}
                            accept={PHOTO_ACCEPT}
                            hint="JPG or PNG only — max 2MB"
                            error={errors.photoUrl}
                        />

                        {/* Phone */}
                        <div>
                            <label style={labelStyle}>Phone Number *</label>
                            <div style={{ marginTop: 8, position: 'relative' }}>
                                <Phone size={16} style={iconStyle} />
                                <input
                                    className="admin-form-input"
                                    style={{ paddingLeft: 36, borderColor: errors.phone ? 'rgba(239,68,68,0.5)' : undefined }}
                                    placeholder="+216 XX XXX XXX"
                                    value={form.phone}
                                    onChange={e => {
                                        const v = formatTunisiaPhoneInput(e.target.value);
                                        setForm(f => ({ ...f, phone: v }));
                                        setErrors(er => ({ ...er, phone: '' }));
                                    }}
                                    required
                                />
                            </div>
                            {errors.phone && <ErrMsg msg={errors.phone} />}
                        </div>

                        {/* Date of Birth */}
                        <div>
                            <label style={labelStyle}>Date of Birth *</label>
                            <div style={{ marginTop: 8, position: 'relative' }}>
                                <Calendar size={16} style={iconStyle} />
                                <input
                                    type="date"
                                    className="admin-form-input"
                                    style={{ paddingLeft: 36, colorScheme: 'dark', borderColor: errors.dob ? 'rgba(239,68,68,0.5)' : undefined }}
                                    max={MAX_DOB_STRING}
                                    value={form.dob}
                                    onChange={e => { setForm(f => ({ ...f, dob: e.target.value })); setErrors(er => ({ ...er, dob: '' })); }}
                                    required
                                />
                            </div>
                            {errors.dob && <ErrMsg msg={errors.dob} />}
                        </div>

                        {/* ID Type */}
                        <div>
                            <label style={labelStyle}>ID Type *</label>
                            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                                {['CIN', 'Passport'].map(t => (
                                    <label key={t} style={{
                                        flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                                        background: form.idType === t ? 'rgba(30,144,255,0.12)' : 'rgba(255,255,255,0.03)',
                                        border: `1.5px solid ${form.idType === t ? 'rgba(30,144,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
                                        transition: 'all 0.2s',
                                    }}>
                                        <input type="radio" name="idType" value={t} checked={form.idType === t}
                                            onChange={() => { setForm(f => ({ ...f, idType: t, idNumber: '' })); setErrors(er => ({ ...er, idNumber: '' })); }}
                                            style={{ accentColor: '#1E90FF' }} />
                                        <CreditCard size={16} color={form.idType === t ? '#60a5fa' : 'rgba(255,255,255,0.4)'} />
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: form.idType === t ? '#93c5fd' : 'rgba(255,255,255,0.5)' }}>{t}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* ID Number */}
                        <div>
                            <label style={labelStyle}>{form.idType} Number *</label>
                            <div style={{ marginTop: 8, position: 'relative' }}>
                                <CreditCard size={16} style={iconStyle} />
                                <input
                                    className="admin-form-input"
                                    style={{ paddingLeft: 36, fontFamily: 'monospace', letterSpacing: '0.08em', borderColor: errors.idNumber ? 'rgba(239,68,68,0.5)' : undefined }}
                                    placeholder={form.idType === 'CIN' ? '12345678 (8 digits)' : 'AB1234567'}
                                    value={form.idNumber}
                                    onChange={e => { setForm(f => ({ ...f, idNumber: e.target.value })); setErrors(er => ({ ...er, idNumber: '' })); }}
                                    required
                                />
                            </div>
                            {errors.idNumber && <ErrMsg msg={errors.idNumber} />}
                        </div>

                        {/* ID Document Upload */}
                        <FileUploadField
                            label={`${form.idType} Document Scan *`}
                            icon={Upload}
                            value={form.docUrl}
                            onChange={handleDocChange}
                            accept={ID_DOC_ACCEPT}
                            hint="JPG, PNG or PDF — max 5MB"
                            error={errors.docUrl}
                        />

                        <button
                            type="submit"
                            className="admin-btn admin-btn--primary"
                            disabled={submitting}
                            style={{ marginTop: 8, height: 48, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                            {submitting ? <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</> : '✅ Complete Profile & Enter Dashboard'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

function ErrMsg({ msg }) {
    return <p style={{ margin: '5px 0 0', fontSize: '0.75rem', color: '#f87171' }}>✗ {msg}</p>;
}

const labelStyle = { fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' };
const iconStyle = { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' };

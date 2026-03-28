import { useState, useEffect, useRef } from 'react';
import { User, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Pencil, Image as ImageIcon, ExternalLink, CreditCard, Upload, FileText, Bell } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { apiChangePassword, apiGetMe, apiPatchSettings, apiSubmitCorrectionRequest, apiResubmitIdProfile } from '../../services/adminApi';
import {
    formatTunisiaPhoneInput,
    tunisiaPhoneFieldError,
    isValidTunisiaPhone,
} from '../../utils/tunisiaPhone';
import { validateProfilePhotoFile, validateIdDocumentFile, PHOTO_ACCEPT, ID_DOC_ACCEPT } from '../../utils/uploadValidation';

function maskIdNumber(raw) {
    if (!raw) return '—';
    const s = String(raw);
    if (s.length <= 4) return '••••';
    return `${'•'.repeat(Math.min(12, s.length - 4))}${s.slice(-4)}`;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function AdminSettings() {
    const { t } = useLanguage();

    const [profile, setProfile] = useState(null);
    const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
    const [pwdVisible, setPwdVisible] = useState({ current: false, next: false });
    const [pwdSaved, setPwdSaved] = useState(false);
    const [pwdError, setPwdError] = useState('');
    const [pwdLoading, setPwdLoading] = useState(false);

    const [idReveal, setIdReveal] = useState(false);
    const [docModalOpen, setDocModalOpen] = useState(false);
    const [editPhone, setEditPhone] = useState(false);
    const [phoneDraft, setPhoneDraft] = useState('+216 ');
    const [phoneErr, setPhoneErr] = useState('');
    const [phoneSaving, setPhoneSaving] = useState(false);

    const photoRef = useRef();
    const [photoErr, setPhotoErr] = useState('');
    const [photoSaving, setPhotoSaving] = useState(false);

    const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
    const [correctionReason, setCorrectionReason] = useState('');
    const [correctionErr, setCorrectionErr] = useState('');
    const [correctionOk, setCorrectionOk] = useState('');
    const [correctionBusy, setCorrectionBusy] = useState(false);

    const [unlockIdType, setUnlockIdType] = useState('CIN');
    const [unlockIdNumber, setUnlockIdNumber] = useState('');
    const [unlockDocUrl, setUnlockDocUrl] = useState('');
    const [unlockFieldErr, setUnlockFieldErr] = useState({});
    const [unlockSaving, setUnlockSaving] = useState(false);
    const idDocInputRef = useRef();

    async function refreshProfile() {
        const { data } = await apiGetMe();
        if (data) setProfile(data);
    }

    useEffect(() => {
        refreshProfile();
    }, []);

    useEffect(() => {
        if (profile?.phone_number) {
            setPhoneDraft(formatTunisiaPhoneInput(profile.phone_number));
        } else {
            setPhoneDraft('+216 ');
        }
    }, [profile?.phone_number, editPhone]);

    useEffect(() => {
        if (profile?.id_fields_unlocked) {
            setUnlockIdType(profile.id_type || 'CIN');
            setUnlockIdNumber(profile.id_number || '');
            setUnlockDocUrl(profile.id_document_url || '');
            setUnlockFieldErr({});
        }
    }, [
        profile?.id_fields_unlocked,
        profile?.id_type,
        profile?.id_number,
        profile?.id_document_url,
    ]);

    async function submitCorrectionRequest() {
        setCorrectionErr('');
        setCorrectionOk('');
        const r = correctionReason.trim();
        if (!r) {
            setCorrectionErr('Please describe what needs to be corrected.');
            return;
        }
        setCorrectionBusy(true);
        const { data, error } = await apiSubmitCorrectionRequest(r);
        setCorrectionBusy(false);
        if (error) {
            setCorrectionErr(error);
            return;
        }
        setCorrectionOk(data?.message || 'Your correction request has been submitted. Please wait for the Super Admin to review it.');
        setCorrectionModalOpen(false);
        setCorrectionReason('');
        await refreshProfile();
    }

    async function onUnlockDocPick(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const fe = validateIdDocumentFile(file);
        if (fe) {
            setUnlockFieldErr((er) => ({ ...er, doc: fe }));
            return;
        }
        const url = await fileToDataUrl(file);
        setUnlockDocUrl(url);
        setUnlockFieldErr((er) => ({ ...er, doc: '' }));
    }

    async function saveUnlockedIdProfile() {
        setUnlockFieldErr({});
        const errs = {};
        if (!unlockDocUrl) errs.doc = 'ID document is required';
        if (unlockIdType === 'CIN' && !/^\d{8}$/.test(unlockIdNumber)) {
            errs.id = 'CIN must be exactly 8 digits';
        }
        if (unlockIdType === 'Passport' && !/^[A-Z0-9]{8,9}$/i.test(unlockIdNumber)) {
            errs.id = 'Passport must be 8-9 alphanumeric characters';
        }
        if (Object.keys(errs).length) {
            setUnlockFieldErr(errs);
            return;
        }
        setUnlockSaving(true);
        const { error } = await apiResubmitIdProfile({
            id_type: unlockIdType,
            id_number: unlockIdType === 'Passport' ? unlockIdNumber.toUpperCase() : unlockIdNumber,
            id_document_url: unlockDocUrl,
        });
        setUnlockSaving(false);
        if (error) {
            setUnlockFieldErr({ form: error });
            return;
        }
        await refreshProfile();
    }

    async function handlePasswordSave(e) {
        e.preventDefault();
        setPwdError('');
        if (!pwdForm.current || !pwdForm.next || !pwdForm.confirm) {
            setPwdError('All fields are required.');
            return;
        }
        if (pwdForm.next !== pwdForm.confirm) {
            setPwdError('New passwords do not match.');
            return;
        }
        if (pwdForm.next.length < 8) {
            setPwdError('New password must be at least 8 characters.');
            return;
        }
        if (pwdForm.next === pwdForm.current) {
            setPwdError('New password must be different from the current one.');
            return;
        }

        setPwdLoading(true);
        const { error } = await apiChangePassword(pwdForm.current, pwdForm.next);
        setPwdLoading(false);

        if (error) {
            setPwdError(error);
            return;
        }
        setPwdForm({ current: '', next: '', confirm: '' });
        setPwdSaved(true);
        setTimeout(() => setPwdSaved(false), 4000);
    }

    async function savePhone() {
        setPhoneErr('');
        const e = tunisiaPhoneFieldError(phoneDraft);
        if (e || !isValidTunisiaPhone(phoneDraft)) {
            setPhoneErr(e || 'Please enter a valid Tunisian phone number (e.g. +216 9X XXX XXX)');
            return;
        }
        setPhoneSaving(true);
        const { error } = await apiPatchSettings({
            phone_number: phoneDraft.replace(/\s/g, ''),
        });
        setPhoneSaving(false);
        if (error) {
            setPhoneErr(error);
            return;
        }
        setEditPhone(false);
        await refreshProfile();
    }

    async function onPhotoPick(e) {
        const file = e.target.files?.[0];
        setPhotoErr('');
        if (!file) return;
        const fe = validateProfilePhotoFile(file);
        if (fe) {
            setPhotoErr(fe);
            return;
        }
        const url = await fileToDataUrl(file);
        setPhotoSaving(true);
        const { error } = await apiPatchSettings({ profile_photo_url: url });
        setPhotoSaving(false);
        if (error) {
            setPhotoErr(error);
            return;
        }
        await refreshProfile();
    }

    const [settings, setSettings] = useState({
        notifications: true,
        emailAlerts: true,
        autoRefresh: true,
        refreshInterval: '30',
        language: 'en',
        timezone: 'Africa/Tunis',
        theme: 'dark',
        delayThreshold: '15',
        highRiskThreshold: '30',
        dataRetention: '90',
    });
    function update(key, value) {
        setSettings((prev) => ({ ...prev, [key]: value }));
    }

    const tunisianAirportAdmin = profile?.role === 'admin';
    const idEditable = tunisianAirportAdmin && !!profile?.id_fields_unlocked;
    const docUrl = idEditable ? unlockDocUrl : profile?.id_document_url;
    const isPdfDoc = docUrl && String(docUrl).startsWith('data:application/pdf');

    return (
        <div className="admin-space-y-6">
            <div className="admin-page-header">
                <h1>{t('admin_settings_title')}</h1>
                <p>{t('admin_settings_subtitle')}</p>
            </div>

            {/* ── Account Info ── */}
            <div className="admin-card">
                <h3
                    style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <User size={18} style={{ color: '#0EA5E9' }} /> Account Information
                </h3>
                {profile ? (
                    <div>
                        {correctionOk && (
                            <div
                                style={{
                                    marginBottom: 16,
                                    padding: 12,
                                    borderRadius: 8,
                                    background: 'rgba(34,197,94,0.12)',
                                    border: '1px solid rgba(34,197,94,0.25)',
                                    color: '#86EFAC',
                                    fontSize: '0.88rem',
                                }}
                            >
                                {correctionOk}
                            </div>
                        )}
                        {tunisianAirportAdmin && !!profile.id_fields_unlocked && (
                            <div
                                style={{
                                    marginBottom: 16,
                                    padding: 12,
                                    borderRadius: 8,
                                    background: 'rgba(30,144,255,0.12)',
                                    border: '1px solid rgba(30,144,255,0.25)',
                                    color: '#93c5fd',
                                    fontSize: '0.88rem',
                                }}
                            >
                                Your ID information has been unlocked. Please update and resubmit.
                            </div>
                        )}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                marginBottom: '1.5rem',
                            }}
                        >
                            <div style={{ position: 'relative' }}>
                                {profile.profile_photo_url ? (
                                    <img
                                        src={profile.profile_photo_url}
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
                                        {(profile.full_name || '?')
                                            .split(' ')
                                            .map((w) => w[0])
                                            .join('')
                                            .slice(0, 2)
                                            .toUpperCase()}
                                    </div>
                                )}
                                {tunisianAirportAdmin && (
                                    <>
                                        <input
                                            ref={photoRef}
                                            type="file"
                                            accept={PHOTO_ACCEPT}
                                            style={{ display: 'none' }}
                                            onChange={onPhotoPick}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => photoRef.current?.click()}
                                            disabled={photoSaving}
                                            className="admin-btn admin-btn--outline"
                                            style={{
                                                marginTop: 12,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                fontSize: '0.8rem',
                                            }}
                                        >
                                            <ImageIcon size={14} />{' '}
                                            {photoSaving ? 'Uploading…' : 'Change photo'}
                                        </button>
                                        {photoErr && (
                                            <p style={{ marginTop: 8, fontSize: '0.75rem', color: '#f87171' }}>
                                                {photoErr}
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '1rem',
                            }}
                        >
                            {[
                                { label: 'Full Name', value: profile.full_name },
                                { label: 'Email', value: profile.email },
                                {
                                    label: 'Role',
                                    value:
                                        profile.role === 'super_admin'
                                            ? '⭐ Super Admin'
                                            : '🛡 Airport Admin',
                                },
                                { label: 'Airport', value: profile.airport_iata || 'All airports' },
                            ].map(({ label, value }) => (
                                <div key={label}>
                                    <label
                                        style={{
                                            display: 'block',
                                            fontSize: '0.8rem',
                                            color: 'rgba(255,255,255,0.5)',
                                            marginBottom: 6,
                                        }}
                                    >
                                        {label}
                                    </label>
                                    <div
                                        style={{
                                            padding: '10px 14px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: 8,
                                            fontSize: '0.9rem',
                                            color: '#E2E8F0',
                                        }}
                                    >
                                        {value}
                                    </div>
                                </div>
                            ))}

                            {/* Phone — editable for airport admin */}
                            <div style={{ gridColumn: tunisianAirportAdmin ? 'span 1' : 'span 2' }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    Phone number
                                </label>
                                {tunisianAirportAdmin && editPhone ? (
                                    <div>
                                        <input
                                            className="admin-form-input"
                                            value={phoneDraft}
                                            onChange={(e) => {
                                                setPhoneDraft(formatTunisiaPhoneInput(e.target.value));
                                                setPhoneErr('');
                                            }}
                                            style={{
                                                borderColor: phoneErr
                                                    ? 'rgba(239,68,68,0.5)'
                                                    : undefined,
                                            }}
                                        />
                                        {phoneErr && (
                                            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#f87171' }}>
                                                {phoneErr}
                                            </p>
                                        )}
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn--primary"
                                                onClick={savePhone}
                                                disabled={phoneSaving}
                                            >
                                                {phoneSaving ? 'Saving…' : 'Save'}
                                            </button>
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn--outline"
                                                onClick={() => {
                                                    setEditPhone(false);
                                                    setPhoneErr('');
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '10px 14px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: 8,
                                        }}
                                    >
                                        <span style={{ flex: 1, color: '#E2E8F0' }}>
                                            {formatTunisiaPhoneInput(profile.phone_number || '+216 ')}
                                        </span>
                                        {tunisianAirportAdmin && (
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn--outline"
                                                style={{
                                                    padding: '6px 10px',
                                                    fontSize: '0.78rem',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                }}
                                                onClick={() => setEditPhone(true)}
                                            >
                                                <Pencil size={13} /> Edit
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    Date of birth
                                </label>
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: 8,
                                        fontSize: '0.9rem',
                                        color: '#E2E8F0',
                                    }}
                                >
                                    {profile.date_of_birth
                                        ? String(profile.date_of_birth).slice(0, 10)
                                        : '—'}
                                </div>
                                {tunisianAirportAdmin && (
                                    <p
                                        style={{
                                            margin: '6px 0 0',
                                            fontSize: '0.72rem',
                                            color: 'rgba(255,255,255,0.35)',
                                        }}
                                    >
                                        Read-only — contact a Super Admin to change.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    ID type
                                </label>
                                {idEditable ? (
                                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                                        {['CIN', 'Passport'].map((tp) => (
                                            <label
                                                key={tp}
                                                style={{
                                                    flex: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    padding: '10px 12px',
                                                    borderRadius: 8,
                                                    cursor: 'pointer',
                                                    background:
                                                        unlockIdType === tp
                                                            ? 'rgba(30,144,255,0.12)'
                                                            : 'rgba(255,255,255,0.03)',
                                                    border: `1px solid ${
                                                        unlockIdType === tp
                                                            ? 'rgba(30,144,255,0.4)'
                                                            : 'rgba(255,255,255,0.08)'
                                                    }`,
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="unlockIdType"
                                                    checked={unlockIdType === tp}
                                                    onChange={() => {
                                                        setUnlockIdType(tp);
                                                        setUnlockIdNumber('');
                                                        setUnlockFieldErr((e) => ({ ...e, id: '' }));
                                                    }}
                                                />
                                                <CreditCard size={14} color="#93c5fd" />
                                                <span style={{ fontSize: '0.88rem' }}>{tp}</span>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            padding: '10px 14px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: 8,
                                            fontSize: '0.9rem',
                                            color: '#E2E8F0',
                                        }}
                                    >
                                        {profile.id_type === 'Passport'
                                            ? 'Passport'
                                            : profile.id_type === 'CIN'
                                              ? 'CIN'
                                              : '—'}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    ID number
                                </label>
                                {idEditable ? (
                                    <div>
                                        <input
                                            className="admin-form-input"
                                            style={{ fontFamily: 'monospace' }}
                                            value={unlockIdNumber}
                                            onChange={(e) => {
                                                setUnlockIdNumber(e.target.value);
                                                setUnlockFieldErr((er) => ({ ...er, id: '' }));
                                            }}
                                            placeholder={
                                                unlockIdType === 'CIN' ? '12345678' : 'Passport number'
                                            }
                                        />
                                        {unlockFieldErr.id && (
                                            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#f87171' }}>
                                                {unlockFieldErr.id}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '10px 14px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: 8,
                                            fontSize: '0.9rem',
                                            color: '#E2E8F0',
                                            fontFamily: 'monospace',
                                        }}
                                    >
                                        <span style={{ flex: 1 }}>
                                            {idReveal
                                                ? profile.id_number || '—'
                                                : maskIdNumber(profile.id_number)}
                                        </span>
                                        {profile.id_number ? (
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn--outline"
                                                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                                onClick={() => setIdReveal((v) => !v)}
                                            >
                                                {idReveal ? (
                                                    <>
                                                        <EyeOff size={12} /> Hide
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye size={12} /> Reveal
                                                    </>
                                                )}
                                            </button>
                                        ) : null}
                                    </div>
                                )}
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    ID document
                                </label>
                                {idEditable ? (
                                    <div>
                                        <input
                                            ref={idDocInputRef}
                                            type="file"
                                            accept={ID_DOC_ACCEPT}
                                            style={{ display: 'none' }}
                                            onChange={onUnlockDocPick}
                                        />
                                        <button
                                            type="button"
                                            className="admin-btn admin-btn--outline"
                                            onClick={() => idDocInputRef.current?.click()}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                                        >
                                            <Upload size={16} /> Upload ID (JPG, PNG, PDF max 5MB)
                                        </button>
                                        {unlockFieldErr.doc && (
                                            <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#f87171' }}>
                                                {unlockFieldErr.doc}
                                            </p>
                                        )}
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 14,
                                                flexWrap: 'wrap',
                                                marginTop: 10,
                                            }}
                                        >
                                            {docUrl && !isPdfDoc ? (
                                                <img
                                                    src={docUrl}
                                                    alt="ID thumb"
                                                    style={{
                                                        width: 72,
                                                        height: 72,
                                                        objectFit: 'cover',
                                                        borderRadius: 8,
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                    }}
                                                />
                                            ) : docUrl && isPdfDoc ? (
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        color: '#93c5fd',
                                                    }}
                                                >
                                                    <FileText size={28} /> PDF selected
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 14,
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            {docUrl && !isPdfDoc ? (
                                                <img
                                                    src={docUrl}
                                                    alt="ID thumb"
                                                    style={{
                                                        width: 72,
                                                        height: 72,
                                                        objectFit: 'cover',
                                                        borderRadius: 8,
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                    }}
                                                />
                                            ) : docUrl && isPdfDoc ? (
                                                <div
                                                    style={{
                                                        width: 72,
                                                        height: 72,
                                                        borderRadius: 8,
                                                        background: 'rgba(239,68,68,0.12)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.7rem',
                                                        color: '#FCA5A5',
                                                    }}
                                                >
                                                    PDF
                                                </div>
                                            ) : (
                                                <span style={{ color: 'rgba(255,255,255,0.35)' }}>—</span>
                                            )}
                                            {docUrl ? (
                                                <button
                                                    type="button"
                                                    className="admin-btn admin-btn--outline"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                                    onClick={() => setDocModalOpen(true)}
                                                >
                                                    <ExternalLink size={14} /> View
                                                </button>
                                            ) : null}
                                        </div>
                                        {tunisianAirportAdmin && (
                                            <p
                                                style={{
                                                    margin: '6px 0 0',
                                                    fontSize: '0.72rem',
                                                    color: 'rgba(255,255,255,0.35)',
                                                }}
                                            >
                                                Read-only — contact a Super Admin to replace your ID scan.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            {tunisianAirportAdmin && profile.profile_complete && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    {profile.correction_request_pending ? (
                                        <div
                                            style={{
                                                padding: '10px 14px',
                                                borderRadius: 8,
                                                background: 'rgba(245,158,11,0.1)',
                                                border: '1px solid rgba(245,158,11,0.3)',
                                                color: '#FCD34D',
                                                fontSize: '0.88rem',
                                            }}
                                        >
                                            🟡 Correction Pending
                                        </div>
                                    ) : profile.id_fields_unlocked ? (
                                        <>
                                            {unlockFieldErr.form && (
                                                <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: 8 }}>
                                                    {unlockFieldErr.form}
                                                </p>
                                            )}
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn--primary"
                                                disabled={unlockSaving}
                                                onClick={saveUnlockedIdProfile}
                                            >
                                                {unlockSaving ? 'Saving…' : 'Save & Resubmit'}
                                            </button>
                                        </>
                                    ) : profile.id_document_status &&
                                      profile.id_document_status !== 'pending' ? (
                                        <button
                                            type="button"
                                            className="admin-btn admin-btn--outline"
                                            onClick={() => {
                                                setCorrectionModalOpen(true);
                                                setCorrectionErr('');
                                            }}
                                        >
                                            Request Correction
                                        </button>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                        Loading profile…
                    </div>
                )}
            </div>

            {correctionModalOpen && (
                <div
                    className="admin-modal-backdrop"
                    onClick={() => !correctionBusy && setCorrectionModalOpen(false)}
                    style={{ zIndex: 10000 }}
                >
                    <div
                        className="admin-modal"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: 440, width: '92vw' }}
                    >
                        <div className="admin-modal__header">
                            <h2 style={{ margin: 0 }}>Request ID correction</h2>
                            <button
                                type="button"
                                className="admin-modal__close"
                                disabled={correctionBusy}
                                onClick={() => setCorrectionModalOpen(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="admin-modal__body">
                            <label style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
                                Describe what needs to be corrected *
                            </label>
                            <textarea
                                className="admin-form-input"
                                style={{ marginTop: 8, minHeight: 100, width: '100%' }}
                                value={correctionReason}
                                onChange={(e) => {
                                    setCorrectionReason(e.target.value);
                                    setCorrectionErr('');
                                }}
                                placeholder='e.g. "I entered the wrong CIN number"'
                            />
                            {correctionErr && (
                                <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#f87171' }}>
                                    {correctionErr}
                                </p>
                            )}
                        </div>
                        <div className="admin-modal__footer">
                            <button
                                type="button"
                                className="admin-btn admin-btn--outline"
                                disabled={correctionBusy}
                                onClick={() => setCorrectionModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="admin-btn admin-btn--primary"
                                disabled={correctionBusy}
                                onClick={submitCorrectionRequest}
                            >
                                {correctionBusy ? 'Submitting…' : 'Submit Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {docModalOpen && docUrl && (
                <div
                    className="admin-modal-backdrop"
                    onClick={() => setDocModalOpen(false)}
                    style={{ zIndex: 10000 }}
                >
                    <div
                        className="admin-modal"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: 900, width: '95vw', maxHeight: '90vh' }}
                    >
                        <div className="admin-modal__header">
                            <h2 style={{ margin: 0 }}>ID document</h2>
                            <button type="button" className="admin-modal__close" onClick={() => setDocModalOpen(false)}>
                                ×
                            </button>
                        </div>
                        <div className="admin-modal__body" style={{ overflow: 'auto' }}>
                            {isPdfDoc ? (
                                <iframe title="ID PDF" src={docUrl} style={{ width: '100%', height: '70vh', border: 'none' }} />
                            ) : (
                                <img src={docUrl} alt="ID full" style={{ maxWidth: '100%', borderRadius: 8 }} />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Change Password ── */}
            <div className="admin-card">
                <h3
                    style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <Lock size={18} style={{ color: '#8B5CF6' }} /> Change Password
                </h3>

                {pwdSaved && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: 'rgba(34,197,94,0.12)',
                            border: '1px solid rgba(34,197,94,0.3)',
                            color: '#4ade80',
                            fontSize: '0.84rem',
                            marginBottom: 16,
                        }}
                    >
                        <CheckCircle size={16} /> Password updated successfully.
                    </div>
                )}
                {pwdError && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#FCA5A5',
                            fontSize: '0.84rem',
                            marginBottom: 16,
                        }}
                    >
                        <AlertCircle size={16} /> {pwdError}
                    </div>
                )}

                <form onSubmit={handlePasswordSave}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
                        {[
                            { key: 'current', label: 'Current Password', vis: 'current' },
                            { key: 'next', label: 'New Password', vis: 'next' },
                            { key: 'confirm', label: 'Confirm New Password', vis: null },
                        ].map(({ key, label, vis }) => (
                            <div key={key}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    {label}
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={vis && pwdVisible[vis] ? 'text' : 'password'}
                                        className="admin-form-input"
                                        value={pwdForm[key]}
                                        onChange={(e) => setPwdForm((p) => ({ ...p, [key]: e.target.value }))}
                                        placeholder="••••••••"
                                        style={{ paddingRight: vis ? 42 : undefined }}
                                        autoComplete={key === 'current' ? 'current-password' : 'new-password'}
                                    />
                                    {vis && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPwdVisible((p) => ({ ...p, [vis]: !p[vis] }))
                                            }
                                            style={{
                                                position: 'absolute',
                                                right: 12,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'rgba(255,255,255,0.4)',
                                                padding: 0,
                                            }}
                                            tabIndex={-1}
                                        >
                                            {pwdVisible[vis] ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        <button
                            type="submit"
                            className="admin-btn admin-btn--primary"
                            disabled={pwdLoading}
                            style={{
                                alignSelf: 'flex-start',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <Lock size={16} /> {pwdLoading ? 'Updating…' : 'Update Password'}
                        </button>
                    </div>
                </form>
            </div>

            {/* ── Operational Settings ── */}
            <div className="admin-card">
                <h3
                    style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <Bell size={18} style={{ color: '#F59E0B' }} /> Operational Settings
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                        { key: 'notifications', label: 'Push Notifications', type: 'toggle' },
                        { key: 'emailAlerts', label: 'Email Alerts', type: 'toggle' },
                        { key: 'autoRefresh', label: 'Auto-refresh Data', type: 'toggle' },
                        {
                            key: 'refreshInterval',
                            label: 'Refresh Interval (seconds)',
                            type: 'select',
                            options: ['15', '30', '60', '120'],
                        },
                        {
                            key: 'delayThreshold',
                            label: 'Delay Alert Threshold (minutes)',
                            type: 'select',
                            options: ['5', '10', '15', '30', '60'],
                        },
                    ].map(({ key, label, type, options }) => (
                        <div
                            key={key}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 0',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                            }}
                        >
                            <span style={{ fontSize: '0.88rem', color: '#CBD5E1' }}>{label}</span>
                            {type === 'toggle' ? (
                                <button
                                    onClick={() => update(key, !settings[key])}
                                    style={{
                                        width: 44,
                                        height: 24,
                                        borderRadius: 12,
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: settings[key] ? '#6366F1' : 'rgba(255,255,255,0.15)',
                                        transition: 'background 0.2s',
                                        position: 'relative',
                                    }}
                                >
                                    <span
                                        style={{
                                            position: 'absolute',
                                            top: 2,
                                            left: settings[key] ? 22 : 2,
                                            width: 20,
                                            height: 20,
                                            borderRadius: '50%',
                                            background: '#fff',
                                            transition: 'left 0.2s',
                                        }}
                                    />
                                </button>
                            ) : (
                                <select
                                    value={settings[key]}
                                    onChange={(e) => update(key, e.target.value)}
                                    style={{
                                        background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: '#E2E8F0',
                                        borderRadius: 6,
                                        padding: '4px 8px',
                                        fontSize: '0.82rem',
                                        outline: 'none',
                                    }}
                                >
                                    {options.map((o) => (
                                        <option key={o} value={o}>
                                            {o}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

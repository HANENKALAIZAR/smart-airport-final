import { useState, useEffect, useRef } from 'react';
import { User, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Pencil, Image as ImageIcon, ExternalLink, Upload, FileText, Bell } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
    apiChangePassword,
    apiGetMe,
    apiPatchSettings,
} from '../../services/adminApi';
import {
    formatTunisiaPhoneInput,
    tunisiaPhoneFieldError,
    isValidTunisiaPhone,
} from '../../utils/tunisiaPhone';
import { validateProfilePhotoFile, validateIdDocumentFile, PHOTO_ACCEPT, ID_DOC_ACCEPT } from '../../utils/uploadValidation';
import CustomSelect from '../../components/admin/ui/CustomSelect';


function maskIdNumber(raw) {
    if (!raw) return '—';
    const s = String(raw);
    if (s.length <= 4) return '••••';
    return `${'•'.repeat(Math.min(12, s.length - 4))}${s.slice(-4)}`;
}

function emergencyPhoneError(raw) {
    const s = String(raw || '').replace(/[^\d+]/g, '');
    if (!s) return 'Required';
    if (s[0] !== '+') return 'Must start with +';
    if (!/^\+[\d]+$/.test(s)) return 'Only + and digits are allowed';
    if (s.startsWith('+216')) {
        return /^\+216[2459]\d{7}$/.test(s) ? '' : 'Invalid Tunisian number (+216, then 8 digits starting with 2, 4, 5, or 9)';
    }
    const rest = s.slice(1);
    if (rest.length < 7 || rest.length > 15) return 'Use + followed by 7–15 digits';
    return '';
}

function passportNumberErr(s) {
    const t = String(s || '').trim();
    if (t.length < 6) return 'Min. 6 characters';
    if (!/^[A-Za-z]+[0-9][A-Za-z0-9]*$/.test(t)) return 'Letters then digits';
    return '';
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

    const [revealCin, setRevealCin] = useState(false);
    const [revealPassport, setRevealPassport] = useState(false);
    const [docModalUrl, setDocModalUrl] = useState(null);
    const [editPhone, setEditPhone] = useState(false);
    const [phoneDraft, setPhoneDraft] = useState('+216 ');
    const [phoneErr, setPhoneErr] = useState('');
    const [phoneSaving, setPhoneSaving] = useState(false);

    const photoRef = useRef();
    const [photoErr, setPhotoErr] = useState('');
    const [photoSaving, setPhotoSaving] = useState(false);

    // Toast for save feedback
    const [saveToast, setSaveToast] = useState(null); // { type: 'success'|'error', msg }
    function showSaveToast(type, msg) {
        setSaveToast({ type, msg });
        setTimeout(() => setSaveToast(null), 4500);
    }

    const [correctionIdentityDraft, setCorrectionIdentityDraft] = useState({
        full_name: '',
        date_of_birth: '',
        gender: 'Male',
        nationality: '',
    });

    const [unlockCinNumber, setUnlockCinNumber] = useState('');
    const [unlockPassportNumber, setUnlockPassportNumber] = useState('');
    const [unlockCinDocUrl, setUnlockCinDocUrl] = useState('');
    const [unlockPassportDocUrl, setUnlockPassportDocUrl] = useState('');
    const [unlockPassportExpiry, setUnlockPassportExpiry] = useState('');
    const [unlockFieldErr, setUnlockFieldErr] = useState({});
    const [unlockSaving, setUnlockSaving] = useState(false);
    const cinDocInputRef = useRef();
    const passportDocInputRef = useRef();

    const [addrDraft, setAddrDraft] = useState('');
    const [addrEdit, setAddrEdit] = useState(false);
    const [addrSaving, setAddrSaving] = useState(false);
    const [addrErr, setAddrErr] = useState('');

    const [emergencyDraft, setEmergencyDraft] = useState({
        name: '',
        phone: '',
        relationship: 'Parent',
    });
    const [emergencyEdit, setEmergencyEdit] = useState(false);
    const [emergencySaving, setEmergencySaving] = useState(false);
    const [emergencyErr, setEmergencyErr] = useState('');

    async function refreshProfile() {
        const { data } = await apiGetMe();
        if (data) {
            setProfile(data);
            localStorage.setItem('admin_user', JSON.stringify(data));
            window.dispatchEvent(new CustomEvent('admin-header-refresh-me'));
        }
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
        if (profile?.residential_address != null) {
            setAddrDraft(profile.residential_address || '');
        }
    }, [profile?.residential_address]);

    useEffect(() => {
        if (profile) {
            setEmergencyDraft({
                name: profile.emergency_contact_name || '',
                phone: profile.emergency_contact_phone || '',
                relationship: profile.emergency_contact_relationship || 'Parent',
            });
        }
    }, [
        profile?.emergency_contact_name,
        profile?.emergency_contact_phone,
        profile?.emergency_contact_relationship,
    ]);

    useEffect(() => {
        const isRejected = profile?.id_document_status === 'rejected';
        const ul = isRejected ? (profile?.rejected_fields || []) : [];
        const needCin = ul.includes('cin_number') || ul.includes('cin_document_url');
        const needPass = ul.includes('passport_number') || ul.includes('passport_document_url') || ul.includes('passport_expiry_date');
        if (needCin || needPass) {
            setUnlockCinNumber(profile.cin_number || '');
            setUnlockPassportNumber(profile.passport_number || '');
            setUnlockCinDocUrl(profile.cin_document_url || '');
            setUnlockPassportDocUrl(profile.passport_document_url || '');
            setUnlockPassportExpiry(
                profile.passport_expiry_date ? String(profile.passport_expiry_date).slice(0, 10) : '',
            );
            setUnlockFieldErr({});
        }
    }, [
        profile?.id_document_status,
        profile?.rejected_fields,
        profile?.cin_number,
        profile?.passport_number,
        profile?.cin_document_url,
        profile?.passport_document_url,
        profile?.passport_expiry_date,
    ]);

    useEffect(() => {
        if (!profile) return;
        setCorrectionIdentityDraft({
            full_name: profile.full_name || '',
            date_of_birth: profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : '',
            gender: profile.gender || 'Male',
            nationality: profile.nationality || '',
        });
    }, [
        profile?.full_name,
        profile?.date_of_birth,
        profile?.gender,
        profile?.nationality,
        profile?.id,
    ]);



    async function onUnlockCinDocPick(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const fe = validateIdDocumentFile(file);
        if (fe) {
            setUnlockFieldErr((er) => ({ ...er, cinDoc: fe }));
            return;
        }
        const url = await fileToDataUrl(file);
        setUnlockCinDocUrl(url);
        setUnlockFieldErr((er) => ({ ...er, cinDoc: '' }));
    }

    async function onUnlockPassportDocPick(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const fe = validateIdDocumentFile(file);
        if (fe) {
            setUnlockFieldErr((er) => ({ ...er, passportDoc: fe }));
            return;
        }
        const url = await fileToDataUrl(file);
        setUnlockPassportDocUrl(url);
        setUnlockFieldErr((er) => ({ ...er, passportDoc: '' }));
    }

    async function saveUnlockedIdProfile() {
        setUnlockFieldErr({});
        const errs = {};

        // Validate ONLY the fields that were explicitly rejected
        if (unlockFields.includes('cin_number')) {
            if (!/^\d{8}$/.test(unlockCinNumber || '')) errs.cin = 'CIN must be exactly 8 digits';
        }
        if (unlockFields.includes('cin_document_url')) {
            if (!unlockCinDocUrl) errs.cinDoc = 'CIN document is required';
        }
        if (unlockFields.includes('passport_number')) {
            const pe = passportNumberErr(unlockPassportNumber);
            if (pe) errs.passport = pe;
        }
        if (unlockFields.includes('passport_expiry_date')) {
            if (!unlockPassportExpiry) errs.expiry = 'Passport expiry is required';
            else if (new Date(unlockPassportExpiry) <= new Date()) errs.expiry = 'Must be a future date';
        }
        if (unlockFields.includes('passport_document_url')) {
            if (!unlockPassportDocUrl) errs.passportDoc = 'Passport document is required';
        }

        if (Object.keys(errs).length) {
            setUnlockFieldErr(errs);
            return;
        }

        // Build body with ONLY the explicitly rejected fields
        const body = {};
        if (unlockFields.includes('cin_number')) body.cin_number = unlockCinNumber;
        if (unlockFields.includes('cin_document_url')) body.cin_document_url = unlockCinDocUrl;
        if (unlockFields.includes('passport_number')) body.passport_number = unlockPassportNumber.trim().toUpperCase();
        if (unlockFields.includes('passport_expiry_date')) body.passport_expiry_date = unlockPassportExpiry;
        if (unlockFields.includes('passport_document_url')) body.passport_document_url = unlockPassportDocUrl;

        if (!Object.keys(body).length) return;
        setUnlockSaving(true);
        const { data: respData, error } = await apiPatchSettings(body);
        setUnlockSaving(false);
        if (error) {
            setUnlockFieldErr({ form: error });
            return;
        }
        showSaveToast('success', respData?.message || 'Saved.');
        await refreshProfile();
    }


    async function saveCorrectionIdentity() {
        const payload = {};
        if (unlockFields.includes('full_name')) payload.full_name = correctionIdentityDraft.full_name.trim();
        if (unlockFields.includes('date_of_birth') && correctionIdentityDraft.date_of_birth) {
            payload.date_of_birth = correctionIdentityDraft.date_of_birth;
        }
        if (unlockFields.includes('gender')) payload.gender = correctionIdentityDraft.gender;
        if (unlockFields.includes('nationality')) payload.nationality = correctionIdentityDraft.nationality.trim();
        if (!Object.keys(payload).length) return;
        const { data: respData, error } = await apiPatchSettings(payload);
        if (error) { showSaveToast('error', error); return; }
        showSaveToast('success', respData?.message || 'Saved.');
        await refreshProfile();
    }


    async function saveAddress() {
        setAddrErr('');
        setAddrSaving(true);
        const { data: respData, error } = await apiPatchSettings({ residential_address: addrDraft.trim() });
        setAddrSaving(false);
        if (error) {
            setAddrErr(error);
            return;
        }
        setAddrEdit(false);
        if (respData?.message) showSaveToast('success', respData.message);
        await refreshProfile();
    }

    async function saveEmergency() {
        setEmergencyErr('');
        const ep = emergencyPhoneError(emergencyDraft.phone);
        if (ep) {
            setEmergencyErr(ep);
            return;
        }
        setEmergencySaving(true);
        const { data: respData, error } = await apiPatchSettings({
            emergency_contact_name: emergencyDraft.name.trim(),
            emergency_contact_phone: emergencyDraft.phone.replace(/[^\d+]/g, ''),
            emergency_contact_relationship: emergencyDraft.relationship,
        });
        setEmergencySaving(false);
        if (error) {
            setEmergencyErr(error);
            return;
        }
        setEmergencyEdit(false);
        if (respData?.message) showSaveToast('success', respData.message);
        await refreshProfile();
    }

    async function handlePasswordSave(e) {
        e.preventDefault();
        if (profile?.role === 'super_admin') return;
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
    const isRejected = profile?.id_document_status === 'rejected';
    const unlockFields = isRejected ? (profile?.rejected_fields || []) : [];

    // A field group is editable only if ANY of its specific sub-fields were rejected
    const cinNumberEditable = tunisianAirportAdmin && unlockFields.includes('cin_number');
    const cinDocEditable = tunisianAirportAdmin && unlockFields.includes('cin_document_url');
    const cinEditable = cinNumberEditable || cinDocEditable;
    const passportNumberEditable = tunisianAirportAdmin && (unlockFields.includes('passport_number') || unlockFields.includes('passport_expiry_date'));
    const passportDocEditable = tunisianAirportAdmin && unlockFields.includes('passport_document_url');
    const passportEditable = passportNumberEditable || passportDocEditable;

    const canEditAddress = tunisianAirportAdmin && unlockFields.includes('residential_address');
    const canEditEmergency = tunisianAirportAdmin && (
        unlockFields.includes('emergency_contact_name') ||
        unlockFields.includes('emergency_contact_phone') ||
        unlockFields.includes('emergency_contact_relationship')
    );
    const hasIdentityUnlock =
        unlockFields.some((k) =>
            ['full_name', 'date_of_birth', 'gender', 'nationality'].includes(k),
        );
    const cinDocUrl = cinEditable ? unlockCinDocUrl : profile?.cin_document_url;
    const passportDocUrl = passportEditable ? unlockPassportDocUrl : profile?.passport_document_url;
    const cinPdf = cinDocUrl && String(cinDocUrl).startsWith('data:application/pdf');
    const passportPdf = passportDocUrl && String(passportDocUrl).startsWith('data:application/pdf');

    return (
        <div className="admin-space-y-6">
            {/* ── Save Toast ── */}
            {saveToast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 9999,
                    padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: '0.85rem',
                    background: saveToast.type === 'success' ? '#064E3B' : '#7F1D1D',
                    color: saveToast.type === 'success' ? '#6EE7B7' : '#FCA5A5',
                    border: `1px solid ${saveToast.type === 'success' ? '#065F46' : '#991B1B'}`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    maxWidth: 400,
                    lineHeight: 1.5,
                }}>
                    {saveToast.msg}
                </div>
            )}

            <div className="admin-page-header">
                <h1>{t('admin_settings_title')}</h1>
                <p>{t('admin_settings_subtitle')}</p>
            </div>
            {/* ── Rejection Alert Banner ── */}
            {tunisianAirportAdmin && isRejected && unlockFields.length > 0 && (
                <div style={{
                    padding: '16px 20px',
                    borderRadius: 12,
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.35)',
                    marginBottom: 4,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <AlertCircle size={18} style={{ color: '#f87171', flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, color: '#f87171', fontSize: '0.95rem' }}>
                            Profile Correction Required
                        </span>
                    </div>
                    <p style={{ margin: '0 0 10px', fontSize: '0.84rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                        {profile?.id_document_rejection_reason || 'Some fields in your profile were rejected by the super admin.'}
                    </p>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
                        Fields requiring correction:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {unlockFields.map(f => (
                            <span key={f} style={{
                                padding: '3px 10px',
                                borderRadius: 20,
                                background: 'rgba(239,68,68,0.15)',
                                border: '1px solid rgba(239,68,68,0.4)',
                                color: '#fca5a5',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                            }}>
                                {({
                                    full_name: 'Full Name',
                                    date_of_birth: 'Date of Birth',
                                    gender: 'Gender',
                                    nationality: 'Nationality',
                                    cin_number: 'CIN Number',
                                    cin_document_url: 'CIN Document Photo',
                                    passport_number: 'Passport Number',
                                    passport_expiry_date: 'Passport Expiry',
                                    passport_document_url: 'Passport Document Photo',
                                    residential_address: 'Residential Address',
                                    emergency_contact_name: 'Emergency Contact Name',
                                    emergency_contact_phone: 'Emergency Contact Phone',
                                    emergency_contact_relationship: 'Emergency Relationship',
                                })[f] || f}
                            </span>
                        ))}
                    </div>
                    <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                        All other fields are locked and preserved. Only the highlighted fields above are editable.
                    </p>
                </div>
            )}

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
                    profile.role === 'super_admin' ? (
                        <div>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Email</label>
                                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 8, fontSize: '0.9rem', color: '#E2E8F0' }}>
                                    {profile.email}
                                </div>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Role</label>
                                <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 8, fontSize: '0.9rem', color: '#E2E8F0' }}>
                                    ⭐ Super Admin
                                </div>
                            </div>
                            <div style={{ padding: '10px 14px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, color: '#93C5FD', fontSize: '0.85rem' }}>
                                This is a system-level account. Profile editing is disabled.
                            </div>
                        </div>
                    ) : (
                    <div>

                        {tunisianAirportAdmin && unlockFields.length > 0 && (
                            <div
                                style={{
                                    marginBottom: 16,
                                    padding: '10px 14px',
                                    borderRadius: 8,
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.25)',
                                    color: '#fca5a5',
                                    fontSize: '0.82rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                                Correct the highlighted fields below, then click Save. Approved fields are locked.
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
                                            id="profile-photo-upload"
                                            name="profile_photo"
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
                                ...(!unlockFields.includes('full_name')
                                    ? [{ label: 'Full Name', value: profile.full_name }]
                                    : []),
                                { label: 'Email', value: profile.email },
                                {
                                    label: 'Role',
                                    value:
                                        profile.role === 'super_admin'
                                            ? '⭐ Super Admin'
                                            : '🛡 Airport Admin',
                                },
                                { label: 'Airport', value: profile.airport_iata || 'All airports' },
                                { label: 'Employee ID', value: profile.employee_id || '—' },
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
                                    htmlFor="phone-number"
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
                                            id="phone-number"
                                            name="phone_number"
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

                            {!unlockFields.includes('nationality') && (
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    Nationality
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
                                    {profile.nationality || '—'}
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
                            )}

                            {!unlockFields.includes('gender') && (
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    Gender
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
                                    {profile.gender || '—'}
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
                            )}

                            <div style={{ gridColumn: '1 / -1' }}>
                                <label
                                    htmlFor="residential-address"
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    Residential address
                                </label>
                                {tunisianAirportAdmin && canEditAddress && addrEdit ? (
                                    <div>
                                        <textarea
                                            id="residential-address"
                                            name="residential_address"
                                            className="admin-form-input"
                                            style={{ minHeight: 72, width: '100%' }}
                                            value={addrDraft}
                                            onChange={(e) => {
                                                setAddrDraft(e.target.value);
                                                setAddrErr('');
                                            }}
                                        />
                                        {addrErr && (
                                            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#f87171' }}>
                                                {addrErr}
                                            </p>
                                        )}
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn--primary"
                                                onClick={saveAddress}
                                                disabled={addrSaving}
                                            >
                                                {addrSaving ? 'Saving…' : 'Save'}
                                            </button>
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn--outline"
                                                onClick={() => {
                                                    setAddrEdit(false);
                                                    setAddrDraft(profile.residential_address || '');
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
                                            alignItems: 'flex-start',
                                            gap: 10,
                                            padding: '10px 14px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: 8,
                                        }}
                                    >
                                        <span style={{ flex: 1, color: '#E2E8F0', whiteSpace: 'pre-wrap' }}>
                                            {profile.residential_address || '—'}
                                        </span>
                                        {tunisianAirportAdmin && canEditAddress && (
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
                                                onClick={() => setAddrEdit(true)}
                                            >
                                                <Pencil size={13} /> Edit
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <label
                                    htmlFor="emergency-name"
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    Emergency contact
                                </label>
                                {tunisianAirportAdmin && canEditEmergency && emergencyEdit ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <input
                                            id="emergency-name"
                                            name="emergency_contact_name"
                                            className="admin-form-input"
                                            placeholder="Name"
                                            value={emergencyDraft.name}
                                            onChange={(e) =>
                                                setEmergencyDraft((d) => ({ ...d, name: e.target.value }))
                                            }
                                        />
                                        <input
                                            id="emergency-phone"
                                            name="emergency_contact_phone"
                                            className="admin-form-input"
                                            placeholder="+216 … or international"
                                            value={emergencyDraft.phone}
                                            onChange={(e) =>
                                                setEmergencyDraft((d) => ({ ...d, phone: e.target.value }))
                                            }
                                        />
                                        <CustomSelect
                                            id="emergency-relationship"
                                            name="emergency_contact_relationship"
                                            options={['Parent', 'Spouse', 'Sibling', 'Friend', 'Other'].map(r => ({ value: r, label: r }))}
                                            value={emergencyDraft.relationship || 'Parent'}
                                            onChange={(val) =>
                                                setEmergencyDraft((d) => ({
                                                    ...d,
                                                    relationship: val,
                                                }))
                                            }
                                        />
                                        {emergencyErr && (
                                            <p style={{ fontSize: '0.75rem', color: '#f87171' }}>{emergencyErr}</p>
                                        )}
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn--primary"
                                                onClick={saveEmergency}
                                                disabled={emergencySaving}
                                            >
                                                {emergencySaving ? 'Saving…' : 'Save'}
                                            </button>
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn--outline"
                                                onClick={() => {
                                                    setEmergencyEdit(false);
                                                    setEmergencyDraft({
                                                        name: profile.emergency_contact_name || '',
                                                        phone: profile.emergency_contact_phone || '',
                                                        relationship: profile.emergency_contact_relationship || 'Parent',
                                                    });
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            padding: '10px 14px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: 8,
                                            fontSize: '0.88rem',
                                            color: '#E2E8F0',
                                        }}
                                    >
                                        <div>
                                            <span style={{ color: 'rgba(255,255,255,0.45)' }}>Name: </span>
                                            {profile.emergency_contact_name || '—'}
                                        </div>
                                        <div style={{ marginTop: 6 }}>
                                            <span style={{ color: 'rgba(255,255,255,0.45)' }}>Phone: </span>
                                            {profile.emergency_contact_phone || '—'}
                                        </div>
                                        <div style={{ marginTop: 6 }}>
                                            <span style={{ color: 'rgba(255,255,255,0.45)' }}>Relationship: </span>
                                            {profile.emergency_contact_relationship || '—'}
                                        </div>
                                        {tunisianAirportAdmin && canEditEmergency && (
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn--outline"
                                                style={{
                                                    marginTop: 10,
                                                    padding: '6px 10px',
                                                    fontSize: '0.78rem',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                }}
                                                onClick={() => setEmergencyEdit(true)}
                                            >
                                                <Pencil size={13} /> Edit
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {hasIdentityUnlock && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div
                                        style={{
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            color: '#93c5fd',
                                            marginBottom: 10,
                                            letterSpacing: '0.04em',
                                        }}
                                    >
                                        Unlocked profile fields
                                    </div>
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '0.75rem',
                                        }}
                                    >
                                        {unlockFields.includes('full_name') && (
                                            <div>
                                                <label
                                                    htmlFor="correction-full-name"
                                                    style={{
                                                        display: 'block',
                                                        fontSize: '0.8rem',
                                                        color: 'rgba(255,255,255,0.5)',
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    Full name
                                                </label>
                                                <input
                                                    id="correction-full-name"
                                                    name="full_name"
                                                    className="admin-form-input"
                                                    value={correctionIdentityDraft.full_name}
                                                    onChange={(e) =>
                                                        setCorrectionIdentityDraft((d) => ({
                                                            ...d,
                                                            full_name: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>
                                        )}
                                        {unlockFields.includes('date_of_birth') && (
                                            <div>
                                                <label
                                                    htmlFor="correction-dob"
                                                    style={{
                                                        display: 'block',
                                                        fontSize: '0.8rem',
                                                        color: 'rgba(255,255,255,0.5)',
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    Date of birth
                                                </label>
                                                <input
                                                    id="correction-dob"
                                                    name="date_of_birth"
                                                    type="date"
                                                    className="admin-form-input"
                                                    style={{ colorScheme: 'dark' }}
                                                    value={correctionIdentityDraft.date_of_birth}
                                                    onChange={(e) =>
                                                        setCorrectionIdentityDraft((d) => ({
                                                            ...d,
                                                            date_of_birth: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>
                                        )}
                                        {unlockFields.includes('gender') && (
                                            <div>
                                                <label
                                                    htmlFor="correction-gender"
                                                    style={{
                                                        display: 'block',
                                                        fontSize: '0.8rem',
                                                        color: 'rgba(255,255,255,0.5)',
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    Gender
                                                </label>
                                                <CustomSelect
                                                    id="correction-gender"
                                                    name="gender"
                                                    options={[
                                                        { value: 'Male', label: 'Male' },
                                                        { value: 'Female', label: 'Female' },
                                                    ]}
                                                    value={correctionIdentityDraft.gender}
                                                    onChange={(val) =>
                                                        setCorrectionIdentityDraft((d) => ({
                                                            ...d,
                                                            gender: val,
                                                        }))
                                                    }
                                                />
                                            </div>
                                        )}
                                        {unlockFields.includes('nationality') && (
                                            <div>
                                                <label
                                                    htmlFor="correction-nationality"
                                                    style={{
                                                        display: 'block',
                                                        fontSize: '0.8rem',
                                                        color: 'rgba(255,255,255,0.5)',
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    Nationality
                                                </label>
                                                <input
                                                    id="correction-nationality"
                                                    name="nationality"
                                                    className="admin-form-input"
                                                    value={correctionIdentityDraft.nationality}
                                                    onChange={(e) =>
                                                        setCorrectionIdentityDraft((d) => ({
                                                            ...d,
                                                            nationality: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="admin-btn admin-btn--primary"
                                        style={{ marginTop: 12 }}
                                        onClick={saveCorrectionIdentity}
                                    >
                                        Save unlocked fields
                                    </button>
                                </div>
                            )}

                            <div style={{ gridColumn: '1 / -1' }}>
                                <div
                                    style={{
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        color: '#93c5fd',
                                        marginBottom: 10,
                                        letterSpacing: '0.04em',
                                    }}
                                >
                                    CIN
                                </div>
                                <label
                                    htmlFor="correction-cin-number"
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    CIN number
                                </label>
                                {cinEditable ? (
                                    <input
                                        id="correction-cin-number"
                                        name="cin_number"
                                        className="admin-form-input"
                                        style={{ fontFamily: 'monospace', marginBottom: 10 }}
                                        value={unlockCinNumber}
                                        maxLength={8}
                                        onChange={(e) =>
                                            setUnlockCinNumber(e.target.value.replace(/\D/g, '').slice(0, 8))
                                        }
                                    />
                                ) : (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '10px 14px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: 8,
                                            fontFamily: 'monospace',
                                            marginBottom: 10,
                                        }}
                                    >
                                        <span style={{ flex: 1 }}>
                                            {revealCin ? profile.cin_number || '—' : maskIdNumber(profile.cin_number)}
                                        </span>
                                        {profile.cin_number ? (
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn--outline"
                                                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                                onClick={() => setRevealCin((v) => !v)}
                                            >
                                                {revealCin ? (
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
                                {unlockFieldErr.cin && (
                                    <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#f87171' }}>
                                        {unlockFieldErr.cin}
                                    </p>
                                )}
                                <label
                                    htmlFor="correction-cin-doc"
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    CIN document
                                </label>
                                {cinEditable ? (
                                    <div>
                                        <input
                                            id="correction-cin-doc"
                                            name="cin_document"
                                            ref={cinDocInputRef}
                                            type="file"
                                            accept={ID_DOC_ACCEPT}
                                            style={{ display: 'none' }}
                                            onChange={onUnlockCinDocPick}
                                        />
                                        <button
                                            type="button"
                                            className="admin-btn admin-btn--outline"
                                            onClick={() => cinDocInputRef.current?.click()}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                                        >
                                            <Upload size={16} /> Upload CIN (JPG, PNG, PDF max 5MB)
                                        </button>
                                        {unlockFieldErr.cinDoc && (
                                            <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#f87171' }}>
                                                {unlockFieldErr.cinDoc}
                                            </p>
                                        )}
                                        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                            {cinDocUrl && !cinPdf ? (
                                                <img
                                                    src={cinDocUrl}
                                                    alt="CIN"
                                                    style={{
                                                        width: 72,
                                                        height: 72,
                                                        objectFit: 'cover',
                                                        borderRadius: 8,
                                                    }}
                                                />
                                            ) : cinDocUrl && cinPdf ? (
                                                <div style={{ color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <FileText size={28} /> PDF
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                            {cinDocUrl && !cinPdf ? (
                                                <img
                                                    src={cinDocUrl}
                                                    alt="CIN"
                                                    style={{
                                                        width: 72,
                                                        height: 72,
                                                        objectFit: 'cover',
                                                        borderRadius: 8,
                                                    }}
                                                />
                                            ) : cinDocUrl && cinPdf ? (
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
                                            {cinDocUrl ? (
                                                <button
                                                    type="button"
                                                    className="admin-btn admin-btn--outline"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                                    onClick={() => setDocModalUrl(cinDocUrl)}
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
                                                Read-only — contact a Super Admin to change.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <div
                                    style={{
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        color: '#93c5fd',
                                        marginBottom: 10,
                                        letterSpacing: '0.04em',
                                    }}
                                >
                                    Passport
                                </div>
                                <label
                                    htmlFor="correction-passport-number"
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    Passport number
                                </label>
                                {passportEditable ? (
                                    <input
                                        id="correction-passport-number"
                                        name="passport_number"
                                        className="admin-form-input"
                                        style={{ fontFamily: 'monospace', marginBottom: 10 }}
                                        value={unlockPassportNumber}
                                        onChange={(e) => {
                                            setUnlockPassportNumber(e.target.value);
                                            setUnlockFieldErr((er) => ({ ...er, passport: '' }));
                                        }}
                                    />
                                ) : (
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '10px 14px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: 8,
                                            fontFamily: 'monospace',
                                            marginBottom: 10,
                                        }}
                                    >
                                        <span style={{ flex: 1 }}>
                                            {revealPassport
                                                ? profile.passport_number || '—'
                                                : maskIdNumber(profile.passport_number)}
                                        </span>
                                        {profile.passport_number ? (
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn--outline"
                                                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                                onClick={() => setRevealPassport((v) => !v)}
                                            >
                                                {revealPassport ? (
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
                                {unlockFieldErr.passport && (
                                    <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#f87171' }}>
                                        {unlockFieldErr.passport}
                                    </p>
                                )}
                                <label
                                    htmlFor="correction-passport-expiry"
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    Passport expiry
                                </label>
                                {passportEditable ? (
                                    <input
                                        id="correction-passport-expiry"
                                        name="passport_expiry_date"
                                        type="date"
                                        className="admin-form-input"
                                        style={{ marginBottom: 10, colorScheme: 'dark' }}
                                        value={unlockPassportExpiry}
                                        onChange={(e) => setUnlockPassportExpiry(e.target.value)}
                                    />
                                ) : (
                                    <div
                                        style={{
                                            padding: '10px 14px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: 8,
                                            marginBottom: 10,
                                        }}
                                    >
                                        {profile.passport_expiry_date
                                            ? String(profile.passport_expiry_date).slice(0, 10)
                                            : '—'}
                                    </div>
                                )}
                                {unlockFieldErr.expiry && (
                                    <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#f87171' }}>
                                        {unlockFieldErr.expiry}
                                    </p>
                                )}
                                <label
                                    htmlFor="correction-passport-doc"
                                    style={{
                                        display: 'block',
                                        fontSize: '0.8rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginBottom: 6,
                                    }}
                                >
                                    Passport document
                                </label>
                                {passportEditable ? (
                                    <div>
                                        <input
                                            id="correction-passport-doc"
                                            name="passport_document"
                                            ref={passportDocInputRef}
                                            type="file"
                                            accept={ID_DOC_ACCEPT}
                                            style={{ display: 'none' }}
                                            onChange={onUnlockPassportDocPick}
                                        />
                                        <button
                                            type="button"
                                            className="admin-btn admin-btn--outline"
                                            onClick={() => passportDocInputRef.current?.click()}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                                        >
                                            <Upload size={16} /> Upload passport (JPG, PNG, PDF max 5MB)
                                        </button>
                                        {unlockFieldErr.passportDoc && (
                                            <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#f87171' }}>
                                                {unlockFieldErr.passportDoc}
                                            </p>
                                        )}
                                        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                            {passportDocUrl && !passportPdf ? (
                                                <img
                                                    src={passportDocUrl}
                                                    alt="Passport"
                                                    style={{
                                                        width: 72,
                                                        height: 72,
                                                        objectFit: 'cover',
                                                        borderRadius: 8,
                                                    }}
                                                />
                                            ) : passportDocUrl && passportPdf ? (
                                                <div style={{ color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <FileText size={28} /> PDF
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                            {passportDocUrl && !passportPdf ? (
                                                <img
                                                    src={passportDocUrl}
                                                    alt="Passport"
                                                    style={{
                                                        width: 72,
                                                        height: 72,
                                                        objectFit: 'cover',
                                                        borderRadius: 8,
                                                    }}
                                                />
                                            ) : passportDocUrl && passportPdf ? (
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
                                            {passportDocUrl ? (
                                                <button
                                                    type="button"
                                                    className="admin-btn admin-btn--outline"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                                    onClick={() => setDocModalUrl(passportDocUrl)}
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
                                                Read-only — contact a Super Admin to change.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            {tunisianAirportAdmin && profile.profile_complete && (cinEditable || passportEditable) && (
                                <div style={{ gridColumn: '1 / -1' }}>
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
                                        {unlockSaving ? 'Saving…' : 'Save Correction'}
                                    </button>
                                    <p style={{ marginTop: 8, fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                                        Only corrected fields are updated. Your profile is resubmitted for super admin review once all rejected fields are resolved.
                                    </p>
                                </div>
                            )}

                        </div>
                    </div>
                    )
                ) : (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
                        Loading profile…
                    </div>
                )}
            </div>


            {docModalUrl && (
                <div
                    className="admin-modal-backdrop"
                    onClick={() => setDocModalUrl(null)}
                    style={{ zIndex: 10000 }}
                >
                    <div
                        className="admin-modal"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: 900, width: '95vw', maxHeight: '90vh' }}
                    >
                        <div className="admin-modal__header">
                            <h2 style={{ margin: 0 }}>Document</h2>
                            <button type="button" className="admin-modal__close" onClick={() => setDocModalUrl(null)}>
                                ×
                            </button>
                        </div>
                        <div className="admin-modal__body" style={{ overflow: 'auto' }}>
                            {String(docModalUrl).startsWith('data:application/pdf') ? (
                                <iframe
                                    title="PDF"
                                    src={docModalUrl}
                                    style={{ width: '100%', height: '70vh', border: 'none' }}
                                />
                            ) : (
                                <img src={docModalUrl} alt="Document" style={{ maxWidth: '100%', borderRadius: 8 }} />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Change Password ── */}
            {profile?.role !== 'super_admin' && (
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
                                    htmlFor={`settings-pwd-${key}`}
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
                                        id={`settings-pwd-${key}`}
                                        name={`${key}_password`}
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
            )}

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
                                    id={key}
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
                                <CustomSelect
                                    id={key}
                                    name={key}
                                    options={(options || []).map((o) => ({ value: o, label: o }))}
                                    value={settings[key]}
                                    onChange={(val) => update(key, val)}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

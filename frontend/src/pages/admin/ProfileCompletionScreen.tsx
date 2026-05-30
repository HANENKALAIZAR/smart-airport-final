/**
 * ProfileCompletionScreen.tsx
 * ===========================
 * Step 2 of 2 admin onboarding — fill personal details and ID documents.
 * Design from aviation-admin-login-main/routes/first-login.complete-profile.tsx.
 * Business logic unchanged: calls apiCompleteProfile() from existing adminApi.
 * Preserves ALL existing validation (Tunisia phone, CIN, passport, file types, age).
 * Converted from JSX → TSX.
 */
import React, { useState, useRef } from 'react';
import {
  User, Upload, FileText, Plane, Phone, MapPin, Calendar, Globe,
  IdCard, ShieldCheck, Camera, Check, ArrowLeft, ArrowRight, AlertCircle,
} from 'lucide-react';
import {
  AdminOnboardingShell,
  panelStyle,
  inputCls,
  labelCls,
} from '../../components/admin/AdminOnboardingShell';
import { useAdminTheme } from '../../hooks/useAdminPrefs';
import { apiCompleteProfile, apiPatchSettings } from '../../services/adminApi';
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProfileCompletionScreenProps {
  user: any | null;
  onComplete: () => void;
  isCorrectionMode?: boolean;
  onLogout?: () => void;
}

type Profile = {
  photo:          string | null;
  dob:            string;
  gender:         string;
  nationality:    string;
  address:        string;
  cin:            string;
  cinDocUrl:      string;
  cinDocBackUrl:  string;
  passport:       string;
  passportExpiry: string;
  passportDocUrl: string;
  phone:          string;
  emergencyName:  string;
  emergencyPhone: string;
  emergencyRel:   string;
};

type ProfileErrors = Partial<Record<keyof Profile, string>>;

// ── Date constraints ──────────────────────────────────────────────────────────
const MAX_DOB_STRING = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().split('T')[0];
})();

const MIN_PASSPORT_EXPIRY = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
})();

// ── Country list ──────────────────────────────────────────────────────────────
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bahrain','Bangladesh',
  'Belgium','Brazil','Bulgaria','Canada','China','Colombia','Croatia','Cyprus','Czech Republic',
  'Denmark','Egypt','Estonia','Finland','France','Germany','Greece','Hungary','Iceland','India',
  'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya','Kuwait',
  'Latvia','Lebanon','Libya','Lithuania','Luxembourg','Malaysia','Malta','Mexico','Morocco',
  'Netherlands','New Zealand','Nigeria','Norway','Oman','Pakistan','Palestine','Poland',
  'Portugal','Qatar','Romania','Russia','Saudi Arabia','Serbia','Singapore','Slovakia',
  'Slovenia','South Africa','South Korea','Spain','Sudan','Sweden','Switzerland','Syria',
  'Tunisia','Turkey','Ukraine','United Arab Emirates','United Kingdom','United States',
  'Venezuela','Vietnam','Yemen',
].sort((a, b) => a.localeCompare(b));

// ── Validation helpers ────────────────────────────────────────────────────────
function emergencyPhoneError(raw: string): string {
  const s = String(raw || '').replace(/[^\d+]/g, '');
  if (!s) return 'Emergency contact phone is required';
  if (s[0] !== '+') return 'Must start with +';
  if (!/^\+[\d]+$/.test(s)) return 'Only + and digits are allowed';
  if (s.startsWith('+216')) {
    return /^\+216[2459]\d{7}$/.test(s)
      ? ''
      : 'Invalid Tunisian number (+216, then 8 digits starting with 2, 4, 5, or 9)';
  }
  const rest = s.slice(1);
  if (rest.length < 7 || rest.length > 15) return 'Use + followed by 7–15 digits';
  return '';
}

function passportNumberError(s: string): string {
  const t = String(s || '').trim();
  if (t.length < 6) return 'Passport number must be at least 6 characters';
  if (!/^[A-Za-z]+[0-9][A-Za-z0-9]*$/.test(t))
    return 'Use letter(s) followed by digits (e.g. AB123456)';
  return '';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const initial: Profile = {
  photo: null, dob: '', gender: 'Male', nationality: '', address: '',
  cin: '', cinDocUrl: '', cinDocBackUrl: '', passport: '', passportExpiry: '', passportDocUrl: '',
  phone: '+216 ', emergencyName: '', emergencyPhone: '+216 ', emergencyRel: 'Parent',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProfileCompletionScreen({
  user,
  onComplete,
  isCorrectionMode = false,
  onLogout,
}: ProfileCompletionScreenProps) {
  const [theme] = useAdminTheme();
  const isDark  = theme === 'dark';

  const [p, setP] = useState<Profile>(() => {
    if (isCorrectionMode && user) {
      return {
        photo:          user.profile_photo_url || null,
        dob:            user.date_of_birth || '',
        gender:         user.gender || 'Male',
        nationality:    user.nationality || '',
        address:        user.residential_address || '',
        cin:            user.cin_number || '',
        cinDocUrl:      user.cin_document_url || '',
        cinDocBackUrl:  user.cin_document_back_url || '',
        passport:       user.passport_number || '',
        passportExpiry: user.passport_expiry_date || '',
        passportDocUrl: user.passport_document_url || '',
        phone:          user.phone_number ? formatTunisiaPhoneInput(user.phone_number) : '+216 ',
        emergencyName:  user.emergency_contact_name || '',
        emergencyPhone: user.emergency_contact_phone ? formatTunisiaPhoneInput(user.emergency_contact_phone) : '+216 ',
        emergencyRel:   user.emergency_contact_relationship || 'Parent',
      };
    }
    return initial;
  });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const update = <K extends keyof Profile>(k: K, v: Profile[K]) =>
    setP((prev) => ({ ...prev, [k]: v }));
  const clearErr = (k: keyof Profile) =>
    setErrors((prev) => ({ ...prev, [k]: '' }));

  const firstName = user?.full_name?.split(' ')[0] || 'Admin';

  const keyMap: Record<keyof Profile, string> = {
    photo: 'profile_photo_url',
    dob: 'date_of_birth',
    gender: 'gender',
    nationality: 'nationality',
    address: 'residential_address',
    cin: 'cin_number',
    cinDocUrl: 'cin_document_url',
    cinDocBackUrl: 'cin_document_back_url',
    passport: 'passport_number',
    passportExpiry: 'passport_expiry_date',
    passportDocUrl: 'passport_document_url',
    phone: 'phone_number',
    emergencyName: 'emergency_contact_name',
    emergencyPhone: 'emergency_contact_phone',
    emergencyRel: 'emergency_contact_relationship',
  };

  const isFieldRejected = (fieldKey: keyof Profile) => {
    if (!isCorrectionMode) return false;
    const backendKey = keyMap[fieldKey];
    return !!(user?.rejected_fields && user.rejected_fields.includes(backendKey));
  };

  const isFieldApproved = (fieldKey: keyof Profile) => {
    if (!isCorrectionMode) return false;
    const backendKey = keyMap[fieldKey];
    return !!(user?.rejected_fields && !user.rejected_fields.includes(backendKey));
  };

  const getInputClass = (fieldKey: keyof Profile, hasIcon = false) => {
    const base = inputCls(isDark, hasIcon);
    if (isFieldRejected(fieldKey)) {
      return `${base} !border-red-500/45 !bg-red-500/5 focus:!border-red-500 focus:!ring-red-500/20`;
    }
    if (isFieldApproved(fieldKey)) {
      return `${base} opacity-60 cursor-not-allowed bg-white/[0.02] border-emerald-500/25 text-white/50`;
    }
    return base;
  };

  // ── Progress ──────────────────────────────────────────────────────────────
  const requiredFields: (keyof Profile)[] = [
    'dob','gender','nationality','address','phone','cin','cinDocUrl','cinDocBackUrl',
    'passport','passportExpiry','passportDocUrl','emergencyName','emergencyPhone',
  ];
  const completed  = requiredFields.filter((f) => !!p[f]).length;
  const progress   = Math.round((completed / requiredFields.length) * 100);

  // ── File handlers ─────────────────────────────────────────────────────────
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fe = validateProfilePhotoFile(file);
    if (fe) { setErrors((er) => ({ ...er, photo: fe })); return; }
    const url = await fileToDataUrl(file);
    update('photo', url);
    clearErr('photo');
  }

  async function handleCinDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fe = validateIdDocumentFile(file);
    if (fe) { setErrors((er) => ({ ...er, cinDocUrl: fe })); return; }
    const url = await fileToDataUrl(file);
    update('cinDocUrl', url);
    clearErr('cinDocUrl');
  }

  async function handleCinDocBack(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fe = validateIdDocumentFile(file);
    if (fe) { setErrors((er) => ({ ...er, cinDocBackUrl: fe })); return; }
    const url = await fileToDataUrl(file);
    update('cinDocBackUrl', url);
    clearErr('cinDocBackUrl');
  }

  async function handlePassportDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fe = validateIdDocumentFile(file);
    if (fe) { setErrors((er) => ({ ...er, passportDocUrl: fe })); return; }
    const url = await fileToDataUrl(file);
    update('passportDocUrl', url);
    clearErr('passportDocUrl');
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): ProfileErrors {
    const errs: ProfileErrors = {};

    if (!isValidTunisiaPhone(p.phone)) {
      errs.phone = tunisiaPhoneFieldError(p.phone) ||
        'Please enter a valid Tunisian phone number (e.g. +216 9X XXX XXX)';
    }
    if (!p.dob) errs.dob = 'Date of birth is required';
    else {
      const age = (Date.now() - new Date(p.dob).getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (age < 18) errs.dob = 'Must be at least 18 years old';
    }
    if (!p.nationality.trim()) errs.nationality = 'Nationality is required';
    if (!p.gender) errs.gender = 'Gender is required';
    if (!p.address.trim()) errs.address = 'Residential address is required';
    if (!p.emergencyName.trim()) errs.emergencyName = 'Emergency contact name is required';

    if (!isValidTunisiaPhone(p.emergencyPhone)) {
      errs.emergencyPhone = tunisiaPhoneFieldError(p.emergencyPhone) ||
        'Please enter a valid Tunisian phone number (e.g. +216 9X XXX XXX)';
    }
    if (!p.emergencyRel) errs.emergencyRel = 'Relationship is required';

    if (!/^\d{8}$/.test(p.cin.trim())) errs.cin = 'CIN must be exactly 8 digits';
    if (!p.cinDocUrl) errs.cinDocUrl = 'CIN Front document is required';
    if (!p.cinDocBackUrl) errs.cinDocBackUrl = 'CIN Back document is required';

    const pe = passportNumberError(p.passport);
    if (pe) errs.passport = pe;
    if (!p.passportDocUrl) errs.passportDocUrl = 'Passport document is required';
    if (!p.passportExpiry) errs.passportExpiry = 'Passport expiry is required';
    else if (new Date(p.passportExpiry) <= new Date())
      errs.passportExpiry = 'Passport must not be expired';

    return errs;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    setApiError('');

    let res;
    if (isCorrectionMode) {
      // Build a payload with ONLY the rejected fields
      const patchPayload: any = {};
      const addIfRejected = (uiKey: keyof Profile, backendKey: string, val: any) => {
        if (isFieldRejected(uiKey)) {
          patchPayload[backendKey] = val;
        }
      };

      addIfRejected('photo', 'profile_photo_url', p.photo || '');
      addIfRejected('dob', 'date_of_birth', p.dob);
      addIfRejected('gender', 'gender', p.gender);
      addIfRejected('nationality', 'nationality', p.nationality.trim());
      addIfRejected('address', 'residential_address', p.address.trim());
      addIfRejected('cin', 'cin_number', p.cin.trim());
      addIfRejected('cinDocUrl', 'cin_document_url', p.cinDocUrl);
      addIfRejected('cinDocBackUrl', 'cin_document_back_url', p.cinDocBackUrl);
      addIfRejected('passport', 'passport_number', p.passport.trim().toUpperCase());
      addIfRejected('passportExpiry', 'passport_expiry_date', p.passportExpiry);
      addIfRejected('passportDocUrl', 'passport_document_url', p.passportDocUrl);
      addIfRejected('phone', 'phone_number', p.phone.replace(/\s/g, ''));
      addIfRejected('emergencyName', 'emergency_contact_name', p.emergencyName.trim());
      addIfRejected('emergencyPhone', 'emergency_contact_phone', p.emergencyPhone.replace(/\s/g, ''));
      addIfRejected('emergencyRel', 'emergency_contact_relationship', p.emergencyRel);

      res = await apiPatchSettings(patchPayload);
    } else {
      res = await apiCompleteProfile({
        phone_number:                    p.phone.replace(/\s/g, ''),
        date_of_birth:                   p.dob,
        nationality:                     p.nationality.trim(),
        gender:                          p.gender,
        residential_address:             p.address.trim(),
        emergency_contact_name:          p.emergencyName.trim(),
        emergency_contact_phone:         p.emergencyPhone.replace(/\s/g, ''),
        emergency_contact_relationship:  p.emergencyRel,
        cin_number:                      p.cin.trim(),
        cin_document_url:                p.cinDocUrl,
        cin_document_back_url:           p.cinDocBackUrl,
        passport_number:                 p.passport.trim().toUpperCase(),
        passport_document_url:           p.passportDocUrl,
        passport_expiry_date:            p.passportExpiry,
        profile_photo_url:               p.photo || '',
      });
    }

    setSubmitting(false);
    if (res.error) { setApiError(res.error); return; }
    onComplete();
  }

  return (
    <AdminOnboardingShell
      step={2}
      totalSteps={2}
      steps={[
        { label: 'Change Password', status: 'done' },
        { label: 'Complete Profile', status: 'active' },
      ]}
    >
      <div className="mb-8 text-center">
        <h1
          className={`text-2xl font-semibold tracking-tight sm:text-3xl ${
            isDark ? 'text-white' : 'text-navy-deep'
          }`}
        >
          {isCorrectionMode ? 'Review & Resubmit Profile' : 'Complete Your Profile'}
        </h1>
        <p
          className={`mx-auto mt-2 max-w-xl text-sm ${
            isDark ? 'text-white/60' : 'text-navy-deep/60'
          }`}
        >
          {isCorrectionMode
            ? 'Please review and correct the fields flagged by the Super Admin. Your approved information has been preserved.'
            : `Welcome, ${firstName}! Professional identity verification. These details are required for airport personnel access and credential issuance.`}
        </p>
      </div>

      {isCorrectionMode && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <h4 className="font-semibold text-red-100">Correction Required</h4>
            <p className="mt-1 text-red-200/80">
              Some information was rejected by the Super Admin. Please correct the highlighted fields and resubmit your profile.
            </p>
            {(user?.id_document_rejection_reason || user?.rejection_reasons) && (
              <div className="mt-2.5 rounded bg-red-950/40 p-2.5 font-mono text-xs border border-red-500/10 text-red-300">
                <strong>Super Admin Rejection Notes:</strong> {user.id_document_rejection_reason || user.rejection_reasons}
              </div>
            )}
          </div>
        </div>
      )}

      <form
        id="complete-profile-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]"
      >
        {/* ── Left rail ──────────────────────────────────────────────────── */}
        <aside className="space-y-4">
          {/* Photo + progress */}
          <div
            className="rounded-2xl border p-6 text-center backdrop-blur-2xl"
            style={panelStyle(isDark)}
          >
            <PhotoUpload
              isDark={isDark}
              value={p.photo}
              onChange={(v) => update('photo', v)}
              isApproved={isFieldApproved('photo')}
              isRejected={isFieldRejected('photo')}
            />
            <p
              className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                isDark ? 'text-white/55' : 'text-navy-deep/55'
              }`}
            >
              {isCorrectionMode ? 'Needs Correction' : 'Admin Candidate'}
            </p>
            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
                <span className={isDark ? 'text-white/60' : 'text-navy-deep/60'}>
                  Profile Strength
                </span>
                <span className="text-amber">{progress}%</span>
              </div>
              <div
                className={`mt-1.5 h-1.5 w-full overflow-hidden rounded-full ${
                  isDark ? 'bg-white/10' : 'bg-navy-deep/10'
                }`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber to-orange-400 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div
            className="rounded-2xl border p-5 backdrop-blur-2xl"
            style={panelStyle(isDark)}
          >
            <p
              className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                isDark ? 'text-white/55' : 'text-navy-deep/55'
              }`}
            >
              Required Documents
            </p>
            <ChecklistItem isDark={isDark}
              done={!!(p.dob && p.gender && p.nationality && p.address && p.phone)}
              title="Personal Information" hint="Identity & phone" />
            <ChecklistItem isDark={isDark}
              done={!!(p.cin && p.cinDocUrl && p.cinDocBackUrl && p.passport && p.passportExpiry && p.passportDocUrl)}
              title="Identification" hint="CIN & Passport" />
            <ChecklistItem isDark={isDark}
              done={!!(p.emergencyName && p.emergencyPhone)}
              title="Emergency Contact" hint="Name & phone" last />
          </div>
        </aside>

        {/* ── Right sections ──────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* API error */}
          {apiError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          {/* 1 — Personal Info */}
          <Section isDark={isDark} icon={<User className="h-4 w-4" />} title="Personal Information">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldWrap
                isDark={isDark}
                label="Date of Birth"
                icon={<Calendar className="h-4 w-4" />}
                isApproved={isFieldApproved('dob')}
                isRejected={isFieldRejected('dob')}
              >
                <input
                  type="date"
                  value={p.dob}
                  max={MAX_DOB_STRING}
                  onChange={(e) => { update('dob', e.target.value); clearErr('dob'); }}
                  className={getInputClass('dob', true)}
                  disabled={isFieldApproved('dob')}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                />
                {errors.dob && <ErrMsg msg={errors.dob} />}
              </FieldWrap>

              <FieldWrap
                isDark={isDark}
                label="Gender"
                isApproved={isFieldApproved('gender')}
                isRejected={isFieldRejected('gender')}
              >
                <select
                  value={p.gender}
                  onChange={(e) => { update('gender', e.target.value); clearErr('gender'); }}
                  className={getInputClass('gender')}
                  disabled={isFieldApproved('gender')}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="na">Prefer not to say</option>
                </select>
                {errors.gender && <ErrMsg msg={errors.gender} />}
              </FieldWrap>

              <FieldWrap
                isDark={isDark}
                label="Nationality"
                icon={<Globe className="h-4 w-4" />}
                isApproved={isFieldApproved('nationality')}
                isRejected={isFieldRejected('nationality')}
              >
                <input
                  type="text"
                  list="country-list"
                  placeholder="Type to search"
                  value={p.nationality}
                  onChange={(e) => { update('nationality', e.target.value); clearErr('nationality'); }}
                  className={getInputClass('nationality', true)}
                  disabled={isFieldApproved('nationality')}
                />
                <datalist id="country-list">
                  {COUNTRIES.slice(0, 80).map((c) => <option key={c} value={c} />)}
                </datalist>
                {errors.nationality && <ErrMsg msg={errors.nationality} />}
              </FieldWrap>

              <FieldWrap
                isDark={isDark}
                label="Residential Address"
                icon={<MapPin className="h-4 w-4" />}
                isApproved={isFieldApproved('address')}
                isRejected={isFieldRejected('address')}
              >
                <input
                  type="text"
                  placeholder="Street, city, country"
                  value={p.address}
                  onChange={(e) => { update('address', e.target.value); clearErr('address'); }}
                  className={getInputClass('address', true)}
                  disabled={isFieldApproved('address')}
                />
                {errors.address && <ErrMsg msg={errors.address} />}
              </FieldWrap>

              <FieldWrap
                isDark={isDark}
                label="Phone Number"
                icon={<Phone className="h-4 w-4" />}
                isApproved={isFieldApproved('phone')}
                isRejected={isFieldRejected('phone')}
              >
                <input
                  type="tel"
                  placeholder="+216 XX XXX XXX"
                  value={p.phone}
                  onChange={(e) => {
                    update('phone', formatTunisiaPhoneInput(e.target.value));
                    clearErr('phone');
                  }}
                  className={getInputClass('phone', true)}
                  disabled={isFieldApproved('phone')}
                />
                {errors.phone && <ErrMsg msg={errors.phone} />}
              </FieldWrap>
            </div>
          </Section>

          {/* 2 — Identification */}
          <Section isDark={isDark} icon={<IdCard className="h-4 w-4" />} title="Identification Information">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldWrap
                  isDark={isDark}
                  label="CIN Number"
                  icon={<IdCard className="h-4 w-4" />}
                  isApproved={isFieldApproved('cin')}
                  isRejected={isFieldRejected('cin')}
                >
                  <input
                    type="text"
                    placeholder="12345678"
                    value={p.cin}
                    maxLength={8}
                    onChange={(e) => {
                      update('cin', e.target.value.replace(/\D/g, '').slice(0, 8));
                      clearErr('cin');
                    }}
                    className={getInputClass('cin', true) + ' font-mono'}
                    disabled={isFieldApproved('cin')}
                  />
                  {errors.cin && <ErrMsg msg={errors.cin} />}
                </FieldWrap>
              </div>

              <FileDropzone
                isDark={isDark}
                label="CIN Front / Document *"
                hint="Front side of your national ID · JPG, PNG, PDF (Max 5MB)"
                value={p.cinDocUrl}
                onChange={handleCinDoc}
                accept={ID_DOC_ACCEPT}
                icon={<FileText className="h-5 w-5" />}
                error={errors.cinDocUrl}
                isApproved={isFieldApproved('cinDocUrl')}
                isRejected={isFieldRejected('cinDocUrl')}
              />

              <FileDropzone
                isDark={isDark}
                label="CIN Back / Document *"
                hint="Back side of your national ID · JPG, PNG, PDF (Max 5MB)"
                value={p.cinDocBackUrl}
                onChange={handleCinDocBack}
                accept={ID_DOC_ACCEPT}
                icon={<FileText className="h-5 w-5" />}
                error={errors.cinDocBackUrl}
                isApproved={isFieldApproved('cinDocBackUrl')}
                isRejected={isFieldRejected('cinDocBackUrl')}
              />

              <FileDropzone
                isDark={isDark}
                label="Passport Document *"
                hint="Main bio page · PDF, JPG, PNG (Max 5MB)"
                value={p.passportDocUrl}
                onChange={handlePassportDoc}
                accept={ID_DOC_ACCEPT}
                icon={<Plane className="h-5 w-5" />}
                error={errors.passportDocUrl}
                isApproved={isFieldApproved('passportDocUrl')}
                isRejected={isFieldRejected('passportDocUrl')}
              />
            </div>
          </Section>

          {/* 3 — Travel Info */}
          <Section isDark={isDark} icon={<Plane className="h-4 w-4" />} title="Travel Information">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldWrap
                isDark={isDark}
                label="Passport Number"
                icon={<Plane className="h-4 w-4" />}
                isApproved={isFieldApproved('passport')}
                isRejected={isFieldRejected('passport')}
              >
                <input
                  type="text"
                  placeholder="AB123456"
                  value={p.passport}
                  onChange={(e) => { update('passport', e.target.value); clearErr('passport'); }}
                  className={getInputClass('passport', true) + ' font-mono'}
                  disabled={isFieldApproved('passport')}
                />
                {errors.passport && <ErrMsg msg={errors.passport} />}
              </FieldWrap>

              <FieldWrap
                isDark={isDark}
                label="Passport Expiry Date"
                icon={<Calendar className="h-4 w-4" />}
                isApproved={isFieldApproved('passportExpiry')}
                isRejected={isFieldRejected('passportExpiry')}
              >
                <input
                  type="date"
                  value={p.passportExpiry}
                  min={MIN_PASSPORT_EXPIRY}
                  onChange={(e) => { update('passportExpiry', e.target.value); clearErr('passportExpiry'); }}
                  className={getInputClass('passportExpiry', true)}
                  disabled={isFieldApproved('passportExpiry')}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                />
                {errors.passportExpiry && <ErrMsg msg={errors.passportExpiry} />}
              </FieldWrap>
            </div>
          </Section>

          {/* 4 — Emergency Contact */}
          <Section isDark={isDark} icon={<Phone className="h-4 w-4" />} title="Emergency Contact">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldWrap
                isDark={isDark}
                label="Contact Name"
                icon={<User className="h-4 w-4" />}
                isApproved={isFieldApproved('emergencyName')}
                isRejected={isFieldRejected('emergencyName')}
              >
                <input
                  type="text"
                  placeholder="Full name"
                  value={p.emergencyName}
                  onChange={(e) => { update('emergencyName', e.target.value); clearErr('emergencyName'); }}
                  className={getInputClass('emergencyName', true)}
                  disabled={isFieldApproved('emergencyName')}
                />
                {errors.emergencyName && <ErrMsg msg={errors.emergencyName} />}
              </FieldWrap>

              <FieldWrap
                isDark={isDark}
                label="Contact Phone"
                icon={<Phone className="h-4 w-4" />}
                isApproved={isFieldApproved('emergencyPhone')}
                isRejected={isFieldRejected('emergencyPhone')}
              >
                <input
                  type="tel"
                  placeholder="+216 XX XXX XXX"
                  value={p.emergencyPhone}
                  onChange={(e) => {
                    update('emergencyPhone', formatTunisiaPhoneInput(e.target.value));
                    clearErr('emergencyPhone');
                  }}
                  className={getInputClass('emergencyPhone', true)}
                  disabled={isFieldApproved('emergencyPhone')}
                />
                {errors.emergencyPhone && <ErrMsg msg={errors.emergencyPhone} />}
              </FieldWrap>

              <FieldWrap
                isDark={isDark}
                label="Relationship"
                isApproved={isFieldApproved('emergencyRel')}
                isRejected={isFieldRejected('emergencyRel')}
              >
                <select
                  value={p.emergencyRel}
                  onChange={(e) => { update('emergencyRel', e.target.value); clearErr('emergencyRel'); }}
                  className={getInputClass('emergencyRel')}
                  disabled={isFieldApproved('emergencyRel')}
                >
                  {['Parent','Spouse','Sibling','Friend','Other'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {errors.emergencyRel && <ErrMsg msg={errors.emergencyRel} />}
              </FieldWrap>
            </div>
          </Section>

          {/* Security note */}
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 text-xs ${
              isDark
                ? 'border-white/10 bg-white/5 text-white/70'
                : 'border-navy-deep/10 bg-navy-deep/[0.03] text-navy-deep/70'
            }`}
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
            <p>
              Your documents are encrypted and stored securely in accordance with aviation
              security standards. Data is used solely for personnel vetting and credentialing.
            </p>
          </div>

          {/* Footer actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {isCorrectionMode ? (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-500/25 bg-red-500/5 px-5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => window.history.back()}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-5 text-sm font-medium transition ${
                  isDark
                    ? 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                    : 'border-navy-deep/15 bg-white/60 text-navy-deep hover:bg-white'
                }`}
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold text-navy-deep shadow-lg transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, oklch(0.82 0.16 75), oklch(0.74 0.17 65))',
                boxShadow: '0 10px 30px -8px oklch(0.78 0.16 75 / 0.45)',
              }}
            >
              {submitting ? 'Submitting…' : isCorrectionMode ? 'Resubmit Profile' : 'Submit Profile'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </form>
    </AdminOnboardingShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({
  isDark, icon, title, children,
}: {
  isDark: boolean; icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-6 backdrop-blur-2xl sm:p-7"
      style={panelStyle(isDark)}
    >
      <div className="mb-5 flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            isDark ? 'bg-amber/15 text-amber' : 'bg-amber/20 text-amber'
          }`}
        >
          {icon}
        </span>
        <h2
          className={`text-base font-semibold tracking-tight ${
            isDark ? 'text-white' : 'text-navy-deep'
          }`}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function FieldWrap({
  isDark, label, icon, children, isApproved, isRejected,
}: {
  isDark: boolean; label: string; icon?: React.ReactNode; children: React.ReactNode; isApproved?: boolean; isRejected?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={labelCls(isDark) + " !mb-0"}>{label}</label>
        {isApproved && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
            <Check className="h-2.5 w-2.5" /> Approved
          </span>
        )}
        {isRejected && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400 border border-red-500/20 animate-pulse">
            <AlertCircle className="h-2.5 w-2.5" /> Needs correction
          </span>
        )}
      </div>
      <div className="relative">
        {icon && (
          <div
            className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${
              isDark ? 'text-white/40' : 'text-navy-deep/40'
            }`}
          >
            {icon}
          </div>
        )}
        {children}
      </div>
      {isRejected && (
        <div className="mt-1 flex items-start gap-1 text-[11px] text-red-400/90 font-medium">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>Please review and correct this field.</span>
        </div>
      )}
    </div>
  );
}

function PhotoUpload({
  isDark, value, onChange, isApproved, isRejected,
}: {
  isDark: boolean; value: string | null; onChange: (v: string | null) => void; isApproved?: boolean; isRejected?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <button
          type="button"
          disabled={isApproved}
          onClick={() => ref.current?.click()}
          className={`group relative h-24 w-24 overflow-hidden rounded-full border-2 border-dashed transition ${
            isApproved
              ? 'border-emerald-500/30 opacity-60 cursor-not-allowed bg-emerald-500/[0.01]'
              : isRejected
                ? 'border-red-500 bg-red-500/5 hover:border-red-400'
                : isDark
                  ? 'border-white/20 bg-white/5 hover:border-amber/60'
                  : 'border-navy-deep/20 bg-navy-deep/[0.04] hover:border-amber/60'
          }`}
        >
          {value ? (
            <img src={value} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${isDark ? 'text-white/50' : 'text-navy-deep/50'}`}>
              <User className="h-9 w-9" />
            </div>
          )}
          {!isApproved && (
            <div className={`absolute bottom-0 right-0 flex h-7 w-7 -translate-x-1 -translate-y-1 items-center justify-center rounded-full text-navy-deep shadow ${
              isRejected ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-amber hover:bg-amber-light'
            }`}>
              <Camera className="h-3.5 w-3.5" />
            </div>
          )}
        </button>
        {isApproved && (
          <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow border-2 border-[#0f172a]">
            <Check className="h-3 w-3" />
          </div>
        )}
        {isRejected && (
          <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow border-2 border-[#0f172a] animate-pulse">
            <AlertCircle className="h-3 w-3" />
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept={PHOTO_ACCEPT}
        className="hidden"
        disabled={isApproved}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => onChange(typeof reader.result === 'string' ? reader.result : null);
          reader.readAsDataURL(file);
        }}
      />
      <div className="mt-3 flex flex-col items-center">
        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-navy-deep'}`}>
          Profile Photo
        </p>
        {isApproved && (
          <span className="mt-1 inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 border border-emerald-500/20">
            <Check className="h-2 w-2" /> Approved
          </span>
        )}
        {isRejected && (
          <span className="mt-1 inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-400 border border-red-500/20 animate-pulse">
            <AlertCircle className="h-2 w-2" /> Needs correction
          </span>
        )}
      </div>
    </div>
  );
}

function FileDropzone({
  isDark, label, hint, value, onChange, accept, icon, error, isApproved, isRejected,
}: {
  isDark: boolean;
  label: string;
  hint: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept: string;
  icon: React.ReactNode;
  error?: string;
  isApproved?: boolean;
  isRejected?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const hasFile = !!value;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={labelCls(isDark) + " !mb-0"}>{label}</label>
        {isApproved && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
            <Check className="h-2.5 w-2.5" /> Approved
          </span>
        )}
        {isRejected && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400 border border-red-500/20 animate-pulse">
            <AlertCircle className="h-2.5 w-2.5" /> Needs correction
          </span>
        )}
      </div>
      <button
        type="button"
        disabled={isApproved}
        onClick={() => ref.current?.click()}
        className={`mt-1 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition ${
          isApproved
            ? isDark
              ? 'border-emerald-500/20 bg-emerald-500/[0.02] opacity-60 cursor-not-allowed'
              : 'border-emerald-500/20 bg-emerald-500/[0.01] opacity-60 cursor-not-allowed'
            : isRejected
              ? 'border-red-500/40 bg-red-500/5 hover:border-red-400'
              : hasFile
                ? isDark
                  ? 'border-emerald-400/40 bg-emerald-400/5'
                  : 'border-emerald-500/50 bg-emerald-500/5'
                : error
                  ? 'border-red-500/40 bg-red-500/5'
                  : isDark
                    ? 'border-white/15 bg-white/[0.03] hover:border-amber/50 hover:bg-amber/[0.04]'
                    : 'border-navy-deep/15 bg-navy-deep/[0.02] hover:border-amber/50 hover:bg-amber/[0.04]'
        }`}
      >
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            isApproved
              ? 'bg-emerald-500/10 text-emerald-500'
              : hasFile
                ? 'bg-emerald-500/20 text-emerald-400'
                : isRejected
                  ? 'bg-red-500/10 text-red-400'
                  : isDark
                    ? 'bg-white/10 text-white/70'
                    : 'bg-navy-deep/10 text-navy-deep/70'
          }`}
        >
          {isApproved ? <Check className="h-5 w-5" /> : hasFile ? <Check className="h-5 w-5" /> : icon}
        </span>
        <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-navy-deep'} ${isApproved ? 'opacity-60' : ''}`}>
          {isApproved ? 'Document Approved' : hasFile ? 'File uploaded — click to change' : 'Click to upload'}
        </span>
        <span className={`text-[11px] ${isDark ? 'text-white/50' : 'text-navy-deep/50'}`}>
          {isApproved ? 'Locked' : hint}
        </span>
        {!hasFile && !isApproved && !isRejected && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber">
            <Upload className="h-3 w-3" /> Upload
          </span>
        )}
        {isRejected && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-red-400">
            <Upload className="h-3 w-3 animate-bounce" /> Correct Upload
          </span>
        )}
      </button>
      <input ref={ref} type="file" accept={accept} className="hidden" disabled={isApproved} onChange={onChange} />
      {error && <ErrMsg msg={error} />}
      {isRejected && (
        <div className="mt-1 flex items-start gap-1 text-[11px] text-red-400/90 font-medium">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>Please upload a valid/corrected document.</span>
        </div>
      )}
    </div>
  );
}

function ChecklistItem({
  isDark, done, title, hint, last = false,
}: {
  isDark: boolean; done: boolean; title: string; hint: string; last?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 py-2 ${
        !last ? (isDark ? 'border-b border-white/5' : 'border-b border-navy-deep/5') : ''
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          done
            ? 'bg-emerald-500/20 text-emerald-400'
            : isDark
              ? 'bg-white/10 text-white/40'
              : 'bg-navy-deep/10 text-navy-deep/40'
        }`}
      >
        {done ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-navy-deep'}`}>{title}</p>
        <p className={`text-xs ${isDark ? 'text-white/50' : 'text-navy-deep/50'}`}>{hint}</p>
      </div>
    </div>
  );
}

function ErrMsg({ msg }: { msg: string }) {
  return (
    <span className="mt-1.5 flex items-center gap-1.5 rounded-md bg-red-500/10 border border-red-500/20 px-2 py-1 text-[11px] font-medium text-red-400 animate-fade-in">
      <AlertCircle size={12} className="shrink-0 text-red-400 animate-pulse" />
      <span>{msg}</span>
    </span>
  );
}


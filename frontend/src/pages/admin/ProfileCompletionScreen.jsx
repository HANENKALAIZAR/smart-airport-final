/**
 * ProfileCompletionScreen — Phase 3
 * ===================================
 * Shown after password change when profile_complete=false.
 * Sections: Personal Info, Contact, ID (CIN + Passport), Emergency Contact.
 */
import { useState, useRef, createElement } from 'react';
import {
  Camera,
  Phone,
  Calendar,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader,
  User,
  FileText,
  MapPin,
  Users,
} from 'lucide-react';
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
import CustomSelect from '../../components/ui/CustomSelect';


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

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria', 'Bahrain', 'Bangladesh',
  'Belgium', 'Brazil', 'Bulgaria', 'Canada', 'China', 'Colombia', 'Croatia', 'Cyprus', 'Czech Republic',
  'Denmark', 'Egypt', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'India',
  'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan', 'Kenya', 'Kuwait',
  'Latvia', 'Lebanon', 'Libya', 'Lithuania', 'Luxembourg', 'Malaysia', 'Malta', 'Mexico', 'Morocco',
  'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Palestine', 'Poland',
  'Portugal', 'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Serbia', 'Singapore', 'Slovakia',
  'Slovenia', 'South Africa', 'South Korea', 'Spain', 'Sudan', 'Sweden', 'Switzerland', 'Syria',
  'Tunisia', 'Turkey', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States',
  'Venezuela', 'Vietnam', 'Yemen',
].sort((a, b) => a.localeCompare(b));

function emergencyPhoneError(raw) {
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

function passportNumberError(s) {
  const t = String(s || '').trim();
  if (t.length < 6) return 'Passport number must be at least 6 characters';
  if (!/^[A-Za-z]+[0-9][A-Za-z0-9]*$/.test(t)) {
    return 'Use letter(s) followed by digits (e.g. AB123456)';
  }
  return '';
}

function ProgressStep({ step, current }) {
  const done = current > step;
  const active = current === step;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          fontWeight: 700,
          background: done ? '#22c55e' : active ? '#1E90FF' : 'rgba(255,255,255,0.1)',
          color: done || active ? '#fff' : 'rgba(255,255,255,0.3)',
          border: `2px solid ${done ? '#22c55e' : active ? '#1E90FF' : 'rgba(255,255,255,0.1)'}`,
          transition: 'all 0.3s ease',
        }}
      >
        {done ? <CheckCircle size={14} /> : step}
      </div>
      <span
        style={{
          fontSize: '0.82rem',
          fontWeight: active ? 700 : 400,
          color: active ? '#fff' : done ? '#4ade80' : 'rgba(255,255,255,0.35)',
        }}
      >
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
          marginTop: 8,
          border: `2px dashed ${borderBad || 'rgba(30,144,255,0.3)'}`,
          borderRadius: 12,
          padding: '16px',
          cursor: 'pointer',
          textAlign: 'center',
          background: value ? 'rgba(30,144,255,0.05)' : 'rgba(255,255,255,0.02)',
          transition: 'border-color 0.2s, background 0.2s',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          if (!error) e.currentTarget.style.borderColor = 'rgba(30,144,255,0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = borderBad || (value ? 'rgba(30,144,255,0.4)' : 'rgba(30,144,255,0.3)');
        }}
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
              <img
                src={value}
                alt="preview"
                style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 8, objectFit: 'cover' }}
              />
            )}
            <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#60a5fa' }}>Click to change</p>
          </div>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.35)' }}>
            {createElement(icon, { size: 28, style: { marginBottom: 8 } })}
            <p style={{ margin: 0, fontSize: '0.82rem' }}>Click to upload</p>
            {hint && (
              <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)' }}>{hint}</p>
            )}
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
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function SectionTitle({ children }) {
  return (
    <h3
      style={{
        margin: '8px 0 4px',
        fontSize: '0.82rem',
        fontWeight: 700,
        color: '#93c5fd',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: 8,
      }}
    >
      {children}
    </h3>
  );
}

export default function ProfileCompletionScreen({ user, onComplete }) {
  const [form, setForm] = useState({
    phone: '+216 ',
    dob: '',
    nationality: '',
    gender: 'Male',
    address: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRel: 'Parent',
    cinNumber: '',
    cinDocUrl: '',
    passportNumber: '',
    passportDocUrl: '',
    passportExpiry: '',
    photoUrl: '',
  });
  const [countryFilter, setCountryFilter] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);

  const firstName = user?.full_name?.split(' ')[0] || 'Admin';

  async function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fe = validateProfilePhotoFile(file);
    if (fe) {
      setErrors((er) => ({ ...er, photoUrl: fe }));
      return;
    }
    const url = await fileToDataUrl(file);
    setForm((f) => ({ ...f, photoUrl: url }));
    setErrors((er) => ({ ...er, photoUrl: '' }));
  }

  async function handleCinDoc(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fe = validateIdDocumentFile(file);
    if (fe) {
      setErrors((er) => ({ ...er, cinDocUrl: fe }));
      return;
    }
    const url = await fileToDataUrl(file);
    setForm((f) => ({ ...f, cinDocUrl: url }));
    setErrors((er) => ({ ...er, cinDocUrl: '' }));
  }

  async function handlePassportDoc(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fe = validateIdDocumentFile(file);
    if (fe) {
      setErrors((er) => ({ ...er, passportDocUrl: fe }));
      return;
    }
    const url = await fileToDataUrl(file);
    setForm((f) => ({ ...f, passportDocUrl: url }));
    setErrors((er) => ({ ...er, passportDocUrl: '' }));
  }

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
    if (!(form.nationality || '').trim()) errs.nationality = 'Nationality is required';
    if (!form.gender) errs.gender = 'Gender is required';
    if (!(form.address || '').trim()) errs.address = 'Residential address is required';
    if (!(form.emergencyName || '').trim()) errs.emergencyName = 'Emergency contact name is required';
    const ep = emergencyPhoneError(form.emergencyPhone);
    if (ep) errs.emergencyPhone = ep;
    if (!form.emergencyRel) errs.emergencyRel = 'Relationship is required';

    if (!/^\d{8}$/.test((form.cinNumber || '').trim())) errs.cinNumber = 'CIN must be exactly 8 digits';
    if (!form.cinDocUrl) errs.cinDocUrl = 'CIN document is required';

    const pe = passportNumberError(form.passportNumber);
    if (pe) errs.passportNumber = pe;
    if (!form.passportDocUrl) errs.passportDocUrl = 'Passport document is required';
    if (!form.passportExpiry) errs.passportExpiry = 'Passport expiry is required';
    else if (new Date(form.passportExpiry) <= new Date()) {
      errs.passportExpiry = 'Passport must not be expired';
    }

    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    setApiError('');
    const { error } = await apiCompleteProfile({
      phone_number: form.phone.replace(/\s/g, ''),
      date_of_birth: form.dob,
      nationality: form.nationality.trim(),
      gender: form.gender,
      residential_address: form.address.trim(),
      emergency_contact_name: form.emergencyName.trim(),
      emergency_contact_phone: form.emergencyPhone.replace(/[^\d+]/g, ''),
      emergency_contact_relationship: form.emergencyRel,
      cin_number: form.cinNumber.trim(),
      cin_document_url: form.cinDocUrl,
      passport_number: form.passportNumber.trim().toUpperCase(),
      passport_document_url: form.passportDocUrl,
      passport_expiry_date: form.passportExpiry,
      profile_photo_url: form.photoUrl,
    });
    setSubmitting(false);

    if (error) {
      setApiError(error);
      return;
    }
    setSuccess(true);
    setTimeout(() => onComplete(), 1500);
  }

  const filteredCountries = countryFilter
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(countryFilter.toLowerCase()))
    : COUNTRIES;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '40px 16px 60px',
      }}
    >
      <p
        style={{
          margin: '0 0 12px',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#1E90FF',
          letterSpacing: '0.04em',
        }}
      >
        Step 2 of 2 — Complete Your Profile
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 36 }}>
        <ProgressStep step={1} current={2} />
        <div style={{ width: 40, height: 2, background: 'rgba(34,197,94,0.5)', borderRadius: 1 }} />
        <ProgressStep step={2} current={2} />
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a5f, #1E90FF22)',
            padding: '28px 32px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(30,144,255,0.15)',
              border: '2px solid rgba(30,144,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
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
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Profile submitted!</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: 6 }}>Awaiting super admin approval…</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {apiError && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5',
                  fontSize: '0.84rem',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{apiError}</span>
              </div>
            )}

            <SectionTitle>1 — Personal info</SectionTitle>
            <FileUploadField
              label="Profile Photo *"
              icon={Camera}
              value={form.photoUrl}
              onChange={handlePhotoChange}
              accept={PHOTO_ACCEPT}
              hint="JPG or PNG only — max 2MB"
              error={errors.photoUrl}
            />

            <div>
              <label style={labelStyle}>Nationality *</label>
              <input
                className="admin-form-input"
                style={{ marginTop: 8, borderColor: errors.nationality ? 'rgba(239,68,68,0.5)' : undefined }}
                list="country-list"
                value={form.nationality}
                placeholder="Type to search"
                onChange={(e) => {
                  setForm((f) => ({ ...f, nationality: e.target.value }));
                  setCountryFilter(e.target.value);
                  setErrors((er) => ({ ...er, nationality: '' }));
                }}
              />
              <datalist id="country-list">
                {filteredCountries.slice(0, 80).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {errors.nationality && <ErrMsg msg={errors.nationality} />}
            </div>

            <div>
              <label style={labelStyle}>Gender *</label>
              <div style={{ marginTop: 8 }}>
                <CustomSelect
                  options={[
                    { value: 'Male', label: 'Male' },
                    { value: 'Female', label: 'Female' },
                  ]}
                  value={form.gender}
                  onChange={(val) => setForm((f) => ({ ...f, gender: val }))}
                />
              </div>
              {errors.gender && <ErrMsg msg={errors.gender} />}
            </div>

            <div>
              <label style={labelStyle}>Date of Birth *</label>
              <div style={{ marginTop: 8, position: 'relative' }}>
                <Calendar size={16} style={iconStyle} />
                <input
                  type="date"
                  className="admin-form-input"
                  style={{
                    paddingLeft: 36,
                    colorScheme: 'dark',
                    borderColor: errors.dob ? 'rgba(239,68,68,0.5)' : undefined,
                  }}
                  max={MAX_DOB_STRING}
                  value={form.dob}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, dob: e.target.value }));
                    setErrors((er) => ({ ...er, dob: '' }));
                  }}
                  required
                />
              </div>
              {errors.dob && <ErrMsg msg={errors.dob} />}
            </div>

            <SectionTitle>2 — Contact</SectionTitle>
            <div>
              <label style={labelStyle}>Phone Number *</label>
              <div style={{ marginTop: 8, position: 'relative' }}>
                <Phone size={16} style={iconStyle} />
                <input
                  className="admin-form-input"
                  style={{
                    paddingLeft: 36,
                    borderColor: errors.phone ? 'rgba(239,68,68,0.5)' : undefined,
                  }}
                  placeholder="+216 XX XXX XXX"
                  value={form.phone}
                  onChange={(e) => {
                    const v = formatTunisiaPhoneInput(e.target.value);
                    setForm((f) => ({ ...f, phone: v }));
                    setErrors((er) => ({ ...er, phone: '' }));
                  }}
                  required
                />
              </div>
              {errors.phone && <ErrMsg msg={errors.phone} />}
            </div>

            <div>
              <label style={labelStyle}>Residential Address *</label>
              <div style={{ marginTop: 8, position: 'relative' }}>
                <MapPin size={16} style={{ ...iconStyle, top: 14, transform: 'none' }} />
                <textarea
                  className="admin-form-input"
                  style={{
                    paddingLeft: 36,
                    minHeight: 72,
                    resize: 'vertical',
                    borderColor: errors.address ? 'rgba(239,68,68,0.5)' : undefined,
                  }}
                  placeholder="Full address"
                  value={form.address}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, address: e.target.value }));
                    setErrors((er) => ({ ...er, address: '' }));
                  }}
                />
              </div>
              {errors.address && <ErrMsg msg={errors.address} />}
            </div>

            <SectionTitle>3 — ID information (CIN + Passport)</SectionTitle>
            <div>
              <label style={labelStyle}>CIN Number *</label>
              <input
                className="admin-form-input"
                style={{
                  marginTop: 8,
                  fontFamily: 'monospace',
                  borderColor: errors.cinNumber ? 'rgba(239,68,68,0.5)' : undefined,
                }}
                placeholder="12345678"
                value={form.cinNumber}
                maxLength={8}
                onChange={(e) => {
                  setForm((f) => ({ ...f, cinNumber: e.target.value.replace(/\D/g, '').slice(0, 8) }));
                  setErrors((er) => ({ ...er, cinNumber: '' }));
                }}
              />
              {errors.cinNumber && <ErrMsg msg={errors.cinNumber} />}
            </div>
            <FileUploadField
              label="CIN Document *"
              icon={Upload}
              value={form.cinDocUrl}
              onChange={handleCinDoc}
              accept={ID_DOC_ACCEPT}
              hint="JPG, PNG or PDF — max 5MB"
              error={errors.cinDocUrl}
            />

            <div>
              <label style={labelStyle}>Passport Number *</label>
              <input
                className="admin-form-input"
                style={{
                  marginTop: 8,
                  fontFamily: 'monospace',
                  borderColor: errors.passportNumber ? 'rgba(239,68,68,0.5)' : undefined,
                }}
                placeholder="AB123456"
                value={form.passportNumber}
                onChange={(e) => {
                  setForm((f) => ({ ...f, passportNumber: e.target.value }));
                  setErrors((er) => ({ ...er, passportNumber: '' }));
                }}
              />
              {errors.passportNumber && <ErrMsg msg={errors.passportNumber} />}
            </div>
            <FileUploadField
              label="Passport Document *"
              icon={Upload}
              value={form.passportDocUrl}
              onChange={handlePassportDoc}
              accept={ID_DOC_ACCEPT}
              hint="JPG, PNG or PDF — max 5MB"
              error={errors.passportDocUrl}
            />
            <div>
              <label style={labelStyle}>Passport Expiry Date *</label>
              <div style={{ marginTop: 8, position: 'relative' }}>
                <Calendar size={16} style={iconStyle} />
                <input
                  type="date"
                  className="admin-form-input"
                  style={{
                    paddingLeft: 36,
                    colorScheme: 'dark',
                    borderColor: errors.passportExpiry ? 'rgba(239,68,68,0.5)' : undefined,
                  }}
                  min={MIN_PASSPORT_EXPIRY}
                  value={form.passportExpiry}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, passportExpiry: e.target.value }));
                    setErrors((er) => ({ ...er, passportExpiry: '' }));
                  }}
                />
              </div>
              {errors.passportExpiry && <ErrMsg msg={errors.passportExpiry} />}
            </div>

            <SectionTitle>4 — Emergency contact</SectionTitle>
            <div>
              <label style={labelStyle}>Emergency Contact Name *</label>
              <input
                className="admin-form-input"
                style={{ marginTop: 8, borderColor: errors.emergencyName ? 'rgba(239,68,68,0.5)' : undefined }}
                value={form.emergencyName}
                onChange={(e) => {
                  setForm((f) => ({ ...f, emergencyName: e.target.value }));
                  setErrors((er) => ({ ...er, emergencyName: '' }));
                }}
              />
              {errors.emergencyName && <ErrMsg msg={errors.emergencyName} />}
            </div>
            <div>
              <label style={labelStyle}>Emergency Contact Phone *</label>
              <div style={{ marginTop: 8, position: 'relative' }}>
                <Phone size={16} style={iconStyle} />
                <input
                  className="admin-form-input"
                  style={{
                    paddingLeft: 36,
                    borderColor: errors.emergencyPhone ? 'rgba(239,68,68,0.5)' : undefined,
                  }}
                  placeholder="+216 … or +1 …"
                  value={form.emergencyPhone}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, emergencyPhone: e.target.value }));
                    setErrors((er) => ({ ...er, emergencyPhone: '' }));
                  }}
                />
              </div>
              {errors.emergencyPhone && <ErrMsg msg={errors.emergencyPhone} />}
            </div>
            <div>
              <label style={labelStyle}>Relationship *</label>
              <div style={{ marginTop: 8 }}>
                <CustomSelect
                  options={['Parent', 'Spouse', 'Sibling', 'Friend', 'Other'].map((r) => ({ value: r, label: r }))}
                  value={form.emergencyRel}
                  onChange={(val) => setForm((f) => ({ ...f, emergencyRel: val }))}
                />
              </div>
              {errors.emergencyRel && <ErrMsg msg={errors.emergencyRel} />}
            </div>

            <button
              type="submit"
              className="admin-btn admin-btn--primary"
              disabled={submitting}
              style={{
                marginTop: 8,
                height: 48,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {submitting ? (
                <>
                  <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…
                </>
              ) : (
                '✅ Submit Profile for Approval'
              )}
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

const labelStyle = {
  fontSize: '0.78rem',
  color: 'rgba(255,255,255,0.5)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
const iconStyle = {
  position: 'absolute',
  left: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'rgba(255,255,255,0.3)',
  pointerEvents: 'none',
};

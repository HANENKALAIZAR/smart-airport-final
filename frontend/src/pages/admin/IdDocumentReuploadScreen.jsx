/**
 * Shown when profile is complete but super admin rejected identity documents.
 */
import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { apiReuploadIdDocument } from '../../services/adminApi';
import { validateIdDocumentFile, ERR_ID_FORMAT } from '../../utils/uploadValidation';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function IdDocumentReuploadScreen({ user, onComplete }) {
  const [cinUrl, setCinUrl] = useState('');
  const [passportUrl, setPassportUrl] = useState('');
  const [docErr, setDocErr] = useState('');
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const cinRef = useRef();
  const passRef = useRef();

  async function onCinFile(e) {
    const file = e.target.files?.[0];
    setDocErr('');
    if (!file) return;
    const err = validateIdDocumentFile(file);
    if (err) {
      setDocErr(err);
      return;
    }
    setCinUrl(await fileToDataUrl(file));
  }

  async function onPassportFile(e) {
    const file = e.target.files?.[0];
    setDocErr('');
    if (!file) return;
    const err = validateIdDocumentFile(file);
    if (err) {
      setDocErr(err);
      return;
    }
    setPassportUrl(await fileToDataUrl(file));
  }

  async function submit(e) {
    e.preventDefault();
    if (!cinUrl && !passportUrl) {
      setDocErr(ERR_ID_FORMAT);
      return;
    }
    setSubmitting(true);
    setApiError('');
    const { error } = await apiReuploadIdDocument(cinUrl || null, passportUrl || null);
    setSubmitting(false);
    if (error) {
      setApiError(error);
      return;
    }
    setDone(true);
    setTimeout(() => onComplete(), 1200);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F172A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '28px 32px',
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#fff' }}>
          Re-upload identity documents
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
          Your previous submission was rejected
          {user?.id_document_rejection_reason
            ? `: ${user.id_document_rejection_reason}`
            : '.'}{' '}
          Upload at least one corrected document (JPG, PNG, or PDF, max 5MB each).
        </p>
        {done ? (
          <div style={{ textAlign: 'center', color: '#4ade80', padding: '2rem 0' }}>
            <CheckCircle size={40} style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 600 }}>Submitted for review</div>
          </div>
        ) : (
          <form onSubmit={submit}>
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
                  marginBottom: 16,
                }}
              >
                <AlertCircle size={16} />
                {apiError}
              </div>
            )}
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>CIN document</p>
            <input ref={cinRef} type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }} onChange={onCinFile} />
            <button
              type="button"
              onClick={() => cinRef.current?.click()}
              style={{
                width: '100%',
                border: '2px dashed rgba(30,144,255,0.35)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
                background: cinUrl ? 'rgba(30,144,255,0.06)' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {cinUrl ? (
                <div style={{ fontSize: '0.9rem' }}>CIN file selected — click to change</div>
              ) : (
                <div>
                  <Upload size={28} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: '0.85rem' }}>Upload CIN document</div>
                </div>
              )}
            </button>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>Passport document</p>
            <input ref={passRef} type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }} onChange={onPassportFile} />
            <button
              type="button"
              onClick={() => passRef.current?.click()}
              style={{
                width: '100%',
                border: '2px dashed rgba(30,144,255,0.35)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
                background: passportUrl ? 'rgba(30,144,255,0.06)' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {passportUrl ? (
                <div style={{ fontSize: '0.9rem' }}>Passport file selected — click to change</div>
              ) : (
                <div>
                  <Upload size={28} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: '0.85rem' }}>Upload passport document</div>
                </div>
              )}
            </button>
            {docErr && (
              <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#f87171' }}>{docErr}</p>
            )}
            <button
              type="submit"
              className="admin-btn admin-btn--primary"
              disabled={submitting || !!docErr || (!cinUrl && !passportUrl)}
              style={{ marginTop: 12, width: '100%', height: 44 }}
            >
              {submitting ? (
                <>
                  <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…
                </>
              ) : (
                'Submit for review'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

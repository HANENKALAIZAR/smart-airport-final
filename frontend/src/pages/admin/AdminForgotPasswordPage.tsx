/**
 * AdminForgotPasswordPage.tsx
 * ===========================
 * New premium forgot-password page — design from aviation-admin-login-main.
 * Business logic unchanged: calls apiForgotPassword() from existing adminApi.
 * Converted from JSX → TSX.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plane, ArrowLeft, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import bgImage from '../../assets/airport-night.jpg';
import { useAdminTheme, useAdminLang } from '../../hooks/useAdminPrefs';
import { apiForgotPassword } from '../../services/adminApi';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ForgotPasswordData {
  message?: string;
}

// ── Translations ──────────────────────────────────────────────────────────────
const tr = {
  fr: {
    badge:        'Récupération du compte',
    title:        'Mot de passe oublié',
    subtitle:     "Entrez votre adresse e-mail administrateur. Nous vous enverrons un lien pour réinitialiser votre mot de passe.",
    email:        'Adresse e-mail',
    submit:       'Envoyer le lien',
    back:         'Retour à la connexion',
    successTitle: 'Vérifiez votre boîte de réception',
    successBody:  "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.",
  },
  en: {
    badge:        'Account recovery',
    title:        'Forgot password',
    subtitle:     "Enter your administrator email. We'll send you a link to reset your password.",
    email:        'Email address',
    submit:       'Send reset link',
    back:         'Back to sign in',
    successTitle: 'Check your inbox',
    successBody:  'If an account exists for this address, a reset link has just been sent.',
  },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminForgotPasswordPage() {
  const [lang]            = useAdminLang();
  const [theme]           = useAdminTheme();
  const isDark            = theme === 'dark';
  const t                 = tr[lang];

  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Please enter your work email.');
      return;
    }
    setLoading(true);
    const { data, error: apiError } = await apiForgotPassword(email.trim());
    setLoading(false);

    if (apiError) {
      setError(apiError);
      return;
    }

    // Backend responds with a generic message regardless — treat as success
    const _data = data as ForgotPasswordData | null;
    void _data; // suppress unused warning
    setSent(true);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <img
        src={bgImage}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      {isDark ? (
        <div className="absolute inset-0 bg-gradient-to-br from-navy-deep/90 via-navy-deep/75 to-navy-mid/65" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-white/75 via-white/60 to-white/45" />
      )}

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link
            to="/admin/login"
            className={`mb-5 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider transition-opacity hover:opacity-70 ${
              isDark ? 'text-white/70' : 'text-navy-deep/70'
            }`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.back}
          </Link>

          <div
            className="rounded-2xl border p-8 shadow-2xl backdrop-blur-2xl sm:p-10"
            style={
              isDark
                ? {
                    background:
                      'linear-gradient(140deg, oklch(0.18 0.04 250 / 0.65), oklch(0.16 0.05 255 / 0.45))',
                    borderColor: 'oklch(1 0 0 / 0.15)',
                  }
                : {
                    background:
                      'linear-gradient(140deg, oklch(1 0 0 / 0.85), oklch(0.98 0.005 240 / 0.7))',
                    borderColor: 'oklch(0.16 0.05 255 / 0.1)',
                  }
            }
          >
            {/* Brand icon */}
            <div className="mb-6 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: 'oklch(0.78 0.16 75)' }}
              >
                <Plane className="h-5 w-5 text-navy-deep" strokeWidth={2.5} />
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
                  isDark ? 'text-white/60' : 'text-navy-deep/60'
                }`}
              >
                {t.badge}
              </span>
            </div>

            {sent ? (
              /* ── Success state ─────────────────────────────────── */
              <div className="text-center">
                <div
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: 'oklch(0.78 0.16 75 / 0.15)' }}
                >
                  <CheckCircle2 className="h-7 w-7 text-amber" />
                </div>
                <h1
                  className={`text-2xl font-semibold tracking-tight ${
                    isDark ? 'text-white' : 'text-navy-deep'
                  }`}
                >
                  {t.successTitle}
                </h1>
                <p
                  className={`mt-2 text-sm ${
                    isDark ? 'text-white/65' : 'text-navy-deep/65'
                  }`}
                >
                  {t.successBody}
                </p>
                <p className="mt-4 break-all text-sm font-medium text-amber">
                  {email}
                </p>
                <Link
                  to="/admin/login"
                  className="mt-7 inline-flex h-11 w-full items-center justify-center rounded-lg font-semibold text-navy-deep shadow-lg transition-all active:scale-[0.99]"
                  style={{
                    background:
                      'linear-gradient(135deg, oklch(0.82 0.16 75), oklch(0.74 0.17 65))',
                  }}
                >
                  {t.back}
                </Link>
              </div>
            ) : (
              /* ── Form state ────────────────────────────────────── */
              <>
                <h1
                  className={`text-2xl font-semibold tracking-tight sm:text-3xl ${
                    isDark ? 'text-white' : 'text-navy-deep'
                  }`}
                >
                  {t.title}
                </h1>
                <p
                  className={`mt-1.5 text-sm ${
                    isDark ? 'text-white/60' : 'text-navy-deep/65'
                  }`}
                >
                  {t.subtitle}
                </p>

                {/* Error banner */}
                {error && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form
                  id="admin-forgot-password-form"
                  onSubmit={handleSubmit}
                  className="mt-7 space-y-5"
                >
                  <div>
                    <label
                      htmlFor="forgot-email"
                      className={`mb-1.5 block text-xs font-medium uppercase tracking-wider ${
                        isDark ? 'text-white/70' : 'text-navy-deep/70'
                      }`}
                    >
                      {t.email}
                    </label>
                    <div className="relative">
                      <Mail
                        className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
                          isDark ? 'text-white/40' : 'text-navy-deep/40'
                        }`}
                      />
                      <input
                        id="forgot-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@name-airport.tn"
                        className={
                          'h-12 w-full rounded-lg border pl-10 pr-3.5 text-sm outline-none transition focus:ring-2 focus:ring-amber/30 focus:border-amber/60 ' +
                          (isDark
                            ? 'bg-white/5 border-white/15 text-white placeholder:text-white/35 focus:bg-white/10'
                            : 'bg-white/70 border-navy-deep/15 text-navy-deep placeholder:text-navy-deep/40 focus:bg-white')
                        }
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full rounded-lg font-semibold text-navy-deep shadow-lg transition-all active:scale-[0.99] disabled:opacity-70"
                    style={{
                      background:
                        'linear-gradient(135deg, oklch(0.82 0.16 75), oklch(0.74 0.17 65))',
                      boxShadow: '0 10px 30px -8px oklch(0.78 0.16 75 / 0.45)',
                    }}
                  >
                    {loading ? '…' : t.submit}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

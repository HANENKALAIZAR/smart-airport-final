/**
 * AdminResetPassword.tsx
 * ======================
 * Page opened from the password-reset email link.
 * Route: /admin/reset-password?token=RESET_TOKEN
 *
 * Flow:
 *  1. Reads ?token from query params.
 *  2. Validates the token via GET /api/auth/reset-password/validate.
 *  3. If valid → shows new-password form.
 *  4. On submit → POST /api/auth/reset-password.
 *  5. On success → redirects to /admin/login with a success flash message.
 *
 * This page is NOT behind ProtectedRoute — it must be accessible
 * without a JWT (admins who forgot their password are not logged in).
 *
 * Converted from JSX → TSX. Design matches the new premium auth pages.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  Lock, Eye, EyeOff, Check, X, ArrowRight, ShieldCheck,
  AlertCircle, CheckCircle2, Plane,
} from 'lucide-react';
import bgImage from '../../assets/airport-night.jpg';
import logoImage from '../../assets/logo.png';
import { useAdminTheme } from '../../hooks/useAdminPrefs';
import { apiValidateResetToken, apiResetPassword } from '../../services/adminApi';

// ── Types ─────────────────────────────────────────────────────────────────────
type TokenState = 'loading' | 'valid' | 'invalid';

// ── Password policy ───────────────────────────────────────────────────────────
type Rule = { key: string; label: string; test: (v: string) => boolean };

const RULES: Rule[] = [
  { key: 'len',     label: '8+ characters',      test: (v) => v.length >= 8 },
  { key: 'upper',   label: 'Uppercase letter',    test: (v) => /[A-Z]/.test(v) },
  { key: 'num',     label: 'Number',              test: (v) => /\d/.test(v) },
  { key: 'special', label: 'Special character',   test: (v) => /[!@#$%^&*]/.test(v) },
];

function scoreOf(v: string): number {
  return RULES.reduce((acc, r) => acc + (r.test(v) ? 1 : 0), 0);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate        = useNavigate();
  const [theme]         = useAdminTheme();
  const isDark          = theme === 'dark';

  const token = (searchParams.get('token') || '').trim();

  // Token validation state
  const [tokenState, setTokenState] = useState<TokenState>('loading');

  // Form state
  const [newPwd,   setNewPwd]   = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showNew,  setShowNew]  = useState(false);
  const [showCon,  setShowCon]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);

  // Derived strength
  const score   = useMemo(() => scoreOf(newPwd), [newPwd]);
  const matches = confirm.length > 0 && confirm === newPwd;
  const canSubmit = score === RULES.length && matches && !loading;

  const strengthLabel = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][score];
  const strengthColor = [
    'bg-red-500', 'bg-orange-500', 'bg-amber', 'bg-lime-500', 'bg-emerald-500',
  ][score];

  // ── Validate token on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setTokenState('invalid');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await apiValidateResetToken(token);
      if (cancelled) return;
      setTokenState(data?.valid ? 'valid' : 'invalid');
    })();
    return () => { cancelled = true; };
  }, [token]);

  // ── Submit handler ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (score < RULES.length) {
      setError('Your password does not meet the security requirements below.');
      return;
    }
    if (!matches) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { data, error: apiErr } = await apiResetPassword(token, newPwd, confirm);
    setLoading(false);

    if (apiErr) {
      // If the token was consumed/expired on this attempt, flip the UI
      const lower = String(apiErr).toLowerCase();
      if (lower.includes('expired') || lower.includes('already been used')) {
        setTokenState('invalid');
      }
      setError(apiErr);
      return;
    }

    // ── Success ─────────────────────────────────────────────────────────────
    setSuccess(true);
    setTimeout(() => {
      navigate('/admin/login', { replace: true, state: { passwordReset: true } });
    }, 2800);
  };

  // ── Shared card styles ─────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = isDark
    ? {
        background: 'linear-gradient(140deg, oklch(0.18 0.04 250 / 0.65), oklch(0.16 0.05 255 / 0.45))',
        borderColor: 'oklch(1 0 0 / 0.15)',
        boxShadow: '0 30px 80px -20px oklch(0 0 0 / 0.6), inset 0 1px 0 oklch(1 0 0 / 0.08)',
      }
    : {
        background: 'linear-gradient(140deg, oklch(1 0 0 / 0.85), oklch(0.98 0.005 240 / 0.7))',
        borderColor: 'oklch(0.16 0.05 255 / 0.1)',
        boxShadow: '0 30px 80px -20px oklch(0.16 0.05 255 / 0.25)',
      };

  const inputCls =
    'h-12 w-full rounded-lg border pl-10 pr-12 text-sm outline-none transition focus:ring-2 focus:ring-amber/30 focus:border-amber/60 ' +
    (isDark
      ? 'bg-white/5 border-white/15 text-white placeholder:text-white/35 focus:bg-white/10'
      : 'bg-white/70 border-navy-deep/15 text-navy-deep placeholder:text-navy-deep/40 focus:bg-white');

  const labelCls =
    `mb-1.5 block text-xs font-medium uppercase tracking-wider ${
      isDark ? 'text-white/70' : 'text-navy-deep/70'
    }`;

  const iconCls =
    `pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
      isDark ? 'text-white/40' : 'text-navy-deep/40'
    }`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background */}
      <img
        src={bgImage}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      {isDark ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-navy-deep/90 via-navy-deep/75 to-navy-mid/65" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-transparent to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/65 to-white/50" />
      )}

      {/* Header */}
      <header className="relative z-10 flex items-center px-6 py-5 sm:px-10">
        <img src={logoImage} alt="Logo" className="h-10 w-auto object-contain" />
      </header>

      {/* Main */}
      <main className="relative z-10 flex min-h-[calc(100vh-88px)] items-center justify-center px-4 pb-10">
        <div className="w-full max-w-md">

          {/* ── Loading ──────────────────────────────────────────────────── */}
          {tokenState === 'loading' && (
            <div
              className="rounded-2xl border p-10 text-center backdrop-blur-2xl"
              style={cardStyle}
            >
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber/30 border-t-amber" />
              <p className={`mt-4 text-sm ${isDark ? 'text-white/70' : 'text-navy-deep/70'}`}>
                Validating your reset link…
              </p>
            </div>
          )}

          {/* ── Invalid / Expired token ───────────────────────────────────── */}
          {tokenState === 'invalid' && (
            <div
              className="rounded-2xl border p-8 text-center backdrop-blur-2xl sm:p-10"
              style={cardStyle}
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
                <X className="h-8 w-8 text-red-400" />
              </div>
              <h1
                className={`text-xl font-semibold tracking-tight sm:text-2xl ${
                  isDark ? 'text-white' : 'text-navy-deep'
                }`}
              >
                Link expired or invalid
              </h1>
              <p className={`mt-2 text-sm ${isDark ? 'text-white/65' : 'text-navy-deep/65'}`}>
                This password reset link has expired or has already been used. Reset links are valid for 24 hours and can only be used once.
              </p>

              <div className="mt-7 flex flex-col gap-3">
                <Link
                  to="/admin/forgot-password"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg font-semibold text-navy-deep transition-all active:scale-[0.99]"
                  style={{
                    background: 'linear-gradient(135deg, oklch(0.82 0.16 75), oklch(0.74 0.17 65))',
                    boxShadow: '0 10px 30px -8px oklch(0.78 0.16 75 / 0.45)',
                  }}
                >
                  Request a new reset link
                </Link>
                <Link
                  to="/admin/login"
                  className={`inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg text-sm transition-opacity hover:opacity-70 ${
                    isDark ? 'text-white/65' : 'text-navy-deep/65'
                  }`}
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          )}

          {/* ── Success state ─────────────────────────────────────────────── */}
          {tokenState === 'valid' && success && (
            <div
              className="rounded-2xl border p-8 text-center backdrop-blur-2xl sm:p-10"
              style={cardStyle}
            >
              <div
                className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10"
                style={{ boxShadow: '0 0 32px -4px oklch(0.75 0.18 150 / 0.4)' }}
              >
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h1
                className={`text-xl font-semibold tracking-tight sm:text-2xl ${
                  isDark ? 'text-white' : 'text-navy-deep'
                }`}
              >
                Password updated!
              </h1>
              <p className={`mt-2 text-sm ${isDark ? 'text-white/65' : 'text-navy-deep/65'}`}>
                Your password has been changed successfully. Redirecting you to the login page…
              </p>
              <div className="mt-5 flex justify-center">
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full animate-[progress_2.8s_linear_forwards] rounded-full bg-amber" />
                </div>
              </div>
            </div>
          )}

          {/* ── Reset form ───────────────────────────────────────────────── */}
          {tokenState === 'valid' && !success && (
            <div
              className="rounded-2xl border p-8 backdrop-blur-2xl sm:p-10"
              style={cardStyle}
            >
              {/* Icon + title */}
              <div className="mb-6 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: 'oklch(0.78 0.16 75)' }}
                >
                  <Plane className="h-5 w-5 text-navy-deep" strokeWidth={2.5} />
                </div>
                <div>
                  <h1
                    className={`text-xl font-semibold tracking-tight sm:text-2xl ${
                      isDark ? 'text-white' : 'text-navy-deep'
                    }`}
                  >
                    Set new password
                  </h1>
                  <p className={`text-xs ${isDark ? 'text-white/55' : 'text-navy-deep/55'}`}>
                    Choose a strong password for your admin account
                  </p>
                </div>
              </div>

              <form id="reset-password-form" onSubmit={handleSubmit} className="space-y-5">

                {/* Error banner */}
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* New password */}
                <div>
                  <label className={labelCls}>New password</label>
                  <div className="relative">
                    <Lock className={iconCls} />
                    <input
                      id="reset-new-password"
                      type={showNew ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Create a strong password"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((s) => !s)}
                      aria-label="Toggle password visibility"
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors ${
                        isDark
                          ? 'text-white/40 hover:text-white/80'
                          : 'text-navy-deep/40 hover:text-navy-deep/80'
                      }`}
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Strength meter */}
                  {newPwd && (
                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
                        <span className={isDark ? 'text-white/55' : 'text-navy-deep/55'}>
                          Strength
                        </span>
                        <span
                          className={
                            score >= 4
                              ? 'text-emerald-400'
                              : score >= 3
                                ? 'text-amber'
                                : 'text-orange-400'
                          }
                        >
                          {strengthLabel}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              i < score
                                ? strengthColor
                                : isDark
                                  ? 'bg-white/10'
                                  : 'bg-navy-deep/10'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Policy checklist */}
                  <div
                    className={`mt-3 grid grid-cols-2 gap-2 rounded-lg border p-3 text-xs ${
                      isDark
                        ? 'border-white/10 bg-white/5'
                        : 'border-navy-deep/10 bg-navy-deep/[0.03]'
                    }`}
                  >
                    {RULES.map((r) => {
                      const ok = r.test(newPwd);
                      return (
                        <div key={r.key} className="flex items-center gap-2">
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-full ${
                              ok
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : isDark
                                  ? 'bg-white/10 text-white/40'
                                  : 'bg-navy-deep/10 text-navy-deep/40'
                            }`}
                          >
                            {ok ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </span>
                          <span
                            className={
                              ok
                                ? isDark
                                  ? 'text-white/90'
                                  : 'text-navy-deep'
                                : isDark
                                  ? 'text-white/55'
                                  : 'text-navy-deep/55'
                            }
                          >
                            {r.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label className={labelCls}>Confirm new password</label>
                  <div className="relative">
                    <Lock className={iconCls} />
                    <input
                      id="reset-confirm-password"
                      type={showCon ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Re-enter new password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCon((s) => !s)}
                      aria-label="Toggle confirm password visibility"
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors ${
                        isDark
                          ? 'text-white/40 hover:text-white/80'
                          : 'text-navy-deep/40 hover:text-navy-deep/80'
                      }`}
                    >
                      {showCon ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirm.length > 0 && (
                    <p
                      className={`mt-1.5 text-xs font-medium ${
                        matches ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {matches ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="group flex h-12 w-full items-center justify-center gap-2 rounded-lg font-semibold text-navy-deep shadow-lg transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background:
                      'linear-gradient(135deg, oklch(0.82 0.16 75), oklch(0.74 0.17 65))',
                    boxShadow: '0 10px 30px -8px oklch(0.78 0.16 75 / 0.45)',
                  }}
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-sm tracking-wide">
                    {loading ? 'Saving new password…' : 'Update Password'}
                  </span>
                  {!loading && (
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  )}
                </button>

                {/* Back link */}
                <div className="text-center">
                  <Link
                    to="/admin/login"
                    className={`text-xs transition-opacity hover:opacity-70 ${
                      isDark ? 'text-white/55' : 'text-navy-deep/55'
                    }`}
                  >
                    Back to sign in
                  </Link>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Inline keyframes for success progress bar */}
      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}

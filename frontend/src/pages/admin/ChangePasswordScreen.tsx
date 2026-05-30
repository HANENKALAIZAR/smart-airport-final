/**
 * ChangePasswordScreen.tsx
 * ========================
 * Step 1 of 2 admin onboarding — forced first-login password change.
 * Design from aviation-admin-login-main/routes/first-login.change-password.tsx.
 * Business logic unchanged: calls apiChangePassword() from existing adminApi.
 * Converted from JSX → TSX.
 */
import React, { useMemo, useState } from 'react';
import {
  Lock, Eye, EyeOff, Check, X, ArrowRight, ShieldCheck, AlertCircle,
} from 'lucide-react';
import {
  AdminOnboardingShell,
  panelStyle,
  inputCls,
  labelCls,
} from '../../components/admin/AdminOnboardingShell';
import { useAdminTheme, useAdminLang } from '../../hooks/useAdminPrefs';
import { apiChangePassword } from '../../services/adminApi';

// ── Translations ──────────────────────────────────────────────────────────────────
const tr = {
  fr: {
    stepChange:    'Changement de mot de passe',
    stepProfile:   'Compléter le profil',
    heading:       'Sécuriser votre compte',
    welcome:       (name: string) => `Bienvenue, ${name} ! Pour votre première connexion, veuillez remplacer le mot de passe temporaire par un mot de passe personnel sécurisé.`,
    newPwd:        'Nouveau mot de passe',
    confirmPwd:    'Confirmer le nouveau mot de passe',
    strength:      'Robustesse',
    labels:        ['Trop faible', 'Faible', 'Acceptable', 'Bon', 'Robuste'],
    rules:         ['8+ caractères', 'Majuscule', 'Chiffre', 'Caractère spécial'],
    placeholder1:  'Créez un mot de passe robuste',
    placeholder2:  'Répétez le nouveau mot de passe',
    match:         'Les mots de passe correspondent',
    noMatch:       'Les mots de passe ne correspondent pas',
    submit:        'Sécuriser le compte et continuer',
    submitting:    'Sécurisation en cours...',
    errFields:     'Tous les champs sont requis.',
    errPolicy:     'Le nouveau mot de passe ne respecte pas la politique de sécurité.',
    errNoMatch:    'Les mots de passe ne correspondent pas.',
  },
  en: {
    stepChange:    'Change Password',
    stepProfile:   'Complete Profile',
    heading:       'Secure Your Account',
    welcome:       (name: string) => `Welcome, ${name}! For your first login, please replace the temporary password issued to you with a strong personal password.`,
    newPwd:        'New password',
    confirmPwd:    'Confirm new password',
    strength:      'Strength',
    labels:        ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'],
    rules:         ['8+ characters', 'Uppercase', 'Number', 'Special char'],
    placeholder1:  'Create a strong password',
    placeholder2:  'Re-enter new password',
    match:         'Passwords match',
    noMatch:       'Passwords do not match',
    submit:        'Secure Account & Continue',
    submitting:    'Securing account…',
    errFields:     'All fields are required.',
    errPolicy:     'New password does not meet the security policy.',
    errNoMatch:    'Passwords do not match.',
  },
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChangePasswordScreenProps {
  /** The currently-stored admin user (from localStorage). */
  user: { full_name?: string; email?: string } | null;
  /** Called after the password has been successfully changed. */
  onComplete: () => void;
}

// ── Password policy ──────────────────────────────────────────────────────────────────
type Rule = { key: string; test: (v: string) => boolean };

const RULES: Rule[] = [
  { key: 'len',     test: (v) => v.length >= 8 },
  { key: 'upper',   test: (v) => /[A-Z]/.test(v) },
  { key: 'num',     test: (v) => /\d/.test(v) },
  { key: 'special', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function scoreOf(v: string): number {
  return RULES.reduce((acc, r) => acc + (r.test(v) ? 1 : 0), 0);
}

// ── Component ─────────────────────────────────────────────────────────────────────────
export default function ChangePasswordScreen({
  user,
  onComplete,
}: ChangePasswordScreenProps) {
  const [theme] = useAdminTheme();
  const [lang]  = useAdminLang();
  const isDark  = theme === 'dark';
  const txt     = tr[lang];

  const [newPwd,   setNewPwd]   = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showNew,  setShowNew]  = useState(false);
  const [showCon,  setShowCon]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const score    = useMemo(() => scoreOf(newPwd), [newPwd]);
  const matches  = confirm.length > 0 && confirm === newPwd;
  const canSubmit = score === RULES.length && matches && !loading;

  const strengthLabel = txt.labels[score];
  const strengthColor = [
    'bg-red-500', 'bg-orange-500', 'bg-amber', 'bg-lime-500', 'bg-emerald-500',
  ][score];

  const firstName = user?.full_name?.split(' ')[0] || 'Admin';

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');

    if (!newPwd || !confirm) {
      setError(txt.errFields);
      return;
    }
    if (score < RULES.length) {
      setError(txt.errPolicy);
      return;
    }
    if (!matches) {
      setError(txt.errNoMatch);
      return;
    }

    setLoading(true);
    // apiChangePassword(currentPassword, newPassword) — we don't require current pwd here
    const { error: apiError } = await apiChangePassword(null, newPwd);
    setLoading(false);

    if (apiError) {
      setError(apiError);
      return;
    }

    onComplete();
  };

  return (
    <AdminOnboardingShell
      step={1}
      totalSteps={2}
      steps={[
        { label: txt.stepChange, status: 'active' },
        { label: txt.stepProfile, status: 'upcoming' },
      ]}
    >
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 text-center">
          <div
            className={`mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border ${
              isDark
                ? 'border-amber/30 bg-amber/10 text-amber'
                : 'border-amber/40 bg-amber/15 text-amber'
            }`}
          >
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1
            className={`text-2xl font-semibold tracking-tight sm:text-3xl ${
              isDark ? 'text-white' : 'text-navy-deep'
            }`}
          >
            {txt.heading}
          </h1>
          <p
            className={`mx-auto mt-2 max-w-md text-sm ${
              isDark ? 'text-white/60' : 'text-navy-deep/60'
            }`}
          >
            {txt.welcome(firstName)}
          </p>
        </div>

        <form
          id="change-password-form"
          onSubmit={onSubmit}
          className="rounded-2xl border p-6 backdrop-blur-2xl sm:p-8"
          style={panelStyle(isDark)}
        >
          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* New password */}
          <div>
            <PasswordField
              isDark={isDark}
              label={txt.newPwd}
              value={newPwd}
              onChange={setNewPwd}
              show={showNew}
              onToggle={() => setShowNew((s) => !s)}
              placeholder={txt.placeholder1}
            />

            {/* Strength meter */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
                <span className={isDark ? 'text-white/60' : 'text-navy-deep/60'}>
                  {txt.strength}
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
                  {newPwd ? strengthLabel : ''}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
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

            {/* Policy rules */}
            <div
              className={`mt-4 grid grid-cols-2 gap-2 rounded-lg border p-3 text-xs ${
                isDark
                  ? 'border-white/10 bg-white/5'
                  : 'border-navy-deep/10 bg-navy-deep/[0.03]'
              }`}
            >
              {RULES.map((r, i) => {
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
                      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
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
                      {txt.rules[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Confirm password */}
          <div className="mt-5">
            <PasswordField
              isDark={isDark}
              label={txt.confirmPwd}
              value={confirm}
              onChange={setConfirm}
              show={showCon}
              onToggle={() => setShowCon((s) => !s)}
              placeholder={txt.placeholder2}
              endIcon={
                confirm.length > 0 ? (
                  matches ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <X className="h-4 w-4 text-red-400" />
                  )
                ) : null
              }
            />
            {confirm.length > 0 && (
              <p
                className={`mt-1.5 text-xs font-medium ${
                  matches ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {matches ? txt.match : txt.noMatch}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="group relative mt-7 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-lg font-semibold text-navy-deep shadow-lg transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background:
                'linear-gradient(135deg, oklch(0.82 0.16 75), oklch(0.74 0.17 65))',
              boxShadow: '0 10px 30px -8px oklch(0.78 0.16 75 / 0.45)',
            }}
          >
            <span className="text-sm tracking-wide">
              {loading ? txt.submitting : txt.submit}
            </span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </form>
      </div>
    </AdminOnboardingShell>
  );
}

// ── PasswordField sub-component ───────────────────────────────────────────────
function PasswordField({
  isDark,
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  endIcon,
}: {
  isDark: boolean;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
  endIcon?: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls(isDark)}>{label}</label>
      <div className="relative">
        <Lock
          className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
            isDark ? 'text-white/40' : 'text-navy-deep/40'
          }`}
        />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          className={inputCls(isDark, true) + ' pr-20'}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {endIcon}
          <button
            type="button"
            onClick={onToggle}
            aria-label="Toggle password visibility"
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              isDark
                ? 'text-white/50 hover:bg-white/10 hover:text-white'
                : 'text-navy-deep/50 hover:bg-navy-deep/5 hover:text-navy-deep'
            }`}
          >
            {show ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

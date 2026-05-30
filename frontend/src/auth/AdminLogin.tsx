/**
 * AdminLogin.tsx
 * ==============
 * New premium admin login page — design from aviation-admin-login-main.
 * Business logic unchanged: calls apiLogin(), stores JWT, redirects to /dashboard.
 * Converted from JSX → TSX.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plane, Moon, Sun, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import bgImage from '../assets/airport-night.jpg';
import logoImage from '../assets/logo.png';
import { useAdminTheme, useAdminLang } from '../hooks/useAdminPrefs';
import { apiLogin } from '../services/adminApi';

// ── Types ─────────────────────────────────────────────────────────────────────
interface LoginApiResponse {
  access_token: string;
  user: {
    id: number;
    email: string;
    role: string;
    id_document_status: string;
    airport_iata?: string;
  };
  must_change_password?: boolean;
  profile_complete?: boolean;
}

// ── Translations ──────────────────────────────────────────────────────────────
const translations = {
  fr: {
    badge:    'Espace Administrateur',
    title:    'Connexion Membre',
    subtitle: 'Connectez-vous pour accéder au tableau de bord',
    email:    'Adresse e-mail',
    password: 'Mot de passe',
    forgot:   'Mot de passe oublié ?',
    login:    'Se connecter',
    remember: 'Rester connecté',
    secure:   'Connexion sécurisée · Accès réservé au personnel autorisé',
  },
  en: {
    badge:    'Administrator Portal',
    title:    'Member Login',
    subtitle: 'Sign in to access your operations dashboard',
    email:    'Email address',
    password: 'Password',
    forgot:   'Forgot password?',
    login:    'Sign in',
    remember: 'Keep me signed in',
    secure:   'Secure connection · Authorized personnel only',
  },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminLogin() {
  const navigate = useNavigate();
  const [lang, setLang]   = useAdminLang();
  const [theme, setTheme] = useAdminTheme();
  const isDark = theme === 'dark';
  const t = translations[lang];

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Redirect already-authenticated admins
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token && token !== 'demo') {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    const { data, error: apiError } = await apiLogin(email.trim(), password);
    setLoading(false);

    if (apiError || !data) {
      setError(apiError || 'Login failed. Please try again.');
      return;
    }

    const { access_token, user, must_change_password, profile_complete } =
      data as LoginApiResponse;

    const minimalUser = {
      id:     user.id,
      email:  user.email,
      role:   user.role,
      status: user.id_document_status,
      token:  access_token,
      must_change_password: must_change_password,
      profile_complete: profile_complete,
    };

    localStorage.removeItem('admin_user');
    try {
      localStorage.setItem('admin_user', JSON.stringify(minimalUser));
    } catch (err) {
      console.error('Failed to store user in localStorage:', err);
    }

    localStorage.setItem('admin_token', access_token);
    localStorage.setItem('admin_role', user.role);
    localStorage.setItem('admin_must_change', String(!!must_change_password));

    const pc = user.role === 'super_admin' ? true : !!profile_complete;
    localStorage.setItem('admin_profile_complete', String(pc));

    if (user.airport_iata) {
      localStorage.setItem('admin_airport_iata', user.airport_iata);
    }

    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <img
        src={bgImage}
        alt="Airplane taking off at night"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Theme-aware overlays */}
      {isDark ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-navy-deep/90 via-navy-deep/70 to-navy-mid/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-transparent to-transparent" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/55 to-white/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-white/30 to-transparent" />
        </>
      )}

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className={`flex items-center gap-3 ${isDark ? 'text-white' : 'text-navy-deep'}`}>
          <img src={logoImage} alt="Logo" className="h-10 w-auto object-contain" />
        </div>

        <div className="flex items-center gap-2">
          {/* Language switcher */}
          <div
            className={`flex rounded-full p-0.5 backdrop-blur-md border ${
              isDark
                ? 'border-white/15 bg-white/5'
                : 'border-navy-deep/15 bg-white/40'
            }`}
          >
            {(['fr', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full transition-colors ${
                  lang === l
                    ? 'bg-amber text-navy-deep'
                    : isDark
                      ? 'text-white/70 hover:text-white'
                      : 'text-navy-deep/70 hover:text-navy-deep'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label="Toggle theme"
            className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition-colors border ${
              isDark
                ? 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
                : 'border-navy-deep/15 bg-white/40 text-navy-deep hover:bg-white/60'
            }`}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Login card */}
      <main className="relative z-10 flex min-h-[calc(100vh-88px)] items-center justify-center px-4 pb-10">
        <div className="w-full max-w-md">
          <div
            className="rounded-2xl p-8 shadow-2xl backdrop-blur-2xl sm:p-10 border"
            style={
              isDark
                ? {
                    background:
                      'linear-gradient(140deg, oklch(0.18 0.04 250 / 0.65), oklch(0.16 0.05 255 / 0.45))',
                    borderColor: 'oklch(1 0 0 / 0.15)',
                    boxShadow:
                      '0 30px 80px -20px oklch(0 0 0 / 0.6), inset 0 1px 0 oklch(1 0 0 / 0.08)',
                  }
                : {
                    background:
                      'linear-gradient(140deg, oklch(1 0 0 / 0.85), oklch(0.98 0.005 240 / 0.7))',
                    borderColor: 'oklch(0.16 0.05 255 / 0.1)',
                    boxShadow:
                      '0 30px 80px -20px oklch(0.16 0.05 255 / 0.25), inset 0 1px 0 oklch(1 0 0 / 0.6)',
                  }
            }
          >
            <div className="mb-7">
              <h1
                className={`mt-3 text-2xl font-semibold tracking-tight sm:text-3xl ${
                  isDark ? 'text-white' : 'text-navy-deep'
                }`}
              >
                {t.title}
              </h1>
              <p
                className={`mt-1.5 text-sm ${
                  isDark ? 'text-white/60' : 'text-navy-deep/60'
                }`}
              >
                {t.subtitle}
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form
              id="admin-login-form"
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {/* Email */}
              <Field isDark={isDark} label={t.email} icon={<Mail className="h-4 w-4" />}>
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="admin@name-airport.tn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls(isDark)}
                />
              </Field>

              {/* Password */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="admin-password"
                    className={`block text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-white/70' : 'text-navy-deep/70'
                    }`}
                  >
                    {t.password}
                  </label>
                  <Link
                    to="/admin/forgot-password"
                    className="text-xs font-medium text-amber transition-colors hover:opacity-80"
                  >
                    {t.forgot}
                  </Link>
                </div>
                <div className="relative">
                  <Lock
                    className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
                      isDark ? 'text-white/40' : 'text-navy-deep/40'
                    }`}
                  />
                  <input
                    id="admin-password"
                    type={showPwd ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls(isDark) + ' pr-11'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    aria-label="Toggle password visibility"
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                      isDark
                        ? 'text-white/40 hover:text-white/80'
                        : 'text-navy-deep/40 hover:text-navy-deep/80'
                    }`}
                  >
                    {showPwd ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group relative h-12 w-full overflow-hidden rounded-lg font-semibold text-navy-deep shadow-lg transition-all active:scale-[0.99] disabled:opacity-70"
                style={{
                  background:
                    'linear-gradient(135deg, oklch(0.82 0.16 75), oklch(0.74 0.17 65))',
                  boxShadow: '0 10px 30px -8px oklch(0.78 0.16 75 / 0.45)',
                }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2 text-sm tracking-wide">
                  {loading ? 'Signing in…' : t.login}
                  {!loading && (
                    <Plane className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-0.5" />
                  )}
                </span>
              </button>
            </form>

            {/* Secure note */}
            <div
              className={`mt-7 flex items-center gap-2 border-t pt-5 text-[11px] ${
                isDark
                  ? 'border-white/10 text-white/45'
                  : 'border-navy-deep/10 text-navy-deep/55'
              }`}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_oklch(0.75_0.18_150)]" />
              {t.secure}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function inputCls(isDark: boolean): string {
  const base =
    'h-12 w-full rounded-lg pl-10 pr-3.5 text-sm outline-none transition border focus:ring-2 focus:ring-amber/30 focus:border-amber/60';
  return isDark
    ? `${base} bg-white/5 border-white/15 text-white placeholder:text-white/35 focus:bg-white/10`
    : `${base} bg-white/70 border-navy-deep/15 text-navy-deep placeholder:text-navy-deep/40 focus:bg-white`;
}

function Field({
  isDark,
  label,
  icon,
  children,
}: {
  isDark: boolean;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className={`mb-1.5 block text-xs font-medium uppercase tracking-wider ${
          isDark ? 'text-white/70' : 'text-navy-deep/70'
        }`}
      >
        {label}
      </label>
      <div className="relative">
        <div
          className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${
            isDark ? 'text-white/40' : 'text-navy-deep/40'
          }`}
        >
          {icon}
        </div>
        {children}
      </div>
    </div>
  );
}

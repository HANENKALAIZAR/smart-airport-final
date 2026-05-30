/**
 * PendingApprovalScreen.tsx
 * =========================
 * Shown after profile submission while waiting for super admin approval.
 * Design adapted from aviation-admin-login-main/routes/first-login.review.tsx.
 * Business logic unchanged: onRefresh() polls /me, onLogout() clears session.
 * Converted from JSX → TSX.
 */
import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Check, Clock, UserCheck, KeyRound,
  ArrowLeft, Pencil, Mail, RefreshCw, LogOut,
} from 'lucide-react';
import bgImage from '../../assets/airport-night.jpg';
import logoImage from '../../assets/logo.png';
import { useAdminTheme, useAdminLang } from '../../hooks/useAdminPrefs';
import { panelStyle } from '../../components/admin/AdminOnboardingShell';

// ── Translations ──────────────────────────────────────────────────────────
const tr = {
  fr: {
    heroTitle:   'Profil soumis avec succès',
    heroSub:     'Votre dossier d\'identité est actuellement en cours de vérification par le Super Administrateur.',
    heroNote:    'Ce processus garantit un accès sécurisé aux systèmes opérationnels aéroportuaires. La vérification peut prendre 24 à 72 heures selon la validation des documents.',
    reviewBadge: 'En cours d\'examen',
    submitted:   'Soumis le',
    estReview:   'Délai estimé',
    hours:       '24 – 72 heures',
    progress:    'Progression de la vérification',
    stepsDone:   ['Documents soumis', 'Validation d\'identité', 'Approbation Super Administrateur', 'Activation du compte'],
    completed:   'Complété',
    inProgress:  'En cours...',
    pending:     'En attente',
    emailNotice: 'Vous recevrez une notification par e-mail dès que votre compte sera approuvé par le Super Administrateur.',
    checkBtn:    'Vérifier le statut d\'approbation',
    checking:    'Vérification en cours...',
    signOut:     'Se déconnecter',
    footer:      'Smart Airport Opérations · Processus de vérification',
  },
  en: {
    heroTitle:   'Profile Submitted Successfully',
    heroSub:     'Your identity verification is currently under review by the Super Admin.',
    heroNote:    'This process helps ensure secure access to airport operational systems. Verification may take 24–72 hours depending on document validation.',
    reviewBadge: 'Under Review',
    submitted:   'Submitted',
    estReview:   'Estimated review',
    hours:       '24 – 72 hours',
    progress:    'Verification progress',
    stepsDone:   ['Documents submitted', 'Identity validation', 'Super Admin approval', 'Account activation'],
    completed:   'Completed',
    inProgress:  'In progress…',
    pending:     'Pending',
    emailNotice: 'You will receive an email notification once your account is approved by the Super Admin.',
    checkBtn:    'Check approval status',
    checking:    'Checking status…',
    signOut:     'Sign out',
    footer:      'Smart Airport Operations · Verification Workflow',
  },
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
interface PendingApprovalScreenProps {
  user: { full_name?: string; email?: string } | null;
  onLogout: () => void;
  onRefresh: () => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PendingApprovalScreen({
  user,
  onLogout,
  onRefresh,
}: PendingApprovalScreenProps) {
  const [theme] = useAdminTheme();
  const [lang]  = useAdminLang();
  const isDark  = theme === 'dark';
  const txt     = tr[lang];
  const [checking, setChecking] = useState(false);

  // Animated dots for "Under Review..."
  const [dots, setDots] = useState('');
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 600);
    return () => clearInterval(id);
  }, []);

  const submittedAt    = new Date();
  const submittedLabel =
    submittedAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }) +
    ' · ' +
    submittedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const reviewSteps = [
    { label: txt.stepsDone[0], status: 'done'     as const, icon: Check },
    { label: txt.stepsDone[1], status: 'active'   as const, icon: Clock },
    { label: txt.stepsDone[2], status: 'upcoming' as const, icon: UserCheck },
    { label: txt.stepsDone[3], status: 'upcoming' as const, icon: KeyRound },
  ];

  const subText   = isDark ? 'text-white/65' : 'text-navy-deep/65';
  const mutedText = isDark ? 'text-white/45' : 'text-navy-deep/50';
  const divider   = isDark ? 'border-white/10' : 'border-navy-deep/10';

  async function handleRefresh() {
    if (checking) return;
    setChecking(true);
    try {
      await onRefresh();
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <img
        src={bgImage}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      {isDark ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-navy-deep/95 via-navy-deep/85 to-navy-mid/75" />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/40 to-transparent" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/75 to-white/65" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/50 to-transparent" />
        </>
      )}

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <img src={logoImage} alt="Logo" className="h-10 w-auto object-contain" />
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-88px)] items-center justify-center px-4 py-10">
        <div className="mx-auto w-full max-w-2xl animate-fade-in">
          {/* Hero */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6">
              <span className="absolute inset-0 rounded-full bg-amber/30 blur-2xl animate-pulse" />
              <div
                className="relative flex h-20 w-20 items-center justify-center rounded-full border border-amber/40 bg-amber/15 backdrop-blur-md"
                style={{ boxShadow: '0 0 40px -8px oklch(0.78 0.16 75 / 0.6)' }}
              >
                <ShieldCheck className="h-10 w-10 text-amber" strokeWidth={1.8} />
              </div>
            </div>
            <h1
              className={`text-2xl sm:text-3xl font-semibold tracking-tight ${
                isDark ? 'text-white' : 'text-navy-deep'
              }`}
            >
              {txt.heroTitle}
            </h1>
            <p className={`mt-3 text-sm sm:text-base ${subText} max-w-lg`}>
              {txt.heroSub}
            </p>
            <p className={`mt-2 text-xs sm:text-sm ${mutedText} max-w-lg`}>
              {txt.heroNote}
            </p>
          </div>

          {/* Status card */}
          <div
            className="mt-10 rounded-2xl border backdrop-blur-xl p-6 sm:p-8 animate-fade-in"
            style={panelStyle(isDark)}
          >
            {/* Pulsing badge */}
            <div className="flex justify-center">
              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-amber/40 blur-xl animate-pulse" />
                <span
                  className="relative inline-flex items-center gap-2 rounded-full border border-amber/50 bg-amber/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber"
                  style={{
                    boxShadow:
                      '0 0 24px -4px oklch(0.78 0.16 75 / 0.55), inset 0 0 0 1px oklch(0.78 0.16 75 / 0.25)',
                  }}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber" />
                  </span>
                  {txt.reviewBadge}{dots}
                </span>
              </div>
            </div>

            {/* Meta */}
            <div className={`mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t ${divider} pt-6`}>
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${mutedText}`}>
                  {txt.submitted}
                </p>
                <p className={`mt-1 text-sm font-medium ${isDark ? 'text-white/90' : 'text-navy-deep'}`}>
                  {submittedLabel}
                </p>
              </div>
              <div className="sm:text-right">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${mutedText}`}>
                  {txt.estReview}
                </p>
                <p className={`mt-1 text-sm font-medium ${isDark ? 'text-white/90' : 'text-navy-deep'}`}>
                  {txt.hours}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className={`mt-6 border-t ${divider} pt-6`}>
              <p className={`mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] ${mutedText}`}>
                {txt.progress}
              </p>
              <ol className="relative space-y-4">
                {reviewSteps.map((s, i) => {
                  const Icon     = s.icon;
                  const done     = s.status === 'done';
                  const active   = s.status === 'active';
                  const isLast   = i === reviewSteps.length - 1;
                  return (
                    <li key={s.label} className="relative flex items-start gap-4">
                      {!isLast && (
                        <span
                          className={`absolute left-[15px] top-9 h-[calc(100%-4px)] w-px ${
                            done ? 'bg-amber/50' : isDark ? 'bg-white/10' : 'bg-navy-deep/10'
                          }`}
                        />
                      )}
                      <div className="relative">
                        {active && (
                          <span className="absolute inset-0 rounded-full bg-amber/30 blur-md animate-pulse" />
                        )}
                        <span
                          className={`relative flex h-8 w-8 items-center justify-center rounded-full border ${
                            done
                              ? 'border-amber/60 bg-amber text-navy-deep'
                              : active
                                ? 'border-amber/60 bg-amber/15 text-amber'
                                : isDark
                                  ? 'border-white/15 bg-white/5 text-white/40'
                                  : 'border-navy-deep/15 bg-white/40 text-navy-deep/40'
                          }`}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2.2} />
                        </span>
                      </div>
                      <div className="pt-1.5">
                        <p
                          className={`text-sm font-medium ${
                            done || active
                              ? isDark ? 'text-white' : 'text-navy-deep'
                              : mutedText
                          }`}
                        >
                          {s.label}
                        </p>
                        <p className={`text-xs ${mutedText}`}>
                          {done ? txt.completed : active ? txt.inProgress : txt.pending}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Email notice */}
            <div
              className={`mt-6 flex items-start gap-3 rounded-xl border ${
                isDark ? 'border-white/10 bg-white/5' : 'border-navy-deep/10 bg-white/40'
              } p-4`}
            >
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
              <p className={`text-xs ${subText}`}>
                {txt.emailNotice}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={checking}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold border transition ${
                isDark
                  ? 'border-white/15 text-white/85 hover:bg-white/5'
                  : 'border-navy-deep/20 text-navy-deep hover:bg-white/60'
              } disabled:opacity-60`}
            >
              <RefreshCw
                className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`}
              />
              {checking ? txt.checking : txt.checkBtn}
            </button>

            <button
              onClick={onLogout}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber px-6 text-sm font-semibold text-navy-deep hover:brightness-105 transition"
              style={{ boxShadow: '0 10px 30px -8px oklch(0.78 0.16 75 / 0.55)' }}
            >
              <LogOut className="h-4 w-4" />
              {txt.signOut}
            </button>
          </div>

          <p
            className={`mt-8 text-center text-[11px] ${
              isDark ? 'text-white/20' : 'text-navy-deep/25'
            }`}
          >
            {txt.footer}
          </p>
        </div>
      </main>
    </div>
  );
}

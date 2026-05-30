/**
 * AdminOnboardingShell.tsx
 * ========================
 * Shared layout for admin onboarding steps (change password,
 * complete profile, review). Adapted from aviation-admin-login-main
 * OnboardingShell.tsx – uses existing react-router-dom, not TanStack Router.
 */
import React from 'react';
import { Moon, Sun } from 'lucide-react';
import bgImage from '../../assets/airport-night.jpg';
import logoImage from '../../assets/logo.png';
import { useAdminTheme, useAdminLang, type AdminLang } from '../../hooks/useAdminPrefs';

type StepStatus = 'done' | 'active' | 'upcoming';
type Step = { label: string; status: StepStatus };

interface AdminOnboardingShellProps {
  step: number;
  totalSteps: number;
  steps: Step[];
  children: React.ReactNode;
}

export function AdminOnboardingShell({
  step,
  totalSteps,
  steps,
  children,
}: AdminOnboardingShellProps) {
  const [lang, setLang] = useAdminLang();
  const [theme, setTheme] = useAdminTheme();
  const isDark = theme === 'dark';

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

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <img src={logoImage} alt="Logo" className="h-10 w-auto object-contain" />
        <div className="flex items-center gap-2">
          <div
            className={`flex rounded-full p-0.5 backdrop-blur-md border ${
              isDark ? 'border-white/15 bg-white/5' : 'border-navy-deep/15 bg-white/40'
            }`}
          >
            {(['fr', 'en'] as AdminLang[]).map((l) => (
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

      <main className="relative z-10 px-4 pb-16 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          {/* Stepper */}
          <div className="mx-auto mb-8 max-w-2xl">
            <div className="flex items-center gap-2">
              {steps.map((s, i) => {
                const active = i + 1 <= step;
                return (
                  <div key={i} className="flex flex-1 items-center gap-2">
                    <div
                      className={`h-1.5 flex-1 rounded-full transition-all ${
                        active
                          ? 'bg-amber'
                          : isDark
                            ? 'bg-white/10'
                            : 'bg-navy-deep/10'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
            <div
              className={`mt-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] ${
                isDark ? 'text-white/55' : 'text-navy-deep/55'
              }`}
            >
              <span>Step {step} of {totalSteps}</span>
              <span className="text-amber">{steps[step - 1]?.label}</span>
            </div>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}

export function panelStyle(isDark: boolean): React.CSSProperties {
  return isDark
    ? {
        background: 'linear-gradient(140deg, oklch(0.18 0.04 250 / 0.7), oklch(0.16 0.05 255 / 0.5))',
        borderColor: 'oklch(1 0 0 / 0.12)',
        boxShadow: '0 30px 80px -20px oklch(0 0 0 / 0.6), inset 0 1px 0 oklch(1 0 0 / 0.08)',
      }
    : {
        background: 'linear-gradient(140deg, oklch(1 0 0 / 0.9), oklch(0.98 0.005 240 / 0.75))',
        borderColor: 'oklch(0.16 0.05 255 / 0.1)',
        boxShadow: '0 30px 80px -20px oklch(0.16 0.05 255 / 0.25), inset 0 1px 0 oklch(1 0 0 / 0.6)',
      };
}

export function inputCls(isDark: boolean, hasIcon = false): string {
  const base = `h-11 w-full rounded-lg ${
    hasIcon ? 'pl-10' : 'pl-3.5'
  } pr-3.5 text-sm outline-none transition border focus:ring-2 focus:ring-amber/30 focus:border-amber/60`;
  return isDark
    ? `${base} bg-white/5 border-white/15 text-white placeholder:text-white/35 focus:bg-white/10`
    : `${base} bg-white/70 border-navy-deep/15 text-navy-deep placeholder:text-navy-deep/40 focus:bg-white`;
}

export function labelCls(isDark: boolean): string {
  return `mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] ${
    isDark ? 'text-white/70' : 'text-navy-deep/70'
  }`;
}

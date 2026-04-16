/**
 * PendingApprovalScreen
 * =====================
 * Shown after an admin submits their profile and is waiting
 * for the super admin to approve their onboarding.
 */
import { useState, useEffect } from 'react';
import { Clock, CheckCircle, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';

const DOTS_ANIMATION_INTERVAL = 600;

export default function PendingApprovalScreen({ user, onLogout, onRefresh }) {
  const [dots, setDots] = useState('');
  const [checking, setChecking] = useState(false);

  // Animate the "Waiting" dots
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, DOTS_ANIMATION_INTERVAL);
    return () => clearInterval(id);
  }, []);

  async function handleRefresh() {
    if (checking) return;
    setChecking(true);
    try {
      await onRefresh();
    } finally {
      setChecking(false);
    }
  }

  const firstName = user?.full_name?.split(' ')[0] || 'Admin';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* Background radial glow */}
      <div
        style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(234,179,8,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1a1a2e, rgba(234,179,8,0.12))',
            padding: '40px 40px 32px',
            textAlign: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Animated clock icon */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(234,179,8,0.1)',
              border: '2px solid rgba(234,179,8,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              animation: 'pulse-amber 2s ease-in-out infinite',
            }}
          >
            <Clock size={36} color="#EAB308" />
          </div>

          <h1
            style={{
              margin: '0 0 8px',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.01em',
            }}
          >
            Awaiting Approval
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '0.9rem',
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.6,
            }}
          >
            Hello, {firstName}! Your profile has been submitted.
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '32px 40px' }}>
          {/* Status pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(234,179,8,0.08)',
              border: '1px solid rgba(234,179,8,0.2)',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#EAB308',
                animation: 'pulse-dot 1.5s ease-in-out infinite',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '0.875rem', color: '#FDE047', fontWeight: 600 }}>
              Under Review — Waiting for Super Admin{dots}
            </span>
          </div>

          {/* Info list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
            <InfoItem
              icon={<ShieldAlert size={18} color="#60A5FA" />}
              title="What happens next?"
              text="A Super Admin will review your submitted identity documents and personal information."
            />

            <InfoItem
              icon={<CheckCircle size={18} color="#A78BFA" />}
              title="After approval"
              text="Once approved, you can log in normally and access the full admin dashboard."
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={handleRefresh}
              disabled={checking}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                border: '1px solid rgba(30,144,255,0.35)',
                background: 'rgba(30,144,255,0.08)',
                color: '#60A5FA',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: checking ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s ease',
                opacity: checking ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!checking) {
                  e.currentTarget.style.background = 'rgba(30,144,255,0.16)';
                  e.currentTarget.style.borderColor = 'rgba(30,144,255,0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(30,144,255,0.08)';
                e.currentTarget.style.borderColor = 'rgba(30,144,255,0.35)';
              }}
            >
              <RefreshCw
                size={16}
                style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }}
              />
              {checking ? 'Checking status…' : 'Check approval status'}
            </button>

            <button
              onClick={onLogout}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.35)',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.35)';
              }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </div>

      <p
        style={{
          marginTop: 24,
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.2)',
          textAlign: 'center',
        }}
      >
        Smart Airport Operations · Verification Workflow
      </p>

      <style>{`
        @keyframes pulse-amber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(234,179,8,0.3); }
          50% { box-shadow: 0 0 0 14px rgba(234,179,8,0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function InfoItem({ icon, title, text }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {icon}
      </div>
      <div>
        <p
          style={{
            margin: '0 0 3px',
            fontSize: '0.825rem',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          {title}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.6,
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

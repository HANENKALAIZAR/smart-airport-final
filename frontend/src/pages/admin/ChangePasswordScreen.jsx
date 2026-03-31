/**
 * ChangePasswordScreen — Phase 2 (Upgraded)
 * ===========================================
 * Step 1 of 2 onboarding — forced password change.
 * Full-page screen with progress indicator and real-time policy enforcement.
 * Admin cannot access anything until this step is complete.
 */
import { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { apiChangePassword } from '../../services/adminApi';

/* ── Password policy checks ── */
const RULES = [
    { id: 'length',  label: 'At least 8 characters',         test: p => p.length >= 8 },
    { id: 'upper',   label: 'One uppercase letter',          test: p => /[A-Z]/.test(p) },
    { id: 'number',  label: 'One number',                    test: p => /\d/.test(p) },
    { id: 'special', label: 'One special character (!@#$%^&*)', test: p => /[!@#$%^&*]/.test(p) },
];

function strengthLevel(password, rules) {
    const passed = rules.filter(r => r.test(password)).length;
    if (!password) return 0;
    if (passed === 1) return 1;
    if (passed === 2) return 2;
    if (passed === 3) return 3;
    return 4;
}

const STRENGTH_COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#22c55e'];
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

function ProgressStep({ step, current }) {
    const done = current > step;
    const active = current === step;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700,
                background: done ? '#22c55e' : active ? '#1E90FF' : 'rgba(255,255,255,0.1)',
                color: done || active ? '#fff' : 'rgba(255,255,255,0.3)',
                border: `2px solid ${done ? '#22c55e' : active ? '#1E90FF' : 'rgba(255,255,255,0.1)'}`,
                transition: 'all 0.3s ease',
            }}>
                {done ? <CheckCircle size={14} /> : step}
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: active ? 700 : 400, color: active ? '#fff' : done ? '#4ade80' : 'rgba(255,255,255,0.35)' }}>
                {step === 1 ? 'Change Password' : 'Complete Profile'}
            </span>
        </div>
    );
}

export default function ChangePasswordScreen({ user, onComplete }) {
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showNext, setShowNext] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const strength = strengthLevel(next, RULES);
    const allRulesPassed = strength === 4;
    const passwordsMatch = next === confirm && confirm !== '';

    function validate() {
        if (!next || !confirm) return 'All fields are required.';
        if (!allRulesPassed) return 'New password does not meet the security policy.';
        if (!passwordsMatch) return 'New passwords do not match.';
        return null;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const err = validate();
        if (err) { setError(err); return; }

        setError('');
        setLoading(true);
        const { error: apiError } = await apiChangePassword(null, next);
        setLoading(false);

        if (apiError) { setError(apiError); return; }

        setSuccess(true);
        setTimeout(() => onComplete(), 1500);
    }

    const firstName = user?.full_name?.split(' ')[0] || 'Admin';

    return (
        <div style={{
            minHeight: '100vh', background: '#0F172A',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-start', padding: '40px 16px 60px',
        }}>
            {/* Progress indicator */}
            <p style={{ margin: '0 0 12px', fontSize: '0.8rem', fontWeight: 600, color: '#1E90FF', letterSpacing: '0.04em' }}>
                Step 1 of 2 — Change Password
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 36 }}>
                <ProgressStep step={1} current={1} />
                <div style={{ width: 40, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1 }} />
                <ProgressStep step={2} current={1} />
            </div>

            <div style={{
                width: '100%', maxWidth: 460,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20, overflow: 'hidden',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg, #1e2a4a, #1E90FF18)', padding: '28px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(30,144,255,0.12)', border: '2px solid rgba(30,144,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                        <Lock size={24} color="#60a5fa" />
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>Set Your Password</h1>
                    <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
                        Welcome, {firstName}! You signed in with your temporary password. Choose a new secure password to continue.
                    </p>
                </div>

                {success ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#4ade80' }}>
                        <CheckCircle size={48} style={{ marginBottom: 12 }} />
                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Password updated!</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: 6 }}>Moving to profile setup…</div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {error && (
                            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: '0.84rem' }}>
                                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /><span>{error}</span>
                            </div>
                        )}

                        {/* New password */}
                        <div>
                            <label style={labelStyle}>New Password</label>
                            <div style={{ marginTop: 8, position: 'relative' }}>
                                <input
                                    type={showNext ? 'text' : 'password'}
                                    className="admin-form-input"
                                    value={next}
                                    onChange={e => setNext(e.target.value)}
                                    placeholder="Choose a strong password"
                                    style={{ paddingRight: 42 }}
                                    autoComplete="new-password"
                                    required
                                />
                                <ToggleBtn show={showNext} onToggle={() => setShowNext(v => !v)} />
                            </div>

                            {/* Strength bar */}
                            {next && (
                                <div style={{ marginTop: 10 }}>
                                    <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} style={{
                                                flex: 1, height: 4, borderRadius: 2,
                                                background: strength >= i ? STRENGTH_COLORS[i] : 'rgba(255,255,255,0.08)',
                                                transition: 'background 0.25s ease',
                                            }} />
                                        ))}
                                        <span style={{ fontSize: '0.7rem', color: strength > 0 ? STRENGTH_COLORS[strength] : 'rgba(255,255,255,0.3)', minWidth: 40, textAlign: 'right', fontWeight: 600 }}>
                                            {STRENGTH_LABELS[strength]}
                                        </span>
                                    </div>
                                    {/* Policy checklist */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                                        {RULES.map(rule => {
                                            const ok = rule.test(next);
                                            return (
                                                <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: ok ? '#4ade80' : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }}>
                                                    <span>{ok ? '✓' : '○'}</span>
                                                    {rule.label}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Confirm */}
                        <div>
                            <label style={labelStyle}>Confirm New Password</label>
                            <div style={{ marginTop: 8, position: 'relative' }}>
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    className="admin-form-input"
                                    value={confirm}
                                    onChange={e => setConfirm(e.target.value)}
                                    placeholder="Repeat your new password"
                                    style={{
                                        paddingRight: 42,
                                        borderColor: confirm && next && confirm !== next ? 'rgba(239,68,68,0.5)'
                                            : confirm && passwordsMatch ? 'rgba(34,197,94,0.4)' : undefined,
                                    }}
                                    autoComplete="new-password"
                                    required
                                />
                                <ToggleBtn show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
                            </div>
                            {confirm && !passwordsMatch && <p style={{ margin: '5px 0 0', fontSize: '0.73rem', color: '#f87171' }}>✗ Passwords don&apos;t match</p>}
                            {confirm && passwordsMatch && <p style={{ margin: '5px 0 0', fontSize: '0.73rem', color: '#4ade80' }}>✓ Passwords match</p>}
                        </div>

                        <button
                            type="submit"
                            className="admin-btn admin-btn--primary"
                            disabled={loading || !allRulesPassed || !passwordsMatch}
                            style={{ marginTop: 8, height: 48, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                            {loading ? <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Updating…</> : <><Lock size={18} /> Set New Password & Continue</>}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

function ToggleBtn({ show, onToggle }) {
    return (
        <button type="button" onClick={onToggle} tabIndex={-1}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0 }}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
    );
}

const labelStyle = { fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' };

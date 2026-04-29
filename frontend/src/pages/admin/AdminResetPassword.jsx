import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Plane, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { apiValidateResetToken, apiResetPassword } from '../../services/adminApi';

function policyHint(pw) {
    if (pw.length < 8) return 'At least 8 characters';
    if (!/[A-Z]/.test(pw)) return 'One uppercase letter';
    if (!/\d/.test(pw)) return 'One number';
    if (!/[!@#$%^&*]/.test(pw)) return 'One special character (!@#$%^&*)';
    return null;
}

export default function AdminResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token') || '';

    const [valid, setValid] = useState(null);
    const [np, setNp] = useState('');
    const [cp, setCp] = useState('');
    const [show, setShow] = useState({ n: false, c: false });
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        (async () => {
            if (!token) {
                setValid(false);
                return;
            }
            const { data } = await apiValidateResetToken(token);
            setValid(!!data?.valid);
        })();
    }, [token]);

    async function handleSubmit(e) {
        e.preventDefault();
        setErr('');
        setMsg('');
        const h = policyHint(np);
        if (h) {
            setErr(h);
            return;
        }
        if (np !== cp) {
            setErr('Passwords do not match.');
            return;
        }
        setLoading(true);
        const { data, error } = await apiResetPassword(token, np, cp);
        setLoading(false);
        if (error) {
            if (
                String(error).toLowerCase().includes('expired') ||
                String(error).toLowerCase().includes('already been used')
            ) {
                setValid(false);
            }
            setErr(error);
            return;
        }
        setMsg(data?.message || 'Password changed successfully. You can now log in.');
        setTimeout(() => navigate('/admin/login', { replace: true }), 2800);
    }

    if (valid === null) {
        return (
            <div className="admin-login">
                <div className="admin-login__card" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
                    Checking link…
                </div>
            </div>
        );
    }

    if (valid === false) {
        return (
            <div className="admin-login">
                <div className="admin-login__card">
                    <div className="admin-login__header">
                        <div className="admin-login__logo">
                            <Plane size={32} />
                        </div>
                        <h1>Link invalid</h1>
                        <p style={{ color: '#FCA5A5' }}>
                            This link has expired or has already been used.
                        </p>
                    </div>
                    <Link to="/admin/forgot-password" className="admin-btn admin-btn--primary admin-login__submit" style={{ textAlign: 'center', textDecoration: 'none' }}>
                        Request a new link
                    </Link>
                    <p style={{ marginTop: 16, textAlign: 'center' }}>
                        <Link to="/admin/login" style={{ color: '#60a5fa', fontSize: '0.9rem' }}>
                            Back to login
                        </Link>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-login">
            <div className="admin-login__card">
                <div className="admin-login__header">
                    <div className="admin-login__logo">
                        <Plane size={32} />
                    </div>
                    <h1>Set new password</h1>
                    <p>Choose a strong password for your account.</p>
                </div>

                <form onSubmit={handleSubmit} className="admin-login__form">
                    {err && valid && (
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                padding: '10px 14px',
                                borderRadius: 8,
                                background: 'rgba(239,68,68,0.12)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                color: '#FCA5A5',
                                fontSize: '0.84rem',
                                marginBottom: 16,
                            }}
                        >
                            <AlertCircle size={16} />
                            {err}
                        </div>
                    )}
                    {msg && (
                        <div
                            style={{
                                padding: '10px 14px',
                                borderRadius: 8,
                                background: 'rgba(34,197,94,0.12)',
                                border: '1px solid rgba(34,197,94,0.3)',
                                color: '#86EFAC',
                                fontSize: '0.84rem',
                                marginBottom: 16,
                            }}
                        >
                            {msg}
                        </div>
                    )}

                    <div className="admin-login__field">
                        <label htmlFor="new-password">New password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="new-password"
                                name="new-password"
                                type={show.n ? 'text' : 'password'}
                                className="admin-form-input"
                                value={np}
                                onChange={(e) => setNp(e.target.value)}
                                style={{ paddingRight: 42 }}
                            />
                            <button
                                type="button"
                                onClick={() => setShow((s) => ({ ...s, n: !s.n }))}
                                style={{
                                    position: 'absolute',
                                    right: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.4)',
                                }}
                            >
                                {show.n ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="admin-login__field">
                        <label htmlFor="confirm-password">Confirm password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="confirm-password"
                                name="confirm-password"
                                type={show.c ? 'text' : 'password'}
                                className="admin-form-input"
                                value={cp}
                                onChange={(e) => setCp(e.target.value)}
                                style={{ paddingRight: 42 }}
                            />
                            <button
                                type="button"
                                onClick={() => setShow((s) => ({ ...s, c: !s.c }))}
                                style={{
                                    position: 'absolute',
                                    right: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.4)',
                                }}
                            >
                                {show.c ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="admin-btn admin-btn--primary admin-login__submit"
                        disabled={loading}
                    >
                        {loading ? 'Saving…' : 'Update password'}
                    </button>

                    <p style={{ marginTop: 12, textAlign: 'center' }}>
                        <Link to="/admin/login" style={{ color: '#60a5fa', fontSize: '0.85rem' }}>
                            Back to login
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}

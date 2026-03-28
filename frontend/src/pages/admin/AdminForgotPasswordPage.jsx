import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plane, AlertCircle } from 'lucide-react';
import { apiForgotPassword } from '../../services/adminApi';

export default function AdminForgotPasswordPage() {
    const [workEmail, setWorkEmail] = useState('');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setErr('');
        setMsg('');
        if (!workEmail.trim()) {
            setErr('Please enter your work email.');
            return;
        }
        setLoading(true);
        const { data, error } = await apiForgotPassword(workEmail);
        setLoading(false);
        if (error) {
            setErr(error);
            return;
        }
        setMsg(
            data?.message ||
                'If this email exists, a reset link has been sent to your personal email address.',
        );
    }

    return (
        <div className="admin-login">
            <div className="admin-login__card">
                <div className="admin-login__header">
                    <div className="admin-login__logo">
                        <Plane size={32} />
                    </div>
                    <h1>Forgot password</h1>
                    <p>Enter your work email (e.g. firstname.lastname@mir-airport.tn)</p>
                </div>

                <form onSubmit={handleSubmit} className="admin-login__form">
                    {err && (
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
                        <label>Work email</label>
                        <input
                            type="email"
                            className="admin-form-input"
                            value={workEmail}
                            onChange={(e) => setWorkEmail(e.target.value)}
                            placeholder="hanen.kalaizar@mir-airport.tn"
                            autoComplete="email"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="admin-btn admin-btn--primary admin-login__submit"
                        disabled={loading}
                    >
                        {loading ? 'Sending…' : 'Send reset link'}
                    </button>

                    <p style={{ marginTop: 16, textAlign: 'center', fontSize: '0.85rem' }}>
                        <Link to="/login" style={{ color: '#60a5fa' }}>
                            Back to login
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}

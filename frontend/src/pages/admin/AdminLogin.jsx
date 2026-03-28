import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Plane, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { apiLogin } from '../../services/adminApi';

export default function AdminLogin() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email.trim() || !password) {
            setError('Please enter your email and password.');
            return;
        }

        setLoading(true);
        const { data, error: apiError } = await apiLogin(email.trim(), password);
        setLoading(false);

        if (apiError) {
            setError(apiError);
            return;
        }

        // Store the real JWT token — not 'demo'
        const { access_token, user, must_change_password, profile_complete } = data;
        localStorage.setItem('admin_token', access_token);
        localStorage.setItem('admin_role', user.role);
        localStorage.setItem('admin_user', JSON.stringify(user));
        localStorage.setItem('admin_must_change', String(!!must_change_password));
        const pc = user.role === 'super_admin' ? true : !!profile_complete;
        localStorage.setItem('admin_profile_complete', String(pc));
        if (user.airport_iata) {
            localStorage.setItem('admin_airport_iata', user.airport_iata);
        }

        // Navigate to dashboard (AdminApp handles the onboarding redirect)
        navigate('/dashboard', { replace: true });
    };

    return (
        <div className="admin-login">
            <div className="admin-login__card">
                <div className="admin-login__header">
                    <div className="admin-login__logo">
                        <Plane size={32} />
                    </div>
                    <h1>{t('admin_login_title')}</h1>
                    <p>{t('admin_login_subtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} className="admin-login__form">

                    {/* Error banner */}
                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            padding: '10px 14px', borderRadius: 8,
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#FCA5A5', fontSize: '0.84rem',
                            marginBottom: 16,
                        }}>
                            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Email */}
                    <div className="admin-login__field">
                        <label>{t('admin_login_email')}</label>
                        <input
                            type="email"
                            className="admin-form-input"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="admin@tunis-carthage.tn"
                            autoComplete="email"
                            required
                        />
                    </div>

                    {/* Password */}
                    <div className="admin-login__field">
                        <label>{t('admin_login_password')}</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="admin-form-input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                required
                                style={{ paddingRight: 42 }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                style={{
                                    position: 'absolute', right: 12, top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.4)', padding: 0,
                                }}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <div style={{ textAlign: 'right', marginTop: 8 }}>
                            <Link to="/forgot-password" style={{ fontSize: '0.82rem', color: '#60a5fa' }}>
                                Forgot password?
                            </Link>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="admin-btn admin-btn--primary admin-login__submit"
                        disabled={loading}
                    >
                        <LogIn size={18} />
                        {loading ? t('admin_login_signing_in') : t('admin_login_submit')}
                    </button>
                </form>
            </div>
        </div>
    );
}

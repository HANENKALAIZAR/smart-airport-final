import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Plane, AlertCircle, Eye, EyeOff, Globe, Moon, Sun, Search, HelpCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { apiLogin } from '../../services/adminApi';

export default function AdminLogin() {
    const navigate = useNavigate();
    const { t, language, setLanguage } = useLanguage();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [isDarkMode, setIsDarkMode] = useState(true);

    const toggleDarkMode = () => {
        setIsDarkMode(!isDarkMode);
        document.documentElement.classList.toggle('light-theme', isDarkMode);
        document.documentElement.classList.toggle('dark-theme', !isDarkMode);
    };

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'fr' : 'en');
    };

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
        const minimalUser = {
            id: user.id,
            email: user.email,
            role: user.role,
            status: user.id_document_status,
            token: access_token
        };

        localStorage.removeItem('admin_user');
        try {
            localStorage.setItem('admin_user', JSON.stringify(minimalUser));
        } catch (e) {
            console.error("Failed to store user in localStorage:", e);
        }

        localStorage.setItem('admin_token', access_token);
        localStorage.setItem('admin_role', user.role);
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
        <div className={`admin-login ${!isDarkMode ? 'admin-login--light' : ''}`}>
            <header style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 2rem',
                height: '64px',
                background: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(12px)',
                borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative', color: '#3b82f6' }}>
                        <Globe size={20} />
                        <Search size={10} style={{ position: 'absolute', bottom: -2, right: -2, background: isDarkMode ? '#0f172a' : '#ffffff', borderRadius: '50%' }} />
                    </div>
                    <span style={{ 
                        color: isDarkMode ? 'white' : '#1e293b', 
                        fontWeight: '700', 
                        letterSpacing: '0.05em',
                        fontSize: '1rem' 
                    }}>SKYCONTROL ADMIN</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 23, 42, 0.7)' }}>
                    <button 
                        type="button"
                        onClick={toggleLanguage}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', background: 'none', border: 'none', color: 'inherit' }}
                    >
                        <Globe size={18} />
                        <span>EN/FR</span>
                    </button>
                    <button 
                        type="button"
                        onClick={toggleDarkMode}
                        style={{ 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            width: '32px', height: '32px', borderRadius: '8px', 
                            border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.2)', 
                            background: 'transparent', color: 'inherit', cursor: 'pointer' 
                        }}
                    >
                        {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <button 
                        type="button"
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex' }}
                    >
                        <HelpCircle size={20} />
                    </button>
                </div>
            </header>

            <div className="admin-login__card" style={{ marginTop: '32px' }}>
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

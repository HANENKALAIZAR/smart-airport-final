import { useState } from 'react';
import { Plane, Mail, Lock, User, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { login, register } from '../services/api';

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (isLogin) {
                const data = await login(email, password);
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('user', JSON.stringify(data.user));
                setToken(data.access_token);
                setMessage({ type: 'success', text: `Welcome back, ${data.user.full_name}!` });
            } else {
                const data = await register(email, password, fullName);
                setMessage({ type: 'success', text: `Account created! Welcome, ${data.full_name || fullName}.` });
                setIsLogin(true);
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Authentication failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setMessage({ type: 'success', text: 'Logged out successfully' });
    };

    if (token) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return (
            <div className="animate-in">
                <div className="page-header">
                    <h1 className="page-title">👤 Profile</h1>
                    <p className="page-subtitle">Manage your account</p>
                </div>

                <div className="card" style={{ maxWidth: 500, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto var(--space-md)', fontSize: '2rem'
                        }}>
                            {user.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{user.full_name || 'User'}</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{user.email}</p>
                        <span className="badge badge--scheduled" style={{ marginTop: 'var(--space-sm)', display: 'inline-block' }}>
                            {user.role || 'passenger'}
                        </span>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Account ID</span>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>#{user.id}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Status</span>
                            <span style={{ color: 'var(--success)', fontSize: '0.875rem', fontWeight: 600 }}>Active</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-sm) 0' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>JWT Token</span>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--primary-400)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {token.substring(0, 30)}...
                            </span>
                        </div>
                    </div>

                    <button className="btn btn--danger" style={{ width: '100%', marginTop: 'var(--space-lg)' }} onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in">
            <div className="login-container">
                <div className="login-card">
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
                        <Plane size={40} style={{ color: 'var(--primary-400)', marginBottom: 'var(--space-sm)' }} />
                        <h1 className="login-card__title">Smart Airport</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            AI-Powered Delay Prediction System
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="tabs" style={{ marginBottom: 'var(--space-lg)' }}>
                        <button className={`tab ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>Sign In</button>
                        <button className={`tab ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>Register</button>
                    </div>

                    {message && (
                        <div className={`alert alert--${message.type === 'success' ? 'success' : 'danger'}`}>
                            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {!isLogin && (
                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        className="form-input" type="text" placeholder="John Doe"
                                        value={fullName} onChange={e => setFullName(e.target.value)}
                                        style={{ paddingLeft: 42 }} required
                                    />
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    className="form-input" type="email" placeholder="admin@airport.com"
                                    value={email} onChange={e => setEmail(e.target.value)}
                                    style={{ paddingLeft: 42 }} required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    className="form-input" type="password" placeholder="••••••••"
                                    value={password} onChange={e => setPassword(e.target.value)}
                                    style={{ paddingLeft: 42 }} required
                                />
                            </div>
                        </div>

                        <button className="btn btn--primary" type="submit" disabled={loading} style={{ marginTop: 'var(--space-md)' }}>
                            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--space-lg)' }}>
                        {isLogin
                            ? 'Authorized personnel only. All access is monitored.'
                            : 'By creating an account, you agree to the terms of service.'}
                    </p>
                </div>
            </div>
        </div>
    );
}

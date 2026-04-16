import { useState } from 'react';
import { Settings, User, Bell, Globe, Shield, CheckCircle } from 'lucide-react';
import CustomSelect from '../components/ui/CustomSelect';

export default function SettingsPage() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const [profile, setProfile] = useState({
        full_name: user.full_name || '',
        email: user.email || '',
        role: user.role || 'passenger',
    });

    const [notifications, setNotifications] = useState({
        delay_alerts: true,
        flight_updates: true,
        weekly_reports: false,
        marketing: false,
    });

    const [preferences, setPreferences] = useState({
        defaultAirport: 'CDG',
        delayThreshold: 15,
        autoRefresh: true,
        darkMode: true,
    });

    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        localStorage.setItem('user', JSON.stringify({ ...user, ...profile }));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1 className="page-title">⚙️ Settings</h1>
                <p className="page-subtitle">Manage your preferences and account</p>
            </div>

            {saved && (
                <div className="alert alert--success">
                    <CheckCircle size={16} /> Settings saved successfully
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                {/* Profile Section */}
                <div className="card">
                    <div className="card__header">
                        <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <User size={20} style={{ color: 'var(--primary-400)' }} />
                            User Profile
                        </div>
                    </div>

                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input className="form-input" type="text" value={profile.full_name}
                                onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" value={profile.email}
                                onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Role</label>
                        <CustomSelect
                            options={[
                                { value: 'passenger', label: 'Passenger' },
                                { value: 'staff', label: 'Staff' },
                                { value: 'admin', label: 'Admin' },
                            ]}
                            value={profile.role}
                            onChange={(val) => setProfile(p => ({ ...p, role: val }))}
                        />
                    </div>
                </div>

                {/* Notifications Section */}
                <div className="card">
                    <div className="card__header">
                        <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Bell size={20} style={{ color: 'var(--primary-400)' }} />
                            Notifications
                        </div>
                    </div>

                    {[
                        { key: 'delay_alerts', title: 'Delay Alerts', desc: 'Get notified when flights are predicted to be delayed' },
                        { key: 'flight_updates', title: 'Flight Updates', desc: 'Status changes and gate information' },
                        { key: 'weekly_reports', title: 'Weekly Reports', desc: 'Summary of delay statistics and trends' },
                        { key: 'marketing', title: 'Marketing Emails', desc: 'Promotions and service announcements' },
                    ].map(({ key, title, desc }) => (
                        <div className="setting-row" key={key}>
                            <div className="setting-row__info">
                                <div className="setting-row__title">{title}</div>
                                <div className="setting-row__desc">{desc}</div>
                            </div>
                            <label className="toggle">
                                <input type="checkbox" checked={notifications[key]}
                                    onChange={e => setNotifications(n => ({ ...n, [key]: e.target.checked }))} />
                                <span className="toggle__slider"></span>
                            </label>
                        </div>
                    ))}
                </div>

                {/* System Preferences */}
                <div className="card">
                    <div className="card__header">
                        <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Globe size={20} style={{ color: 'var(--primary-400)' }} />
                            System Preferences
                        </div>
                    </div>

                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-label">Default Airport</label>
                            <CustomSelect
                                options={['CDG', 'JFK', 'LAX', 'LHR', 'DXB', 'ATL', 'ORD'].map(code => ({ value: code, label: code }))}
                                value={preferences.defaultAirport}
                                onChange={(val) => setPreferences(p => ({ ...p, defaultAirport: val }))}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Delay Alert Threshold ({preferences.delayThreshold} min)</label>
                            <input type="range" className="form-range" min="5" max="120" step="5"
                                value={preferences.delayThreshold}
                                onChange={e => setPreferences(p => ({ ...p, delayThreshold: parseInt(e.target.value) }))} />
                        </div>
                    </div>

                    <div className="setting-row">
                        <div className="setting-row__info">
                            <div className="setting-row__title">Auto-Refresh</div>
                            <div className="setting-row__desc">Automatically refresh dashboard data every 30 seconds</div>
                        </div>
                        <label className="toggle">
                            <input type="checkbox" checked={preferences.autoRefresh}
                                onChange={e => setPreferences(p => ({ ...p, autoRefresh: e.target.checked }))} />
                            <span className="toggle__slider"></span>
                        </label>
                    </div>

                    <div className="setting-row">
                        <div className="setting-row__info">
                            <div className="setting-row__title">Dark Mode</div>
                            <div className="setting-row__desc">Use dark theme for the interface</div>
                        </div>
                        <label className="toggle">
                            <input type="checkbox" checked={preferences.darkMode}
                                onChange={e => setPreferences(p => ({ ...p, darkMode: e.target.checked }))} />
                            <span className="toggle__slider"></span>
                        </label>
                    </div>
                </div>

                {/* Security */}
                <div className="card">
                    <div className="card__header">
                        <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Shield size={20} style={{ color: 'var(--primary-400)' }} />
                            Security
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Change Password</label>
                        <input className="form-input" type="password" placeholder="Current password" style={{ marginBottom: 'var(--space-sm)' }} />
                        <input className="form-input" type="password" placeholder="New password" style={{ marginBottom: 'var(--space-sm)' }} />
                        <input className="form-input" type="password" placeholder="Confirm new password" />
                    </div>

                    <div className="setting-row">
                        <div className="setting-row__info">
                            <div className="setting-row__title">Two-Factor Authentication</div>
                            <div className="setting-row__desc">Add an extra layer of security to your account</div>
                        </div>
                        <button className="btn btn--sm btn--outline">Enable</button>
                    </div>
                </div>

                {/* System Info */}
                <div className="card" style={{ opacity: 0.8 }}>
                    <div className="card__header">
                        <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Settings size={20} style={{ color: 'var(--text-muted)' }} />
                            System Information
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-md)', fontSize: '0.85rem' }}>
                        <div><span style={{ color: 'var(--text-muted)' }}>Version</span><br />1.0.0</div>
                        <div><span style={{ color: 'var(--text-muted)' }}>API Endpoint</span><br />http://localhost:8000</div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Model</span><br />XGBoost v2.1</div>
                        <div><span style={{ color: 'var(--text-muted)' }}>API Status</span><br /><span style={{ color: 'var(--success)' }}>● Online</span></div>
                    </div>
                </div>

                <button className="btn btn--primary" onClick={handleSave} style={{ alignSelf: 'flex-start' }}>
                    Save Settings
                </button>
            </div>
        </div>
    );
}

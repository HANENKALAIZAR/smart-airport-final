import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar as CalendarIcon, ChevronDown, Building2, Bell, Sun, Moon, ChevronLeft } from 'lucide-react';
import { useAirport, TUNISIAN_AIRPORTS } from '../../context/AirportContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import { apiGetNotificationSummary, apiMarkNotificationRead, apiMarkAllNotificationsRead } from '../../services/adminApi';
import useAdminAuth from '../../hooks/useAdminAuth';
import { useAdminTheme } from '../../hooks/useAdminPrefs';

interface AdminHeaderProps {
    selectedDate: Date;
    onDateClick: () => void;
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
}

interface NotificationItem {
    id: number;
    body: string;
    is_read: boolean;
    created_at: string;
    context?: {
        action?: string;
        admin_id?: number | null;
        [key: string]: any;
    };
}

interface NotificationSummary {
    unread_count: number;
    pending_review_count: number;
    items: NotificationItem[];
}

function initialsFromName(name?: string) {
    if (!name || !String(name).trim()) return '?';
    return String(name)
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

function formatNotifTime(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const diffMin = (Date.now() - d.getTime()) / 60000;
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${Math.floor(diffMin)} min ago`;
    const diffH = diffMin / 60;
    if (diffH < 24) return `${Math.floor(diffH)}h ago`;
    return d.toLocaleDateString();
}

export default function AdminHeader({ selectedDate, onDateClick, collapsed, setCollapsed }: AdminHeaderProps) {
    const navigate = useNavigate();
    const { selectedAirport, setSelectedAirport, role } = useAirport();
    const { t } = useLanguage();
    const [theme, setTheme] = useAdminTheme();
    const [airportDropdownOpen, setAirportDropdownOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [summary, setSummary] = useState<NotificationSummary | null>(null);
    const { user: headerUser, refetch: refetchMe } = useAdminAuth();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    const loadSummary = useCallback(async () => {
        const token = localStorage.getItem('admin_token');
        if (!token || token === 'demo') return;
        const { data } = await apiGetNotificationSummary();
        if (data) setSummary(data);
    }, []);

    useEffect(() => {
        loadSummary();
        const iv = setInterval(() => {
            loadSummary();
        }, 45000);
        return () => clearInterval(iv);
    }, [loadSummary]);

    const badgeCount =
        role === 'super_admin'
            ? (summary?.pending_review_count ?? 0)
            : (summary?.unread_count ?? 0);

    const items = summary?.items ?? [];

    useEffect(() => {
        const onRefreshMe = () => refetchMe();
        window.addEventListener('admin-header-refresh-me', onRefreshMe);
        return () => window.removeEventListener('admin-header-refresh-me', onRefreshMe);
    }, [refetchMe]);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setAirportDropdownOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setNotifOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const markAllRead = async () => {
        await apiMarkAllNotificationsRead();
        await loadSummary();
    };

    async function handleNotifClick(n: NotificationItem) {
        if (!n.is_read) {
            await apiMarkNotificationRead(n.id);
        }
        const ctx = n.context || {};
        if (ctx.action === 'open_admin_review' && ctx.admin_id != null && role === 'super_admin') {
            navigate(`/dashboard/users?review=${ctx.admin_id}`);
        } else if (ctx.action === 'open_settings') {
            navigate('/dashboard/settings');
        }
        await loadSummary();
        setNotifOpen(false);
    }

    const formatDate = (date: Date) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    return (
        <div className="admin-header">
            <div className="admin-header__left">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className="admin-header__btn admin-header__btn--square"
                >
                    <ChevronLeft
                        size={18}
                        className="admin-header__btn-icon"
                        style={{
                            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)'
                        }}
                    />
                </button>

                <button className="admin-header__btn" onClick={onDateClick}>
                    <CalendarIcon size={18} className="admin-header__btn-icon" />
                    <span>{formatDate(selectedDate)}</span>
                </button>
                <div className="admin-header__divider" />

                {role === 'super_admin' ? (
                    <div className="admin-header__airport-selector" ref={dropdownRef} style={{ position: 'relative' }}>
                        <button
                            className="admin-header__btn"
                            onClick={() => setAirportDropdownOpen(!airportDropdownOpen)}
                        >
                            <Building2 size={18} className="admin-header__btn-icon" />
                            <span>{selectedAirport.name} ({selectedAirport.iata})</span>
                            <ChevronDown size={16} className={`admin-header__chevron${airportDropdownOpen ? ' open' : ''}`} style={{ transition: 'transform 200ms', transform: airportDropdownOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
                        </button>
                        {airportDropdownOpen && (
                            <div className="admin-header__airport-dropdown">
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--adm-text-muted)', padding: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {t('switchAirport')}
                                </div>
                                {TUNISIAN_AIRPORTS.map(a => (
                                    <button
                                        key={a.id}
                                        className={`admin-header__airport-option${a.id === selectedAirport.id ? ' active' : ''}`}
                                        onClick={() => { setSelectedAirport(a); setAirportDropdownOpen(false); }}
                                    >
                                        <span style={{ fontWeight: 700, fontSize: '0.875rem', width: '38px', flexShrink: 0 }}>{a.iata}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--adm-text-sub)' }}>{a.city}</div>
                                        </div>
                                        {a.id === selectedAirport.id && <span style={{ color: 'var(--adm-accent)', fontWeight: 700 }}>✓</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="admin-header__airport">
                        {selectedAirport.name} {t('operations')}
                    </div>
                )}
            </div>

            <div className="admin-header__right">
                <div className="admin-header__search">
                    <Search className="admin-header__search-icon" />
                    <input
                        id="global-flight-search"
                        name="search"
                        type="text"
                        placeholder={t('searchFlights')}
                        className="admin-header__search-input"
                    />
                </div>

                <LanguageSwitcher />

                {/* Theme Toggle */}
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-label="Toggle theme"
                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    className="admin-header__btn admin-header__btn--square"
                >
                    {theme === 'dark' ? <Sun size={18} className="admin-header__btn-icon" /> : <Moon size={18} className="admin-header__btn-icon" />}
                </button>

                <div className="admin-notif" ref={notifRef}>
                    <button
                        type="button"
                        className="admin-header__btn admin-header__btn--square"
                        onClick={() => {
                            setNotifOpen(!notifOpen);
                            if (!notifOpen) loadSummary();
                        }}
                    >
                        <Bell size={18} className="admin-header__btn-icon" />
                        {badgeCount > 0 && (
                            <span className="admin-notif__badge">{badgeCount > 99 ? '99+' : badgeCount}</span>
                        )}
                    </button>
                    {notifOpen && (
                        <div className="admin-notif__dropdown">
                            <div className="admin-notif__header">
                                <span className="admin-notif__title">{t('notifications')}</span>
                                {items.some((n) => !n.is_read) && (
                                    <button type="button" className="admin-notif__mark-read" onClick={markAllRead}>
                                        {t('markAllRead')}
                                    </button>
                                )}
                            </div>
                            <div className="admin-notif__list">
                                {items.length === 0 && (
                                    <div className="admin-notif__item" style={{ color: 'var(--adm-text-muted)', cursor: 'default' }}>
                                        <div className="admin-notif__item-content">
                                            <div className="admin-notif__item-msg">No notifications yet.</div>
                                        </div>
                                    </div>
                                )}
                                {items.map((n) => (
                                    <button
                                        type="button"
                                        key={n.id}
                                        className={`admin-notif__item${n.is_read ? '' : ' unread'}`}
                                        onClick={() => handleNotifClick(n)}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'inherit',
                                            font: 'inherit',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 8,
                                        }}
                                    >
                                        <span className="admin-notif__item-icon">📋</span>
                                        <div className="admin-notif__item-content" style={{ flex: 1, minWidth: 0 }}>
                                            <div className="admin-notif__item-msg" style={{ whiteSpace: 'normal', lineHeight: 1.35 }}>
                                                {n.body}
                                            </div>
                                            <div className="admin-notif__item-time">{formatNotifTime(n.created_at)}</div>
                                        </div>
                                        {!n.is_read && <span className="admin-notif__item-dot" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="admin-header__user" onClick={() => navigate(role === 'super_admin' ? '/dashboard/settings' : '/dashboard/profile')}>
                    <div className="admin-header__avatar-wrapper">
                        {headerUser?.profile_photo_url ? (
                            <img
                                src={headerUser.profile_photo_url}
                                alt=""
                                className="admin-header__avatar"
                            />
                        ) : (
                            <div className="admin-header__avatar admin-header__avatar--placeholder">
                                {initialsFromName(headerUser?.full_name)}
                            </div>
                        )}
                    </div>
                    <div className="admin-header__user-info">
                        <span className="admin-header__username">
                            {headerUser?.full_name || (role === 'super_admin' ? t('superAdmin') : t('admin'))}
                        </span>
                        {headerUser?.full_name && (
                            <span className="admin-header__userrole">
                                {role === 'super_admin' ? t('superAdmin') : t('admin')}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

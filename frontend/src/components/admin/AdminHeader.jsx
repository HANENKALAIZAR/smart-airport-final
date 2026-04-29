import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar as CalendarIcon, ChevronDown, Building2, Bell } from 'lucide-react';
import { useAirport, TUNISIAN_AIRPORTS } from '../../context/AirportContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import { apiGetNotificationSummary, apiMarkNotificationRead, apiMarkAllNotificationsRead } from '../../services/adminApi';
import useAdminAuth from '../../hooks/useAdminAuth';

function initialsFromName(name) {
    if (!name || !String(name).trim()) return '?';
    return String(name)
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

function formatNotifTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const diffMin = (Date.now() - d.getTime()) / 60000;
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${Math.floor(diffMin)} min ago`;
    const diffH = diffMin / 60;
    if (diffH < 24) return `${Math.floor(diffH)}h ago`;
    return d.toLocaleDateString();
}

export default function AdminHeader({ selectedDate, onDateClick }) {
    const navigate = useNavigate();
    const { selectedAirport, setSelectedAirport, role } = useAirport();
    const { t } = useLanguage();
    const [airportDropdownOpen, setAirportDropdownOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [summary, setSummary] = useState(null);
    const { user: headerUser, refetch: refetchMe } = useAdminAuth();
    const dropdownRef = useRef(null);
    const notifRef = useRef(null);

    const loadSummary = useCallback(async () => {
        const token = localStorage.getItem('admin_token');
        if (!token || token === 'demo') return;
        const { data } = await apiGetNotificationSummary();
        if (data) setSummary(data);
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
        function handleClick(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setAirportDropdownOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target)) {
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

    async function handleNotifClick(n) {
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

    const formatDate = (date) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    return (
        <div className="admin-header">
            <div className="admin-header__left">
                <button className="admin-header__date" onClick={onDateClick}>
                    <CalendarIcon size={20} className="admin-header__date-icon" />
                    <span>{formatDate(selectedDate)}</span>
                </button>
                <div className="admin-header__divider" />

                {role === 'super_admin' ? (
                    <div className="admin-header__airport-selector" ref={dropdownRef}>
                        <button
                            className="admin-header__airport-btn"
                            onClick={() => setAirportDropdownOpen(!airportDropdownOpen)}
                        >
                            <Building2 size={18} className="admin-header__airport-icon" />
                            <span>{selectedAirport.name} ({selectedAirport.iata})</span>
                            <ChevronDown size={16} className={`admin-header__chevron${airportDropdownOpen ? ' open' : ''}`} />
                        </button>
                        {airportDropdownOpen && (
                            <div className="admin-header__airport-dropdown">
                                <div className="admin-header__airport-dropdown-title">{t('switchAirport')}</div>
                                {TUNISIAN_AIRPORTS.map(a => (
                                    <button
                                        key={a.id}
                                        className={`admin-header__airport-option${a.id === selectedAirport.id ? ' active' : ''}`}
                                        onClick={() => { setSelectedAirport(a); setAirportDropdownOpen(false); }}
                                    >
                                        <span className="admin-header__airport-option-iata">{a.iata}</span>
                                        <div>
                                            <div className="admin-header__airport-option-name">{a.name}</div>
                                            <div className="admin-header__airport-option-city">{a.city}</div>
                                        </div>
                                        {a.id === selectedAirport.id && <span className="admin-header__airport-check">✓</span>}
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

                <LanguageSwitcher variant="dark" />

                <div className="admin-notif" ref={notifRef}>
                    <button
                        type="button"
                        className="admin-notif__btn"
                        onClick={() => {
                            setNotifOpen(!notifOpen);
                            if (!notifOpen) loadSummary();
                        }}
                    >
                        <Bell size={20} />
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
                                    <div className="admin-notif__item" style={{ color: 'rgba(255,255,255,0.35)', cursor: 'default' }}>
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

                <div className="admin-header__user" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {headerUser?.profile_photo_url ? (
                        <img
                            src={headerUser.profile_photo_url}
                            alt=""
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid rgba(255,255,255,0.12)',
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(14,165,233,0.35))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#F1F5F9',
                            }}
                        >
                            {initialsFromName(headerUser?.full_name)}
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
                        <span
                            style={{
                                fontSize: '0.88rem',
                                fontWeight: 600,
                                color: '#F1F5F9',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {headerUser?.full_name || (role === 'super_admin' ? t('superAdmin') : t('admin'))}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    Plane, LayoutDashboard, Target, TrendingUp,
    BrainCircuit, Settings, LogOut, Users, Globe,
    ChevronRight, ChevronLeft, FileText, MessageSquare,
} from 'lucide-react';
import { useAirport } from '../../context/AirportContext';
import { useLanguage } from '../../context/LanguageContext';
import { apiGetMessageUnreadCount } from '../../services/adminApi';

export default function AdminSidebar({ activeTab, onTabChange, onLogout, isRejected }) {
    const { selectedAirport, role } = useAirport();
    const { t } = useLanguage();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(
        () => localStorage.getItem('admin_sidebar_collapsed') === 'true'
    );
    const [msgUnread, setMsgUnread] = useState(0);

    const refreshMsgUnread = useCallback(async () => {
        const token = localStorage.getItem('admin_token');
        if (!token || token === 'demo') return;
        const { data } = await apiGetMessageUnreadCount();
        if (data && typeof data.count === 'number') setMsgUnread(data.count);
    }, []);

    useEffect(() => {
        localStorage.setItem('admin_sidebar_collapsed', String(collapsed));
    }, [collapsed]);

    useEffect(() => {
        refreshMsgUnread();
        const iv = setInterval(refreshMsgUnread, 45000);
        const onRefresh = () => refreshMsgUnread();
        window.addEventListener('admin-msg-unread-refresh', onRefresh);
        return () => {
            clearInterval(iv);
            window.removeEventListener('admin-msg-unread-refresh', onRefresh);
        };
    }, [refreshMsgUnread]);

    useEffect(() => {
        if (location.pathname.includes('/dashboard/messages')) refreshMsgUnread();
    }, [location.pathname, refreshMsgUnread]);

    let menuItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: t('dashboard') },
        { to: '/dashboard/flights', icon: Plane, label: t('flights') },
        { to: '/dashboard/analytics', icon: TrendingUp, label: t('analytics') },
        { to: '/dashboard/predict', icon: Target, label: t('predictDelay') },
        { to: '/dashboard/ai', icon: BrainCircuit, label: t('aiExplanations') },
        { to: '/dashboard/messages', icon: MessageSquare, label: 'Messages' },
        { to: '/dashboard/settings', icon: Settings, label: t('settings') },
        ...(role === 'super_admin' ? [
            { to: '/dashboard/global', icon: Globe, label: t('globalOps') || 'Global Ops', superOnly: true },
            { to: '/dashboard/users', icon: Users, label: t('admin_users_nav'), superOnly: true },
        ] : []),
    ];

    if (isRejected) {
        menuItems = [{ to: '/dashboard/settings', icon: Settings, label: t('settings') }];
    }

    // User initial for avatar
    const userInitial = role === 'super_admin' ? 'S' : 'A';

    return (
        <div className={`admin-sidebar${collapsed ? ' admin-sidebar--collapsed' : ''}`}>
            {/* Toggle button */}
            <button
                className="admin-sidebar__toggle"
                onClick={() => setCollapsed(c => !c)}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            {/* Logo – only in expanded mode */}
            {!collapsed && (
                <div className="admin-sidebar__brand">
                    <Plane className="admin-sidebar__brand-icon" />
                    <div>
                        <div className="admin-sidebar__brand-title">{t('smartAirport')}</div>
                        <div className="admin-sidebar__brand-sub">{selectedAirport.name}</div>
                    </div>
                </div>
            )}

            {/* Icon-only brand in collapsed mode */}
            {collapsed && (
                <div className="admin-sidebar__brand-icon-only">
                    <Plane size={22} />
                </div>
            )}

            {/* Navigation */}
            <nav className="admin-sidebar__nav">
                {menuItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        title={collapsed ? label : undefined}
                        className={({ isActive }) =>
                            `admin-sidebar__item${isActive ? ' active' : ''}${collapsed ? ' admin-sidebar__item--icon' : ''}`
                        }
                        onClick={() => onTabChange(label.toLowerCase())}
                        style={
                            to === '/dashboard/messages' && (msgUnread > 0 || collapsed)
                                ? { position: 'relative' }
                                : undefined
                        }
                    >
                        <Icon size={20} />
                        {!collapsed && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                                {to === '/dashboard/messages' && msgUnread > 0 && (
                                    <span
                                        style={{
                                            flexShrink: 0,
                                            minWidth: 20,
                                            height: 20,
                                            padding: '0 6px',
                                            borderRadius: 10,
                                            background: '#DC2626',
                                            color: '#fff',
                                            fontSize: '0.68rem',
                                            fontWeight: 700,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {msgUnread > 99 ? '99+' : msgUnread}
                                    </span>
                                )}
                            </span>
                        )}
                        {collapsed && to === '/dashboard/messages' && msgUnread > 0 && (
                            <span
                                style={{
                                    position: 'absolute',
                                    top: 6,
                                    right: 8,
                                    minWidth: 16,
                                    height: 16,
                                    padding: '0 4px',
                                    borderRadius: 8,
                                    background: '#DC2626',
                                    color: '#fff',
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {msgUnread > 9 ? '+' : msgUnread}
                            </span>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Bottom: logout (expanded) or avatar (collapsed) */}
            <div className="admin-sidebar__footer">
                {collapsed ? (
                    /* Collapsed: show avatar circle as logout */
                    <button
                        className="admin-sidebar__logout admin-sidebar__logout--icon"
                        onClick={onLogout}
                        title={t('logout')}
                    >
                        <div className="admin-sidebar__user-avatar">{userInitial}</div>
                    </button>
                ) : (
                    /* Expanded: show full logout row */
                    <button className="admin-sidebar__logout" onClick={onLogout}>
                        <LogOut size={20} />
                        <span>{t('logout')}</span>
                    </button>
                )}
            </div>
        </div>
    );
}

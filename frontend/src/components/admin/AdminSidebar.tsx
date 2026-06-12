import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, TrendingUp,
    BrainCircuit, Settings, LogOut, Users, Globe,
    ChevronRight, ChevronLeft, MessageSquare, UserCircle,
} from 'lucide-react';
import { useAirport } from '../../context/AirportContext';
import { useLanguage } from '../../context/LanguageContext';
import { apiGetMessageUnreadCount } from '../../services/adminApi';
import usePersistentState from '../../hooks/usePersistentState';
import logo from '../../assets/airplane-logo.png';

interface AdminSidebarProps {
    onTabChange: (tab: string) => void;
    onLogout: () => void;
    isRejected?: boolean;
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
}

export default function AdminSidebar({ onTabChange, onLogout, isRejected, collapsed, setCollapsed }: AdminSidebarProps) {
    const { selectedAirport, role } = useAirport();
    const { t } = useLanguage();
    const location = useLocation();
    const [token] = usePersistentState<string | null>('admin_token', null);
    const [msgUnread, setMsgUnread] = useState(0);

    const refreshMsgUnread = useCallback(async () => {
        if (!token || token === 'demo') return;
        const { data } = await apiGetMessageUnreadCount();
        const unreadVal = data?.totalUnread ?? data?.count ?? 0;
        setMsgUnread(unreadVal);
    }, [token]);

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

    const activeRole = role || localStorage.getItem('admin_role') || 'admin';
    const isSuperAdmin = activeRole === 'super_admin' || activeRole === 'superadmin';

    let menuItems = [
        { to: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard', id: 'dashboard' },
        { to: '/dashboard/analytics', icon: TrendingUp, labelKey: 'analytics', id: 'analytics' },
        ...(isSuperAdmin ? [
            { to: '/dashboard/ai', icon: BrainCircuit, labelKey: 'aiExplanations', id: 'ai' },
        ] : []),
        { to: '/dashboard/messages', icon: MessageSquare, labelKey: 'messages', id: 'messages' },
        ...(isSuperAdmin ? [] : [
            { to: '/dashboard/profile', icon: UserCircle, labelKey: 'profile', id: 'profile' },
        ]),
        { to: '/dashboard/global', icon: Globe, labelKey: 'globalOps', id: 'global' },
        ...(isSuperAdmin ? [
            { to: '/dashboard/settings', icon: Settings, labelKey: 'settings', id: 'settings' },
            { to: '/dashboard/users', icon: Users, labelKey: 'adminUsers', id: 'users' },
        ] : []),
    ];

    if (isRejected) {
        menuItems = [{ to: '/dashboard/settings', icon: Settings, labelKey: 'settings', id: 'settings' }];
    }

    const userInitial = isSuperAdmin ? 'SA' : 'A';

    return (
        <aside
            className={`admin-sidebar${collapsed ? " admin-sidebar--collapsed" : ""}`}
            style={{ width: collapsed ? 72 : 240 }}
        >
            <div
                className="admin-sidebar__brand"
                style={{
                    padding: collapsed ? "1rem 0.5rem" : "1.5rem",
                    justifyContent: collapsed ? "center" : "flex-start",
                }}
            >
                <img
                    src={logo}
                    alt={t('admin_brand')}
                    style={{
                        width: 36,
                        height: 36,
                        objectFit: "contain",
                        filter: "drop-shadow(0 0 8px rgba(245,158,11,0.35))",
                        flexShrink: 0,
                    }}
                />
                {!collapsed && (
                    <div style={{ minWidth: 0 }}>
                        <div className="admin-sidebar__brand-title">{t('smartAirport')}</div>
                        <div className="admin-sidebar__brand-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {selectedAirport.name}
                        </div>
                    </div>
                )}
            </div>

            <nav className="admin-sidebar__nav">
                {menuItems.map(({ to, icon: Icon, labelKey, id }) => {
                    const isMsgTab = to === '/dashboard/messages';
                    const displayLabel = t(labelKey);
                    return (
                        <NavLink
                            key={to}
                            to={to}
                            title={collapsed ? displayLabel : undefined}
                            className={({ isActive }) =>
                                `admin-sidebar__item${isActive ? ' active' : ''}${collapsed ? ' admin-sidebar__item--icon' : ''}`
                            }
                            onClick={() => onTabChange(id)}
                            style={isMsgTab && (msgUnread > 0 || collapsed) ? { position: 'relative' } : undefined}
                        >
                            <Icon size={20} style={{ flexShrink: 0 }} />
                            {!collapsed && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel}</span>
                                    {isMsgTab && msgUnread > 0 && (
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
                            {collapsed && isMsgTab && msgUnread > 0 && (
                                <span
                                    style={{
                                        position: 'absolute',
                                        top: 4,
                                        right: 4,
                                        minWidth: 16,
                                        height: 16,
                                        padding: '0 4px',
                                        borderRadius: 8,
                                        background: '#DC2626',
                                        color: '#fff',
                                        fontSize: '0.6rem',
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {msgUnread > 9 ? '+' : msgUnread}
                                </span>
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            <div className="admin-sidebar__footer">
                {collapsed ? (
                    <button
                        className="admin-sidebar__logout admin-sidebar__logout--icon"
                        onClick={onLogout}
                        title={t('logout')}
                        style={{ display: "flex", justifyContent: "center", width: "100%", padding: "0.75rem 0" }}
                    >
                        <LogOut size={20} style={{ flexShrink: 0 }} />
                    </button>
                ) : (
                    <button className="admin-sidebar__logout" onClick={onLogout}>
                        <LogOut size={20} />
                        <span>{t('logout')}</span>
                    </button>
                )}
            </div>
        </aside>
    );
}

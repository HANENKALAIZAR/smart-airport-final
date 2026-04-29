import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AdminAirportProvider, DEFAULT_AIRPORT, TUNISIAN_AIRPORTS } from '../../context/AirportContext';
import usePersistentState from '../../hooks/usePersistentState';
import { logoutAdmin } from '../../hooks/useAdminAuth';
import { apiGetMe } from '../../services/adminApi';

// ── Always-needed structural components (eager) ───────────────────────────
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminHeader  from '../../components/admin/AdminHeader';
import CalendarPopup from '../../components/admin/CalendarPopup';

// ── Onboarding screens (needed only before dashboard — keep eager) ─────────
import ChangePasswordScreen   from './ChangePasswordScreen';
import ProfileCompletionScreen from './ProfileCompletionScreen';
import PendingApprovalScreen  from './PendingApprovalScreen';

// ── Dashboard routes: lazy-loaded per route for code splitting ────────────
const AdminDashboard     = lazy(() => import('./AdminDashboard'));
const AdminFlights       = lazy(() => import('./AdminFlights'));
const AdminPredict       = lazy(() => import('./AdminPredict'));
const AdminAnalytics     = lazy(() => import('./AdminAnalytics'));
const AdminAIExplanations = lazy(() => import('./AdminAIExplanations'));
const AdminSettings      = lazy(() => import('./AdminSettings'));
const AdminMessages      = lazy(() => import('./AdminMessages'));
const SuperAdminUsers    = lazy(() => import('./SuperAdminUsers'));
const SuperAdminGlobalOps = lazy(() => import('./SuperAdminGlobalOps'));
const MonthlySummaryPage = lazy(() =>
    import('./AdminMonthlySummary').then(m => ({ default: m.MonthlySummaryPage }))
);
const YearlySummaryPage  = lazy(() =>
    import('./AdminYearlySummary').then(m => ({ default: m.YearlySummaryPage }))
);

// ── Page-level loading skeleton ───────────────────────────────────────────
function PageLoader() {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '60vh', color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem',
            gap: 10,
        }}>
            <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2px solid rgba(59,130,246,0.3)',
                borderTopColor: '#3b82f6',
                animation: 'spin 0.8s linear infinite',
            }} />
            Loading…
        </div>
    );
}

import '../../styles/admin.css';


// ── Restore airport object from IATA code stored via hook ──────────────────
function resolveAirport(iataCode) {
    if (!iataCode) return DEFAULT_AIRPORT;
    return TUNISIAN_AIRPORTS.find(a => a.iata === iataCode) || DEFAULT_AIRPORT;
}

// ── Helpers to read initial booleans from stored JSON-serialized values ─────
function readBool(val, fallback = false) {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'boolean') return val;
    return String(val) === 'true';
}

export default function AdminApp() {
    const navigate = useNavigate();

    // ── Persistent state (backed by localStorage atomically) ──────────────
    const [token]                       = usePersistentState('admin_token', null);
    const [storedRole]                  = usePersistentState('admin_role', 'admin');
    const [storedUser, setStoredUser]   = usePersistentState('admin_user', null);
    const [mustChangePassword, setMustChangePassword] = usePersistentState(
        'admin_must_change',
        storedRole === 'super_admin' ? false : false
    );
    const [profileComplete, setProfileComplete] = usePersistentState(
        'admin_profile_complete',
        storedRole === 'super_admin' ? true : false
    );
    const [airportIata, setAirportIata] = usePersistentState('admin_airport_iata', null);

    // Derived non-persistent state
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('dashboard');

    // ── Resolve airport object from stored IATA ────────────────────────────
    const selectedAirport = resolveAirport(airportIata);
    const handleAirportChange = (airport) => setAirportIata(airport.iata);

    // ── Derive gate flags ──────────────────────────────────────────────────
    const validToken = token && token !== 'demo' ? token : null;
    const role = storedUser?.role || storedRole || 'admin';
    const isSuper = role === 'super_admin';

    // Coerce stored values to booleans safely
    const mustChange  = isSuper ? false : readBool(mustChangePassword);
    const profComplete = isSuper ? true  : readBool(profileComplete);

    // idDocStatus is derived from the stored user object
    const idDocStatus = isSuper
        ? 'approved'
        : (storedUser?.id_document_status ?? storedUser?.status ?? null);

    // ── Sync onboarding flags from server on mount ─────────────────────────
    useEffect(() => {
        if (!validToken) return;
        let cancelled = false;
        (async () => {
            const { data, error } = await apiGetMe();
            if (cancelled || error || !data) return;
            _applyMeData(data);
        })();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [validToken]);

    // ── Apply /me response to all persistent state ─────────────────────────
    function _applyMeData(data) {
        const minimalUser = {
            id: data.id,
            email: data.email,
            full_name: data.full_name,
            role: data.role,
            id_document_status: data.id_document_status,
            status: data.id_document_status,
            airport_iata: data.airport_iata,
        };
        setStoredUser(minimalUser);

        const isS = data.role === 'super_admin';
        setMustChangePassword(isS ? false : !!data.must_change_password);
        setProfileComplete(isS ? true : !!data.profile_complete);
        if (data.airport_iata) setAirportIata(data.airport_iata);
    }

    // ── Handler: password changed ──────────────────────────────────────────
    function handlePasswordChanged() {
        setMustChangePassword(false);
    }

    // ── Handler: profile submitted ─────────────────────────────────────────
    function handleProfileComplete() {
        setProfileComplete(true);
        // Status becomes 'pending' after submission — don't skip approval gate
        setStoredUser(prev => ({ ...(prev || {}), id_document_status: 'pending', status: 'pending' }));
    }



    // ── Handler: approval refresh ──────────────────────────────────────────
    async function handleApprovalRefresh() {
        const { data } = await apiGetMe();
        if (data) _applyMeData(data);
    }

    // ── Handler: logout ────────────────────────────────────────────────────
    function handleLogout() {
        logoutAdmin(navigate);
    }

    // ── Onboarding gate: airport admins only (super admin skips) ─────────
    if (validToken && role === 'admin') {
        if (mustChange) {
            return <ChangePasswordScreen user={storedUser} onComplete={handlePasswordChanged} />;
        }
        if (!profComplete) {
            return <ProfileCompletionScreen user={storedUser} onComplete={handleProfileComplete} />;
        }
        if (idDocStatus === 'rejected') {
            return (
                <AdminAirportProvider airport={selectedAirport} setAirport={handleAirportChange} role={role}>
                    <div className="admin-layout">
                        <AdminSidebar
                            activeTab="settings"
                            onTabChange={setActiveTab}
                            onLogout={handleLogout}
                            isRejected={true}
                        />
                        <div className="admin-main">
                            <AdminHeader
                                selectedDate={selectedDate}
                                onDateClick={() => setIsCalendarOpen(true)}
                            />
                            <div className="admin-content">
                                <div className="admin-content__inner">
                                    <Suspense fallback={<PageLoader />}>
                                        <Routes>
                                            <Route path="settings" element={<AdminSettings />} />
                                            <Route path="*" element={<Navigate to="/dashboard/settings" replace />} />
                                        </Routes>
                                    </Suspense>
                                </div>
                            </div>
                        </div>
                    </div>
                </AdminAirportProvider>
            );
        } else if (idDocStatus !== 'approved') {
            return (
                <PendingApprovalScreen
                    user={storedUser}
                    onLogout={handleLogout}
                    onRefresh={handleApprovalRefresh}
                />
            );
        }
    }

    // ── Full dashboard ────────────────────────────────────────────────────
    return (
        <AdminAirportProvider airport={selectedAirport} setAirport={handleAirportChange} role={role}>
            <div className="admin-layout">
                <AdminSidebar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    onLogout={handleLogout}
                />

                <div className="admin-main">
                    <AdminHeader
                        selectedDate={selectedDate}
                        onDateClick={() => setIsCalendarOpen(true)}
                    />

                        <div className="admin-content">
                            <div className="admin-content__inner">
                                <Suspense fallback={<PageLoader />}>
                                    <Routes>
                                        <Route index element={<AdminDashboard selectedDate={selectedDate} />} />
                                        <Route path="flights" element={<AdminFlights />} />
                                        <Route path="predict" element={<AdminPredict />} />
                                        <Route path="analytics" element={<AdminAnalytics />} />
                                        <Route path="ai" element={<AdminAIExplanations />} />
                                        <Route path="settings" element={<AdminSettings />} />
                                        <Route path="messages" element={<AdminMessages />} />
                                        {role === 'super_admin' && (
                                            <>
                                                <Route path="users" element={<SuperAdminUsers />} />
                                                <Route path="global" element={<SuperAdminGlobalOps />} />
                                            </>
                                        )}
                                        <Route path="monthly-summary" element={<MonthlySummaryPage month={selectedDate.getMonth()} year={selectedDate.getFullYear()} />} />
                                        <Route path="yearly-summary" element={<YearlySummaryPage year={selectedDate.getFullYear()} />} />
                                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                                    </Routes>
                                </Suspense>
                            </div>
                        </div>

                </div>

                <CalendarPopup
                    isOpen={isCalendarOpen}
                    onClose={() => setIsCalendarOpen(false)}
                    selectedDate={selectedDate}
                    onDateSelect={(date) => { setSelectedDate(date); setIsCalendarOpen(false); }}
                />
            </div>
        </AdminAirportProvider>
    );
}

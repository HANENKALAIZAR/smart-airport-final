import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AdminAirportProvider, DEFAULT_AIRPORT, TUNISIAN_AIRPORTS } from '../../context/AirportContext';
import usePersistentState from '../../hooks/usePersistentState';
import { logoutAdmin } from '../../hooks/useAdminAuth';
import { useAdminTheme } from '../../hooks/useAdminPrefs';
import { apiGetMe } from '../../services/adminApi';

// ── Always-needed structural components (eager) ───────────────────────────
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminHeader  from '../../components/admin/AdminHeader';
import CalendarPopup from '../../components/admin/CalendarPopup';

// ── Onboarding screens (new premium TSX UI — keep eager) ────────────────────
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
const AdminProfilePage   = lazy(() => import('./AdminProfilePage'));
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
function resolveAirport(iataCode: string | null) {
    if (!iataCode) return DEFAULT_AIRPORT;
    return TUNISIAN_AIRPORTS.find(a => a.iata === iataCode) || DEFAULT_AIRPORT;
}

// ── Helpers to read initial booleans from stored JSON-serialized values ─────
function readBool(val: any, fallback = false): boolean {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'boolean') return val;
    return String(val) === 'true';
}

interface StoredUser {
    id: number;
    email: string;
    full_name: string;
    role: string;
    id_document_status?: string | null;
    status?: string | null;
    airport_iata?: string | null;
    must_change_password?: number | boolean;
    profile_complete?: number | boolean;
    password_change_required?: number | boolean;
    profile_completed?: number | boolean;
    verification_status?: string | null;
    onboarding_status?: string | null;
    is_approved?: boolean;

    // Profile properties
    phone_number?: string | null;
    date_of_birth?: string | null;
    nationality?: string | null;
    gender?: string | null;
    residential_address?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
    emergency_contact_relationship?: string | null;
    cin_number?: string | null;
    cin_document_url?: string | null;
    cin_document_back_url?: string | null;
    passport_number?: string | null;
    passport_document_url?: string | null;
    passport_expiry_date?: string | null;
    profile_photo_url?: string | null;

    // Rejection details
    rejected_fields?: string[] | null;
    id_document_rejection_reason?: string | null;
    rejection_reasons?: string | null;
}

export default function AdminApp() {
    const navigate = useNavigate();

    // ── Persistent state (backed by localStorage atomically) ──────────────
    const [theme]                       = useAdminTheme();
    const [token]                       = usePersistentState<string | null>('admin_token', null);
    const [storedRole]                  = usePersistentState<string>('admin_role', 'admin');
    const [storedUser, setStoredUser]   = usePersistentState<StoredUser | null>('admin_user', null);
    const [mustChangePassword, setMustChangePassword] = usePersistentState<boolean>(
        'admin_must_change',
        false
    );
    const [profileComplete, setProfileComplete] = usePersistentState<boolean>(
        'admin_profile_complete',
        false
    );
    const [airportIata, setAirportIata] = usePersistentState<string | null>('admin_airport_iata', null);
    const [collapsed, setCollapsed]     = usePersistentState<boolean>('admin_sidebar_collapsed', false);

    // Derived non-persistent state
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<string>('dashboard');
    const [meLoaded, setMeLoaded] = useState<boolean>(false);

    // ── Resolve airport object from stored IATA ────────────────────────────
    const selectedAirport = resolveAirport(airportIata);
    const handleAirportChange = (airport: any) => setAirportIata(airport.iata);

    // ── Derive gate flags ──────────────────────────────────────────────────
    const validToken = token && token !== 'demo' ? token : null;
    const role = storedUser?.role || storedRole || 'admin';
    const isSuper = role === 'super_admin';

    // Coerce stored values to booleans safely using exact backend fields
    const mustChange = !isSuper && (
        readBool(mustChangePassword) ||
        storedUser?.must_change_password === 1 ||
        storedUser?.must_change_password === true ||
        (storedUser as any)?.password_change_required === 1 ||
        (storedUser as any)?.password_change_required === true
    );

    const profComplete = isSuper || (
        readBool(profileComplete) ||
        storedUser?.profile_complete === 1 ||
        storedUser?.profile_complete === true ||
        (storedUser as any)?.profile_completed === 1 ||
        (storedUser as any)?.profile_completed === true
    );

    // Deriving approval / rejection flags safely from all potential backend-defined fields
    const currentStatus = (() => {
        if (isSuper) return 'approved';
        const raw = 
            storedUser?.id_document_status || 
            storedUser?.status || 
            (storedUser as any)?.verification_status || 
            (storedUser as any)?.onboarding_status || 
            null;
        return raw ? String(raw).toLowerCase() : null;
    })();

    const isApproved = currentStatus === 'approved' || 
                       storedUser?.status === 'approved' || 
                       (storedUser as any)?.is_approved === true;

    const isRejected = currentStatus === 'rejected' || 
                       storedUser?.status === 'rejected';

    // ── Apply /me response to all persistent state ─────────────────────────
    function _applyMeData(data: any) {
        const minimalUser: StoredUser = {
            id: data.id,
            email: data.email,
            full_name: data.full_name,
            role: data.role,
            id_document_status: data.id_document_status,
            status: data.id_document_status,
            airport_iata: data.airport_iata,
            must_change_password: data.must_change_password,
            profile_complete: data.profile_complete,
            is_approved: data.is_approved,
            onboarding_status: data.onboarding_status,

            phone_number: data.phone_number,
            date_of_birth: data.date_of_birth,
            nationality: data.nationality,
            gender: data.gender,
            residential_address: data.residential_address,
            emergency_contact_name: data.emergency_contact_name,
            emergency_contact_phone: data.emergency_contact_phone,
            emergency_contact_relationship: data.emergency_contact_relationship,
            cin_number: data.cin_number,
            cin_document_url: data.cin_document_url,
            cin_document_back_url: data.cin_document_back_url,
            passport_number: data.passport_number,
            passport_document_url: data.passport_document_url,
            passport_expiry_date: data.passport_expiry_date,
            profile_photo_url: data.profile_photo_url,

            rejected_fields: data.rejected_fields,
            id_document_rejection_reason: data.id_document_rejection_reason,
            rejection_reasons: data.rejection_reasons,
        };
        setStoredUser(minimalUser);

        const isS = data.role === 'super_admin';
        setMustChangePassword(isS ? false : !!data.must_change_password);
        setProfileComplete(isS ? true : !!data.profile_complete);
        if (data.airport_iata) setAirportIata(data.airport_iata);
    }

    // ── Sync onboarding flags from server on mount ─────────────────────────
    useEffect(() => {
        if (!validToken) {
            setMeLoaded(true);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const { data, error } = await apiGetMe();
                if (!cancelled && data) {
                    _applyMeData(data);
                }
            } catch (err) {
                console.error("Failed to sync /me data on mount:", err);
            } finally {
                if (!cancelled) {
                    setMeLoaded(true);
                }
            }
        })();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [validToken]);

    // ── Pre-synchronization loading blocker ──
    if (validToken && !meLoaded) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100vh', width: '100vw', background: '#0f172a', color: 'rgba(255,255,255,0.7)',
                fontSize: '1.1rem', gap: 20, fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
                <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: '3px solid rgba(59,130,246,0.2)',
                    borderTopColor: '#3b82f6',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                `}</style>
                <span>Synchronizing operational session…</span>
            </div>
        );
    }

    // ── Handler: password changed ──────────────────────────────────────────
    function handlePasswordChanged() {
        setMustChangePassword(false);
        setStoredUser(prev => prev ? {
            ...prev,
            must_change_password: 0,
            password_change_required: false
        } : null);
    }

    // ── Handler: profile submitted ─────────────────────────────────────────
    function handleProfileComplete() {
        setProfileComplete(true);
        // Status becomes 'pending' after submission — don't skip approval gate
        setStoredUser(prev => ({ ...(prev || {}), id_document_status: 'pending', status: 'pending' } as StoredUser));
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
    if (validToken && !isSuper) {
        if (mustChange) {
            return <ChangePasswordScreen user={storedUser} onComplete={handlePasswordChanged} />;
        }
        if (!profComplete) {
            return <ProfileCompletionScreen user={storedUser} onComplete={handleProfileComplete} />;
        }
        if (isRejected) {
            return (
                <ProfileCompletionScreen
                    user={storedUser}
                    onComplete={handleProfileComplete}
                    isCorrectionMode={true}
                    onLogout={handleLogout}
                />
            );
        } else if (!isApproved) {
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
            <div className="admin-layout" data-theme={theme}>
                <AdminSidebar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    onLogout={handleLogout}
                    collapsed={collapsed}
                    setCollapsed={setCollapsed}
                />

                <div className="admin-main">
                    <AdminHeader
                        selectedDate={selectedDate}
                        onDateClick={() => setIsCalendarOpen(true)}
                        collapsed={collapsed}
                        setCollapsed={setCollapsed}
                    />

                        <div className="admin-content">
                            <div className="admin-content__inner admin-page">
                                <Suspense fallback={<PageLoader />}>
                                    <Routes>
                                        <Route index element={<AdminDashboard selectedDate={selectedDate} onDateChange={setSelectedDate} />} />
                                        <Route path="predict" element={<AdminPredict />} />
                                        <Route path="analytics" element={<AdminAnalytics />} />
                                        <Route path="messages" element={<AdminMessages />} />
                                        
                                        {role !== 'super_admin' && (
                                            <Route path="profile" element={<AdminProfilePage />} />
                                        )}
                                        
                                        {role === 'super_admin' && (
                                            <>
                                                <Route path="settings" element={<AdminSettings />} />
                                                <Route path="ai" element={<AdminAIExplanations />} />
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

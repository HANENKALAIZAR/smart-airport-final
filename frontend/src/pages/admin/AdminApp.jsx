import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { apiGetMe } from '../../services/adminApi';
import AdminLogin from './AdminLogin';
import ChangePasswordScreen from './ChangePasswordScreen';
import ProfileCompletionScreen from './ProfileCompletionScreen';
import PendingApprovalScreen from './PendingApprovalScreen';
import AdminSidebar from '../../components/admin/AdminSidebar';
import AdminHeader from '../../components/admin/AdminHeader';
import AdminDashboard from './AdminDashboard';
import AdminFlights from './AdminFlights';
import AdminPredict from './AdminPredict';
import AdminAnalytics from './AdminAnalytics';
import AdminAIExplanations from './AdminAIExplanations';
import AdminSettings from './AdminSettings';
import SuperAdminUsers from './SuperAdminUsers';
import SuperAdminGlobalOps from './SuperAdminGlobalOps';
import AdminMessages from './AdminMessages';
import { MonthlySummaryPage } from './AdminMonthlySummary';
import { YearlySummaryPage } from './AdminYearlySummary';
import CalendarPopup from '../../components/admin/CalendarPopup';
import { AdminAirportProvider, DEFAULT_AIRPORT, TUNISIAN_AIRPORTS } from '../../context/AirportContext';
import '../../styles/admin.css';

// ── Restore airport object from IATA code stored in localStorage ──────────
function resolveAirport(iataCode) {
    if (!iataCode) return DEFAULT_AIRPORT;
    return (
        TUNISIAN_AIRPORTS.find(a => a.iata === iataCode) || DEFAULT_AIRPORT
    );
}

export default function AdminApp() {
    const navigate = useNavigate();
    // Only trust the token if it exists AND is not the old 'demo' placeholder
    const storedToken = localStorage.getItem('admin_token');
    const validToken = storedToken && storedToken !== 'demo' ? storedToken : null;
    const storedRole = localStorage.getItem('admin_role');

    const [mustChangePassword, setMustChangePassword] = useState(() => {
        if (storedRole === 'super_admin') return false;
        return localStorage.getItem('admin_must_change') === 'true';
    });
    const [profileComplete, setProfileComplete] = useState(() => {
        if (storedRole === 'super_admin') return true;
        return localStorage.getItem('admin_profile_complete') === 'true';
    });
    const [idDocStatus, setIdDocStatus] = useState(() => {
        if (storedRole === 'super_admin') return 'approved';
        try {
            const u = JSON.parse(localStorage.getItem('admin_user') || 'null');
            return u?.status || u?.id_document_status || null;
        } catch { return null; }
    });
    const [currentUser, setCurrentUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('admin_user') || 'null'); } catch { return null; }
    });
    const [activeTab, setActiveTab] = useState('dashboard');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const [selectedAirport, setSelectedAirport] = useState(() => {
        const iata = localStorage.getItem('admin_airport_iata');
        return resolveAirport(iata);
    });

    const role = currentUser?.role || localStorage.getItem('admin_role') || 'admin';

    const _applyMeData = (data) => {
        const minimalUser = {
            id: data.id,
            email: data.email,
            role: data.role,
            status: data.id_document_status,
            token: localStorage.getItem('admin_token')
        };
        localStorage.removeItem('admin_user');
        try {
            localStorage.setItem('admin_user', JSON.stringify(minimalUser));
        } catch (e) {
            console.error("Failed to store user in localStorage:", e);
        }
        localStorage.setItem('admin_role', data.role);
        if (data.airport_iata) localStorage.setItem('admin_airport_iata', data.airport_iata);
        setCurrentUser(data);
        const isSuper = data.role === 'super_admin';
        const mc = isSuper ? false : !!data.must_change_password;
        const pc = isSuper ? true : !!data.profile_complete;
        const docStatus = isSuper ? 'approved' : (data.id_document_status || null);
        localStorage.setItem('admin_must_change', String(mc));
        localStorage.setItem('admin_profile_complete', String(pc));
        setMustChangePassword(mc);
        setProfileComplete(pc);
        setIdDocStatus(docStatus);
    };

    // Sync onboarding flags from server (middleware equivalent for SPA)
    useEffect(() => {
        if (!validToken) return;
        let cancelled = false;
        (async () => {
            const { data, error } = await apiGetMe();
            if (cancelled || error || !data) return;
            _applyMeData(data);
        })();
        return () => { cancelled = true; };
    }, [validToken]);



    // ── All handler functions ──────────────────────────────────────────────
    function handlePasswordChanged() {
        setMustChangePassword(false);
        localStorage.setItem('admin_must_change', 'false');
    }

    function handleProfileComplete() {
        // After profile submission the status is 'pending' — super admin must approve.
        // We update profileComplete but do NOT skip the approval gate.
        setProfileComplete(true);
        localStorage.setItem('admin_profile_complete', 'true');
        setIdDocStatus('pending');
    }

    async function handleIdRejectionFixed() {
        const { data } = await apiGetMe();
        if (data) _applyMeData(data);
    }

    async function handleApprovalRefresh() {
        const { data } = await apiGetMe();
        if (data) _applyMeData(data);
    }

    function handleLogout() {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_role');
        localStorage.removeItem('admin_user');
        localStorage.removeItem('admin_airport_iata');
        localStorage.removeItem('admin_must_change');
        localStorage.removeItem('admin_profile_complete');
        navigate('/login', { replace: true });
    }

    function handleAirportChange(airport) {
        setSelectedAirport(airport);
        localStorage.setItem('admin_airport_iata', airport.iata);
    }

    // ── Onboarding gate: airport admins only (super admin skips) ─────────
    if (validToken && role === 'admin') {
        if (mustChangePassword) {
            return <ChangePasswordScreen user={currentUser} onComplete={handlePasswordChanged} />;
        }
        if (!profileComplete) {
            return <ProfileCompletionScreen user={currentUser} onComplete={handleProfileComplete} />;
        }
        if (idDocStatus === 'rejected') {
            // Render a locked-down layout specifically for correction mode
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
                                    <Routes>
                                        <Route path="settings" element={<AdminSettings />} />
                                        <Route path="*" element={<Navigate to="/dashboard/settings" replace />} />
                                    </Routes>
                                </div>
                            </div>
                        </div>
                    </div>
                </AdminAirportProvider>
            );
        } else if (idDocStatus !== 'approved') {
            // Covers 'pending' and null (profile just submitted but not yet approved)
            return (
                <PendingApprovalScreen
                    user={currentUser}
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
                            <Routes>
                                <Route index element={<AdminDashboard selectedDate={selectedDate} />} />
                                <Route path="flights" element={<AdminFlights />} />
                                <Route path="predict" element={<AdminPredict />} />
                                <Route path="analytics" element={<AdminAnalytics />} />
                                <Route path="ai" element={<AdminAIExplanations />} />
                                <Route path="settings" element={<AdminSettings />} />
                                <Route path="messages" element={<AdminMessages />} />
                                {/* Super-admin only routes */}
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

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminApp from './pages/admin/AdminApp';
import AdminLogin from './auth/AdminLogin';
import AdminForgotPasswordPage from './pages/admin/AdminForgotPasswordPage';
import AdminResetPassword from './pages/admin/AdminResetPassword';
import Contact from './pages/passenger/Contact';
import { LanguageProvider } from './context/LanguageContext';
import ErrorBoundary from './components/system/ErrorBoundary';
import './index.css';

/* ─── Protected Route Component ─────────────────────────── */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token');
  if (!token || token === 'demo') {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

/* ─── Root Admin App ─────────────────────────────────────── */
export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            {/* Root Redirect */}
            <Route path="/" element={<Navigate to="/admin/login" replace />} />

            {/* Public Passenger Route */}
            <Route path="/contact" element={<Contact />} />

            {/* Admin Auth Group — no wrapper div needed, pages are full-screen */}
            <Route path="/admin/login"            element={<AdminLogin />} />
            <Route path="/admin/forgot-password"  element={<AdminForgotPasswordPage />} />
            <Route path="/admin/reset-password"   element={<AdminResetPassword />} />

            {/* Admin Dashboard - Protected */}
            <Route
              path="/dashboard/*"
              element={
                <ProtectedRoute>
                  <AdminApp />
                </ProtectedRoute>
              }
            />

            {/* Catch-all Redirect to Login */}
            <Route path="*" element={<Navigate to="/admin/login" replace />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

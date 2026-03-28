import { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Shield, Search, Compass, Info, MapPin, Bell, HelpCircle, Phone, Cloud, ChevronDown, Menu, X as XIcon } from 'lucide-react';
import HomePage from './pages/HomePage';
import FlightsPage from './pages/FlightsPage';
import FlightDetailPage from './pages/FlightDetailPage';
import RightsPage from './pages/RightsPage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import AlertsPage from './pages/AlertsPage';
import FAQPage from './pages/FAQPage';
import ContactPage from './pages/ContactPage';
import LiveConditionsPage from './pages/LiveConditionsPage';
import AdminApp from './pages/admin/AdminApp';
import AdminLogin from './pages/admin/AdminLogin';
import AdminForgotPasswordPage from './pages/admin/AdminForgotPasswordPage';
import AdminResetPassword from './pages/admin/AdminResetPassword';
import AIAssistantPage from './pages/AIAssistantPage';
import { Navigate } from 'react-router-dom';
import { PassengerAirportProvider, useAirport, TUNISIAN_AIRPORTS } from './context/AirportContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import LanguageSwitcher from './components/LanguageSwitcher';
import PassengerFooter from './components/PassengerFooter';
import LiveChatWidget from './components/LiveChatWidget';
import './index.css';

/* ─── Explore Hub Page ──────────────────────────── */
function ExplorePage() {
  const { t } = useLanguage();

  const EXPLORE_ITEMS = [
    { to: '/about', icon: <Info size={24} />, label: t('about'), desc: t('aboutDesc'), color: '#3B82F6', bg: '#EFF6FF' },
    { to: '/services', icon: <MapPin size={24} />, label: t('services'), desc: t('servicesDesc'), color: '#10B981', bg: '#F0FDF4' },
    { to: '/alerts', icon: <Bell size={24} />, label: t('alerts'), desc: t('alertsDesc'), color: '#8B5CF6', bg: '#F5F3FF' },
    { to: '/conditions', icon: <Cloud size={24} />, label: t('liveConditions'), desc: t('conditionsDesc'), color: '#06B6D4', bg: '#ECFEFF' },
    { to: '/faq', icon: <HelpCircle size={24} />, label: t('faq'), desc: t('faqDesc'), color: '#F59E0B', bg: '#FFFBEB' },
    { to: '/contact', icon: <Phone size={24} />, label: t('contact'), desc: t('contactDesc'), color: '#EF4444', bg: '#FEF2F2' },
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 6 }}>{t('exploreTitle')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('exploreDesc')}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {EXPLORE_ITEMS.map(item => (
          <NavLink key={item.to} to={item.to} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card" style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 14, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1E293B', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.4 }}>{item.desc}</div>
              </div>
            </div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

/* ─── Airport Selector Dropdown in passenger header ─── */
function AirportSelector() {
  const { selectedAirport, setSelectedAirport } = useAirport();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="passenger-airport-selector" ref={ref}>
      <button className="passenger-airport-selector__btn" onClick={() => setOpen(!open)}>
        <span className="passenger-airport-selector__iata">{selectedAirport.iata}</span>
        <span className="passenger-airport-selector__name">{selectedAirport.city}</span>
        <ChevronDown size={14} className={`passenger-airport-selector__chevron${open ? ' open' : ''}`} />
      </button>
      {open && (
        <div className="passenger-airport-selector__dropdown">
          <div className="passenger-airport-selector__title">{t('selectAirport')}</div>
          {TUNISIAN_AIRPORTS.map(a => (
            <button
              key={a.id}
              className={`passenger-airport-selector__option${a.id === selectedAirport.id ? ' active' : ''}`}
              onClick={() => { setSelectedAirport(a); setOpen(false); }}
            >
              <span className="passenger-airport-selector__option-iata">{a.iata}</span>
              <div>
                <div className="passenger-airport-selector__option-name">{a.name}</div>
                <div className="passenger-airport-selector__option-city">{a.city}, {a.region}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Passenger App (public, no login) ──────────── */
function PassengerLayout() {
  const { t } = useLanguage();
  const { selectedAirport } = useAirport();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close menu on route change
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  return (
    <div className="app-layout">
      {/* ── Top header with navigation ──── */}
      <header className="top-header">
        <div className="top-header__inner">
          <div className="top-header__brand">
            <span className="top-header__logo">✈️</span>
            <div>
              <NavLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="top-header__title" style={{ cursor: 'pointer' }}>{selectedAirport?.name || t('smartAirport')}</div>
              </NavLink>
              <AirportSelector />
            </div>
          </div>
          <nav className="header-nav">
            <NavLink to="/flights" className={({ isActive }) => `header-nav__link${isActive ? ' active' : ''}`}>
              <Search size={16} />
              <span>{t('flights')}</span>
            </NavLink>
            <NavLink to="/rights" className={({ isActive }) => `header-nav__link${isActive ? ' active' : ''}`}>
              <Shield size={16} />
              <span>{t('rights')}</span>
            </NavLink>
            <NavLink to="/explore" className={({ isActive }) => `header-nav__link${isActive ? ' active' : ''}`}>
              <Compass size={16} />
              <span>{t('explore')}</span>
            </NavLink>
            {/* Language Switcher in passenger header */}
            <LanguageSwitcher variant="light" />
          </nav>
          {/* Hamburger — mobile only */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <XIcon size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* ── Mobile Nav Drawer ─────────────────── */}
      {mobileMenuOpen && (
        <div className="mobile-nav">
          <NavLink to="/flights" className="mobile-nav__link">
            <Search size={18} /> {t('flights')}
          </NavLink>
          <NavLink to="/rights" className="mobile-nav__link">
            <Shield size={18} /> {t('rights')}
          </NavLink>
          <NavLink to="/explore" className="mobile-nav__link">
            <Compass size={18} /> {t('explore')}
          </NavLink>
          <div className="mobile-nav__lang">
            <LanguageSwitcher variant="light" />
          </div>
        </div>
      )}

      {/* ── Main content ────────────────── */}
      <main className="app-content" style={{ paddingBottom: 'var(--space-xl)' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/flights" element={<FlightsPage />} />
          <Route path="/flights/:id" element={<FlightDetailPage />} />
          <Route path="/rights" element={<RightsPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/conditions" element={<LiveConditionsPage />} />
        </Routes>
      </main>

      {/* ── Footer ───────────────────────────── */}
      <PassengerFooter />

      {/* ── Live Chat ────────────────────────── */}
      <LiveChatWidget />
    </div>
  );
}

/* ─── Protected Route Component ───────────────────── */
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('admin_token');
  const location = useLocation();

  if (!token || token === 'demo') {
    // Redirect to login but save the current location for redirection after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

/* ─── Root App ──────────────────────────────────── */
export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          {/* Admin Login */}
          <Route path="/login" element={
            <div className="admin-login-page">
              <AdminLogin />
            </div>
          } />

          <Route path="/forgot-password" element={
            <div className="admin-login-page">
              <AdminForgotPasswordPage />
            </div>
          } />

          <Route path="/reset-password" element={
            <div className="admin-login-page">
              <AdminResetPassword />
            </div>
          } />

          {/* AI Assistant - Full Page */}
          <Route path="/ai-assistant" element={<AIAssistantPage />} />

          {/* Admin Dashboard - Protected */}
          <Route path="/dashboard/*" element={
            <ProtectedRoute>
              <AdminApp />
            </ProtectedRoute>
          } />

          {/* Passenger App (Public) */}
          <Route path="/*" element={
            <PassengerAirportProvider>
              <PassengerLayout />
            </PassengerAirportProvider>
          } />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

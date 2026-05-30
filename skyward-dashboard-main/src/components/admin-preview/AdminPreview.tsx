import { useEffect, useState } from "react";
import {
  LayoutDashboard, TrendingUp, Target, BrainCircuit, MessageSquare, Settings,
  Globe, Users, LogOut, Calendar as CalendarIcon,
  Building2, ChevronDown, Bell, ChevronLeft, ChevronRight, Sun, Moon, UserCircle,
} from "lucide-react";
import "@/styles/admin.css";
import logo from "@/assets/airplane-logo.png";
import DashboardPage from "./pages/DashboardPage";
import MessagesPage from "./pages/MessagesPage";
import SuperAdminUsers from "@/pages/admin/SuperAdminUsers";
import { PredictPage, AIExplanationsPage, SettingsPage, GlobalOpsPage } from "./pages/OtherPages";
import ReportsPage from "./pages/ReportsPage";
import AdminProfilePage from "./pages/AdminProfilePage";

const NAV = [
  { to: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "analytics", icon: TrendingUp, label: "Analytics" },
  { to: "predict", icon: Target, label: "Predict Delay" },
  { to: "ai", icon: BrainCircuit, label: "AI Explanations" },
  { to: "messages", icon: MessageSquare, label: "Messages", badge: 4 },
  { to: "profile", icon: UserCircle, label: "Profile" },
  { to: "settings", icon: Settings, label: "Settings" },
  { to: "global", icon: Globe, label: "Global Ops" },
  { to: "users", icon: Users, label: "Admin Users" },
];

export default function AdminPreview() {
  const [active, setActive] = useState("dashboard");
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  // Role is now fixed (no role-selection screen / toggle button).
  const role: "superadmin" | "admin" = "superadmin";

  // Compute date label after mount to avoid SSR/CSR mismatch with timezone-dependent locale formatting.
  const [dateLabel, setDateLabel] = useState("");
  useEffect(() => {
    setDateLabel(new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  }, []);
  const dir = "ltr";

  let page: React.ReactNode = null;
  switch (active) {
    case "dashboard": page = <DashboardPage dateLabel={dateLabel} role={role} onOpenAnalytics={() => setActive("analytics")} />; break;
    case "messages": page = <MessagesPage />; break;
    case "users": page = <SuperAdminUsers />; break;
    case "analytics": page = <ReportsPage />; break;
    case "predict": page = <PredictPage />; break;
    case "ai": page = <AIExplanationsPage />; break;
    case "profile": page = <AdminProfilePage />; break;
    case "settings": page = <SettingsPage />; break;
    case "global": page = <GlobalOpsPage />; break;
    default: page = <DashboardPage dateLabel={dateLabel} role={role} onOpenAnalytics={() => setActive("analytics")} />;
  }

  return (
    <div className="admin-layout" dir={dir} data-theme={theme}>
      {/* Sidebar */}
      <aside className={`admin-sidebar${collapsed ? " admin-sidebar--collapsed" : ""}`} style={{ width: collapsed ? 72 : 240 }}>
        <div className="admin-sidebar__brand" style={{ padding: collapsed ? "1rem 0.5rem" : "1.5rem", justifyContent: collapsed ? "center" : "flex-start" }}>
          <img src={logo} alt="Smart Airport" style={{ width: 36, height: 36, objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(245,158,11,0.35))", flexShrink: 0 }} />
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div className="admin-sidebar__brand-title">Smart Airport</div>
              <div className="admin-sidebar__brand-sub">Tunis–Carthage Intl.</div>
            </div>
          )}
        </div>

        <nav className="admin-sidebar__nav">
          {NAV.map(({ to, icon: Icon, label, badge }) => {
            const isActive = active === to;
            return (
              <button
                key={to}
                onClick={() => setActive(to)}
                title={collapsed ? label : undefined}
                className={`admin-sidebar__item${isActive ? " active" : ""}`}
                style={{ justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "0.75rem" : "0.75rem 1rem", position: "relative" }}
              >
                <Icon size={20} style={{ flexShrink: 0 }} />
                {!collapsed && (
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                    {badge && (
                      <span style={{ flexShrink: 0, minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10, background: "#DC2626", color: "#fff", fontSize: "0.68rem", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>
                    )}
                  </span>
                )}
                {collapsed && badge && (
                  <span style={{ position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "#DC2626", color: "#fff", fontSize: "0.6rem", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar__footer">
          <button className="admin-sidebar__logout" style={{ justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "0.65rem" : "0.75rem 1rem" }}>
            <LogOut size={20} /> {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="admin-main">
        <div className="admin-header">
          <div className="admin-header__left">
            {/* Sidebar collapse moved here, outside the sidebar */}
            <button
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: 10,
                border: "1px solid var(--adm-border)",
                background: "rgba(255,255,255,0.03)",
                color: "var(--adm-text-sub)",
                cursor: "pointer",
                transition: "all 200ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.10)"; e.currentTarget.style.color = "var(--adm-accent)"; e.currentTarget.style.borderColor = "rgba(245,158,11,0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "var(--adm-text-sub)"; e.currentTarget.style.borderColor = "var(--adm-border)"; }}
            >
              <ChevronLeft
                size={18}
                style={{
                  transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>

            <button className="admin-header__date">
              <CalendarIcon size={20} className="admin-header__date-icon" />
              <span>{dateLabel}</span>
            </button>
            <div className="admin-header__divider" />
            <div className="admin-header__airport-selector">
              <button className="admin-header__airport-btn">
                <Building2 size={18} className="admin-header__airport-icon" />
                <span>Tunis–Carthage (TUN)</span>
                <ChevronDown size={16} className="admin-header__chevron" />
              </button>
            </div>
          </div>
          <div className="admin-header__right">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
              aria-label="Toggle theme"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 32, borderRadius: 999,
                border: "1px solid var(--adm-border)",
                background: "var(--adm-input-bg)",
                color: "var(--adm-text-sub)",
                cursor: "pointer",
                transition: "all 220ms ease",
              }}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {/* Language toggle */}
            <button
              onClick={() => setLang(l => (l === "en" ? "fr" : "en"))}
              aria-label="Toggle language"
              style={{
                position: "relative", width: 44, height: 32, borderRadius: 999,
                border: "1px solid var(--adm-border)", background: "rgba(255,255,255,0.03)",
                color: "var(--adm-text)", fontSize: "0.75rem", fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.04em",
                transition: "all 220ms ease",
              }}
            >
              <span>{lang.toUpperCase()}</span>
            </button>

            <div className="admin-notif">
              <button className="admin-notif__btn"><Bell size={20} /><span className="admin-notif__badge">3</span></button>
            </div>
            <div className="admin-header__user" style={{ gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #F59E0B, #FBBF24)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#0A1628" }}>SA</div>
              <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Sarah Admin</span>
            </div>
          </div>
        </div>

        <div className="admin-content">
          <div className="admin-content__inner admin-page">
            {page}
          </div>
        </div>
      </div>
    </div>
  );
}

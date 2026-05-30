import { useState } from "react";
import { Users, Search, Plus, Filter, MoreHorizontal, Shield, ShieldCheck, UserCheck, UserX, Mail, MapPin } from "lucide-react";

const USERS = [
  { id: 1, name: "Sarah Admin", email: "sarah.admin@tun-airport.tn", role: "Super Admin", airport: "All Airports", status: "active", last: "Active now", avatar: "SA", color: "#F59E0B" },
  { id: 2, name: "Karim Trabelsi", email: "k.trabelsi@tun-airport.tn", role: "Airport Admin", airport: "Tunis–Carthage (TUN)", status: "active", last: "12 min ago", avatar: "KT", color: "#34D399" },
  { id: 3, name: "Lina Ben Salah", email: "l.bensalah@mir-airport.tn", role: "Airport Admin", airport: "Monastir (MIR)", status: "active", last: "1 h ago", avatar: "LB", color: "#60A5FA" },
  { id: 4, name: "Mehdi Khelifi", email: "m.khelifi@tun-airport.tn", role: "Operator", airport: "Tunis–Carthage (TUN)", status: "active", last: "Yesterday", avatar: "MK", color: "#A78BFA" },
  { id: 5, name: "Sofia Riahi", email: "s.riahi@djerba-airport.tn", role: "Operator", airport: "Djerba (DJE)", status: "pending", last: "Awaiting approval", avatar: "SR", color: "#FBBF24" },
  { id: 6, name: "Yassine Mahmoudi", email: "y.mahmoudi@sfax-airport.tn", role: "Operator", airport: "Sfax (SFA)", status: "suspended", last: "5 days ago", avatar: "YM", color: "#F87171" },
  { id: 7, name: "Nour El Houda", email: "n.elhouda@tun-airport.tn", role: "Viewer", airport: "Tunis–Carthage (TUN)", status: "active", last: "3 h ago", avatar: "NH", color: "#34D399" },
];

const ROLE_STYLES: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  "Super Admin": { bg: "rgba(245,158,11,0.15)", color: "#FBBF24", icon: <ShieldCheck size={12} /> },
  "Airport Admin": { bg: "rgba(96,165,250,0.15)", color: "#60A5FA", icon: <Shield size={12} /> },
  "Operator": { bg: "rgba(167,139,250,0.15)", color: "#A78BFA", icon: <UserCheck size={12} /> },
  "Viewer": { bg: "rgba(255,255,255,0.06)", color: "#94A3B8", icon: <UserCheck size={12} /> },
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: "rgba(52,211,153,0.12)", color: "#34D399", label: "Active" },
  pending: { bg: "rgba(251,191,36,0.12)", color: "#FBBF24", label: "Pending" },
  suspended: { bg: "rgba(248,113,113,0.12)", color: "#F87171", label: "Suspended" },
};

export default function AdminUsersPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = USERS.filter(u => {
    if (filter !== "all" && u.status !== filter) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = [
    { label: "Total Users", value: USERS.length, color: "var(--adm-accent)" },
    { label: "Active", value: USERS.filter(u => u.status === "active").length, color: "#34D399" },
    { label: "Pending", value: USERS.filter(u => u.status === "pending").length, color: "#FBBF24" },
    { label: "Suspended", value: USERS.filter(u => u.status === "suspended").length, color: "#F87171" },
  ];

  return (
    <>
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={22} style={{ color: "var(--adm-accent)" }} /> Admin Users
          </h1>
          <p className="admin-page__subtitle">Manage roles, airport access, and account status across the network.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="admin-btn admin-btn--outline"><Filter size={15} /><span>Bulk actions</span></button>
          <button className="admin-btn admin-btn--primary"><Plus size={15} /><span>Invite user</span></button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
        {stats.map(s => (
          <div key={s.label} className="admin-stat-card">
            <div className="admin-stat-card__label">{s.label}</div>
            <div className="admin-stat-card__value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="admin-filter-bar" style={{ marginBottom: "1rem" }}>
        <div style={{ position: "relative", flex: "0 0 320px" }}>
          <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--adm-text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
            style={{ width: "100%", padding: "0.5rem 0.85rem 0.5rem 2.4rem", borderRadius: 8, border: "1px solid var(--adm-border)", background: "rgba(255,255,255,0.05)", color: "var(--adm-text)", fontSize: "0.85rem", outline: "none" }} />
        </div>
        <div className="admin-filter-toolbar__group">
          {["all", "active", "pending", "suspended"].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`admin-filter-pill admin-filter-pill--compact${filter === s ? " active" : ""}`}>
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="admin-table-wrap">
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Airport scope</th>
                <th>Status</th>
                <th>Last active</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const role = ROLE_STYLES[u.role];
                const status = STATUS_STYLES[u.status];
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${u.color}, ${u.color}aa)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.74rem", fontWeight: 700, color: "#0A1628", flexShrink: 0 }}>{u.avatar}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: "var(--adm-text)" }}>{u.name}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem", color: "var(--adm-text-muted)" }}>
                            <Mail size={11} /> {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, background: role.bg, color: role.color, fontSize: "0.74rem", fontWeight: 600 }}>
                        {role.icon} {u.role}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--adm-text-sub)", fontSize: "0.82rem" }}>
                        <MapPin size={12} style={{ color: "var(--adm-text-muted)" }} /> {u.airport}
                      </div>
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 6, background: status.bg, color: status.color, fontSize: "0.74rem", fontWeight: 600 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.color }} /> {status.label}
                      </span>
                    </td>
                    <td className="admin-table__muted">{u.last}</td>
                    <td>
                      <button style={{ background: "transparent", border: "none", color: "var(--adm-text-muted)", cursor: "pointer", padding: 6, borderRadius: 6 }}><MoreHorizontal size={16} /></button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "2.5rem", color: "var(--adm-text-muted)" }}>
                  <UserX size={32} style={{ margin: "0 auto 8px", opacity: 0.4 }} /><br />
                  No users match your filters.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
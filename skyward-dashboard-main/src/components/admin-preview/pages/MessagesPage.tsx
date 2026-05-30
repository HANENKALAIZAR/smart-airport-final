import { useMemo, useState } from "react";
import {
  Inbox, Send as SendIcon, CheckCircle2, Archive, Search, Reply, Trash2,
  AlertCircle, ShieldCheck,
} from "lucide-react";

/* ─────────────── Types & data ─────────────── */

type Priority = "high" | "medium" | "low";
type Folder = "inbox" | "sent" | "resolved" | "archived";

interface Message {
  id: string;
  senderName: string;
  senderRole: string;
  initials: string;
  subject: string;
  preview: string;
  body: string;
  timestamp: string; // human label
  priority: Priority;
  folder: Folder;
  unread: boolean;
  linkedFlight?: { num: string; route: string; time: string; note: string };
}

const PASSENGER_MESSAGES: Message[] = [
  {
    id: "PM-1", senderName: "Karim Trabelsi", senderRole: "Airline Ops · Tunisair", initials: "KT",
    subject: "Gate reassignment for TU721", preview: "Hi team — we just had a last-minute swap from gate B12 to B07. Could you confirm…",
    body: "Hi team,\n\nHi team — we just had a last-minute swap from gate B12 to B07. Could you confirm…\n\nJust looping you in early so the apron team and the gate scheduler can re-sync. Catering and fueling have already been notified and are tracking the change. PAX boarding signage in the terminal will need updating too — can someone confirm that's been pushed?\n\nThanks for the quick turnaround on this.\n\n— Karim Trabelsi\nAirline Ops · Tunisair",
    timestamp: "2 min ago", priority: "high", folder: "inbox", unread: true,
    linkedFlight: { num: "TU721", route: "TUN→CDG", time: "14:25", note: "Currently delayed (45 min, high risk)" },
  },
  {
    id: "PM-2", senderName: "Lina Ben Salah", senderRole: "Ground Ops · TUN", initials: "LB",
    subject: "Crew bus delay impacting boarding", preview: "Crew bus running ~8 min late due to an incident on the perimeter road…",
    body: "Hi,\n\nCrew bus running ~8 min late due to an incident on the perimeter road. Please advise the boarding team to hold momentarily.\n\n— Lina",
    timestamp: "14 min ago", priority: "medium", folder: "inbox", unread: true,
  },
  {
    id: "PM-3", senderName: "Yassine Mahmoudi", senderRole: "Catering · TUN", initials: "YM",
    subject: "Re: AF1234 catering quantity update", preview: "Confirmed updated count: 142 PAX, 12 special meals…",
    body: "Confirmed updated count: 142 PAX, 12 special meals. Loaders dispatched.\n\n— Yassine",
    timestamp: "1 h ago", priority: "low", folder: "inbox", unread: false,
  },
  {
    id: "PM-4", senderName: "Operations Bot", senderRole: "Automation", initials: "OB",
    subject: "Daily ops digest — May 1, 2026", preview: "248 flights scheduled, 84.2% on-time rate, 12 min average delay…",
    body: "Daily summary:\n\n• 248 flights scheduled\n• On-time rate: 84.2%\n• Avg delay: 12 min\n• 3 high-risk flights flagged by AI\n\n— Ops Bot",
    timestamp: "3 h ago", priority: "low", folder: "inbox", unread: false,
  },
  {
    id: "PM-5", senderName: "Sofia Riahi", senderRole: "Crew Planning", initials: "SR",
    subject: "LH490 inbound crew rest requirements", preview: "Crew arriving from FRA will need a minimum 11-hour rest…",
    body: "Crew arriving from FRA will need a minimum 11-hour rest before next rotation. Please confirm hotel block.\n\n— Sofia",
    timestamp: "Yesterday", priority: "medium", folder: "inbox", unread: false,
  },
  {
    id: "PM-6", senderName: "Mehdi Khelifi", senderRole: "Security · TUN", initials: "MK",
    subject: "Re: Perimeter check completed", preview: "All clear on the south perimeter. Sector 4 fence was inspected…",
    body: "All clear on the south perimeter. Sector 4 fence was inspected and reinforced. No further actions needed.\n\n— Mehdi",
    timestamp: "Yesterday", priority: "low", folder: "resolved", unread: false,
  },
];

const SUPERADMIN_MESSAGES: Message[] = [
  {
    id: "SA-1", senderName: "Karim Bouazizi", senderRole: "Super Admin · HQ", initials: "KB",
    subject: "Approval required — Q2 shift rotation", preview: "Please review and acknowledge the proposed Q2 shift rotation…",
    body: "Hi,\n\nPlease review and acknowledge the proposed Q2 shift rotation for the terminal team. Confirmation needed before May 1.\n\nRegards,\nKarim — Super Admin",
    timestamp: "5 min ago", priority: "high", folder: "inbox", unread: true,
  },
  {
    id: "SA-2", senderName: "Amel Saidi", senderRole: "Super Admin · Compliance", initials: "AS",
    subject: "Re: April KPI report submission", preview: "Received your KPIs — flagging two airports for follow-up review…",
    body: "Received your KPIs — flagging TUN and MIR for follow-up review on AI alert handling.\n\n— Amel",
    timestamp: "32 min ago", priority: "medium", folder: "inbox", unread: true,
  },
  {
    id: "SA-3", senderName: "Walid Gharbi", senderRole: "Super Admin · Ops Director", initials: "WG",
    subject: "New audit checklist published", preview: "v2.4 of the operational audit checklist is now active…",
    body: "v2.4 of the operational audit checklist is now active. Please distribute to all admins.\n\n— Walid",
    timestamp: "2 h ago", priority: "low", folder: "inbox", unread: false,
  },
  {
    id: "SA-4", senderName: "Karim Bouazizi", senderRole: "Super Admin · HQ", initials: "KB",
    subject: "Resolved: Access escalation request", preview: "Access for the new dispatcher has been provisioned…",
    body: "Access for the new dispatcher has been provisioned and confirmed.\n\n— Karim",
    timestamp: "Yesterday", priority: "medium", folder: "resolved", unread: false,
  },
];

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "#F87171",
  medium: "#FBBF24",
  low: "#34D399",
};

const FOLDERS: { key: Folder; label: string; icon: typeof Inbox }[] = [
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "sent", label: "Sent", icon: SendIcon },
  { key: "resolved", label: "Resolved", icon: CheckCircle2 },
  { key: "archived", label: "Archived", icon: Archive },
];

/* ─────────────── Component ─────────────── */

export default function MessagesPage() {
  const [tab, setTab] = useState<"passenger" | "superadmin">("passenger");
  const [folder, setFolder] = useState<Folder>("inbox");
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState({
    passenger: PASSENGER_MESSAGES,
    superadmin: SUPERADMIN_MESSAGES,
  });
  const [selectedId, setSelectedId] = useState<string | null>("PM-1");
  const [reply, setReply] = useState("");

  const list = tab === "passenger" ? messages.passenger : messages.superadmin;

  const counts = useMemo(() => {
    const c: Record<Folder, number> = { inbox: 0, sent: 0, resolved: 0, archived: 0 };
    list.forEach(m => { c[m.folder]++; });
    return c;
  }, [list]);

  const filtered = useMemo(() => {
    return list.filter(m => {
      if (m.folder !== folder) return false;
      if (priorityFilter && m.priority !== priorityFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${m.senderName} ${m.subject} ${m.preview}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [list, folder, priorityFilter, search]);

  const selected = filtered.find(m => m.id === selectedId) ?? filtered[0] ?? null;

  const resolveSelected = () => {
    if (!selected) return;
    setMessages(prev => ({
      ...prev,
      [tab]: prev[tab].map(m => m.id === selected.id ? { ...m, folder: "resolved", unread: false } : m),
    }));
  };
  const deleteSelected = () => {
    if (!selected) return;
    setMessages(prev => ({
      ...prev,
      [tab]: prev[tab].filter(m => m.id !== selected.id),
    }));
    setSelectedId(null);
  };
  const markRead = (id: string) => {
    setMessages(prev => ({
      ...prev,
      [tab]: prev[tab].map(m => m.id === id ? { ...m, unread: false } : m),
    }));
  };
  const sendReply = () => {
    if (!reply.trim()) return;
    setReply("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header + role tabs (only the two existing tabs kept) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 className="admin-page__title">Message Center</h1>
          <p className="admin-page__subtitle">Coordinate with passengers and platform leadership in one inbox.</p>
        </div>
        <div style={{
          display: "inline-flex", padding: 4, gap: 4,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--adm-border)",
          borderRadius: 12,
        }}>
          {([
            { k: "passenger", l: "Passenger Messages", icon: Inbox },
            { k: "superadmin", l: "Super Admin Messages", icon: ShieldCheck },
          ] as const).map(t => {
            const active = tab === t.k;
            const Icon = t.icon;
            return (
              <button
                key={t.k}
                onClick={() => { setTab(t.k); setFolder("inbox"); setPriorityFilter(null); setSelectedId(null); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "0.55rem 0.95rem", borderRadius: 9, border: "none", cursor: "pointer",
                  fontSize: "0.82rem", fontWeight: 600,
                  background: active ? "linear-gradient(135deg, #F59E0B, #FBBF24)" : "transparent",
                  color: active ? "#0A1628" : "var(--adm-text-sub)",
                  transition: "all 200ms ease",
                  boxShadow: active ? "0 4px 14px rgba(245,158,11,0.25)" : "none",
                }}
              >
                <Icon size={15} />
                {t.l}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3-pane layout */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 360px minmax(0,1fr)", gap: "1rem", alignItems: "stretch", minHeight: 640 }}>
        {/* ─── Sidebar: Folders + Priority ─── */}
        <div style={{
          background: "var(--adm-card)",
          border: "1px solid var(--adm-border)",
          borderRadius: 16,
          padding: "0.75rem",
          display: "flex", flexDirection: "column", gap: "1.25rem",
          height: "fit-content",
        }}>
          <div>
            <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--adm-text-muted)", padding: "0.4rem 0.6rem 0.6rem" }}>FOLDERS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {FOLDERS.map(f => {
                const Icon = f.icon;
                const active = folder === f.key;
                return (
                  <button key={f.key} onClick={() => { setFolder(f.key); setSelectedId(null); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 10, padding: "0.55rem 0.7rem", border: "none",
                      borderRadius: 10, cursor: "pointer",
                      background: active ? "rgba(245,158,11,0.12)" : "transparent",
                      color: active ? "var(--adm-accent)" : "var(--adm-text-sub)",
                      fontSize: "0.85rem", fontWeight: active ? 700 : 500,
                      transition: "background 150ms ease, color 150ms ease",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                      <Icon size={16} />
                      {f.label}
                    </span>
                    <span style={{
                      minWidth: 22, padding: "0 6px", height: 20, borderRadius: 10,
                      background: active ? "rgba(245,158,11,0.22)" : "rgba(255,255,255,0.06)",
                      color: active ? "var(--adm-accent)" : "var(--adm-text-muted)",
                      fontSize: "0.68rem", fontWeight: 700,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>{counts[f.key]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--adm-text-muted)", padding: "0.4rem 0.6rem 0.6rem" }}>PRIORITY</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {(["high", "medium", "low"] as Priority[]).map(p => {
                const active = priorityFilter === p;
                return (
                  <button key={p} onClick={() => setPriorityFilter(active ? null : p)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "0.5rem 0.7rem", border: "none",
                      borderRadius: 10, cursor: "pointer",
                      background: active ? "rgba(255,255,255,0.04)" : "transparent",
                      color: active ? "var(--adm-text)" : "var(--adm-text-sub)",
                      fontSize: "0.83rem", fontWeight: active ? 600 : 500,
                      textTransform: "capitalize",
                      transition: "background 150ms ease",
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLOR[p], boxShadow: `0 0 6px ${PRIORITY_COLOR[p]}80` }} />
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Message list ─── */}
        <div style={{
          background: "var(--adm-card)",
          border: "1px solid var(--adm-border)",
          borderRadius: 16,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--adm-border)" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "0.5rem 0.85rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--adm-border)",
              borderRadius: 10,
            }}>
              <Search size={15} style={{ color: "var(--adm-text-muted)" }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search messages…"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--adm-text)", fontSize: "0.82rem" }}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--adm-text-muted)", fontSize: "0.85rem" }}>
                No messages.
              </div>
            )}
            {filtered.map(m => {
              const active = selected?.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => { setSelectedId(m.id); markRead(m.id); }}
                  style={{
                    width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                    display: "flex", gap: 10, padding: "0.85rem 1rem",
                    background: active ? "rgba(245,158,11,0.06)" : "transparent",
                    borderLeft: active ? "3px solid var(--adm-accent)" : "3px solid transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    transition: "background 150ms ease",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <Avatar initials={m.initials} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.senderName}</span>
                        {m.unread && <span style={{ width: 7, height: 7, borderRadius: "50%", background: PRIORITY_COLOR[m.priority], boxShadow: `0 0 6px ${PRIORITY_COLOR[m.priority]}80`, flexShrink: 0 }} />}
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "var(--adm-text-muted)", flexShrink: 0 }}>{m.timestamp}</span>
                    </div>
                    <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--adm-text)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.subject}
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "var(--adm-text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.preview}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Message detail ─── */}
        <div style={{
          background: "var(--adm-card)",
          border: "1px solid var(--adm-border)",
          borderRadius: 16,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {selected ? (
            <>
              {/* detail header */}
              <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid var(--adm-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--adm-text)", marginBottom: 6 }}>{selected.subject}</h2>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      padding: "2px 9px", borderRadius: 6,
                      background: `${PRIORITY_COLOR[selected.priority]}1f`,
                      color: PRIORITY_COLOR[selected.priority],
                      fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
                    }}>
                      {selected.priority}
                    </span>
                    <span style={{ fontSize: "0.74rem", color: "var(--adm-text-muted)" }}>· {selected.timestamp}</span>
                  </div>
                </div>
                <div style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
                  <ToolbarBtn icon={Reply} label="Reply" />
                  <ToolbarBtn icon={CheckCircle2} label="Resolve" tone="success" onClick={resolveSelected} />
                  <ToolbarBtn icon={Trash2} label="" tone="danger" onClick={deleteSelected} />
                </div>
              </div>

              {/* sender block */}
              <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid var(--adm-border)", display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar initials={selected.initials} />
                <div>
                  <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)" }}>{selected.senderName}</div>
                  <div style={{ fontSize: "0.74rem", color: "var(--adm-text-muted)" }}>{selected.senderRole}</div>
                </div>
              </div>

              {/* body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.4rem" }}>
                <div style={{ fontSize: "0.88rem", lineHeight: 1.65, color: "var(--adm-text-sub)", whiteSpace: "pre-wrap" }}>
                  {selected.body}
                </div>

                {selected.linkedFlight && (
                  <div style={{ marginTop: "1.5rem", padding: "0.85rem 1rem", borderRadius: 12, border: "1px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
                    <AlertCircle size={18} style={{ color: "var(--adm-accent)", flexShrink: 0 }} />
                    <div style={{ fontSize: "0.82rem", color: "var(--adm-text-sub)" }}>
                      <span style={{ color: "var(--adm-accent)", fontWeight: 700 }}>Linked flight:</span>{" "}
                      {selected.linkedFlight.num} · {selected.linkedFlight.route} · {selected.linkedFlight.time} · {selected.linkedFlight.note}
                    </div>
                  </div>
                )}
              </div>

              {/* quick reply */}
              <div style={{ padding: "0.85rem 1rem", borderTop: "1px solid var(--adm-border)", display: "flex", gap: 8 }}>
                <input
                  value={reply} onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") sendReply(); }}
                  placeholder="Quick reply…"
                  style={{
                    flex: 1, padding: "0.6rem 0.85rem",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--adm-border)",
                    borderRadius: 10, color: "var(--adm-text)", fontSize: "0.84rem", outline: "none",
                  }}
                />
                <button
                  onClick={sendReply}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "0.6rem 1.1rem",
                    background: "linear-gradient(135deg, #F59E0B, #FBBF24)",
                    border: "none", borderRadius: 10,
                    color: "#0A1628", fontWeight: 700, fontSize: "0.83rem",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(245,158,11,0.3)",
                  }}
                >
                  <SendIcon size={14} /> Send
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--adm-text-muted)", padding: "2rem" }}>
              <Inbox size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
              <div style={{ fontSize: "0.9rem" }}>Select a message to read it.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, #F59E0B, #FBBF24)",
      color: "#0A1628",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.02em",
    }}>{initials}</div>
  );
}

function ToolbarBtn({ icon: Icon, label, tone, onClick }: {
  icon: typeof Reply; label: string; tone?: "success" | "danger"; onClick?: () => void;
}) {
  const colors = tone === "success"
    ? { bg: "rgba(52,211,153,0.10)", color: "#34D399", border: "rgba(52,211,153,0.35)" }
    : tone === "danger"
    ? { bg: "rgba(248,113,113,0.10)", color: "#F87171", border: "rgba(248,113,113,0.35)" }
    : { bg: "rgba(255,255,255,0.04)", color: "var(--adm-text-sub)", border: "var(--adm-border)" };
  return (
    <button onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: label ? "0.45rem 0.8rem" : "0.45rem",
        borderRadius: 9,
        border: `1px solid ${colors.border}`,
        background: colors.bg, color: colors.color,
        fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
        transition: "all 150ms ease",
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

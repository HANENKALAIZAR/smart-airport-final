import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  Inbox, Send as SendIcon, CheckCircle2, Archive, Search, Reply, Trash2,
  AlertCircle, ShieldCheck, RefreshCw, PenSquare, X, Lock, Shield, Mail, Plus, Clock
} from "lucide-react";
import { cn } from "../../components/admin/ui/utils";
import { useAirport } from "../../context/AirportContext";
import CustomSelect from "../../components/admin/ui/CustomSelect";
import {
  apiListMessages,
  apiReplyToMessage,
  apiUpdateMessageStatus,
  apiDeleteMessage,
  apiSendMessage,
  apiGetMe,
  apiListAdmins,
  apiMarkMessagesInboxRead
} from "../../services/adminApi";

/* ─────────────── Types ─────────────── */
type Priority = "high" | "medium" | "low";
type Folder = "inbox" | "sent" | "resolved" | "archived";

interface ReplyMsg {
  id: number;
  sender_type: string;
  author_name: string;
  author_role: string;
  body: string;
  created_at: string;
}

interface Message {
  id: number;
  direction: "to_super" | "to_admin";
  from_user_id: number;
  from_user_name: string;
  from_user_airport?: string | null;
  to_user_id?: number | null;
  to_user_name: string;
  category: string;
  subject: string;
  body: string;
  status: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
  replies: ReplyMsg[];
  sender_type: string;
}

interface AdminUser {
  id: number;
  full_name: string;
  airport_iata: string;
}

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

function getInitials(name?: string) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtTime(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function getPriorityFromCategory(category: string): Priority {
  if (category === "operational" || category === "security" || category === "passport" || category === "medical") return "high";
  if (category === "technical" || category === "baggage" || category === "boarding" || category === "delay") return "medium";
  return "low";
}

/* ─────────────── Component ─────────────── */

export default function SuperAdminMessages() {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
  const [search, setSearch] = useState("");
  const [customFilter, setCustomFilter] = useState<"all" | "unread" | "resolved">("all");
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [inboxMessages, setInboxMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [adminList, setAdminList] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [composing, setComposing] = useState(false);
  const [composeForm, setComposeForm] = useState({ subject: "", body: "", category: "general", to_user_id: "" });
  const [sendingMessage, setSendingMessage] = useState(false);

  const inboxMarkedRef = useRef(false);

  // ── Fetch User Info ──
  useEffect(() => {
    apiGetMe().then(res => {
      if (res.data) setCurrentUser(res.data);
    });
    
    apiListAdmins().then(({ data }) => {
      if (data) setAdminList(data);
    });
  }, []);

  // ── Load Data ──
  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inboxRes, sentRes] = await Promise.all([
        apiListMessages("inbox"),
        apiListMessages("sent"),
      ]);

      if (inboxRes.error) setError(inboxRes.error);
      if (sentRes.error) setError(sentRes.error);

      setInboxMessages(inboxRes.data || []);
      setSentMessages(sentRes.data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load HQ messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();

    if (!inboxMarkedRef.current) {
      inboxMarkedRef.current = true;
      apiMarkMessagesInboxRead().then(() => {
        window.dispatchEvent(new CustomEvent("admin-msg-unread-refresh"));
      });
    }
  }, [loadMessages]);

  // ── Transform & Filter Data ──
  const allMessages = useMemo(() => {
    const mapped: (Message & { _folder: Folder, _priority: Priority })[] = [];
    
    inboxMessages.forEach(m => {
      let f: Folder = "inbox";
      if (m.status === "resolved") f = "resolved";
      mapped.push({ ...m, _folder: f, _priority: getPriorityFromCategory(m.category) });
    });
    
    sentMessages.forEach(m => {
      let f: Folder = "sent";
      if (m.status === "resolved") f = "resolved";
      mapped.push({ ...m, _folder: f, _priority: getPriorityFromCategory(m.category) });
    });
    
    return mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [inboxMessages, sentMessages]);

  const list = useMemo(() => {
    return allMessages.filter(m => m.sender_type !== "passenger");
  }, [allMessages]);

  const counts = useMemo(() => {
    const c: Record<Folder, number> = { inbox: 0, sent: 0, resolved: 0, archived: 0 };
    list.forEach(m => { if (c[m._folder] !== undefined) c[m._folder]++; });
    return c;
  }, [list]);

  const filtered = useMemo(() => {
    return list.filter(m => {
      if (m._folder !== folder) return false;
      if (priorityFilter && m._priority !== priorityFilter) return false;
      
      // Apply Custom Refined Filters
      if (customFilter === "unread" && m.is_read) return false;
      if (customFilter === "resolved" && m.status !== "resolved") return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const sender = (m.from_user_name || "").toLowerCase();
        const hay = `${sender} ${m.subject} ${m.body}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [list, folder, priorityFilter, search, customFilter]);

  const selected = filtered.find(m => m.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (selected && selectedId !== selected.id) {
      setSelectedId(selected.id);
    } else if (!selected) {
      setSelectedId(null);
    }
  }, [filtered, selected, selectedId]);

  // ── Actions ──
  const resolveSelected = async () => {
    if (!selected) return;
    if (selected.status === "resolved") return;
    const { error: err } = await apiUpdateMessageStatus(selected.id, "resolved");
    if (err) setError(err);
    else {
      await loadMessages();
      window.dispatchEvent(new CustomEvent("admin-msg-unread-refresh"));
    }
  };

  const deleteSelected = async () => {
    if (!selected) return;
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    const { error: err } = await apiDeleteMessage(selected.id);
    if (err) setError(err);
    else {
      setSelectedId(null);
      await loadMessages();
      window.dispatchEvent(new CustomEvent("admin-msg-unread-refresh"));
    }
  };

  const markRead = (id: number) => {
    setSelectedId(id);
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;

    setSendingReply(true);
    const { error: err } = await apiReplyToMessage(selected.id, reply.trim());
    if (err) setError(err);
    else {
      setReply("");
      await loadMessages();
      window.dispatchEvent(new CustomEvent("admin-msg-unread-refresh"));
    }
    setSendingReply(false);
  };

  const handleCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeForm.subject.trim() || !composeForm.body.trim() || !composeForm.to_user_id) return;
    
    setSendingMessage(true);
    const payload = {
      subject: composeForm.subject,
      body: composeForm.body,
      category: composeForm.category,
      to_user_id: parseInt(composeForm.to_user_id)
    };
    
    const { error: err } = await apiSendMessage(payload);
    setSendingMessage(false);
    
    if (err) setError(err);
    else {
      setComposing(false);
      setComposeForm({ subject: "", body: "", category: "general", to_user_id: "" });
      setFolder("sent");
      await loadMessages();
    }
  };

  // ── Render Helpers ──
  const getSenderDetails = (m: Message) => {
    const isFromSuper = m.direction === "to_admin";
    const name = m.from_user_name || (isFromSuper ? "Super Admin" : "Me");
    const roleLabel = isFromSuper ? "Super Admin · HQ" : `Admin · ${m.from_user_airport || "Unknown"}`;
    return { name, role: roleLabel, initials: getInitials(name) };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", padding: "1rem" }}>
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-400">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-300 border-none bg-transparent cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header + Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 className="admin-page__title">HQ Communications Hub</h1>
          <p className="admin-page__subtitle">Internal coordination with airport administration teams.</p>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <button
            onClick={loadMessages}
            className="group relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-foreground backdrop-blur-md transition-all hover:bg-white/10 hover:shadow-lg active:scale-95 cursor-pointer"
          >
            <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" /> Refresh
          </button>
          
          <button
            onClick={() => setComposing(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-cyan px-4 text-xs font-semibold text-primary-foreground shadow-glow border-none cursor-pointer"
          >
            <Plus size={14} /> New HQ Message
          </button>
        </div>
      </div>

      {/* 3-pane layout */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 360px minmax(0,1fr)", gap: "1rem", alignItems: "stretch", minHeight: 640 }}>
        {/* Sidebar: Folders + Priority */}
        <div style={{
          background: "var(--adm-card)",
          border: "1px solid var(--adm-border)",
          borderRadius: 16,
          padding: "0.75rem",
          display: "flex", flexDirection: "column", gap: "1.25rem",
          height: "fit-content",
        }}>
          <div>
            <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--adm-text-muted)", padding: "0.4rem 0.6rem 0.6rem" }}>HQ CHANNELS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {FOLDERS.map(f => {
                const Icon = f.icon;
                const active = folder === f.key;
                if (f.key === "archived") return null;
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

        {/* Message list */}
        <div style={{
          background: "var(--adm-card)",
          border: "1px solid var(--adm-border)",
          borderRadius: 16,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--adm-border)" }} className="space-y-2">
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
                placeholder="Search sender, subject…"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--adm-text)", fontSize: "0.82rem" }}
              />
            </div>
            
            <div className="pt-1">
              <select
                value={customFilter}
                onChange={(e) => setCustomFilter(e.target.value as any)}
                style={{
                  width: "100%",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid var(--adm-border)",
                  borderRadius: 10,
                  color: "var(--adm-text)",
                  fontSize: "0.78rem",
                  padding: "0.45rem 0.6rem",
                  outline: "none"
                }}
              >
                <option value="all">🔍 Show All Messages</option>
                <option value="unread">📬 Unread Only</option>
                <option value="resolved">✅ Resolved Only</option>
              </select>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--adm-text-muted)", fontSize: "0.85rem", display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <RefreshCw size={20} className="mb-2 animate-spin opacity-50" />
                Loading messages...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--adm-text-muted)", fontSize: "0.85rem" }}>
                <Inbox size={32} className="opacity-30 mb-2 block mx-auto text-center" />
                No HQ messages yet.<br />
                <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>Start an internal coordination message with an airport team.</span>
              </div>
            ) : (
              filtered.map(m => {
                const active = selected?.id === m.id;
                const details = getSenderDetails(m);
                const preview = m.body.slice(0, 60) + (m.body.length > 60 ? "…" : "");
                const isNew = !m.is_read && m.direction === "to_super";
                
                return (
                  <button
                    key={m.id}
                    onClick={() => markRead(m.id)}
                    style={{
                      width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                      display: "flex", gap: 10, padding: "0.85rem 1rem",
                      background: active ? "rgba(245,158,11,0.06)" : "transparent",
                      borderLeft: active ? "4px solid var(--adm-accent)" : `4px solid ${PRIORITY_COLOR[m._priority]}50`,
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      transition: "background 150ms ease",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    <Avatar initials={details.initials} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{details.name}</span>
                          {isNew && <span style={{ width: 7, height: 7, borderRadius: "50%", background: PRIORITY_COLOR[m._priority], boxShadow: `0 0 6px ${PRIORITY_COLOR[m._priority]}80`, flexShrink: 0 }} />}
                        </div>
                        <span style={{ fontSize: "0.7rem", color: "var(--adm-text-muted)", flexShrink: 0 }}>{fmtTime(m.created_at)}</span>
                      </div>
                      
                      <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--adm-text)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.subject}
                      </div>
                      
                      <div style={{ fontSize: "0.76rem", color: "var(--adm-text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {preview}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Message detail */}
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
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--adm-text)", margin: 0 }}>{selected.subject}</h2>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      padding: "2px 9px", borderRadius: 6,
                      background: `${PRIORITY_COLOR[selected._priority]}1f`,
                      color: PRIORITY_COLOR[selected._priority],
                      fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
                    }}>
                      {selected._priority}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-white/5 px-2 py-0.5 rounded">
                      {selected.category}
                    </span>
                    <span style={{ fontSize: "0.74rem", color: "var(--adm-text-muted)" }}>· {fmtTime(selected.created_at)}</span>
                  </div>
                </div>
                <div style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
                  {selected.status !== "resolved" && <ToolbarBtn icon={CheckCircle2} label="Resolve" tone="success" onClick={resolveSelected} />}
                  <ToolbarBtn icon={Trash2} label="" tone="danger" onClick={deleteSelected} />
                </div>
              </div>

              {/* sender block */}
              <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid var(--adm-border)", display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar initials={getSenderDetails(selected).initials} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {getSenderDetails(selected).name}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--adm-text-muted)", display: "flex", gap: 4 }}>
                    {getSenderDetails(selected).role} 
                  </div>
                </div>
              </div>

              {/* body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.4rem" }}>
                <div style={{ fontSize: "0.88rem", lineHeight: 1.65, color: "var(--adm-text-sub)", whiteSpace: "pre-wrap" }}>
                  {selected.body}
                </div>
                
                {/* Replies Thread oldest -> newest */}
                {selected.replies && selected.replies.length > 0 && (
                  <div className="mt-8 space-y-4 border-t border-border/40 pt-4">
                    {selected.replies.map((r, i) => {
                      return (
                        <div
                          key={r.id || i}
                          style={{
                            background: "rgba(255,255,255,0.02)",
                            padding: "1rem",
                            borderRadius: "10px",
                            border: "1px solid var(--adm-border)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.8rem" }}>
                            <div>
                              <span style={{ fontWeight: 600, color: "var(--adm-text)", display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {r.author_name}
                              </span>
                              <span style={{ color: "var(--adm-text-muted)", marginLeft: 6 }}>
                                {r.author_role === "super_admin" ? "Super Admin" : "Operations Office"}
                              </span>
                            </div>
                            <span style={{ color: "var(--adm-text-muted)" }}>{fmtTime(r.created_at)}</span>
                          </div>
                          
                          <div style={{ fontSize: "0.85rem", color: "var(--adm-text-sub)", whiteSpace: "pre-wrap" }}>
                            {r.body}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* reply composer */}
              {selected.status !== "resolved" && (
                <div style={{ borderTop: "1px solid var(--adm-border)" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{
                      padding: "0.5rem 1rem",
                      background: "rgba(245,158,11,0.02)",
                      borderBottom: "1px solid var(--adm-border)",
                    }}>
                      <span className="text-[11px] font-semibold text-amber-500 flex items-center gap-1">
                        🔒 Internal coordination channel: Secure admin-to-admin message
                      </span>
                    </div>

                    <div style={{ padding: "0.85rem 1rem", display: "flex", gap: 8, alignItems: "flex-end" }}>
                      <input
                        value={reply} onChange={e => setReply(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") sendReply(); }}
                        disabled={sendingReply}
                        placeholder="Type your secure message response..."
                        style={{
                          flex: 1, padding: "0.6rem 0.85rem",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid var(--adm-border)",
                          borderRadius: 10, color: "var(--adm-text)", fontSize: "0.84rem", outline: "none"
                        }}
                      />
                      <button
                        onClick={sendReply}
                        disabled={sendingReply || !reply.trim()}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "0.6rem 1.1rem",
                          background: "linear-gradient(135deg, #F59E0B, #FBBF24)",
                          border: "none", borderRadius: 10,
                          color: "#0A1628", fontWeight: 700, fontSize: "0.83rem",
                          cursor: "pointer",
                          boxShadow: "0 4px 14px rgba(245,158,11,0.3)",
                          opacity: (sendingReply || !reply.trim()) ? 0.5 : 1,
                          height: 38
                        }}
                      >
                        <SendIcon size={14} /> Send
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--adm-text-muted)", padding: "2rem" }}>
              <Inbox size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
              <div style={{ fontSize: "0.9rem" }}>Select a conversation from the list to view.</div>
            </div>
          )}
        </div>
      </div>

      {/* Composer Modal */}
      {composing && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50
        }}>
          <div style={{
            background: "var(--adm-card)", border: "1px solid var(--adm-border)", borderRadius: 16,
            width: "100%", maxWidth: 600, overflow: "hidden",
            boxShadow: "var(--adm-shadow-md)"
          }}>
            {/* Modal Header */}
            <div style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "flex-start", justifyBetween: "space-between", borderBottom: "1px solid var(--adm-border)", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #F59E0B, #FBBF24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A1628", flexShrink: 0 }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px 0" }}>New Message to Airport Admin</h2>
                  <div style={{ fontSize: "0.8rem", color: "var(--adm-text-muted)" }}>Send secure internal communication from HQ.</div>
                </div>
              </div>
              <button onClick={() => setComposing(false)} style={{ background: "transparent", border: "none", color: "var(--adm-text-muted)", cursor: "pointer", padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Body */}
            <form onSubmit={handleCompose} style={{ padding: "1.5rem" }}>
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--adm-text-muted)", marginBottom: "0.5rem" }}>RECIPIENT AIRPORT ADMIN</label>
                <CustomSelect
                  options={adminList.map((a) => ({ value: String(a.id), label: `${a.full_name} · ${a.airport_iata}` }))}
                  value={composeForm.to_user_id ? String(composeForm.to_user_id) : null}
                  onChange={(val: any) => setComposeForm(f => ({ ...f, to_user_id: val }))}
                  placeholder="Select an airport admin..."
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--adm-text-muted)", marginBottom: "0.5rem" }}>PRIORITY / CATEGORY</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: "general", label: "💬 General" },
                    { value: "technical", label: "🔧 Technical" },
                    { value: "operational", label: "🚨 Operational" },
                    { value: "request", label: "📋 Request" },
                  ].map((c) => (
                    <button
                      key={c.value} type="button"
                      onClick={() => setComposeForm(f => ({ ...f, category: c.value }))}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all",
                        composeForm.category === c.value
                          ? "bg-amber-500/10 border-amber-500 text-amber-500"
                          : "bg-transparent border-white/10 text-muted-foreground hover:text-white"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--adm-text-muted)", marginBottom: "0.5rem" }}>SUBJECT</label>
                <input
                  required
                  type="text"
                  value={composeForm.subject}
                  onChange={e => setComposeForm({...composeForm, subject: e.target.value})}
                  style={{
                    width: "100%", padding: "0.8rem 1rem", background: "var(--adm-input-bg)",
                    border: "1px solid var(--adm-border)", borderRadius: 10, color: "var(--adm-text)",
                    fontSize: "0.9rem", outline: "none"
                  }}
                  placeholder="e.g. Schedule review or equipment request"
                />
              </div>

              <div style={{ marginBottom: "2rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--adm-text-muted)", marginBottom: "0.5rem" }}>MESSAGE BODY</label>
                <textarea
                  required
                  rows={5}
                  value={composeForm.body}
                  onChange={e => setComposeForm({...composeForm, body: e.target.value})}
                  style={{
                    width: "100%", padding: "0.8rem 1rem", background: "var(--adm-input-bg)",
                    border: "1px solid var(--adm-border)", borderRadius: 10, color: "var(--adm-text)",
                    fontSize: "0.9rem", outline: "none", resize: "none"
                  }}
                  placeholder="Write your secure HQ message..."
                />
              </div>

              {/* Modal Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setComposing(false)}
                  style={{
                    padding: "0.6rem 1.25rem", background: "transparent", border: "1px solid var(--adm-border)",
                    borderRadius: 10, color: "var(--adm-text)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingMessage || !composeForm.to_user_id}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "0.6rem 1.25rem", background: "linear-gradient(135deg, #F59E0B, #FBBF24)",
                    border: "none", borderRadius: 10, color: "#0A1628", fontSize: "0.85rem", fontWeight: 700,
                    cursor: "pointer", opacity: (sendingMessage || !composeForm.to_user_id) ? 0.7 : 1
                  }}
                >
                  <SendIcon size={16} /> {sendingMessage ? "Sending..." : "Send HQ Message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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

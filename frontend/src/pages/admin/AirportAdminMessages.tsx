import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Inbox, Send as SendIcon, CheckCircle2, Archive, Search, Reply, Trash2,
  AlertCircle, ShieldCheck, RefreshCw, X, Lock, Shield, Mail, RefreshCw as LoopIcon,
  User
} from "lucide-react";
import { cn } from "../../components/admin/ui/utils";
import { useAirport } from "../../context/AirportContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  apiListMessages,
  apiReplyToMessage,
  apiUpdateMessageStatus,
  apiDeleteMessage,
  apiSendMessage,
  apiGetMe,
  // Passenger helpdesk wrappers
  apiListPassengerMessages,
  apiClaimPassengerMessage,
  apiHeartbeatPassengerMessage,
  apiSavePassengerDraft,
  apiReplyToPassengerMessage,
  apiAddPassengerInternalNote,
  apiRetryPassengerEmail,
  apiResolvePassengerMessage,
  apiMarkPassengerRead,
  apiDeletePassengerMessage
} from "../../services/adminApi";

/* ─────────────── Types ─────────────── */
type Priority = "high" | "medium" | "low";
type Folder = "inbox" | "assigned" | "sent" | "resolved" | "archived";

interface ReplyMsg {
  id: number;
  sender_type: string;
  author_name: string;
  author_role: string;
  body: string;
  email_status?: string | null;
  retry_count?: number;
  created_at: string;
}

interface Message {
  id: number;
  reference_id?: string;
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
  passenger_name?: string | null;
  passenger_email?: string | null;
  airport_code?: string | null;
  assigned_admin_id?: number | null;
  assigned_admin_name?: string | null;
  draft_body?: string | null;
  is_overdue?: boolean;
}

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "#F87171",
  medium: "#FBBF24",
  low: "#34D399",
};

const PASSENGER_FOLDERS: { key: Folder; labelKey: string; icon: typeof Inbox }[] = [
  { key: "inbox", labelKey: "msg_inbox", icon: Inbox },
  { key: "assigned", labelKey: "msg_passenger_assigned", icon: User },
  { key: "sent", labelKey: "msg_passenger_sent", icon: SendIcon },
  { key: "resolved", labelKey: "msg_passenger_resolved", icon: CheckCircle2 },
  { key: "archived", labelKey: "msg_passenger_archived", icon: Archive },
];

const ADMIN_FOLDERS: { key: Folder; labelKey: string; icon: typeof Inbox }[] = [
  { key: "inbox", labelKey: "msg_inbox", icon: Inbox },
  { key: "sent", labelKey: "msg_sent", icon: SendIcon },
  { key: "resolved", labelKey: "msg_resolved", icon: CheckCircle2 },
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
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"; // localized in caller via t('msg_yesterday') if needed
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function getPriorityFromCategory(category: string): Priority {
  if (category === "operational" || category === "security" || category === "passport" || category === "medical") return "high";
  if (category === "technical" || category === "baggage" || category === "boarding" || category === "delay") return "medium";
  return "low";
}

/* ─────────────── Component ─────────────── */

export default function AirportAdminMessages() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"passenger" | "superadmin">("passenger");
  const [folder, setFolder] = useState<Folder>("inbox");
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
  const [search, setSearch] = useState("");
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [inboxMessages, setInboxMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [passengerMessages, setPassengerMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [composing, setComposing] = useState(false);
  const [composeForm, setComposeForm] = useState({ subject: "", body: "", category: "general" });
  const [sendingMessage, setSendingMessage] = useState(false);

  // Active workspace pane mode for passenger messages: "reply" (outbound email) vs "note" (internal note)
  const [activeNoteType, setActiveNoteType] = useState<"reply" | "note">("reply");
  const [draftSavedAlert, setDraftSavedAlert] = useState(false);

  // ── Fetch User Info ──
  useEffect(() => {
    apiGetMe().then(res => {
      if (res.data) setCurrentUser(res.data);
    });
  }, []);

  // ── Load Data ──
  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "passenger") {
        const res = await apiListPassengerMessages();
        if (res.error) {
          setError(res.error);
        } else {
          // Normalize helpdesk tickets into frontend Message format
          const list = (res.data || []).map((m: any) => ({
            id: m.id,
            reference_id: m.reference_id,
            direction: "to_admin",
            from_user_id: 0,
            from_user_name: m.sender_name,
            from_user_airport: m.airport_iata,
            to_user_name: m.assigned_admin_name || "Unassigned",
            category: m.category,
            subject: m.subject,
            body: m.message_body,
            status: m.status.toLowerCase(), // new, assigned, replied, resolved
            is_read: m.is_read,
            created_at: m.created_at,
            updated_at: m.updated_at,
            replies: m.replies,
            sender_type: "passenger",
            passenger_name: m.sender_name,
            passenger_email: m.sender_email,
            airport_code: m.airport_iata,
            assigned_admin_id: m.assigned_admin_id,
            assigned_admin_name: m.assigned_admin_name,
            draft_body: m.draft_body,
            priority: m.priority
          }));
          setPassengerMessages(list);
        }
      } else {
        const [inboxRes, sentRes] = await Promise.all([
          apiListMessages("inbox"),
          apiListMessages("sent"),
        ]);

        if (inboxRes.error) setError(inboxRes.error);
        if (sentRes.error) setError(sentRes.error);

        setInboxMessages(inboxRes.data || []);
        setSentMessages(sentRes.data || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load messages from backend.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // ── Transform & Filter Data ──
  const allMessages = useMemo(() => {
    if (tab === "passenger") {
      return passengerMessages.map(m => {
        let f: Folder = "inbox";
        if (m.status === "resolved") f = "resolved";
        else if (m.assigned_admin_id === currentUser?.id) f = "assigned";
        
        let p: Priority = "low";
        if (m.priority === "HIGH" || m.priority === "high") p = "high";
        else if (m.priority === "MEDIUM" || m.priority === "medium") p = "medium";

        return { ...m, _folder: f, _priority: p };
      });
    }

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
  }, [tab, passengerMessages, inboxMessages, sentMessages, currentUser]);

  const list = useMemo(() => {
    if (tab === "passenger") return allMessages;
    return allMessages.filter(m => m.sender_type !== "passenger");
  }, [allMessages, tab]);

  const counts = useMemo(() => {
    const c: Record<Folder, number> = { inbox: 0, assigned: 0, sent: 0, resolved: 0, archived: 0 };
    list.forEach(m => { if (c[m._folder] !== undefined) c[m._folder]++; });
    return c;
  }, [list]);

  const filtered = useMemo(() => {
    return list.filter(m => {
      if (m._folder !== folder) return false;
      if (priorityFilter && m._priority !== priorityFilter) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const sender = (m.passenger_name || m.from_user_name || "").toLowerCase();
        const hay = `${sender} ${m.subject} ${m.body} ${m.reference_id || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [list, folder, priorityFilter, search]);

  const selected = filtered.find(m => m.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (selected && selectedId !== selected.id) {
      setSelectedId(selected.id);
    } else if (!selected) {
      setSelectedId(null);
    }
  }, [filtered, selected, selectedId]);

  // ── Load saved Draft reply & Mark as Read when selecting tickets ──
  useEffect(() => {
    if (tab === "passenger" && selected) {
      if (selected.assigned_admin_id === currentUser?.id && selected.draft_body) {
        setReply(selected.draft_body);
      } else {
        setReply("");
      }

      // Mark ticket as read when opened/selected by airport admin
      if (!selected.is_read) {
        apiMarkPassengerRead(selected.id).then(() => {
          // Update local state is_read to true
          selected.is_read = true;
          setPassengerMessages(prev => prev.map(m => m.id === selected.id ? { ...m, is_read: true } : m));
          window.dispatchEvent(new CustomEvent("admin-msg-unread-refresh"));
        });
      }
    }
  }, [selectedId, tab, currentUser]);

  // ── Typing Heartbeat Lock refreshes claims ──
  useEffect(() => {
    if (tab !== "passenger" || !selected || !currentUser) return;
    if (selected.assigned_admin_id !== currentUser.id || selected.status === "resolved") return;

    const timer = setInterval(() => {
      apiHeartbeatPassengerMessage(selected.id);
    }, 45000);

    return () => clearInterval(timer);
  }, [tab, selected, currentUser]);

  // ── Autosave draft reply typing pause ──
  useEffect(() => {
    if (tab !== "passenger" || !selected || !currentUser || activeNoteType !== "reply") return;
    if (selected.assigned_admin_id !== currentUser.id || selected.status === "resolved") return;
    if (!reply.trim() || reply === selected.draft_body) return;

    const timer = setTimeout(async () => {
      setDraftSavedAlert(true);
      await apiSavePassengerDraft(selected.id, reply.trim());
      setTimeout(() => setDraftSavedAlert(false), 2000);
    }, 2000);

    return () => clearTimeout(timer);
  }, [reply, tab, selected, currentUser, activeNoteType]);

  // ── Actions ──
  const claimSelected = async () => {
    if (!selected) return;
    const { error: err } = await apiClaimPassengerMessage(selected.id);
    if (err) setError(err);
    else {
      await loadMessages();
      window.dispatchEvent(new CustomEvent("admin-msg-unread-refresh"));
    }
  };

  const resolveSelected = async () => {
    if (!selected) return;
    if (tab === "passenger") {
      const { error: err } = await apiResolvePassengerMessage(selected.id);
      if (err) setError(err);
      else {
        await loadMessages();
        window.dispatchEvent(new CustomEvent("admin-msg-unread-refresh"));
      }
    } else {
      if (selected.status === "resolved") return;
      const { error: err } = await apiUpdateMessageStatus(selected.id, "resolved");
      if (err) setError(err);
      else {
        await loadMessages();
        window.dispatchEvent(new CustomEvent("admin-msg-unread-refresh"));
      }
    }
  };

  const deleteSelected = async () => {
    if (!selected) return;
    if (!window.confirm(t('msg_confirm_delete'))) return;
    const isPassenger = tab === "passenger";
    const { error: err } = isPassenger
      ? await apiDeletePassengerMessage(selected.id)
      : await apiDeleteMessage(selected.id);
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
    if (tab === "passenger") {
      if (activeNoteType === "reply") {
        const { error: err } = await apiReplyToPassengerMessage(selected.id, reply.trim());
        if (err) setError(err);
        else {
          setReply("");
          await loadMessages();
          window.dispatchEvent(new CustomEvent("admin-msg-unread-refresh"));
        }
      } else {
        const { error: err } = await apiAddPassengerInternalNote(selected.id, reply.trim());
        if (err) setError(err);
        else {
          setReply("");
          await loadMessages();
          window.dispatchEvent(new CustomEvent("admin-msg-unread-refresh"));
        }
      }
    } else {
      if (selected.sender_type === "passenger" && !selected.passenger_email) return;
      const { error: err } = await apiReplyToMessage(selected.id, reply.trim());
      if (err) setError(err);
      else {
        setReply("");
        await loadMessages();
        window.dispatchEvent(new CustomEvent("admin-msg-unread-refresh"));
      }
    }
    setSendingReply(false);
  };

  const retryEmailSend = async (replyId: number) => {
    setSendingReply(true);
    const { error: err } = await apiRetryPassengerEmail(replyId);
    setSendingReply(false);
    if (err) setError(err);
    else await loadMessages();
  };

  const handleCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeForm.subject.trim() || !composeForm.body.trim()) return;
    
    setSendingMessage(true);
    const { error: err } = await apiSendMessage(composeForm);
    setSendingMessage(false);
    
    if (err) setError(err);
    else {
      setComposing(false);
      setComposeForm({ subject: "", body: "", category: "general" });
      setFolder("sent");
      setTab("superadmin");
      await loadMessages();
    }
  };

  // ── Render Helpers ──
  const getSenderDetails = (m: Message) => {
    if (m.sender_type === "passenger") {
      return {
        name: m.passenger_name || t('msg_unknown_passenger'),
        role: t('msg_passenger_helpdesk') + ' · ' + (m.airport_code || '—'),
        initials: getInitials(m.passenger_name || "P"),
      };
    }
    const isFromSuper = m.direction === "to_admin";
    const name = m.from_user_name || (isFromSuper ? t('msg_role_super_admin') : t('msg_role_me'));
    const role = isFromSuper ? t('msg_role_hq') : t('msg_role_admin') + ' · ' + (m.from_user_airport || '—');
    return { name, role, initials: getInitials(name) };
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

      {/* Header + role tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 className="admin-page__title">{t(tab === 'superadmin' ? 'msg_internal_page_title' : 'msg_page_title')}</h1>
          <p className="admin-page__subtitle">{t(tab === 'superadmin' ? 'msg_internal_page_subtitle' : 'msg_page_subtitle')}</p>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          {tab === "superadmin" && (
            <button
              onClick={() => setComposing(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-cyan px-4 text-xs font-semibold text-primary-foreground shadow-glow border-none cursor-pointer"
            >
              <Mail size={14} /> {t('msg_compose_hq')}
            </button>
          )}
          
          <div style={{
            display: "inline-flex", padding: 4, gap: 4,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--adm-border)",
            borderRadius: 12,
          }}>
            {([
              { k: "passenger", lk: "msg_passenger_desk", icon: Inbox },
              { k: "superadmin", lk: "msg_hq_messages", icon: ShieldCheck },
            ] as const).map((tabItem) => {
              const active = tab === tabItem.k;
              const Icon = tabItem.icon;
              return (
                <button
                  key={tabItem.k}
                  onClick={() => { setTab(tabItem.k); setFolder("inbox"); setPriorityFilter(null); setSelectedId(null); }}
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
                  {t(tabItem.lk)}
                </button>
              );
            })}
          </div>
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
            <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--adm-text-muted)", padding: "0.4rem 0.6rem 0.6rem" }}>
              {tab === "passenger" ? t('msg_ticket_folders') : t('msg_internal_folders')}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {(tab === "passenger" ? PASSENGER_FOLDERS : ADMIN_FOLDERS).map(f => {
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
                      {t(f.labelKey)}
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
            <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--adm-text-muted)", padding: "0.4rem 0.6rem 0.6rem" }}>{t('msg_priority')}</div>
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
                    {t('msg_priority_' + p)}
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
                placeholder={t('msg_search_reference')}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--adm-text)", fontSize: "0.82rem" }}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--adm-text-muted)", fontSize: "0.85rem", display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <RefreshCw size={20} className="mb-2 animate-spin opacity-50" />
                {t('msg_loading')}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--adm-text-muted)", fontSize: "0.85rem" }}>
                {t('msg_no_tickets')}
              </div>
            ) : (
              filtered.map(m => {
                const active = selected?.id === m.id;
                const details = getSenderDetails(m);
                const preview = m.body.slice(0, 60) + (m.body.length > 60 ? "…" : "");
                const isNew = m.status === "new" || m.status === "NEW";
                
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
                      
                      {m.reference_id && (
                        <div className="text-[10px] font-mono text-amber-500 mt-0.5">
                          {m.reference_id} &middot; <span className="uppercase text-muted-foreground">{m.category}</span>
                        </div>
                      )}

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
                    {selected.reference_id && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-amber-500">
                        {selected.reference_id}
                      </span>
                    )}
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
                  {selected.status !== "resolved" && <ToolbarBtn icon={CheckCircle2} label={t('msg_resolve_btn')} tone="success" onClick={resolveSelected} />}
                  <ToolbarBtn icon={Trash2} label="" tone="danger" onClick={deleteSelected} />
                </div>
              </div>

              {/* sender block */}
              <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid var(--adm-border)", display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar initials={getSenderDetails(selected).initials} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--adm-text)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {getSenderDetails(selected).name}
                    {selected.sender_type === "passenger" && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-semibold tracking-wide">
                        {selected.assigned_admin_name ? t('msg_assigned_to').replace('{name}', selected.assigned_admin_name) : t('msg_unassigned_shared')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--adm-text-muted)", display: "flex", gap: 4 }}>
                    {getSenderDetails(selected).role} 
                    {selected.sender_type === "passenger" && selected.passenger_email && (
                      <span> · {selected.passenger_email}</span>
                    )}
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
                      const isInternal = r.sender_type === "internal_note";
                      const isSystem = r.sender_type === "system";
                      
                      if (isSystem) {
                        return (
                          <div key={r.id || i} className="text-center py-2">
                            <span className="text-[11px] italic text-muted-foreground font-mono">
                              * {r.body} &middot; {fmtTime(r.created_at)} *
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={r.id || i}
                          style={{
                            background: isInternal ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.02)",
                            padding: "1rem",
                            borderRadius: "10px",
                            border: isInternal ? "1px solid rgba(245,158,11,0.15)" : "1px solid var(--adm-border)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.8rem" }}>
                            <div>
                              <span style={{ fontWeight: 600, color: "var(--adm-text)", display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {isInternal ? <Lock size={12} className="text-amber-500 shrink-0" /> : null}
                                {r.author_name}
                              </span>
                              <span style={{ color: "var(--adm-text-muted)", marginLeft: 6 }}>
                                {isInternal ? t('msg_internal_note') : t('msg_role_operations')}
                              </span>
                            </div>
                            <span style={{ color: "var(--adm-text-muted)" }}>{fmtTime(r.created_at)}</span>
                          </div>
                          
                          <div style={{ fontSize: "0.85rem", color: "var(--adm-text-sub)", whiteSpace: "pre-wrap" }}>
                            {r.body}
                          </div>

                          {/* Email delivery failures and retries */}
                          {(!isInternal && r.email_status) && (
                            <div className="mt-2 flex items-center justify-between text-[11px] font-semibold border-t border-white/5 pt-2 flex-wrap gap-2">
                              {r.email_status === "sent" ? (
                                <span className="text-emerald-400 inline-flex items-center gap-1">
                                  <Mail size={12} /> {t('msg_email_dispatched')}
                                </span>
                              ) : r.email_status === "PERMANENT_FAILURE" ? (
                                <span className="text-red-500 inline-flex items-center gap-1">
                                  {t('msg_email_failure_permanent')}
                                </span>
                              ) : (
                                <>
                                  <span className="text-red-400 inline-flex items-center gap-1">
                                    {t('msg_email_failure').replace('{count}', String(r.retry_count || 0))}
                                  </span>
                                  <button
                                    onClick={() => retryEmailSend(r.id)}
                                    disabled={sendingReply}
                                    className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 text-[10px] font-bold cursor-pointer transition-colors"
                                  >
                                    {t('msg_retry_send')}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* quick reply claiming validations desk layout */}
              {selected.status !== "resolved" && (
                <div style={{ borderTop: "1px solid var(--adm-border)" }}>
                  {/* unclaimed state */}
                  {(!selected.assigned_admin_id) ? (
                    <div style={{ padding: "1.25rem", textAlign: "center", background: "rgba(245,158,11,0.03)" }} className="space-y-3">
                      <div className="text-xs text-amber-500 flex items-center justify-center gap-1.5 font-semibold">
                        <Shield size={14} /> {t('msg_ticket_unclaimed')}
                      </div>
                      <button
                        onClick={claimSelected}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-amber px-6 text-xs font-bold text-primary-foreground shadow-glow border-none cursor-pointer"
                      >
                        <ShieldCheck size={14} /> {t('msg_take_ownership')}
                      </button>
                    </div>
                  ) : selected.assigned_admin_id !== currentUser?.id ? (
                    /* Claimed by someone else */
                    <div style={{ padding: "1rem", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
                      <span className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
                        <Lock size={12} /> {t('msg_claimed_by_other').replace('{name}', selected.assigned_admin_name || '')}
                      </span>
                    </div>
                  ) : (
                    /* Claimed by Me */
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {/* Warning bar + drafting switch */}
                      <div style={{
                        padding: "0.5rem 1rem",
                        background: activeNoteType === "reply" ? "rgba(245,158,11,0.03)" : "rgba(245,158,11,0.02)",
                        borderBottom: "1px solid var(--adm-border)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        flexWrap: "wrap", gap: 10
                      }}>
                        <span className="text-[11px] font-semibold text-amber-500 flex items-center gap-1">
                          {activeNoteType === "reply" ? (
                            <>{t('msg_warning_passenger')}</>
                          ) : (
                            <>{t('msg_internal_note_info')}</>
                          )}
                        </span>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => setActiveNoteType("reply")}
                            className={cn(
                              "px-2.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-all",
                              activeNoteType === "reply" 
                                ? "bg-amber-500 text-primary-foreground border-amber-500" 
                                : "bg-transparent text-muted-foreground border-white/10 hover:text-white"
                            )}
                          >
                              {t('msg_email_reply')}
                          </button>
                          <button
                            onClick={() => setActiveNoteType("note")}
                            className={cn(
                              "px-2.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-all",
                              activeNoteType === "note" 
                                ? "bg-amber-500 text-primary-foreground border-amber-500" 
                                : "bg-transparent text-muted-foreground border-white/10 hover:text-white"
                            )}
                          >
                              {t('msg_internal_note')}
                          </button>
                        </div>
                      </div>

                      {/* typing draft autosave area */}
                      <div style={{ padding: "0.85rem 1rem", display: "flex", gap: 8, alignItems: "flex-end" }}>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                          <input
                            value={reply} onChange={e => setReply(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") sendReply(); }}
                            disabled={sendingReply}
                            placeholder={activeNoteType === "reply" ? t('msg_reply_placeholder_email') : t('msg_reply_placeholder_note')}
                            style={{
                              width: "100%", padding: "0.6rem 0.85rem",
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid var(--adm-border)",
                              borderRadius: 10, color: "var(--adm-text)", fontSize: "0.84rem", outline: "none"
                            }}
                          />
                          {draftSavedAlert && (
                            <span className="text-[10px] text-emerald-400 font-mono self-start ml-1 animate-pulse">
                              {t('msg_draft_autosaved')}
                            </span>
                          )}
                        </div>
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
                          <SendIcon size={14} /> {t('msg_send')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--adm-text-muted)", padding: "2rem" }}>
              <Inbox size={36} style={{ opacity: 0.4, marginBottom: 12 }} />
              <div style={{ fontSize: "0.9rem" }}>{t('msg_select_ticket')}</div>
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
            <div style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid var(--adm-border)" }}>
              <div style={{ display: "flex", gap: "1rem" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #F59E0B, #FBBF24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A1628", flexShrink: 0 }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--adm-text)", margin: "0 0 4px 0" }}>{t('msg_new_to_hq')}</h2>
                  <div style={{ fontSize: "0.8rem", color: "var(--adm-text-muted)" }}>From: Current Admin · {useAirport().selectedAirport.iata}</div>
                </div>
              </div>
              <button onClick={() => setComposing(false)} style={{ background: "transparent", border: "none", color: "var(--adm-text-muted)", cursor: "pointer", padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Body */}
            <form onSubmit={handleCompose} style={{ padding: "1.5rem" }}>
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--adm-text-muted)", marginBottom: "0.5rem" }}>{t('msg_subject_label')}</label>
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
                  placeholder={t('msg_compose_subject_placeholder')}
                />
              </div>

              <div style={{ marginBottom: "2rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--adm-text-muted)", marginBottom: "0.5rem" }}>{t('msg_message_label')}</label>
                <textarea
                  required
                  rows={6}
                  value={composeForm.body}
                  onChange={e => setComposeForm({...composeForm, body: e.target.value})}
                  style={{
                    width: "100%", padding: "0.8rem 1rem", background: "var(--adm-input-bg)",
                    border: "1px solid var(--adm-border)", borderRadius: 10, color: "var(--adm-text)",
                    fontSize: "0.9rem", outline: "none", resize: "none"
                  }}
                  placeholder={t('msg_compose_body_placeholder')}
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
                  {t('msg_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={sendingMessage}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "0.6rem 1.25rem", background: "linear-gradient(135deg, #F59E0B, #FBBF24)",
                    border: "none", borderRadius: 10, color: "#0A1628", fontSize: "0.85rem", fontWeight: 700,
                    cursor: "pointer", opacity: sendingMessage ? 0.7 : 1
                  }}
                >
                  <SendIcon size={16} /> {sendingMessage ? t('msg_sending') : t('msg_send_to_hq')}
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

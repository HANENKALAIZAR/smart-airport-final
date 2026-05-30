import os

file_path = r"c:\Users\gzhan\Downloads\smart-airport-postgres-feature-cleaned-up-the-chaos\frontend\src\pages\admin\SuperAdminMessages.tsx"

new_content = """import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  PenSquare,
  Inbox,
  Send,
  Archive,
  Star,
  Paperclip,
  X,
  CornerDownRight,
  CheckCircle,
  Trash2,
  RefreshCw,
  Plus,
  CornerUpLeft,
  AlertCircle,
  Clock
} from "lucide-react";
import { AdminShell } from "../../components/admin/AdminShell";
import { cn } from "../../components/admin/ui/utils";
import { useAirport } from "../../context/AirportContext";
import CustomSelect from "../../components/admin/ui/CustomSelect";
import {
  apiListMessages,
  apiSendMessage,
  apiReplyToMessage,
  apiUpdateMessageStatus,
  apiListAdmins,
  apiDeleteMessage,
  apiMarkMessagesInboxRead,
} from "../../services/adminApi";

interface Reply {
  id: number;
  author_id: number;
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
  category: "technical" | "operational" | "request" | "general";
  subject: string;
  body: string;
  status: "open" | "in_progress" | "resolved";
  is_read: boolean;
  created_at: string;
  updated_at: string;
  replies: Reply[];
  sender_type: string;
  passenger_name?: string | null;
  passenger_email?: string | null;
  airport_code?: string | null;
  assigned_admin_name?: string | null;
}

interface AdminUser {
  id: number;
  full_name: string;
  airport_iata: string;
}

interface FormState {
  category: string;
  to_user_id: string;
  subject: string;
  body: string;
}

const CATEGORIES = [
  { value: "general", label: "💬 General" },
  { value: "technical", label: "🔧 Technical" },
  { value: "operational", label: "🚨 Operational" },
  { value: "request", label: "📋 Request" },
] as const;

const EMPTY_FORM: FormState = {
  category: "general",
  to_user_id: "",
  subject: "",
  body: "",
};

function getInitials(name?: string) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function fmtTime(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    const diff = now.getTime() - date.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${Math.max(1, min)} min ago`;
    const hr = Math.floor(min / 60);
    return `${hr} h ago`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function SuperAdminMessages() {
  const { role } = useAirport();
  const isSuperAdmin = role === "super_admin";

  const [inboxMessages, setInboxMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [adminList, setAdminList] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string>("");
  const [composing, setComposing] = useState(false);
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState<"inbox" | "sent" | "resolved" | "archive">("inbox");
  const [priorityFilter, setPriorityFilter] = useState<"high" | "medium" | "low" | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");

  const inboxMarkedRef = useRef(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inboxRes, sentRes] = await Promise.all([
        apiListMessages("inbox"),
        apiListMessages("sent"),
      ]);

      if (inboxRes.error) {
        setError(inboxRes.error);
        return;
      }
      if (sentRes.error) {
        setError(sentRes.error);
        return;
      }

      setInboxMessages(inboxRes.data || []);
      setSentMessages(sentRes.data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load messages from backend.");
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

    if (isSuperAdmin) {
      apiListAdmins().then(({ data }) => {
        if (data) setAdminList(data);
      });
    }
  }, [loadMessages, isSuperAdmin]);

  const getFromDetails = useCallback((msg: Message) => {
    let name = "";
    let roleLabel = "";
    let hue = "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg"; 

    if (msg.sender_type === "passenger") {
      name = msg.passenger_name || "Unknown Passenger";
      roleLabel = `Passenger Feedback · ${msg.airport_code || "Unknown"}`;
      hue = "bg-gradient-to-br from-rose-400 to-pink-600 text-white shadow-lg";
    } else {
      const isFromSuper = msg.direction === "to_admin";
      name = msg.from_user_name || (isFromSuper ? "Super Admin" : "Operations Bot");
      roleLabel = isFromSuper ? "Super Admin · HQ" : `Airline Ops · ${msg.from_user_airport || "System"}`;
      
      if (name.includes("Bot")) {
        hue = "bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-md";
      } else if (isFromSuper) {
        hue = "bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg";
      }
    }

    const initials = getInitials(name);
    return { name, role: roleLabel, initials, hue };
  }, []);

  const list = useMemo(() => {
    let l = [];
    if (folder === "inbox") l = inboxMessages.filter(m => m.status !== "resolved");
    else if (folder === "sent") l = sentMessages;
    else if (folder === "resolved") l = inboxMessages.filter(m => m.status === "resolved");
    else if (folder === "archive") l = [];
    
    if (priorityFilter) {
      l = l.filter(m => {
        if (priorityFilter === "high") return m.category === "operational";
        if (priorityFilter === "medium") return m.category === "technical";
        if (priorityFilter === "low") return m.category === "general" || m.category === "request";
        return true;
      });
    }

    if (q) {
      l = l.filter(
        (m) =>
          (m.subject + m.from_user_name + m.body)
            .toLowerCase()
            .includes(q.toLowerCase())
      );
    }
    return l;
  }, [folder, inboxMessages, sentMessages, q, priorityFilter]);

  const active = useMemo(() => {
    return list.find((m) => m.id.toString() === activeId) || list[0];
  }, [list, activeId]);

  useEffect(() => {
    if (list.length > 0) {
      const exists = list.some((m) => m.id.toString() === activeId);
      if (!exists) {
        setActiveId(list[0].id.toString());
      }
    } else {
      setActiveId("");
    }
  }, [folder, list, priorityFilter]);

  const folderCounts = useMemo(() => {
    return {
      inbox: inboxMessages.filter(m => m.status !== "resolved").length,
      sent: sentMessages.length,
      resolved: inboxMessages.filter(m => m.status === "resolved").length,
      archive: 0,
    };
  }, [inboxMessages, sentMessages]);

  const FOLDERS = [
    { key: "inbox", label: "Inbox", icon: Inbox, count: folderCounts.inbox },
    { key: "sent", label: "Sent", icon: Send, count: folderCounts.sent },
    { key: "resolved", label: "Resolved", icon: CheckCircle, count: folderCounts.resolved },
    { key: "archive", label: "Archived", icon: Archive, count: folderCounts.archive },
  ] as const;

  const PRIORITIES = [
    { key: "high", label: "High", color: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" },
    { key: "medium", label: "Medium", color: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" },
    { key: "low", label: "Low", color: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" },
  ] as const;

  const handleSendMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.body.trim()) return;
    if (isSuperAdmin && !form.to_user_id) return;

    setSendingMessage(true);
    setError("");
    const payload = {
      category: form.category,
      subject: form.subject.trim(),
      body: form.body.trim(),
      ...(isSuperAdmin ? { to_user_id: parseInt(form.to_user_id) } : {}),
    };

    const { error: err } = await apiSendMessage(payload);
    setSendingMessage(false);

    if (err) {
      setError(err);
      return;
    }

    setForm(EMPTY_FORM);
    setComposing(false);
    setFolder("sent");
    await loadMessages();
  };

  const handleSendReply = async () => {
    const isPassengerReplyDisabled = active?.sender_type === "passenger" && !active.passenger_email;
    if (!replyText.trim() || !active || isPassengerReplyDisabled) return;
    
    setSendingReply(true);
    setError("");
    const { error: err } = await apiReplyToMessage(active.id, replyText.trim());
    setSendingReply(false);
    if (err) {
      setError(err);
      return;
    }
    setReplyText("");
    await loadMessages();
  };

  const handleUpdateStatus = async (msgId: number, newStatus: "open" | "in_progress" | "resolved") => {
    setError("");
    const { error: err } = await apiUpdateMessageStatus(msgId, newStatus);
    if (err) {
      setError(err);
      return;
    }
    await loadMessages();
  };

  const handleDelete = async (msgId: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this message?")) return;
    setError("");
    const { error: err } = await apiDeleteMessage(msgId);
    if (err) {
      setError(err);
      return;
    }
    if (activeId === msgId.toString()) setActiveId("");
    await loadMessages();
    window.dispatchEvent(new CustomEvent("admin-msg-unread-refresh"));
  };

  const activeDetails = active ? getFromDetails(active) : null;

  return (
    <AdminShell
      title={<div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_4px_20px_rgba(245,158,11,0.3)] text-white"><Inbox size={20} /></div> <span className="tracking-tight text-foreground bg-clip-text">Messages Center</span></div>}
      subtitle="Modern, real-time coordination across airlines, ground crews, and ops teams."
      actions={
        <div className="flex items-center gap-3">
          <button
            onClick={loadMessages}
            className="group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-foreground backdrop-blur-md transition-all hover:bg-white/10 hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
          >
            <RefreshCw size={15} className="group-hover:rotate-180 transition-transform duration-500" /> Refresh
          </button>
          <button
            onClick={() => { setForm(EMPTY_FORM); setComposing(true); }}
            className="relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 text-xs font-bold text-white shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition-all hover:shadow-[0_6px_25px_rgba(245,158,11,0.6)] hover:-translate-y-0.5 active:scale-95"
          >
            <Plus size={16} /> New Message
          </button>
        </div>
      }
    >
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-400 mb-4 backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2"><AlertCircle size={16} /> {error}</div>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-300 transition-colors"><X size={16} /></button>
        </div>
      )}

      <div className="grid h-[calc(100vh-220px)] min-h-[640px] grid-cols-12 gap-5">
        {/* Modern Glass Sidebar */}
        <div className="col-span-12 md:col-span-2 flex flex-col gap-5">
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
            <div className="relative z-10 flex flex-col h-full">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-2">Folders</div>
              <ul className="space-y-1.5">
                {FOLDERS.map((f) => {
                  const Icon = f.icon;
                  const isActive = folder === f.key;
                  return (
                    <li key={f.key}>
                      <button
                        onClick={() => { setFolder(f.key); setQ(""); setPriorityFilter(null); }}
                        className={cn(
                          "group relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-300",
                          isActive ? "text-amber-400" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {isActive && <div className="absolute inset-0 rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]" />}
                        <span className="relative z-10 inline-flex items-center gap-3">
                          <Icon size={16} className={cn("transition-colors duration-300", isActive ? "text-amber-400" : "text-muted-foreground group-hover:text-foreground")} />
                          {f.label}
                        </span>
                        {f.count > 0 && (
                          <span className={cn("relative z-10 font-mono-num text-[11px] px-2 py-0.5 rounded-full", isActive ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-muted-foreground")}>
                            {f.count}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-2 mt-8">Priority</div>
              <ul className="space-y-1.5">
                {PRIORITIES.map((p) => {
                  const isActive = priorityFilter === p.key;
                  return (
                    <li key={p.key}>
                      <button
                        onClick={() => setPriorityFilter(isActive ? null : p.key as any)}
                        className={cn(
                          "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-300",
                          isActive ? "text-foreground bg-white/10 border border-white/10 shadow-lg" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        )}
                      >
                        <span className={cn("h-2.5 w-2.5 rounded-full transition-transform duration-300", p.color, isActive && "scale-125")} />
                        {p.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        {/* Modern List Panel */}
        <div className="col-span-12 flex flex-col md:col-span-4 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2.5 border border-white/10 focus-within:border-amber-500/50 focus-within:bg-black/40 focus-within:shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-all duration-300">
              <Search size={15} className="text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search messages..."
                className="w-full bg-transparent text-xs font-medium outline-none placeholder:text-muted-foreground text-foreground"
              />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground animate-pulse">
                <RefreshCw size={24} className="animate-spin mb-3 text-amber-500/50" />
                <span className="text-xs font-medium">Syncing...</span>
              </div>
            ) : list.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/5 mb-4 border border-white/5">
                  <Inbox size={28} className="opacity-40" />
                </div>
                <span className="text-sm font-semibold text-foreground">Inbox Zero</span>
                <span className="text-xs opacity-60 mt-1">No messages match your criteria.</span>
              </div>
            ) : (
              list.map((m) => {
                const isActive = m.id.toString() === activeId;
                const details = getFromDetails(m);
                const isUnread = !m.is_read && folder === "inbox";
                const timeFormatted = fmtTime(m.created_at);
                const preview = m.body.slice(0, 60) + (m.body.length > 60 ? "..." : "");

                return (
                  <li key={m.id} className="p-2">
                    <button
                      onClick={() => setActiveId(m.id.toString())}
                      className={cn(
                        "group relative w-full rounded-xl p-4 text-left transition-all duration-300 overflow-hidden",
                        isActive ? "bg-white/10 shadow-lg border border-white/10" : "hover:bg-white/5 border border-transparent"
                      )}
                    >
                      {isActive && <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-400 to-orange-500 rounded-l-xl" />}
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("grid h-9 w-9 place-items-center rounded-full text-xs font-bold transition-transform duration-300 group-hover:scale-105", details.hue)}>
                            {details.initials}
                          </div>
                          <div>
                            <span className={cn("block text-[13px] font-bold tracking-tight", isUnread ? "text-foreground" : "text-muted-foreground")}>
                              {details.name} {isUnread && <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 ml-1 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />}
                            </span>
                            <span className="block text-[10px] text-muted-foreground mt-0.5"><Clock size={10} className="inline mr-1 opacity-70"/>{timeFormatted}</span>
                          </div>
                        </div>
                      </div>
                      <div className={cn("mb-1.5 text-[13px] truncate font-semibold", isActive ? "text-foreground" : "text-foreground/80")}>
                        {m.subject}
                      </div>
                      <div className="text-[11px] text-muted-foreground/80 leading-relaxed truncate">{preview}</div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* Modern Details Panel */}
        <div className="col-span-12 flex flex-col md:col-span-6 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          {active && activeDetails ? (
            <>
              <div className="border-b border-white/5 bg-white/[0.02] px-8 py-6 relative overflow-hidden">
                <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-500/10 blur-[60px] pointer-events-none" />
                <div className="flex items-start justify-between gap-4 mb-6 relative z-10">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold text-foreground mb-3 leading-tight tracking-tight">
                      {active.subject}
                    </h2>
                    <div className="flex items-center gap-3 text-[11px] font-semibold tracking-wider uppercase">
                      <span className={cn(
                        "px-2.5 py-1 rounded-md border flex items-center gap-1.5 shadow-sm",
                        active.category === 'operational' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        active.category === 'technical' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      )}>
                        {active.category === 'operational' && <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse"/>}
                        {active.category === 'operational' ? 'HIGH PRIORITY' : active.category === 'technical' ? 'MEDIUM PRIORITY' : 'LOW PRIORITY'}
                      </span>
                      <span className="text-muted-foreground/50">•</span>
                      <span className="text-muted-foreground flex items-center gap-1"><Clock size={12}/> {fmtTime(active.created_at)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => document.getElementById('quick-reply-input')?.focus()} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-foreground hover:bg-white/10 hover:shadow-lg transition-all active:scale-95">
                      <CornerUpLeft size={14} /> Reply
                    </button>
                    <button onClick={() => handleUpdateStatus(active.id, active.status === 'resolved' ? 'open' : 'resolved')} className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all active:scale-95">
                      <CheckCircle size={14} /> {active.status === 'resolved' ? 'Reopen' : 'Resolve'}
                    </button>
                    <button onClick={() => handleDelete(active.id)} className="grid h-9 w-9 place-items-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all active:scale-95">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                  <div className={cn("grid h-12 w-12 place-items-center rounded-full text-sm font-black shadow-xl", activeDetails.hue)}>
                    {activeDetails.initials}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground tracking-tight">{activeDetails.name}</div>
                    <div className="text-[11px] font-medium text-muted-foreground mt-0.5">{activeDetails.role}</div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 custom-scrollbar relative">
                <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/90 font-medium">
                  {active.body}
                </p>

                {active.replies?.map((reply, i) => (
                  <div key={reply.id || i} className="relative pl-6 py-2">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-500/50 to-transparent rounded-full" />
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-bold text-xs text-foreground tracking-tight">{reply.author_name}</span>
                      <span className="text-[10px] font-medium text-muted-foreground">· {fmtTime(reply.created_at)}</span>
                    </div>
                    <p className="text-[13px] text-foreground/80 whitespace-pre-wrap leading-relaxed">{reply.body}</p>
                  </div>
                ))}

                {active.category === 'operational' && (
                  <div className="mt-8 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/5 p-4 flex items-start gap-4 shadow-[0_4px_20px_rgba(245,158,11,0.05)] backdrop-blur-sm">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-amber-500/20 shrink-0">
                      <AlertCircle size={16} className="text-amber-500" />
                    </div>
                    <div className="text-xs text-foreground/90 leading-relaxed font-medium">
                      <span className="font-bold text-amber-500 block mb-1">Operational Alert Requirement</span>
                      This message involves active operational coordination. Ensure all critical teams (apron, gate, catering) are notified of cascade impacts.
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 bg-white/[0.02] border-t border-white/5 backdrop-blur-xl">
                <div className="flex items-end gap-3 rounded-xl border border-white/10 bg-black/20 p-2 focus-within:border-amber-500/50 focus-within:bg-black/40 focus-within:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all duration-300 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                  <textarea
                    id="quick-reply-input"
                    value={replyText}
                    rows={1}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply here..."
                    disabled={active.status === "resolved"}
                    className="flex-1 bg-transparent px-3 py-2 text-[13px] font-medium outline-none placeholder:text-muted-foreground/70 text-foreground disabled:opacity-50 min-h-[40px] max-h-[120px] resize-none relative z-10"
                    style={{ overflowY: 'auto' }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyText.trim() || active.status === "resolved"}
                    className="relative z-10 inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-6 text-[13px] font-bold text-white shadow-[0_4px_15px_rgba(245,158,11,0.3)] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all hover:shadow-[0_6px_20px_rgba(245,158,11,0.5)] active:scale-95 shrink-0"
                  >
                    <Send size={15} /> {sendingReply ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground">
              <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/5 mb-6 border border-white/5 shadow-inner">
                <Inbox size={32} className="opacity-40" />
              </div>
              <h3 className="font-bold text-sm text-foreground tracking-tight">Select a conversation</h3>
              <p className="text-xs mt-2 opacity-70 font-medium">Choose a thread from the list to view details.</p>
            </div>
          )}
        </div>
      </div>

      {composing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setComposing(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-surface-1/90 backdrop-blur-3xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 bg-white/[0.02] relative overflow-hidden">
               <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-amber-500/10 blur-[50px] pointer-events-none" />
              <div className="font-display text-base font-bold tracking-tight flex items-center gap-3 relative z-10">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
                  <PenSquare size={14} />
                </div>
                New Message
              </div>
              <button onClick={() => setComposing(false)} className="relative z-10 text-muted-foreground hover:text-foreground transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleSendMessageSubmit}>
              <div className="space-y-5 px-6 py-6 bg-transparent">
                {isSuperAdmin && (
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-2 tracking-wide uppercase">Recipient Admin</label>
                    <CustomSelect
                      options={adminList.map((a) => ({ value: String(a.id), label: `${a.full_name} · ${a.airport_iata}` }))}
                      value={form.to_user_id ? String(form.to_user_id) : null}
                      onChange={(val: any) => setForm((f) => ({ ...f, to_user_id: val }))}
                      placeholder="Select an airport admin..."
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-2 tracking-wide uppercase">Priority / Category</label>
                  <div className="flex gap-3">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value} type="button"
                        onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                        className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all border", form.category === c.value ? "bg-amber-500/10 border-amber-500/50 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]" : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10")}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-2 tracking-wide uppercase">Subject</label>
                  <input required value={form.subject} onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium outline-none focus:border-amber-500/50 focus:bg-black/40 focus:shadow-[0_0_15px_rgba(245,158,11,0.1)] text-foreground transition-all duration-300" placeholder="Brief descriptive subject..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-2 tracking-wide uppercase">Message Body</label>
                  <textarea required rows={5} value={form.body} onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))} className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium outline-none focus:border-amber-500/50 focus:bg-black/40 focus:shadow-[0_0_15px_rgba(245,158,11,0.1)] text-foreground transition-all duration-300" placeholder="Type your full message here..." />
                </div>
              </div>
              <div className="flex justify-end border-t border-white/10 px-6 py-5 bg-white/[0.02]">
                <button type="submit" disabled={sendingMessage || (isSuperAdmin && !form.to_user_id)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_15px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.5)] disabled:opacity-50 disabled:shadow-none transition-all active:scale-95">
                  <Send size={15} /> {sendingMessage ? "Sending..." : "Send Secure Message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

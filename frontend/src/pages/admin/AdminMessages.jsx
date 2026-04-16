import { useState, useEffect, useCallback, useRef } from 'react';
import {
    MessageSquare, Send, Plus, X, ChevronDown, ChevronUp,
    CheckCircle, Clock, AlertCircle, Inbox, Filter,
    ArrowUpRight, ArrowDownLeft, RefreshCw, Trash2,
} from 'lucide-react';
import { useAirport } from '../../context/AirportContext';
import { TUNISIAN_AIRPORTS } from '../../context/AirportContext';
import {
    apiListMessages, apiSendMessage, apiReplyToMessage, apiUpdateMessageStatus, apiListAdmins,
    apiDeleteMessage, apiMarkMessagesInboxRead,
} from '../../services/adminApi';
import CustomSelect from '../../components/ui/CustomSelect';

const CATEGORIES = [
    { value: 'technical',   label: '🔧 Technical',   color: '#3B82F6' },
    { value: 'operational', label: '🚨 Operational',  color: '#EF4444' },
    { value: 'request',     label: '📋 Request',      color: '#8B5CF6' },
    { value: 'general',     label: '💬 General',      color: '#64748B' },
];

const STATUS_CONFIG = {
    open:        { icon: <AlertCircle size={12} />, label: 'Pending',     color: '#F59E0B' },
    in_progress: { icon: <Clock size={12} />,       label: 'In Progress', color: '#3B82F6' },
    resolved:    { icon: <CheckCircle size={12} />, label: 'Resolved',    color: '#22C55E' },
};

const EMPTY_FORM = { category: 'technical', to_user_id: '', subject: '', body: '' };

function getCat(value) { return CATEGORIES.find(c => c.value === value) || CATEGORIES[3]; }

function fmtTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    });
}

function airportLabel(iata) {
    if (!iata || iata === 'HQ') return 'HQ (Super Admin)';
    return TUNISIAN_AIRPORTS.find(a => a.iata === iata)?.name || iata;
}

export default function AdminMessages() {
    const { role, selectedAirport } = useAirport();
    const isSuperAdmin = role === 'super_admin';

    const [messages, setMessages]       = useState([]);
    const [adminList, setAdminList]     = useState([]);
    const [loading, setLoading]         = useState(true);
    const [expandedId, setExpandedId]   = useState(null);
    const [composing, setComposing]     = useState(false);
    const [tab, setTab]                 = useState('inbox');
    const [filterStatus, setFilterStatus] = useState('all');
    const [replyText, setReplyText]     = useState({});
    const [form, setForm]               = useState(EMPTY_FORM);
    const [sending, setSending]         = useState(false);
    const [error, setError]             = useState('');
    const [hoverMsgId, setHoverMsgId]   = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const inboxMarkedRef = useRef(false);

    // ── Load messages ─────────────────────────────────────────────────
    const loadMessages = useCallback(async () => {
        if (!inboxMarkedRef.current) {
            inboxMarkedRef.current = true;
            await apiMarkMessagesInboxRead();
            window.dispatchEvent(new CustomEvent('admin-msg-unread-refresh'));
        }
        setLoading(true);
        const { data, error: err } = await apiListMessages(tab, filterStatus);
        setLoading(false);
        if (err) { setError(err); return; }
        setMessages(data || []);
        setError('');
    }, [tab, filterStatus]);

    useEffect(() => { loadMessages(); }, [loadMessages]);

    // Load admin list for super_admin compose dropdown
    useEffect(() => {
        if (!isSuperAdmin) return;
        apiListAdmins().then(({ data }) => { if (data) setAdminList(data); });
    }, [isSuperAdmin]);

    // ── Send message ──────────────────────────────────────────────────
    async function handleSend(e) {
        e.preventDefault();
        if (!form.subject.trim() || !form.body.trim()) return;
        if (isSuperAdmin && !form.to_user_id) return;

        setSending(true);
        const payload = {
            category: form.category,
            subject: form.subject.trim(),
            body: form.body.trim(),
            ...(isSuperAdmin ? { to_user_id: parseInt(form.to_user_id) } : {}),
        };
        const { error: err } = await apiSendMessage(payload);
        setSending(false);

        if (err) { setError(err); return; }
        setForm(EMPTY_FORM);
        setComposing(false);
        setTab('sent');
        await loadMessages();
    }

    // ── Reply ─────────────────────────────────────────────────────────
    async function handleReply(msgId) {
        const text = replyText[msgId]?.trim();
        if (!text) return;
        const { error: err } = await apiReplyToMessage(msgId, text);
        if (err) { setError(err); return; }
        setReplyText(p => ({ ...p, [msgId]: '' }));
        await loadMessages();
    }

    // ── Status Update ─────────────────────────────────────────────────
    async function handleStatusUpdate(msgId, newStatus) {
        const { error: err } = await apiUpdateMessageStatus(msgId, newStatus);
        if (err) { setError(err); return; }
        await loadMessages();
    }

    async function handleDeleteMessage(msgId) {
        const { error: err } = await apiDeleteMessage(msgId);
        if (err) { setError(err); return; }
        setConfirmDeleteId(null);
        if (expandedId === msgId) setExpandedId(null);
        await loadMessages();
        window.dispatchEvent(new CustomEvent('admin-msg-unread-refresh'));
    }

    return (
        <div className="admin-page">
            {/* ── Header ── */}
            <div className="admin-page__header" style={{ marginBottom: '1.5rem' }}>
                <div>
                    <h1 className="admin-page__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <MessageSquare size={22} style={{ color: '#6366F1' }} />
                        {isSuperAdmin ? 'Messaging Center' : 'Messages'}
                    </h1>
                    <p className="admin-page__subtitle">
                        {isSuperAdmin
                            ? 'Manage communications with all airport administrators'
                            : `Internal communications — ${selectedAirport.name} (${selectedAirport.iata})`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="admin-btn admin-btn--outline" onClick={loadMessages} title="Refresh">
                        <RefreshCw size={15} />
                    </button>
                    <button
                        className="admin-btn admin-btn--primary"
                        onClick={() => { setComposing(true); setForm(EMPTY_FORM); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <Plus size={16} /> Compose
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '0.84rem', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{error}</span>
                    <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer' }}>✕</button>
                </div>
            )}

            {/* ── Tabs ── */}
            <div style={{ display: 'flex', gap: 0, marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {[
                    { key: 'inbox', icon: <ArrowDownLeft size={14} />, label: 'Inbox' },
                    { key: 'sent',  icon: <ArrowUpRight size={14} />,  label: 'Sent' },
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '10px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
                            fontSize: '0.85rem', fontWeight: 600,
                            color: tab === t.key ? '#A5B4FC' : 'rgba(255,255,255,0.4)',
                            borderBottom: `2px solid ${tab === t.key ? '#6366F1' : 'transparent'}`,
                            marginBottom: -1, transition: 'color 0.15s, border-color 0.15s',
                        }}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ── Filters ── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1.2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <Filter size={14} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                {['all', 'open', 'in_progress', 'resolved'].map(s => (
                    <button key={s} onClick={() => setFilterStatus(s)} style={{
                        padding: '4px 13px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${filterStatus === s ? '#6366F1' : 'rgba(255,255,255,0.1)'}`,
                        background: filterStatus === s ? 'rgba(99,102,241,0.15)' : 'transparent',
                        color: filterStatus === s ? '#A5B4FC' : 'rgba(255,255,255,0.4)',
                        transition: 'all 0.15s',
                    }}>
                        {s === 'all' ? 'All' : s === 'open' ? 'Pending' : s === 'in_progress' ? 'In Progress' : 'Resolved'}
                    </button>
                ))}
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>
                    {messages.length} message{messages.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* ── Message List ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loading && (
                    <div style={{ textAlign: 'center', padding: '3rem 0', color: 'rgba(255,255,255,0.3)' }}>
                        <Clock size={32} style={{ marginBottom: 12, opacity: 0.5, animation: 'spin 1s linear infinite' }} />
                        <p style={{ fontSize: '0.85rem' }}>Loading messages…</p>
                    </div>
                )}

                {!loading && messages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem 0', color: 'rgba(255,255,255,0.2)' }}>
                        <Inbox size={44} style={{ marginBottom: 14, opacity: 0.5 }} />
                        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>No messages</p>
                        <p style={{ fontSize: '0.78rem', marginTop: 4 }}>
                            {tab === 'inbox' ? 'Your inbox is empty' : 'No sent messages yet'}
                        </p>
                    </div>
                )}

                {!loading && messages.map(msg => {
                    const cat = getCat(msg.category);
                    const st  = STATUS_CONFIG[msg.status] || STATUS_CONFIG.open;
                    const isExpanded = expandedId === msg.id;

                    return (
                        <div
                            key={msg.id}
                            onMouseEnter={() => setHoverMsgId(msg.id)}
                            onMouseLeave={() => { setHoverMsgId(null); }}
                            style={{
                                position: 'relative',
                                background: isExpanded ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${isExpanded ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)'}`,
                                borderRadius: 12, overflow: 'visible', transition: 'all 0.18s',
                            }}
                        >
                            <button type="button" onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        {tab === 'inbox' && !msg.is_read && (
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366F1', flexShrink: 0 }} />
                                        )}
                                        <span style={{ fontWeight: (!msg.is_read && tab === 'inbox') ? 700 : 500, fontSize: '0.88rem', color: (!msg.is_read && tab === 'inbox') ? '#FFFFFF' : '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>
                                            {msg.subject}
                                        </span>
                                        <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 20, background: `${cat.color}1A`, color: cat.color, border: `1px solid ${cat.color}33`, flexShrink: 0 }}>
                                            {cat.label}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.38)', marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        <span>{tab === 'inbox' ? `From: ${msg.from_user_name}` : `To: ${msg.to_user_name || 'Super Admin'}`}</span>
                                        {msg.from_user_airport && <span style={{ color: '#818CF8', fontWeight: 600 }}>✈ {msg.from_user_airport}</span>}
                                        <span>·</span>
                                        <span>{fmtTime(msg.created_at)}</span>
                                        {msg.replies?.length > 0 && <span style={{ color: 'rgba(255,255,255,0.5)' }}>💬 {msg.replies.length}</span>}
                                    </div>
                                </div>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, padding: '3px 9px', borderRadius: 20, background: `${st.color}1A`, color: st.color, border: `1px solid ${st.color}33` }}>
                                    {st.icon} {st.label}
                                </span>
                                {isExpanded ? <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />}
                                {hoverMsgId === msg.id && (
                                    <button
                                        type="button"
                                        title="Delete message"
                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(msg.id); }}
                                        style={{
                                            flexShrink: 0,
                                            padding: 6,
                                            borderRadius: 8,
                                            border: '1px solid rgba(239,68,68,0.35)',
                                            background: 'rgba(239,68,68,0.12)',
                                            color: '#FCA5A5',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </button>

                            {confirmDeleteId === msg.id && (
                                <div
                                    role="dialog"
                                    aria-label="Confirm delete"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        position: 'absolute',
                                        right: 12,
                                        top: 48,
                                        zIndex: 20,
                                        padding: '12px 14px',
                                        borderRadius: 10,
                                        background: 'rgba(15,23,42,0.98)',
                                        border: '1px solid rgba(239,68,68,0.4)',
                                        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                                        minWidth: 220,
                                    }}
                                >
                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9', marginBottom: 10 }}>
                                        Delete this message?
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                        <button
                                            type="button"
                                            className="admin-btn admin-btn--outline"
                                            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                                            onClick={() => setConfirmDeleteId(null)}
                                        >
                                            No
                                        </button>
                                        <button
                                            type="button"
                                            className="admin-btn admin-btn--danger"
                                            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                                            onClick={() => handleDeleteMessage(msg.id)}
                                        >
                                            Yes
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isExpanded && (
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 18px 18px' }}>
                                    <div style={{ display: 'flex', gap: 20, marginBottom: 14, fontSize: '0.73rem', color: 'rgba(255,255,255,0.35)', flexWrap: 'wrap' }}>
                                        <span><strong style={{ color: 'rgba(255,255,255,0.55)' }}>From:</strong> {msg.from_user_name}{msg.from_user_airport ? ` · ${airportLabel(msg.from_user_airport)}` : ''}</span>
                                        <span><strong style={{ color: 'rgba(255,255,255,0.55)' }}>To:</strong> {msg.to_user_name || 'Super Admin'}</span>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '12px 14px', marginBottom: 14, fontSize: '0.87rem', color: '#CBD5E1', lineHeight: 1.65, borderLeft: '3px solid rgba(255,255,255,0.1)' }}>
                                        {msg.body}
                                    </div>

                                    {msg.replies?.map((r, i) => (
                                        <div key={i} style={{ marginBottom: 8, padding: '10px 14px', borderRadius: 8, background: r.author_role === 'super_admin' ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)', borderLeft: `3px solid ${r.author_role === 'super_admin' ? '#6366F1' : 'rgba(255,255,255,0.12)'}` }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 5, color: r.author_role === 'super_admin' ? '#818CF8' : 'rgba(255,255,255,0.45)' }}>
                                                {r.author_role === 'super_admin' ? '⭐ ' : '🛡 '}{r.author_name} · {fmtTime(r.created_at)}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#CBD5E1', lineHeight: 1.55 }}>{r.body}</div>
                                        </div>
                                    ))}

                                    {msg.status !== 'resolved' && (
                                        <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
                                            <input
                                                value={replyText[msg.id] || ''}
                                                onChange={e => setReplyText(p => ({ ...p, [msg.id]: e.target.value }))}
                                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleReply(msg.id)}
                                                placeholder="Write a reply and press Enter…"
                                                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 14px', color: '#E2E8F0', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                            <button onClick={() => handleReply(msg.id)} className="admin-btn admin-btn--primary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                                                <Send size={14} /> Reply
                                            </button>
                                            <button onClick={() => handleStatusUpdate(msg.id, 'resolved')} className="admin-btn admin-btn--outline" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, color: '#22C55E', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                                                <CheckCircle size={14} /> Resolve
                                            </button>
                                        </div>
                                    )}

                                    {msg.status === 'resolved' && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0 4px', fontSize: '0.78rem', color: '#22C55E', fontWeight: 600 }}>
                                            <CheckCircle size={14} /> This thread has been resolved
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Compose Modal ── */}
            {composing && (
                <div className="admin-modal-backdrop" onClick={() => setComposing(false)}>
                    <div className="admin-modal" style={{ maxWidth: 560, width: '94%' }} onClick={e => e.stopPropagation()}>
                        <div className="admin-modal__header">
                            <div>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <MessageSquare size={18} style={{ color: '#6366F1' }} />
                                    {isSuperAdmin ? 'Message to Admin' : 'Message to Super Admin'}
                                </h2>
                                <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                                    {isSuperAdmin ? 'Select an administrator and compose your message' : 'Your message will be sent directly to headquarters'}
                                </p>
                            </div>
                            <button className="admin-modal__close" onClick={() => setComposing(false)}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSend}>
                            <div className="admin-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {isSuperAdmin && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recipient</label>
                                        <CustomSelect
                                            required
                                            placeholder="— Select an administrator —"
                                            options={adminList.map(a => ({ value: String(a.id), label: `${a.full_name} · ${a.airport_iata}` }))}
                                            value={form.to_user_id ? String(form.to_user_id) : null}
                                            onChange={(val) => setForm(f => ({ ...f, to_user_id: val }))}
                                        />
                                    </div>
                                )}

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Category</label>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {CATEGORIES.map(c => (
                                            <button key={c.value} type="button" onClick={() => setForm(f => ({ ...f, category: c.value }))} style={{ padding: '6px 13px', borderRadius: 20, fontSize: '0.77rem', fontWeight: 600, cursor: 'pointer', border: `1px solid ${form.category === c.value ? c.color : 'rgba(255,255,255,0.1)'}`, background: form.category === c.value ? `${c.color}22` : 'rgba(255,255,255,0.03)', color: form.category === c.value ? c.color : 'rgba(255,255,255,0.4)', transition: 'all 0.15s' }}>
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subject</label>
                                    <input required maxLength={120} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Brief, descriptive subject line…" className="admin-form-input" />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Message</label>
                                    <textarea required rows={6} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your full message here…" className="admin-form-input" style={{ resize: 'vertical', minHeight: 110 }} />
                                    <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{form.body.length} chars</div>
                                </div>
                            </div>

                            <div className="admin-modal__footer">
                                <button type="button" className="admin-btn admin-btn--outline" onClick={() => setComposing(false)}>Cancel</button>
                                <button type="submit" className="admin-btn admin-btn--primary" disabled={sending || (isSuperAdmin && !form.to_user_id)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {sending ? <><Clock size={14} /> Sending…</> : <><Send size={14} /> Send Message</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

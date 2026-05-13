/**
 * SuperAdminUsers — FULLY MERGED (plain JSX, no TypeScript, no framer-motion)
 * ✅ Real backend logic (duplicate detection, email suggestions, API calls)
 * ✅ Glassmorphic UI matching screenshots
 * ✅ Personal email field added to Create modal
 * ✅ All table columns, filters, review modal, delete modal preserved
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    UserPlus, Search, ShieldCheck, ShieldAlert,
    Mail, MoreHorizontal, CheckCircle2, Clock, X,
    IdCard, Eye, Building2, Trash2, RefreshCw,
    AlertTriangle, Filter, Loader, CheckCircle, XCircle,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { TUNISIAN_AIRPORTS } from '../../context/AirportContext';
import {
    apiListAdmins, apiCreateAdmin, apiDeleteAdmin,
    apiCheckEmail, apiSuggestEmail, apiCheckDuplicate,
    apiGetAdminReview, apiPostIdReview,
} from '../../services/adminApi';

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const HUE_POOL = [
    ['#06b6d4', '#3b82f6'],
    ['#8b5cf6', '#7c3aed'],
    ['#f59e0b', '#f97316'],
    ['#10b981', '#14b8a6'],
    ['#f43f5e', '#ec4899'],
    ['#6366f1', '#3b82f6'],
    ['#0ea5e9', '#06b6d4'],
    ['#d946ef', '#ec4899'],
];

function pickGradient(id) {
    const pair = HUE_POOL[id % HUE_POOL.length];
    return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

function getInitials(name) {
    return (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function isValidEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());
}

const EMPTY_FORM = { name: '', airport: 'TUN', personalEmail: '', workEmail: '' };

/* ─────────────────────────────────────────────
   Modal wrapper — pure CSS, no framer-motion
───────────────────────────────────────────── */
function Modal({ show, onBackdropClick, children, maxWidth = '520px' }) {
    if (!show) return null;
    return (
        <div
            onClick={onBackdropClick}
            style={{
                position: 'fixed', inset: 0, zIndex: 50,
                display: 'grid', placeItems: 'center',
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(12px)',
                padding: 16,
                animation: 'su-fadeIn 0.15s ease',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth,
                    background: '#111118',
                    borderRadius: 18,
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
                    animation: 'su-slideUp 0.18s ease',
                    overflow: 'hidden',
                }}
            >
                {children}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────
   Badges
───────────────────────────────────────────── */
function StatusBadge({ status }) {
    const active = status === 'active';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            borderRadius: 999,
            border: active ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(113,113,122,0.25)',
            background: active ? 'rgba(52,211,153,0.1)' : 'rgba(113,113,122,0.08)',
            padding: '3px 10px', fontSize: 11, fontWeight: 700,
            color: active ? '#34d399' : '#71717a',
        }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#34d399' : '#52525b' }} />
            {active ? 'Active' : 'Inactive'}
        </span>
    );
}

const VERIF_CFG = {
    approved: { color: '#34d399', border: 'rgba(52,211,153,0.3)', bg: 'rgba(52,211,153,0.1)', label: 'Verified', Icon: CheckCircle2 },
    verified: { color: '#34d399', border: 'rgba(52,211,153,0.3)', bg: 'rgba(52,211,153,0.1)', label: 'Verified', Icon: CheckCircle2 },
    pending: { color: '#fbbf24', border: 'rgba(251,191,36,0.3)', bg: 'rgba(251,191,36,0.1)', label: 'Pending', Icon: Clock },
    pending_review: { color: '#fbbf24', border: 'rgba(251,191,36,0.3)', bg: 'rgba(251,191,36,0.1)', label: 'Pending', Icon: Clock },
    under_review: { color: '#38bdf8', border: 'rgba(56,189,248,0.3)', bg: 'rgba(56,189,248,0.1)', label: 'Under Review', Icon: Eye },
    rejected: { color: '#f87171', border: 'rgba(248,113,113,0.3)', bg: 'rgba(248,113,113,0.1)', label: 'Rejected', Icon: X },
};

function VerifBadge({ status, profileComplete }) {
    if (!profileComplete) return <span style={{ fontSize: 12, color: '#3f3f46' }}>—</span>;
    const cfg = VERIF_CFG[status] ?? VERIF_CFG.pending_review;
    const Icon = cfg.Icon;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            borderRadius: 999, border: `1px solid ${cfg.border}`,
            background: cfg.bg, padding: '3px 10px',
            fontSize: 11, fontWeight: 700, color: cfg.color,
        }}>
            <Icon size={11} /> {cfg.label}
        </span>
    );
}

/* ─────────────────────────────────────────────
   GlassCard
───────────────────────────────────────────── */
function GlassCard({ children, style }) {
    return (
        <div style={{
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.025)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(8px)',
            ...style,
        }}>
            {children}
        </div>
    );
}

/* ─────────────────────────────────────────────
   Form Field
───────────────────────────────────────────── */
function Field({ label, hint, statusIcon, borderColor, ...rest }) {
    return (
        <label style={{ display: 'block' }}>
            <span style={{
                display: 'block', marginBottom: 6,
                fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.16em', color: '#52525b',
            }}>
                {label}
            </span>
            <div style={{ position: 'relative' }}>
                <input
                    {...rest}
                    style={{
                        height: 40, width: '100%', boxSizing: 'border-box',
                        borderRadius: 12, outline: 'none',
                        border: `1px solid ${borderColor || 'rgba(255,255,255,0.1)'}`,
                        background: 'rgba(255,255,255,0.04)',
                        padding: statusIcon ? '0 36px 0 12px' : '0 12px',
                        fontSize: 14, color: '#f4f4f5',
                        transition: 'border-color 0.2s',
                        opacity: rest.disabled ? 0.45 : 1,
                    }}
                />
                {statusIcon && (
                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                        {statusIcon}
                    </div>
                )}
            </div>
            {hint && <div style={{ marginTop: 5 }}>{hint}</div>}
        </label>
    );
}

/* ─────────────────────────────────────────────
   Shared button styles
───────────────────────────────────────────── */
const btnBase = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, border: 'none', cursor: 'pointer', fontWeight: 700,
    transition: 'all 0.15s', borderRadius: 10,
};

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function SuperAdminUsers() {
    const { t } = useLanguage();
    const isSuperAdmin = localStorage.getItem('admin_role') === 'super_admin';
    const [searchParams, setSearchParams] = useSearchParams();

    /* state */
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [airportFilter, setAirportFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [verifFilter, setVerifFilter] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [reviewAdmin, setReviewAdmin] = useState(null);
    const [reviewDetail, setReviewDetail] = useState(null);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectedFields, setRejectedFields] = useState([]);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [workEmailStatus, setWorkEmailStatus] = useState(null);
    const [workEmailWarning, setWorkEmailWarning] = useState('');
    const [workEmailEdited, setWorkEmailEdited] = useState(false);
    const [dupState, setDupState] = useState('idle');
    const [dupInfo, setDupInfo] = useState(null);
    const [bypassDuplicate, setBypassDuplicate] = useState(false);
    const [toast, setToast] = useState(null);

    const nameRef = useRef(null);
    const emailRef = useRef(null);

    /* ── CSS injected once ── */
    useEffect(() => {
        const s = document.createElement('style');
        s.id = 'su-styles';
        if (!document.getElementById('su-styles')) {
            s.textContent = `
        @keyframes su-fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes su-slideUp { from{opacity:0;transform:translateY(14px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes su-spin    { to{transform:rotate(360deg)} }
        .su-spin { animation: su-spin 1s linear infinite; display:inline-flex; }
        .su-tr:hover td { background: rgba(255,255,255,0.018) !important; }
        .su-icon-btn:hover { background:rgba(255,255,255,0.07) !important; color:#d4d4d8 !important; }
        select option { background:#111118; }
        input::placeholder { color:#3f3f46; }
        textarea::placeholder { color:#3f3f46; }
        .su-input:focus { border-color:rgba(6,182,212,0.55) !important; box-shadow:0 0 0 3px rgba(6,182,212,0.1); }
      `;
            document.head.appendChild(s);
        }
        return () => { const el = document.getElementById('su-styles'); if (el) el.remove(); };
    }, []);

    /* ── Toast ── */
    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 5000);
    }, []);

    const airportLabel = iata => TUNISIAN_AIRPORTS.find(a => a.iata === iata)?.name || iata;

    /* ── Load admins ── */
    const fetchAdmins = useCallback(async () => {
        setLoading(true);
        const { data, error } = await apiListAdmins();
        setLoading(false);
        if (error) { showToast('error', `Could not load admins: ${error}`); return; }
        setUsers((data || []).map(u => ({
            id: u.id,
            name: u.full_name,
            email: u.email,
            personalEmail: u.personal_email || '',
            employeeId: u.employee_id || '',
            airport: u.airport_iata || '—',
            status: u.onboarding_active ? 'active' : 'inactive',
            profileComplete: !!u.profile_complete,
            verificationStatus: u.verification_status || 'pending_review',
            createdAt: u.created_at ? new Date(u.created_at).toLocaleDateString() : '—',
            lastLogin: u.last_login ? new Date(u.last_login).toLocaleDateString() : '—',
            initials: getInitials(u.full_name),
            gradient: pickGradient(u.id),
        })));
    }, [showToast]);

    useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

    /* ── Deep link ?review=id ── */
    const openReview = useCallback(async (user) => {
        setReviewAdmin(user);
        setReviewDetail(null);
        setRejectReason('');
        setRejectedFields([]);
        setReviewLoading(true);
        const { data, error } = await apiGetAdminReview(user.id);
        setReviewLoading(false);
        if (error) { showToast('error', error); setReviewAdmin(null); return; }
        setReviewDetail(data);
    }, [showToast]);

    useEffect(() => {
        const rid = searchParams.get('review');
        if (!rid || loading) return;
        const uid = parseInt(rid, 10);
        if (Number.isNaN(uid)) { setTimeout(() => setSearchParams({}, { replace: true }), 0); return; }
        const u = users.find(x => x.id === uid);
        if (u) setTimeout(() => { setSearchParams({}, { replace: true }); openReview(u); }, 0);
    }, [searchParams, users, loading, openReview, setSearchParams]);

    /* ── Filters / Stats ── */
    const filtered = useMemo(() =>
        users.filter(u => {
            const s = search.toLowerCase();
            return (
                (u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) ||
                    u.personalEmail.toLowerCase().includes(s) || u.airport.toLowerCase().includes(s) ||
                    String(u.employeeId).toLowerCase().includes(s)) &&
                (airportFilter === 'all' || u.airport === airportFilter) &&
                (statusFilter === 'all' || u.status === statusFilter) &&
                (verifFilter === 'all' || u.verificationStatus === verifFilter)
            );
        }),
        [users, search, airportFilter, statusFilter, verifFilter],
    );

    const stats = useMemo(() => ({
        total: users.length,
        verified: users.filter(u => u.verificationStatus === 'approved' || u.verificationStatus === 'verified').length,
        pending: users.filter(u => u.verificationStatus === 'pending_review' || u.verificationStatus === 'pending').length,
    }), [users]);

    /* ── Email helpers ── */
    const checkWorkEmail = useCallback((email) => {
        clearTimeout(emailRef.current);
        if (!email || !email.includes('@')) { setWorkEmailStatus(null); return; }
        setWorkEmailStatus('checking');
        emailRef.current = setTimeout(async () => {
            const { data } = await apiCheckEmail(email);
            setWorkEmailStatus(data?.available ? 'available' : 'taken');
        }, 500);
    }, []);

    const suggestWorkEmail = useCallback(async (name, airport) => {
        if (!name.trim() || !airport) return;
        setWorkEmailStatus('checking'); setWorkEmailWarning('');
        const { data, error } = await apiSuggestEmail(name, airport);
        if (error || !data) { setWorkEmailStatus(null); return; }
        const suggested = data.email;
        const primary = data.all_suggestions?.[0] || '';
        setForm(f => ({ ...f, workEmail: suggested }));
        if (data.is_fallback && primary && primary.toLowerCase() !== suggested.toLowerCase())
            setWorkEmailWarning(`${primary} is taken — using ${suggested}`);
        const { data: avail } = await apiCheckEmail(suggested);
        setWorkEmailStatus(avail?.available ? 'available' : 'taken');
    }, []);

    /* ── Duplicate check ── */
    const checkDuplicate = useCallback((name, airport) => {
        clearTimeout(nameRef.current);
        if (!name.trim() || name.length < 3) { setDupState('idle'); return; }
        setDupState('checking');
        nameRef.current = setTimeout(async () => {
            const { data } = await apiCheckDuplicate(name, airport);
            if (data?.duplicate) { setDupState('warning'); setDupInfo(data.existing); }
            else { setDupState('idle'); setDupInfo(null); }
        }, 500);
    }, []);

    /* ── Form handlers ── */
    function handleNameChange(name) {
        setForm(f => ({ ...f, name }));
        setWorkEmailEdited(false); setBypassDuplicate(false); setDupState('idle');
        checkDuplicate(name, form.airport);
        if (!workEmailEdited) suggestWorkEmail(name, form.airport);
    }
    function handleAirportChange(airport) {
        setForm(f => ({ ...f, airport }));
        if (!workEmailEdited && form.name.trim()) suggestWorkEmail(form.name, airport);
        checkDuplicate(form.name, airport);
    }
    function handleWorkEmailChange(workEmail) {
        setForm(f => ({ ...f, workEmail }));
        setWorkEmailEdited(true); setWorkEmailWarning('');
        checkWorkEmail(workEmail);
    }

    function openCreate() {
        setForm(EMPTY_FORM); setWorkEmailStatus(null); setWorkEmailWarning('');
        setWorkEmailEdited(false); setDupState('idle'); setDupInfo(null);
        setBypassDuplicate(false); setModalOpen(true);
    }
    function closeModal() { setModalOpen(false); setForm(EMPTY_FORM); setDupState('idle'); }

    /* ── Submit ── */
    async function handleSave(e) {
        e.preventDefault();
        if (!form.name.trim() || !form.airport || !form.workEmail.trim() || !form.personalEmail.trim()) return;
        if (!isValidEmail(form.personalEmail)) { showToast('error', 'Enter a valid personal email.'); return; }
        if (workEmailStatus === 'taken') { showToast('error', 'That work email is already in use.'); return; }
        if (dupState === 'warning' && !bypassDuplicate) return;
        setSaving(true);
        const { data, error } = await apiCreateAdmin({
            full_name: form.name.trim(), airport_iata: form.airport,
            work_email: form.workEmail.trim(), personal_email: form.personalEmail.trim(),
            bypass_duplicate: bypassDuplicate,
        });
        setSaving(false);
        if (error) { showToast('error', `Error: ${error}`); return; }
        showToast('success', `Admin created. Welcome email sent to ${form.personalEmail.trim()} (login: ${data.email}).`);
        await fetchAdmins(); closeModal();
    }

    /* ── Review submit ── */
    async function submitReview(action) {
        if (!reviewAdmin) return;
        if (action === 'reject') {
            if (!rejectedFields.length) { showToast('error', 'Select at least one incorrect field.'); return; }
            if (!rejectReason.trim()) { showToast('error', 'Please enter a rejection reason.'); return; }
        }
        setReviewSubmitting(true);
        const { error } = await apiPostIdReview(
            reviewAdmin.id, action,
            action === 'reject' ? rejectReason.trim() : undefined,
            action === 'reject' ? rejectedFields : [],
        );
        setReviewSubmitting(false);
        if (error) { showToast('error', error); return; }
        showToast('success', action === 'approve' ? 'ID approved.' : 'ID rejected; admin notified.');
        setReviewAdmin(null); setReviewDetail(null);
        await fetchAdmins();
    }

    /* ── Delete ── */
    async function handleDelete(user) {
        const { error } = await apiDeleteAdmin(user.id);
        if (error) showToast('error', `Failed to delete: ${error}`);
        else { setUsers(p => p.filter(u => u.id !== user.id)); showToast('success', `Admin '${user.name}' deleted.`); }
        setDeleteConfirm(null);
    }

    const personalOk = isValidEmail(form.personalEmail);
    const canSubmit = form.name.trim() && form.workEmail.trim() && form.personalEmail.trim() &&
        personalOk && workEmailStatus === 'available' &&
        dupState !== 'checking' && dupState !== 'warning' && !saving;

    /* ════════════════════════════════
       STYLES
    ════════════════════════════════ */
    const labelMono = {
        display: 'block', marginBottom: 6,
        fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.16em', color: '#52525b',
    };

    const selectStyle = {
        height: 32, padding: '0 12px', borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)', background: '#0d0d14',
        fontSize: 12, color: '#d4d4d8', outline: 'none', cursor: 'pointer',
    };

    const footerBtn = (primary, disabled) => ({
        ...btnBase,
        height: 36, padding: '0 18px', fontSize: 12,
        background: disabled ? 'rgba(255,255,255,0.05)'
            : primary ? '#06b6d4' : 'rgba(255,255,255,0.06)',
        color: disabled ? '#52525b' : primary ? '#000' : '#a1a1aa',
        border: primary ? 'none' : '1px solid rgba(255,255,255,0.1)',
        boxShadow: (!disabled && primary) ? '0 4px 20px rgba(6,182,212,0.3)' : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
    });

    /* ════════════════════════════════
       RENDER
    ════════════════════════════════ */
    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '32px 24px', color: '#f4f4f5' }}>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 9999,
                    padding: '12px 18px', borderRadius: 12, fontWeight: 600, fontSize: 13,
                    maxWidth: 420, backdropFilter: 'blur(12px)',
                    animation: 'su-fadeIn 0.2s ease',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    background: toast.type === 'success' ? 'rgba(5,46,22,0.92)' : 'rgba(69,10,10,0.92)',
                    color: toast.type === 'success' ? '#6ee7b7' : '#fca5a5',
                    border: toast.type === 'success' ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(248,113,113,0.3)',
                }}>
                    {toast.msg}
                </div>
            )}

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
                        Admin Management
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: '#52525b' }}>
                        Govern access, identity verification and account status
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    style={{ ...btnBase, height: 40, padding: '0 20px', fontSize: 14, borderRadius: 12, background: '#06b6d4', color: '#000', boxShadow: '0 4px 24px rgba(6,182,212,0.35)' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#22d3ee'}
                    onMouseLeave={e => e.currentTarget.style.background = '#06b6d4'}
                >
                    <UserPlus size={16} /> Create new admin
                </button>
            </div>

            {/* ── Stat Strip ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
                {[
                    { label: 'Total admins', value: stats.total, Icon: ShieldCheck, color: '#22d3ee', bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.18)' },
                    { label: 'Verified', value: stats.verified, Icon: CheckCircle2, color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.18)' },
                    { label: 'Pending review', value: stats.pending, Icon: Clock, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.18)' },
                ].map(s => (
                    <GlassCard key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20 }}>
                        <div>
                            <div style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#52525b' }}>
                                {s.label}
                            </div>
                            <div style={{ marginTop: 8, fontSize: 38, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                                {s.value}
                            </div>
                        </div>
                        <div style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', border: `1px solid ${s.border}`, background: s.bg, color: s.color }}>
                            <s.Icon size={20} />
                        </div>
                    </GlassCard>
                ))}
            </div>

            {/* ── Filter Bar + Table ── */}
            <GlassCard style={{ padding: 0 }}>

                {/* Filter bar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 20px' }}>
                    {/* Search */}
                    <div style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center', gap: 8 }}>
                        <Search size={14} style={{ color: '#52525b', flexShrink: 0 }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name, email, employee ID or airport..."
                            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#e4e4e7' }}
                        />
                    </div>

                    <Filter size={14} style={{ color: '#3f3f46' }} />

                    {/* Airport */}
                    <select value={airportFilter} onChange={e => setAirportFilter(e.target.value)} style={selectStyle}>
                        <option value="all">All airports</option>
                        {TUNISIAN_AIRPORTS.map(a => <option key={a.iata} value={a.iata}>{a.iata}</option>)}
                    </select>

                    {/* Verification */}
                    <select value={verifFilter} onChange={e => setVerifFilter(e.target.value)} style={selectStyle}>
                        <option value="all">All verifications</option>
                        <option value="approved">Verified</option>
                        <option value="pending_review">Pending</option>
                        <option value="under_review">Under Review</option>
                        <option value="rejected">Rejected</option>
                    </select>

                    {/* Status */}
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
                        <option value="all">All statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>

                    {/* Refresh */}
                    <button onClick={fetchAdmins} className="su-icon-btn" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#52525b', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'all 0.15s' }}>
                        <RefreshCw size={13} />
                    </button>

                    <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#3f3f46' }}>
                        {filtered.length} results
                    </span>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                {[
                                    { h: 'Admin', pl: 20, pr: 20, right: false },
                                    { h: 'Employee ID', pl: 12, pr: 12, right: false },
                                    { h: 'Airport', pl: 12, pr: 12, right: false },
                                    { h: 'Verification', pl: 12, pr: 12, right: false },
                                    { h: 'Status', pl: 12, pr: 12, right: false },
                                    { h: 'Created', pl: 12, pr: 12, right: false },
                                    { h: 'Actions', pl: 20, pr: 20, right: true },
                                ].map(col => (
                                    <th key={col.h} style={{ paddingLeft: col.pl, paddingRight: col.pr, paddingTop: 12, paddingBottom: 12, textAlign: col.right ? 'right' : 'left', fontSize: 10, fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#52525b' }}>
                                        {col.h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={7} style={{ padding: 48, textAlign: 'center', color: '#3f3f46', fontSize: 14 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                            <Loader size={18} className="su-spin" style={{ color: '#52525b' }} />
                                            Loading admins…
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {!loading && filtered.map(u => (
                                <tr key={u.id} className="su-tr" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>

                                    {/* Admin */}
                                    <td style={{ padding: '14px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: '#fff', background: u.gradient }}>
                                                {u.initials}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#f4f4f5' }}>{u.name}</div>
                                                <div style={{ fontSize: 11, color: '#71717a', marginTop: 1 }}>{u.email}</div>
                                                {u.personalEmail && (
                                                    <div style={{ fontSize: 10, color: '#3f3f46', marginTop: 1 }}>Personal: {u.personalEmail}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Employee ID */}
                                    <td style={{ padding: '14px 12px', fontFamily: 'monospace', fontSize: 12, color: '#71717a' }}>
                                        {u.employeeId || '—'}
                                    </td>

                                    {/* Airport */}
                                    <td style={{ padding: '14px 12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#d4d4d8' }}>
                                            <Building2 size={12} style={{ color: '#52525b' }} /> {u.airport}
                                        </div>
                                    </td>

                                    {/* Verification */}
                                    <td style={{ padding: '14px 12px' }}>
                                        <VerifBadge status={u.verificationStatus} profileComplete={u.profileComplete} />
                                    </td>

                                    {/* Status */}
                                    <td style={{ padding: '14px 12px' }}>
                                        <StatusBadge status={u.status} />
                                    </td>

                                    {/* Created */}
                                    <td style={{ padding: '14px 12px', fontSize: 12, color: '#71717a' }}>{u.createdAt}</td>

                                    {/* Actions */}
                                    <td style={{ padding: '14px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                            {u.profileComplete && (
                                                <button
                                                    onClick={() => openReview(u)}
                                                    style={{ ...btnBase, height: 28, padding: '0 10px', borderRadius: 8, fontSize: 10, border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(251,191,36,0.2)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(251,191,36,0.1)'}
                                                >
                                                    <Eye size={11} /> Review ID
                                                </button>
                                            )}
                                            <button className="su-icon-btn" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: '#52525b', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'all 0.15s' }}>
                                                <Mail size={13} />
                                            </button>
                                            {isSuperAdmin && (
                                                <button
                                                    onClick={() => setDeleteConfirm(u)}
                                                    className="su-icon-btn"
                                                    style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: '#52525b', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'all 0.15s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#f87171'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#52525b'; }}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                            <button className="su-icon-btn" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: '#52525b', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'all 0.15s' }}>
                                                <MoreHorizontal size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ padding: 48, textAlign: 'center', fontSize: 14, color: '#3f3f46' }}>
                                        No admins match your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            {/* ══════════════════════════════════════
          CREATE ADMIN MODAL
      ══════════════════════════════════════ */}
            <Modal show={modalOpen} onBackdropClick={closeModal} maxWidth="520px">
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#06b6d4', display: 'grid', placeItems: 'center', boxShadow: '0 4px 20px rgba(6,182,212,0.45)' }}>
                            <UserPlus size={18} color="#000" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, color: '#fff', fontSize: 16 }}>Create new admin</div>
                            <div style={{ fontSize: 12, color: '#52525b', marginTop: 2 }}>An access email will be sent to the generated address.</div>
                        </div>
                    </div>
                    <button onClick={closeModal} className="su-icon-btn" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: '#52525b', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                        <X size={15} />
                    </button>
                </div>

                <form onSubmit={handleSave}>
                    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Duplicate warning */}
                        {dupState === 'warning' && (
                            <div style={{ borderRadius: 12, border: '1px solid rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.07)', padding: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <AlertTriangle size={16} color="#fbbf24" />
                                    <span style={{ fontWeight: 700, color: '#fcd34d', fontSize: 14 }}>Possible Duplicate Detected</span>
                                </div>
                                <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                                    An admin named <strong style={{ color: '#fcd34d' }}>"{dupInfo?.full_name}"</strong> is already assigned to{' '}
                                    <strong>{airportLabel(dupInfo?.airport_iata)}</strong>.
                                    Created: {dupInfo?.created_at ? new Date(dupInfo.created_at).toLocaleDateString() : '—'}.
                                    <br />Are you sure this is a different person?
                                </p>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="button"
                                        style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.45)', background: 'rgba(251,191,36,0.12)', color: '#fcd34d', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
                                        onClick={() => { setBypassDuplicate(true); setDupState('bypassed'); suggestWorkEmail(form.name, form.airport); }}
                                    >Yes, different person</button>
                                    <button type="button"
                                        style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}
                                        onClick={closeModal}
                                    >Cancel</button>
                                </div>
                            </div>
                        )}

                        {bypassDuplicate && (
                            <div style={{ borderRadius: 8, border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.07)', padding: '8px 12px', fontSize: 12, color: '#6ee7b7' }}>
                                🪪 ID verification note will be added to the welcome email automatically.
                            </div>
                        )}

                        {/* Full Name */}
                        <Field
                            label="Full name"
                            placeholder="e.g. Ahmed Ben Salah"
                            required
                            value={form.name}
                            onChange={e => handleNameChange(e.target.value)}
                            disabled={dupState === 'warning'}
                            statusIcon={dupState === 'checking' ? <Loader size={13} className="su-spin" style={{ color: '#52525b' }} /> : null}
                        />

                        {/* Generated Email */}
                        <Field
                            label="Generated email"
                            placeholder="firstname.lastname@tun-airport.tn"
                            type="email"
                            required
                            value={form.workEmail}
                            onChange={e => handleWorkEmailChange(e.target.value)}
                            disabled={dupState === 'warning'}
                            borderColor={
                                workEmailStatus === 'taken' ? 'rgba(248,113,113,0.55)' :
                                    workEmailStatus === 'available' ? 'rgba(52,211,153,0.45)' : undefined
                            }
                            statusIcon={
                                workEmailStatus === 'checking' ? <Loader size={13} className="su-spin" style={{ color: '#52525b' }} /> :
                                    workEmailStatus === 'available' ? <CheckCircle size={14} color="#34d399" /> :
                                        workEmailStatus === 'taken' ? <XCircle size={14} color="#f87171" /> : null
                            }
                            hint={
                                <p style={{
                                    margin: 0, fontSize: 11, color:
                                        workEmailStatus === 'taken' ? '#f87171' :
                                            workEmailStatus === 'available' ? '#34d399' :
                                                workEmailWarning ? '#fbbf24' : '#52525b',
                                }}>
                                    {workEmailStatus === 'taken' ? 'This work email is already in use.' :
                                        workEmailStatus === 'available' ? 'Available for login' :
                                            workEmailWarning ? workEmailWarning :
                                                'Generated automatically from the full name.'}
                                </p>
                            }
                        />

                        {/* ── Personal Email (NEW) ── */}
                        <Field
                            label="Personal email"
                            placeholder="e.g. ahmed.bensalah@gmail.com"
                            type="email"
                            required
                            value={form.personalEmail}
                            onChange={e => setForm(f => ({ ...f, personalEmail: e.target.value }))}
                            disabled={dupState === 'warning'}
                            borderColor={
                                form.personalEmail && !personalOk ? 'rgba(248,113,113,0.55)' :
                                    form.personalEmail && personalOk ? 'rgba(52,211,153,0.45)' : undefined
                            }
                            statusIcon={
                                form.personalEmail && !personalOk ? <XCircle size={14} color="#f87171" /> :
                                    form.personalEmail && personalOk ? <CheckCircle size={14} color="#34d399" /> : null
                            }
                            hint={
                                <p style={{ margin: 0, fontSize: 11, color: form.personalEmail && !personalOk ? '#f87171' : '#52525b' }}>
                                    {form.personalEmail && !personalOk
                                        ? 'Enter a valid personal email.'
                                        : 'Welcome email & credentials will be sent here.'}
                                </p>
                            }
                        />

                        {/* Airport */}
                        <div>
                            <span style={labelMono}>Airport</span>
                            <select
                                value={form.airport}
                                onChange={e => handleAirportChange(e.target.value)}
                                disabled={dupState === 'warning'}
                                style={{ height: 40, width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: '#0d0d14', padding: '0 12px', fontSize: 14, color: '#e4e4e7', outline: 'none', opacity: dupState === 'warning' ? 0.45 : 1, cursor: 'pointer' }}
                            >
                                {TUNISIAN_AIRPORTS.map(a => (
                                    <option key={a.iata} value={a.iata}>{a.name} ({a.iata})</option>
                                ))}
                            </select>
                        </div>

                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px' }}>
                        <button type="button" onClick={closeModal} style={footerBtn(false, false)}>Cancel</button>
                        <button type="submit" disabled={!canSubmit} style={footerBtn(true, !canSubmit)}>
                            {saving ? <><Loader size={13} className="su-spin" /> Creating…</> : <><Mail size={13} /> Send email</>}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* ══════════════════════════════════════
          ID REVIEW MODAL
      ══════════════════════════════════════ */}
            <Modal show={!!reviewAdmin} onBackdropClick={() => !reviewSubmitting && setReviewAdmin(null)} maxWidth="720px">
                <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.12)' }}>
                                <IdCard size={18} color="#fbbf24" />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, color: '#fff', fontSize: 16 }}>Review: {reviewAdmin?.name}</div>
                                <div style={{ fontSize: 12, color: '#52525b', marginTop: 2 }}>{reviewAdmin?.email} · {airportLabel(reviewAdmin?.airport)}</div>
                            </div>
                        </div>
                        <button disabled={reviewSubmitting} onClick={() => setReviewAdmin(null)} className="su-icon-btn" style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: '#52525b', cursor: 'pointer', display: 'grid', placeItems: 'center', opacity: reviewSubmitting ? 0.4 : 1 }}>
                            <X size={15} />
                        </button>
                    </div>

                    {/* Body */}
                    <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
                        {reviewLoading && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#52525b' }}>
                                <Loader size={14} className="su-spin" /> Loading…
                            </div>
                        )}
                        {reviewDetail && !reviewLoading && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {/* Profile info */}
                                <div>
                                    <div style={{ marginBottom: 12, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#22d3ee' }}>
                                        Profile Information
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                        {[
                                            { label: 'Full name', value: reviewDetail.full_name },
                                            { label: 'Personal email', value: reviewDetail.personal_email },
                                            { label: 'Phone', value: reviewDetail.phone_number },
                                            { label: 'Date of birth', value: reviewDetail.date_of_birth ? String(reviewDetail.date_of_birth).slice(0, 10) : null },
                                            { label: 'Nationality', value: reviewDetail.nationality },
                                            { label: 'Gender', value: reviewDetail.gender },
                                            { label: 'CIN number', value: reviewDetail.cin_number, mono: true },
                                            { label: 'Passport number', value: reviewDetail.passport_number, mono: true },
                                            { label: 'Passport expiry', value: reviewDetail.passport_expiry_date ? String(reviewDetail.passport_expiry_date).slice(0, 10) : null },
                                            { label: 'Employee ID', value: reviewDetail.employee_id, mono: true },
                                            { label: 'Address', value: reviewDetail.residential_address, span: true },
                                            { label: 'Emergency name', value: reviewDetail.emergency_contact_name },
                                            { label: 'Emergency phone', value: reviewDetail.emergency_contact_phone },
                                            { label: 'Emergency rel.', value: reviewDetail.emergency_contact_relationship },
                                        ].map(f => (
                                            <div key={f.label} style={{ gridColumn: f.span ? '1 / -1' : undefined, borderRadius: 10, background: 'rgba(255,255,255,0.025)', padding: 12 }}>
                                                <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3f3f46', marginBottom: 4 }}>{f.label}</div>
                                                <div style={{ fontSize: 12, color: '#d4d4d8', fontFamily: f.mono ? 'monospace' : undefined }}>{f.value || '—'}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Profile photo */}
                                {reviewDetail.profile_photo_url && (
                                    <div>
                                        <div style={{ marginBottom: 8, fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3f3f46' }}>Profile Photo</div>
                                        <img src={reviewDetail.profile_photo_url} alt="" style={{ height: 96, borderRadius: 10, objectFit: 'cover' }} />
                                    </div>
                                )}

                                {/* Documents */}
                                {[
                                    { label: 'CIN Document', url: reviewDetail.cin_document_url },
                                    { label: 'Passport Document', url: reviewDetail.passport_document_url },
                                ].map(doc => (
                                    <div key={doc.label}>
                                        <div style={{ marginBottom: 8, fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3f3f46' }}>{doc.label}</div>
                                        {doc.url
                                            ? doc.url.startsWith('data:application/pdf')
                                                ? <iframe title={doc.label} src={doc.url} style={{ width: '100%', height: 260, border: 'none', borderRadius: 10, background: '#fff' }} />
                                                : <img src={doc.url} alt={doc.label} style={{ maxWidth: '100%', borderRadius: 10 }} />
                                            : <span style={{ fontSize: 12, color: '#3f3f46' }}>No document on file.</span>
                                        }
                                    </div>
                                ))}

                                {/* Rejection fields */}
                                <div style={{ borderRadius: 12, border: '1px solid rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.04)', padding: 16 }}>
                                    <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#fcd34d', marginBottom: 12 }}>
                                        Select Incorrect Fields (required if rejecting)
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                                        {[
                                            { key: 'full_name', label: 'Full Name' },
                                            { key: 'date_of_birth', label: 'Date of Birth' },
                                            { key: 'gender', label: 'Gender' },
                                            { key: 'nationality', label: 'Nationality' },
                                            { key: 'cin_number', label: 'CIN Number' },
                                            { key: 'cin_document_url', label: 'CIN Document' },
                                            { key: 'passport_number', label: 'Passport Number' },
                                            { key: 'passport_expiry_date', label: 'Passport Expiry' },
                                            { key: 'passport_document_url', label: 'Passport Document' },
                                            { key: 'residential_address', label: 'Residential Address' },
                                            { key: 'emergency_contact_name', label: 'Emergency Name' },
                                            { key: 'emergency_contact_phone', label: 'Emergency Phone' },
                                        ].map(opt => (
                                            <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#a1a1aa', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    style={{ accentColor: '#fbbf24' }}
                                                    checked={rejectedFields.includes(opt.key)}
                                                    onChange={e => {
                                                        if (e.target.checked) setRejectedFields(p => [...p, opt.key]);
                                                        else setRejectedFields(p => p.filter(k => k !== opt.key));
                                                    }}
                                                />
                                                {opt.label}
                                            </label>
                                        ))}
                                    </div>
                                    <div style={{ marginBottom: 6, fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#52525b' }}>
                                        Rejection notes (required if rejecting)
                                    </div>
                                    <textarea
                                        style={{ width: '100%', minHeight: 72, boxSizing: 'border-box', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', padding: '10px 12px', fontSize: 12, color: '#e4e4e7', outline: 'none', resize: 'vertical' }}
                                        value={rejectReason}
                                        onChange={e => setRejectReason(e.target.value)}
                                        placeholder="Explain what is wrong with the selected fields…"
                                    />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#52525b' }}>
                                    <ShieldAlert size={12} /> Cross-check with HR records before approving.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px', flexShrink: 0 }}>
                        <button type="button" disabled={reviewSubmitting} onClick={() => setReviewAdmin(null)} style={{ ...footerBtn(false, reviewSubmitting) }}>Close</button>
                        <button type="button" disabled={reviewSubmitting || reviewLoading || !reviewDetail} onClick={() => submitReview('reject')}
                            style={{ ...btnBase, height: 36, padding: '0 18px', fontSize: 12, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', opacity: (reviewSubmitting || reviewLoading || !reviewDetail) ? 0.4 : 1, cursor: (reviewSubmitting || reviewLoading || !reviewDetail) ? 'not-allowed' : 'pointer' }}>
                            Reject
                        </button>
                        <button type="button" disabled={reviewSubmitting || reviewLoading || !reviewDetail} onClick={() => submitReview('approve')}
                            style={{ ...btnBase, height: 36, padding: '0 18px', fontSize: 12, background: '#22c55e', color: '#000', boxShadow: '0 4px 16px rgba(34,197,94,0.3)', opacity: (reviewSubmitting || reviewLoading || !reviewDetail) ? 0.4 : 1, cursor: (reviewSubmitting || reviewLoading || !reviewDetail) ? 'not-allowed' : 'pointer' }}>
                            Approve verification
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ══════════════════════════════════════
          DELETE CONFIRM MODAL
      ══════════════════════════════════════ */}
            <Modal show={!!deleteConfirm} onBackdropClick={() => setDeleteConfirm(null)} maxWidth="400px">
                <div style={{ padding: '24px 24px 0' }}>
                    <h3 style={{ margin: '0 0 8px', fontWeight: 700, color: '#fff', fontSize: 16 }}>Delete admin?</h3>
                    <p style={{ margin: 0, fontSize: 14, color: '#71717a', lineHeight: 1.5 }}>
                        This will permanently remove{' '}
                        <strong style={{ color: '#d4d4d8' }}>{deleteConfirm?.name}</strong> and cannot be undone.
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', padding: 16, marginTop: 20 }}>
                    <button onClick={() => setDeleteConfirm(null)} style={footerBtn(false, false)}>Cancel</button>
                    <button onClick={() => handleDelete(deleteConfirm)}
                        style={{ ...btnBase, height: 36, padding: '0 18px', fontSize: 12, background: '#ef4444', color: '#fff', boxShadow: '0 4px 16px rgba(239,68,68,0.3)' }}>
                        Delete
                    </button>
                </div>
            </Modal>

        </div>
    );
}
/**
 * SuperAdminUsers — Phase 1: Fully redesigned Create Admin modal
 * - Live email suggestions with availability checking (debounced)
 * - Duplicate name detection with bypass flow
 * - Audit trail via backend on bypass
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Users, Plus, Search, Trash2, X,
    Building2, Mail, CheckCircle, XCircle, AlertTriangle,
    RefreshCw, User, AtSign, Loader
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { TUNISIAN_AIRPORTS } from '../../context/AirportContext';
import {
    apiListAdmins, apiCreateAdmin, apiDeleteAdmin,
    apiCheckEmail, apiSuggestEmail, apiCheckDuplicate,
    apiGetAdminReview, apiPostIdReview,
} from '../../services/adminApi';
import CustomSelect from '../../components/ui/CustomSelect';

/* ── Small helpers ──────────────────────────────────────────── */
function StatusBadge({ status }) {
    if (status === 'active') return <span className="users-badge users-badge--active"><CheckCircle size={12} /> Active</span>;
    return <span className="users-badge users-badge--inactive"><XCircle size={12} /> Inactive</span>;
}

function VerificationBadge({ verificationStatus, profileComplete }) {
    if (!profileComplete) {
        return <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>—</span>;
    }
    if (verificationStatus === 'approved') return <span style={{ fontSize: '0.78rem' }}>🟢 Approved</span>;
    if (verificationStatus === 'rejected') return <span style={{ fontSize: '0.78rem' }}>🔴 Rejected</span>;
    if (verificationStatus === 'under_review') return <span style={{ fontSize: '0.78rem' }}>🟠 Under Review</span>;
    return <span style={{ fontSize: '0.78rem' }}>🟡 Pending Review</span>;
}

function verificationStatusFromReview(d) {
    if (!d) return 'pending_review';
    if (d.correction_request?.status === 'pending') return 'under_review';
    const st = d.id_document_status;
    if (st === 'approved') return 'approved';
    if (st === 'rejected') return 'rejected';
    return 'pending_review';
}

const EMPTY_FORM = { name: '', airport: 'TUN', personalEmail: '', workEmail: '' };

function isValidPersonalEmail(s) {
    const t = (s || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export default function SuperAdminUsers() {
    const { t } = useLanguage();
    const isSuperAdmin = localStorage.getItem('admin_role') === 'super_admin';
    const [searchParams, setSearchParams] = useSearchParams();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [airportFilter, setAirportFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [verificationFilter, setVerificationFilter] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const [reviewAdmin, setReviewAdmin] = useState(null);
    const [reviewDetail, setReviewDetail] = useState(null);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectedFields, setRejectedFields] = useState([]);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);

    // Work (login) email — auto-suggest + uniqueness
    const [workEmailStatus, setWorkEmailStatus] = useState(null);
    const [workEmailWarning, setWorkEmailWarning] = useState('');
    const [workEmailEdited, setWorkEmailEdited] = useState(false);

    // Duplicate detection state
    const [dupState, setDupState] = useState('idle'); // 'idle' | 'checking' | 'warning' | 'bypassed'
    const [dupInfo, setDupInfo] = useState(null);
    const [bypassDuplicate, setBypassDuplicate] = useState(false);

    const nameDebounceRef = useRef(null);
    const emailDebounceRef = useRef(null);

    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 5000);
    }, []);

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
            idDocumentStatus: u.id_document_status || null,
            verificationStatus: u.verification_status || 'pending_review',
            createdAt: u.created_at ? new Date(u.created_at).toLocaleDateString() : '—',
            lastLogin: u.last_login ? new Date(u.last_login).toLocaleDateString() : '—',
        })));
    }, [showToast]);

    const openReview = useCallback(async (user) => {
        setReviewAdmin(user);
        setReviewDetail(null);
        setRejectReason('');
        setRejectedFields([]);
        setReviewLoading(true);
        const { data, error } = await apiGetAdminReview(user.id);
        setReviewLoading(false);
        if (error) {
            showToast('error', error);
            setReviewAdmin(null);
            return;
        }
        setReviewDetail(data);
    }, [showToast]);

    /* ── Load admins ── */
    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled) fetchAdmins();
        });
        return () => { cancelled = true; };
    }, [fetchAdmins]);

    /* ── Deep link: ?review=adminId (from notification bell) ── */
    useEffect(() => {
        const rid = searchParams.get('review');
        if (!rid) return;
        if (loading) return;
        const uid = parseInt(rid, 10);
        if (Number.isNaN(uid)) {
            setSearchParams({}, { replace: true });
            return;
        }
        const u = users.find((x) => x.id === uid);
        setSearchParams({}, { replace: true });
        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled && u) openReview(u);
        });
        return () => { cancelled = true; };
    }, [searchParams, users, loading, openReview, setSearchParams]);

    /* ── Filtered / stats ── */
    const filtered = useMemo(() => users.filter(u => {
        const matchSearch = u.name.toLowerCase().includes(search.toLowerCase())
            || u.email.toLowerCase().includes(search.toLowerCase())
            || (u.personalEmail && u.personalEmail.toLowerCase().includes(search.toLowerCase()))
            || u.airport.toLowerCase().includes(search.toLowerCase())
            || (u.employeeId && String(u.employeeId).toLowerCase().includes(search.toLowerCase()));
        const matchAirport = airportFilter === 'all' || u.airport === airportFilter;
        const matchStatus = statusFilter === 'all' || u.status === statusFilter;
        const matchVerification =
            verificationFilter === 'all' || u.verificationStatus === verificationFilter;
        return matchSearch && matchAirport && matchStatus && matchVerification;
    }), [users, search, airportFilter, statusFilter, verificationFilter]);

    const stats = useMemo(() => ({
        total: users.length,
        active: users.filter(u => u.status === 'active').length,
        inactive: users.filter(u => u.status === 'inactive').length,
    }), [users]);

    const checkWorkEmailAvailability = useCallback((email) => {
        clearTimeout(emailDebounceRef.current);
        if (!email || !email.includes('@')) { setWorkEmailStatus(null); return; }
        setWorkEmailStatus('checking');
        emailDebounceRef.current = setTimeout(async () => {
            const { data } = await apiCheckEmail(email);
            setWorkEmailStatus(data?.available ? 'available' : 'taken');
        }, 500);
    }, []);

    const suggestWorkEmail = useCallback(async (name, airport) => {
        if (!name.trim() || !airport) return;
        setWorkEmailStatus('checking');
        setWorkEmailWarning('');
        const { data, error } = await apiSuggestEmail(name, airport);
        if (error || !data) { setWorkEmailStatus(null); return; }
        const suggested = data.email;
        const primary = (data.all_suggestions && data.all_suggestions[0]) || '';
        setForm(f => ({ ...f, workEmail: suggested }));
        if (data.is_fallback && primary && primary.toLowerCase() !== suggested.toLowerCase()) {
            setWorkEmailWarning(`${primary} is taken — using ${suggested}`);
        }
        const { data: avail } = await apiCheckEmail(suggested);
        setWorkEmailStatus(avail?.available ? 'available' : 'taken');
    }, []);

    /* ── Duplicate name check (debounced) ── */
    const checkDuplicate = useCallback((name, airport) => {
        clearTimeout(nameDebounceRef.current);
        if (!name.trim() || name.length < 3) { setDupState('idle'); return; }
        setDupState('checking');
        nameDebounceRef.current = setTimeout(async () => {
            const { data } = await apiCheckDuplicate(name, airport);
            if (data?.duplicate) {
                setDupState('warning');
                setDupInfo(data.existing);
            } else {
                setDupState('idle');
                setDupInfo(null);
            }
        }, 500);
    }, []);

    /* ── Form field handlers ── */
    function handleNameChange(name) {
        setForm(f => ({ ...f, name }));
        setWorkEmailEdited(false);
        setBypassDuplicate(false);
        setDupState('idle');
        checkDuplicate(name, form.airport);
        if (!workEmailEdited) suggestWorkEmail(name, form.airport);
    }

    function handleAirportChange(airport) {
        setForm(f => ({ ...f, airport }));
        if (!workEmailEdited && form.name.trim()) suggestWorkEmail(form.name, airport);
        checkDuplicate(form.name, airport);
    }

    function handlePersonalEmailChange(personalEmail) {
        setForm(f => ({ ...f, personalEmail }));
    }

    function handleWorkEmailChange(workEmail) {
        setForm(f => ({ ...f, workEmail }));
        setWorkEmailEdited(true);
        setWorkEmailWarning('');
        checkWorkEmailAvailability(workEmail);
    }

    /* ── Modal open/close ── */
    function openCreate() {
        setForm(EMPTY_FORM);
        setWorkEmailStatus(null);
        setWorkEmailWarning('');
        setWorkEmailEdited(false);
        setDupState('idle');
        setDupInfo(null);
        setBypassDuplicate(false);
        setModalOpen(true);
    }
    function closeModal() { setModalOpen(false); setForm(EMPTY_FORM); setDupState('idle'); }

    /* ── Submit ── */
    async function handleSave(e) {
        e.preventDefault();
        if (!form.name.trim() || !form.airport || !form.workEmail.trim() || !form.personalEmail.trim()) return;
        if (!isValidPersonalEmail(form.personalEmail)) { showToast('error', 'Enter a valid personal email.'); return; }
        if (workEmailStatus === 'taken') { showToast('error', 'That work email is already in use.'); return; }
        if (dupState === 'warning' && !bypassDuplicate) return;

        setSaving(true);
        const { data, error } = await apiCreateAdmin({
            full_name: form.name.trim(),
            airport_iata: form.airport,
            work_email: form.workEmail.trim(),
            personal_email: form.personalEmail.trim(),
            bypass_duplicate: bypassDuplicate,
        });
        setSaving(false);

        if (error) { showToast('error', `Error: ${error}`); return; }
        showToast('success', `Admin created. Welcome email sent to ${form.personalEmail.trim()} (login: ${data.email}).`);
        await fetchAdmins();
        closeModal();
    }

    async function submitReview(action) {
        if (!reviewAdmin) return;
        if (action === 'reject') {
            const r = rejectReason.trim();
            if (!rejectedFields.length) {
                showToast('error', 'Select at least one incorrect field.');
                return;
            }
            if (!r) {
                showToast('error', 'Please enter a rejection reason.');
                return;
            }
        }
        setReviewSubmitting(true);
        const { error } = await apiPostIdReview(
            reviewAdmin.id,
            action === 'approve' ? 'approve' : 'reject',
            action === 'reject' ? rejectReason.trim() : undefined,
            action === 'reject' ? rejectedFields : [],
        );
        setReviewSubmitting(false);
        if (error) {
            showToast('error', error);
            return;
        }
        showToast('success', action === 'approve' ? 'ID approved.' : 'ID rejected; admin notified.');
        setReviewAdmin(null);
        setReviewDetail(null);
        await fetchAdmins();
    }

    async function handleDelete(user) {
        const { error } = await apiDeleteAdmin(user.id);
        if (error) showToast('error', `Failed to delete admin: ${error}`);
        else {
            setUsers(prev => prev.filter(u => u.id !== user.id));
            showToast('success', `Admin '${user.name}' deleted successfully.`);
        }
        setDeleteConfirm(null);
    }

    const airportName = iata => TUNISIAN_AIRPORTS.find(a => a.iata === iata)?.name || iata;

    const personalOk = isValidPersonalEmail(form.personalEmail);
    const canSubmit = form.name.trim() && form.workEmail.trim() && form.personalEmail.trim() &&
        personalOk &&
        workEmailStatus === 'available' &&
        dupState !== 'checking' &&
        dupState !== 'warning' &&
        (dupState === 'idle' || dupState === 'bypassed') &&
        !saving;

    return (
        <div className="admin-page">
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 9999,
                    padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: '0.85rem',
                    background: toast.type === 'success' ? '#064E3B' : '#7F1D1D',
                    color: toast.type === 'success' ? '#6EE7B7' : '#FCA5A5',
                    border: `1px solid ${toast.type === 'success' ? '#065F46' : '#991B1B'}`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)', maxWidth: 420,
                }}>{toast.msg}</div>
            )}

            {/* Header */}
            <div className="admin-page__header">
                <div>
                    <h1 className="admin-page__title">{t('admin_users_title')}</h1>
                    <p className="admin-page__subtitle">{t('admin_users_subtitle')}</p>
                </div>
                <button className="admin-btn admin-btn--primary users-add-btn" onClick={openCreate}>
                    <Plus size={16} /> {t('admin_users_add')}
                </button>
            </div>

            {/* Stats */}
            <div className="users-stats">
                <div className="users-stat-card"><Users size={22} className="users-stat-icon" /><div><div className="users-stat-value">{stats.total}</div><div className="users-stat-label">{t('admin_users_total')}</div></div></div>
                <div className="users-stat-card users-stat-card--green"><CheckCircle size={22} className="users-stat-icon" /><div><div className="users-stat-value">{stats.active}</div><div className="users-stat-label">{t('admin_users_active')}</div></div></div>
                <div className="users-stat-card users-stat-card--red"><XCircle size={22} className="users-stat-icon" /><div><div className="users-stat-value">{stats.inactive}</div><div className="users-stat-label">{t('admin_users_inactive')}</div></div></div>
            </div>

            {/* Filters */}
            <div className="admin-card users-filters">
                <div className="users-filters__search">
                    <Search size={16} className="users-filters__search-icon" />
                    <input className="users-filters__search-input" placeholder={t('admin_users_search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="users-filters__selects">
                    <CustomSelect
                        options={[{ value: 'all', label: 'All Airports' }, ...TUNISIAN_AIRPORTS.map(a => ({ value: a.iata, label: `${a.name} (${a.iata})` }))]}
                        value={airportFilter}
                        onChange={setAirportFilter}
                    />
                    <CustomSelect
                        options={[
                            { value: 'all', label: t('admin_users_all_statuses') },
                            { value: 'active', label: t('admin_users_status_active') },
                            { value: 'inactive', label: t('admin_users_status_inactive') },
                        ]}
                        value={statusFilter}
                        onChange={setStatusFilter}
                    />
                    <CustomSelect
                        options={[
                            { value: 'all', label: 'All Verifications' },
                            { value: 'approved', label: 'Approved' },
                            { value: 'pending_review', label: 'Pending Review' },
                            { value: 'under_review', label: 'Under Review' },
                            { value: 'rejected', label: 'Rejected' },
                        ]}
                        value={verificationFilter}
                        onChange={setVerificationFilter}
                    />
                </div>
                <span className="users-filters__count">{filtered.length} {t('admin_users_found')}</span>
            </div>

            {/* Table */}
            <div className="admin-table-wrap">
                <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                        <thead><tr>
                            <th>{t('admin_users_col_name')}</th>
                            <th>Employee ID</th>
                            <th>{t('admin_users_col_email')}</th>
                            <th>{t('admin_users_col_airport')}</th>
                            <th>{t('admin_users_col_status')}</th>
                            <th>Verification</th>
                            <th>{t('admin_users_col_last_login')}</th>
                            <th>{t('admin_users_col_created')}</th>
                            <th>{t('admin_users_col_actions')}</th>
                        </tr></thead>
                        <tbody>
                            {loading && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.3)' }}>Loading admins…</td></tr>}
                            {!loading && filtered.map(user => (
                                <tr key={user.id}>
                                    <td><div className="users-name-cell"><div className="users-avatar">{user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div><span style={{ fontWeight: 500 }}>{user.name}</span></div></td>
                                    <td className="admin-table__muted" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{user.employeeId || '—'}</td>
                                    <td className="admin-table__muted">
                                        <div style={{ fontWeight: 500, color: 'rgba(255,255,255,0.88)' }}>{user.email}</div>
                                        {user.personalEmail ? (
                                            <div style={{ fontSize: '0.75rem', marginTop: 3, color: 'rgba(255,255,255,0.38)' }}>Personal: {user.personalEmail}</div>
                                        ) : null}
                                    </td>
                                    <td><div className="users-airport-cell"><Building2 size={13} /><span>{airportName(user.airport)}</span></div></td>
                                    <td><StatusBadge status={user.status} /></td>
                                    <td>
                                        <VerificationBadge verificationStatus={user.verificationStatus} profileComplete={user.profileComplete} />
                                    </td>
                                    <td className="admin-table__muted">{user.lastLogin}</td>
                                    <td className="admin-table__muted">{user.createdAt}</td>
                                    <td>
                                        <div className="users-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {user.profileComplete ? (
                                                <button
                                                    type="button"
                                                    className="users-action-btn"
                                                    style={{ fontSize: '0.72rem', padding: '6px 8px' }}
                                                    onClick={() => openReview(user)}
                                                >
                                                    Review
                                                </button>
                                            ) : null}
                                            {isSuperAdmin && (
                                                <button
                                                    className="users-action-btn users-action-btn--delete"
                                                    onClick={() => setDeleteConfirm(user)}
                                                    title="Delete admin"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loading && filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.3)' }}>{t('admin_users_no_results')}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Create Admin Modal ── */}
            {modalOpen && (
                <div className="admin-modal-backdrop" onClick={closeModal}>
                    <div className="admin-modal users-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540, width: '95vw' }}>
                        <div className="admin-modal__header">
                            <div>
                                <h2 style={{ margin: 0 }}>Create New Admin</h2>
                            </div>
                            <button className="admin-modal__close" onClick={closeModal}><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="admin-modal__body">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                                    {/* ── Duplicate Warning Card ── */}
                                    {dupState === 'warning' && (
                                        <div style={{
                                            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)',
                                            borderRadius: 12, padding: '14px 16px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <AlertTriangle size={18} color="#F59E0B" />
                                                <span style={{ fontWeight: 700, color: '#FCD34D', fontSize: '0.9rem' }}>Possible Duplicate Detected</span>
                                            </div>
                                            <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                                                An admin named <strong style={{ color: '#FCD34D' }}>&quot;{dupInfo?.full_name}&quot;</strong> is already assigned to{' '}
                                                <strong>{airportName(dupInfo?.airport_iata)}</strong>.{' '}
                                                Created on: {dupInfo?.created_at ? new Date(dupInfo.created_at).toLocaleDateString() : '—'}.<br />
                                                Are you sure this is a different person?
                                            </p>
                                            <div style={{ display: 'flex', gap: 10 }}>
                                                <button type="button"
                                                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.5)', color: '#FCD34D', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}
                                                    onClick={() => { setBypassDuplicate(true); setDupState('bypassed'); suggestWorkEmail(form.name, form.airport); }}>
                                                    Yes, this is a different person
                                                </button>
                                                <button type="button"
                                                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#FCA5A5', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}
                                                    onClick={closeModal}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {bypassDuplicate && (
                                        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', color: '#86EFAC' }}>
                                            🪪 ID verification note will be added to the welcome email automatically.
                                        </div>
                                    )}

                                    {/* ── Full Name ── */}
                                    <div className="admin-login__field">
                                        <label style={labelStyle}>Full Name</label>
                                        <div className="users-input-wrap" style={{ marginTop: 6, position: 'relative' }}>
                                            <User size={16} className="users-input-icon" />
                                            <input
                                                className="admin-form-input users-input-padded"
                                                required
                                                value={form.name}
                                                placeholder="e.g. Ahmed Ben Salah"
                                                onChange={e => handleNameChange(e.target.value)}
                                                disabled={dupState === 'warning'}
                                            />
                                            {dupState === 'checking' && <Loader size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite', color: 'rgba(255,255,255,0.3)' }} />}
                                        </div>
                                    </div>

                                    {/* ── Assigned Airport ── */}
                                    <div className="admin-login__field">
                                        <label style={labelStyle}>Assigned Airport</label>
                                        <div style={{ marginTop: 6 }}>
                                            <CustomSelect
                                                options={TUNISIAN_AIRPORTS.map(a => ({ value: a.iata, label: `${a.name} (${a.iata})` }))}
                                                value={form.airport}
                                                onChange={(val) => handleAirportChange(val)}
                                                disabled={dupState === 'warning'}
                                            />
                                        </div>
                                    </div>

                                    {/* ── Personal email: welcome + credentials only; no auto-suggest ── */}
                                    <div className="admin-login__field">
                                        <label style={labelStyle}>Personal email</label>
                                        <div style={{ marginTop: 8, position: 'relative' }}>
                                            <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                                            <input
                                                className="admin-form-input"
                                                style={{
                                                    paddingLeft: 36,
                                                    borderColor: form.personalEmail && !personalOk ? 'rgba(239,68,68,0.55)' : undefined,
                                                }}
                                                required
                                                type="email"
                                                autoComplete="off"
                                                value={form.personalEmail}
                                                placeholder="e.g. ahmed.bensalah@gmail.com"
                                                onChange={e => handlePersonalEmailChange(e.target.value)}
                                                disabled={dupState === 'warning'}
                                            />
                                        </div>
                                        {form.personalEmail && !personalOk && (
                                            <p style={{ margin: '5px 0 0', fontSize: '0.75rem', color: '#f87171' }}>Enter a valid personal email.</p>
                                        )}
                                    </div>

                                    {/* ── Work email: login; firstname.lastname@[code]-airport.tn + uniqueness ── */}
                                    <div className="admin-login__field">
                                        <label style={labelStyle}>
                                            Work email (auto-suggested)
                                        </label>
                                        <div style={{ marginTop: 8, position: 'relative' }}>
                                            <AtSign size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                                            <input
                                                className="admin-form-input"
                                                style={{
                                                    paddingLeft: 36, paddingRight: 36,
                                                    borderColor: workEmailStatus === 'taken' ? 'rgba(239,68,68,0.6)'
                                                        : workEmailStatus === 'available' ? 'rgba(34,197,94,0.4)' : undefined,
                                                }}
                                                required
                                                type="email"
                                                value={form.workEmail}
                                                placeholder="firstname.lastname@tun-airport.tn"
                                                onChange={e => handleWorkEmailChange(e.target.value)}
                                                disabled={dupState === 'warning'}
                                            />
                                            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                                                {workEmailStatus === 'checking' && <Loader size={14} style={{ animation: 'spin 1s linear infinite', color: 'rgba(255,255,255,0.3)' }} />}
                                                {workEmailStatus === 'available' && <CheckCircle size={15} color="#4ade80" />}
                                                {workEmailStatus === 'taken' && <XCircle size={15} color="#f87171" />}
                                            </div>
                                        </div>
                                        {workEmailWarning && workEmailStatus !== 'taken' && (
                                            <p style={{ margin: '5px 0 0', fontSize: '0.75rem', color: '#FCD34D' }}>{workEmailWarning}</p>
                                        )}
                                        {workEmailStatus === 'taken' && (
                                            <p style={{ margin: '5px 0 0', fontSize: '0.75rem', color: '#f87171' }}>
                                                This work email is already in use.
                                            </p>
                                        )}
                                        {workEmailStatus === 'available' && (
                                            <p style={{ margin: '5px 0 0', fontSize: '0.75rem', color: '#4ade80' }}>Available for login</p>
                                        )}
                                    </div>

                                    
                                </div>
                            </div>

                            <div className="admin-modal__footer">
                                <button type="button" className="admin-btn admin-btn--outline" onClick={closeModal}>Cancel</button>
                                <button
                                    type="submit"
                                    className="admin-btn admin-btn--primary"
                                    disabled={!canSubmit}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: canSubmit ? 1 : 0.5 }}
                                >
                                    {saving ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Creating…</> : '📧 Create & Send Email'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── ID review panel ── */}
            {reviewAdmin && (
                <div className="admin-modal-backdrop" onClick={() => !reviewSubmitting && setReviewAdmin(null)}>
                    <div className="admin-modal users-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, width: '96vw', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div className="admin-modal__header">
                            <div>
                                <h2 style={{ margin: 0 }}>Review: {reviewAdmin.name}</h2>
                                <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                                    {reviewAdmin.email} · {airportName(reviewAdmin.airport)}
                                </p>
                            </div>
                            <button type="button" className="admin-modal__close" disabled={reviewSubmitting} onClick={() => setReviewAdmin(null)}><X size={24} /></button>
                        </div>
                        <div className="admin-modal__body" style={{ overflowY: 'auto', flex: 1 }}>
                            {reviewLoading && <p style={{ color: 'rgba(255,255,255,0.4)' }}>Loading…</p>}
                            {reviewDetail && !reviewLoading && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div style={{ fontSize: '0.82rem' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>Employee ID</span>
                                        <div style={{ fontFamily: 'monospace', marginTop: 4 }}>{reviewDetail.employee_id || '—'}</div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.82rem' }}>
                                        <div><span style={{ color: 'rgba(255,255,255,0.4)' }}>Verification</span><br /><VerificationBadge verificationStatus={verificationStatusFromReview(reviewDetail)} profileComplete={!!reviewDetail.profile_complete} /></div>
                                    </div>
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 10, color: '#93c5fd' }}>Admin Profile Information</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Full name</span>
                                                <span>{reviewDetail.full_name || '—'}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Personal email</span>
                                                <span>{reviewDetail.personal_email || '—'}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Phone</span>
                                                <span>{reviewDetail.phone_number || '—'}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>DOB</span>
                                                <span>{reviewDetail.date_of_birth ? String(reviewDetail.date_of_birth).slice(0, 10) : '—'}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Nationality</span>
                                                <span>{reviewDetail.nationality || '—'}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Gender</span>
                                                <span>{reviewDetail.gender || '—'}</span>
                                            </div>
                                            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Residential address</span>
                                                <span>{reviewDetail.residential_address || '—'}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Emergency name</span>
                                                <span>{reviewDetail.emergency_contact_name || '—'}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Emergency phone</span>
                                                <span>{reviewDetail.emergency_contact_phone || '—'}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Emergency relationship</span>
                                                <span>{reviewDetail.emergency_contact_relationship || '—'}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>CIN number</span>
                                                <span style={{ fontFamily: 'monospace' }}>{reviewDetail.cin_number || '—'}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Passport number</span>
                                                <span style={{ fontFamily: 'monospace' }}>{reviewDetail.passport_number || '—'}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Passport expiry</span>
                                                <span>{reviewDetail.passport_expiry_date ? String(reviewDetail.passport_expiry_date).slice(0, 10) : '—'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {reviewDetail.profile_photo_url && (
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Profile photo</div>
                                            <img src={reviewDetail.profile_photo_url} alt="" style={{ maxHeight: 120, borderRadius: 8 }} />
                                        </div>
                                    )}
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>CIN document</div>
                                        {reviewDetail.cin_document_url ? (
                                            reviewDetail.cin_document_url.startsWith('data:application/pdf') ? (
                                                <iframe title="cin" src={reviewDetail.cin_document_url} style={{ width: '100%', height: 280, border: 'none', borderRadius: 8, background: '#fff' }} />
                                            ) : (
                                                <img src={reviewDetail.cin_document_url} alt="CIN" style={{ maxWidth: '100%', borderRadius: 8 }} />
                                            )
                                        ) : (
                                            <span style={{ color: 'rgba(255,255,255,0.35)' }}>No CIN document on file.</span>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Passport document</div>
                                        {reviewDetail.passport_document_url ? (
                                            reviewDetail.passport_document_url.startsWith('data:application/pdf') ? (
                                                <iframe title="passport" src={reviewDetail.passport_document_url} style={{ width: '100%', height: 280, border: 'none', borderRadius: 8, background: '#fff' }} />
                                            ) : (
                                                <img src={reviewDetail.passport_document_url} alt="Passport" style={{ maxWidth: '100%', borderRadius: 8 }} />
                                            )
                                        ) : (
                                            <span style={{ color: 'rgba(255,255,255,0.35)' }}>No passport document on file.</span>
                                        )}
                                    </div>
                                    <div style={{
                                        borderTop: '1px solid rgba(245, 158, 11, 0.35)',
                                        borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
                                        padding: '14px 0',
                                        margin: '4px 0',
                                    }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#FCD34D', marginBottom: 8 }}>
                                            Select Incorrect Fields (required if rejecting)
                                        </div>
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14
                                        }}>
                                            {[
                                                { key: 'full_name', label: 'Full Name' }, { key: 'date_of_birth', label: 'Date of Birth' },
                                                { key: 'gender', label: 'Gender' }, { key: 'nationality', label: 'Nationality' },
                                                { key: 'cin_number', label: 'CIN Number' }, { key: 'cin_document_url', label: 'CIN Document' },
                                                { key: 'passport_number', label: 'Passport Number' }, { key: 'passport_expiry_date', label: 'Passport Expiry' },
                                                { key: 'passport_document_url', label: 'Passport Document' }, { key: 'residential_address', label: 'Residential Address' },
                                                { key: 'emergency_contact_name', label: 'Emergency Contact Name' }, { key: 'emergency_contact_phone', label: 'Emergency Contact Phone' },
                                            ].map(opt => (
                                                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={rejectedFields.includes(opt.key)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setRejectedFields(prev => [...prev, opt.key]);
                                                            else setRejectedFields(prev => prev.filter(k => k !== opt.key));
                                                        }}
                                                    />
                                                    {opt.label}
                                                </label>
                                            ))}
                                        </div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
                                            Rejection notes (required if rejecting)
                                        </label>
                                        <textarea
                                            className="admin-form-input"
                                            style={{ minHeight: 72, width: '100%', resize: 'vertical' }}
                                            value={rejectReason}
                                            onChange={e => setRejectReason(e.target.value)}
                                            placeholder="Explain what is wrong with the selected fields…"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="admin-modal__footer" style={{ flexWrap: 'wrap', gap: 8 }}>
                            <button type="button" className="admin-btn admin-btn--outline" disabled={reviewSubmitting} onClick={() => setReviewAdmin(null)}>Close</button>
                            <button
                                type="button"
                                className="admin-btn admin-btn--danger"
                                disabled={reviewSubmitting || reviewLoading || !reviewDetail}
                                onClick={() => submitReview('reject')}
                            >
                                Reject
                            </button>
                            <button
                                type="button"
                                className="admin-btn admin-btn--primary"
                                disabled={reviewSubmitting || reviewLoading || !reviewDetail}
                                onClick={() => submitReview('approve')}
                            >
                                Approve
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm Modal ── */}
            {deleteConfirm && (
                <div className="admin-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
                    <div className="admin-modal users-modal users-modal--sm" onClick={e => e.stopPropagation()}>
                        <div className="admin-modal__header users-delete-header">
                            <div>
                                <h2>🗑 {t('admin_users_delete_title')}</h2>
                                <p>{t('admin_users_delete_confirm')} <strong>{deleteConfirm.name}</strong>?</p>
                            </div>
                            <button className="admin-modal__close" onClick={() => setDeleteConfirm(null)}><X size={22} /></button>
                        </div>
                        <div className="admin-modal__footer">
                            <button className="admin-btn admin-btn--outline" onClick={() => setDeleteConfirm(null)}>{t('admin_users_cancel')}</button>
                            <button className="admin-btn admin-btn--danger" onClick={() => handleDelete(deleteConfirm)}>{t('admin_users_delete_confirm_btn')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const labelStyle = { fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' };

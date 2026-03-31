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
    apiListAdmins, apiCreateAdmin, apiDeactivateAdmin,
    apiCheckEmail, apiSuggestEmail, apiCheckDuplicate,
    apiGetAdminReview, apiPostIdReview,
    apiUnlockAdminCorrection, apiDismissAdminCorrection,
    apiPatchAdminProfile,
} from '../../services/adminApi';

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
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [dismissNote, setDismissNote] = useState('');
    const [reviewForm, setReviewForm] = useState(null);
    const [profileSaveBusy, setProfileSaveBusy] = useState(false);

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
        setDismissNote('');
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

    async function submitUnlockCorrection() {
        if (!reviewAdmin) return;
        setReviewSubmitting(true);
        const { error } = await apiUnlockAdminCorrection(reviewAdmin.id);
        setReviewSubmitting(false);
        if (error) {
            showToast('error', error);
            return;
        }
        showToast('success', 'ID fields unlocked. The admin has been notified.');
        setReviewAdmin(null);
        setReviewDetail(null);
        setDismissNote('');
        await fetchAdmins();
    }

    async function submitDismissCorrection() {
        if (!reviewAdmin) return;
        setReviewSubmitting(true);
        const { error } = await apiDismissAdminCorrection(reviewAdmin.id, dismissNote.trim() || null);
        setReviewSubmitting(false);
        if (error) {
            showToast('error', error);
            return;
        }
        showToast('success', 'Correction request dismissed.');
        setReviewAdmin(null);
        setReviewDetail(null);
        setDismissNote('');
        await fetchAdmins();
    }

    useEffect(() => {
        if (!reviewDetail) {
            setReviewForm(null);
            return;
        }
        setReviewForm({
            full_name: reviewDetail.full_name || '',
            personal_email: reviewDetail.personal_email || '',
            phone_number: reviewDetail.phone_number || '',
            nationality: reviewDetail.nationality || '',
            gender: reviewDetail.gender || 'Male',
            residential_address: reviewDetail.residential_address || '',
            emergency_contact_name: reviewDetail.emergency_contact_name || '',
            emergency_contact_phone: reviewDetail.emergency_contact_phone || '',
            emergency_contact_relationship: reviewDetail.emergency_contact_relationship || 'Parent',
            cin_number: reviewDetail.cin_number || '',
            passport_number: reviewDetail.passport_number || '',
            passport_expiry_date: reviewDetail.passport_expiry_date
                ? String(reviewDetail.passport_expiry_date).slice(0, 10)
                : '',
            date_of_birth: reviewDetail.date_of_birth ? String(reviewDetail.date_of_birth).slice(0, 10) : '',
        });
    }, [reviewDetail]);

    async function saveReviewProfile() {
        if (!reviewAdmin || !reviewForm) return;
        setProfileSaveBusy(true);
        const { error } = await apiPatchAdminProfile(reviewAdmin.id, reviewForm);
        setProfileSaveBusy(false);
        if (error) {
            showToast('error', error);
            return;
        }
        showToast('success', 'Profile updated.');
        const { data } = await apiGetAdminReview(reviewAdmin.id);
        if (data) setReviewDetail(data);
        await fetchAdmins();
    }

    async function handleDelete(user) {
        const { error } = await apiDeactivateAdmin(user.id);
        if (error) showToast('error', `Failed to deactivate: ${error}`);
        else { setUsers(prev => prev.filter(u => u.id !== user.id)); showToast('success', `Admin '${user.name}' deactivated.`); }
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
                    <select className="admin-filter-bar__select" value={airportFilter} onChange={e => setAirportFilter(e.target.value)}>
                        <option value="all">All Airports</option>
                        {TUNISIAN_AIRPORTS.map(a => <option key={a.iata} value={a.iata}>{a.name} ({a.iata})</option>)}
                    </select>
                    <select className="admin-filter-bar__select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="all">{t('admin_users_all_statuses')}</option>
                        <option value="active">{t('admin_users_status_active')}</option>
                        <option value="inactive">{t('admin_users_status_inactive')}</option>
                    </select>
                    <select className="admin-filter-bar__select" value={verificationFilter} onChange={e => setVerificationFilter(e.target.value)}>
                        <option value="all">All Verifications</option>
                        <option value="approved">Approved</option>
                        <option value="pending_review">Pending Review</option>
                        <option value="under_review">Under Review</option>
                        <option value="rejected">Rejected</option>
                    </select>
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
                                            <button className="users-action-btn users-action-btn--delete" onClick={() => setDeleteConfirm(user)} title="Deactivate"><Trash2 size={15} /></button>
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
                                <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                                    A secure password is generated server-side and emailed to the admin&apos;s personal address.
                                </p>
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
                                        <select
                                            className="admin-form-input"
                                            style={{ marginTop: 6 }}
                                            value={form.airport}
                                            onChange={e => handleAirportChange(e.target.value)}
                                            disabled={dupState === 'warning'}
                                        >
                                            {TUNISIAN_AIRPORTS.map(a => (
                                                <option key={a.iata} value={a.iata}>{a.name} ({a.iata})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* ── Personal email: welcome + credentials only; no auto-suggest ── */}
                                    <div className="admin-login__field">
                                        <label style={labelStyle}>Personal email</label>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.45 }}>
                                            The admin&apos;s real personal address (Gmail, Yahoo, etc.). Welcome email with credentials is sent here. No auto-suggestion — enter manually.
                                        </p>
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
                                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.45 }}>
                                            Auto-suggested from full name + airport as <code style={{ fontSize: '0.7rem', color: 'rgba(147,197,253,0.9)' }}>firstname.lastname@[code]-airport.tn</code>. This is the login email; all uniqueness and fallback logic applies here only.
                                        </p>
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

                                    <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '11px 14px' }}>
                                        <p style={{ fontSize: '0.77rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.55, margin: 0 }}>
                                            The welcome email lists the <strong style={{ color: 'rgba(255,255,255,0.65)' }}>work email</strong> (username) and temporary password. First login: change password, then complete profile.
                                        </p>
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
                                    {reviewForm && (
                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 10, color: '#93c5fd' }}>Edit profile (Super Admin)</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                    Full name
                                                    <input className="admin-form-input" value={reviewForm.full_name} onChange={(e) => setReviewForm((f) => ({ ...f, full_name: e.target.value }))} />
                                                </label>
                                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                    Personal email
                                                    <input className="admin-form-input" value={reviewForm.personal_email} onChange={(e) => setReviewForm((f) => ({ ...f, personal_email: e.target.value }))} />
                                                </label>
                                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                    Phone
                                                    <input className="admin-form-input" value={reviewForm.phone_number} onChange={(e) => setReviewForm((f) => ({ ...f, phone_number: e.target.value }))} />
                                                </label>
                                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                    DOB
                                                    <input type="date" className="admin-form-input" value={reviewForm.date_of_birth} onChange={(e) => setReviewForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
                                                </label>
                                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                    Nationality
                                                    <input className="admin-form-input" value={reviewForm.nationality} onChange={(e) => setReviewForm((f) => ({ ...f, nationality: e.target.value }))} />
                                                </label>
                                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                    Gender
                                                    <select className="admin-form-input" value={reviewForm.gender} onChange={(e) => setReviewForm((f) => ({ ...f, gender: e.target.value }))}>
                                                        <option value="Male">Male</option>
                                                        <option value="Female">Female</option>
                                                    </select>
                                                </label>
                                                <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                    Residential address
                                                    <textarea className="admin-form-input" style={{ minHeight: 56 }} value={reviewForm.residential_address} onChange={(e) => setReviewForm((f) => ({ ...f, residential_address: e.target.value }))} />
                                                </label>
                                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                    Emergency name
                                                    <input className="admin-form-input" value={reviewForm.emergency_contact_name} onChange={(e) => setReviewForm((f) => ({ ...f, emergency_contact_name: e.target.value }))} />
                                                </label>
                                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                    Emergency phone
                                                    <input className="admin-form-input" value={reviewForm.emergency_contact_phone} onChange={(e) => setReviewForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))} />
                                                </label>
                                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                    Emergency relationship
                                                    <select className="admin-form-input" value={reviewForm.emergency_contact_relationship} onChange={(e) => setReviewForm((f) => ({ ...f, emergency_contact_relationship: e.target.value }))}>
                                                        {['Parent', 'Spouse', 'Sibling', 'Friend', 'Other'].map((r) => (
                                                            <option key={r} value={r}>{r}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                    CIN number
                                                    <input className="admin-form-input" style={{ fontFamily: 'monospace' }} value={reviewForm.cin_number} onChange={(e) => setReviewForm((f) => ({ ...f, cin_number: e.target.value }))} />
                                                </label>
                                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                    Passport number
                                                    <input className="admin-form-input" style={{ fontFamily: 'monospace' }} value={reviewForm.passport_number} onChange={(e) => setReviewForm((f) => ({ ...f, passport_number: e.target.value }))} />
                                                </label>
                                                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem' }}>
                                                    Passport expiry
                                                    <input type="date" className="admin-form-input" value={reviewForm.passport_expiry_date} onChange={(e) => setReviewForm((f) => ({ ...f, passport_expiry_date: e.target.value }))} />
                                                </label>
                                            </div>
                                            <button type="button" className="admin-btn admin-btn--primary" style={{ marginTop: 12 }} disabled={profileSaveBusy || reviewSubmitting} onClick={saveReviewProfile}>
                                                {profileSaveBusy ? 'Saving…' : 'Save profile changes'}
                                            </button>
                                        </div>
                                    )}
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
                                    {reviewDetail.correction_request && reviewDetail.correction_request.status === 'pending' && (
                                        <div style={{
                                            borderTop: '1px solid rgba(245, 158, 11, 0.35)',
                                            borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
                                            padding: '14px 0',
                                            margin: '4px 0',
                                        }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#FCD34D', marginBottom: 8 }}>
                                                🟡 ID correction request
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.84rem', lineHeight: 1.5, color: 'rgba(255,255,255,0.82)' }}>
                                                {reviewDetail.correction_request.reason}
                                            </p>
                                            <label style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: 12, marginBottom: 6 }}>
                                                Optional note when dismissing
                                            </label>
                                            <textarea
                                                className="admin-form-input"
                                                style={{ minHeight: 56, width: '100%', resize: 'vertical', marginBottom: 10 }}
                                                value={dismissNote}
                                                onChange={(e) => setDismissNote(e.target.value)}
                                                placeholder="Reason shown to the admin if you dismiss…"
                                                disabled={reviewSubmitting}
                                            />
                                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    className="admin-btn admin-btn--outline"
                                                    disabled={reviewSubmitting}
                                                    onClick={submitDismissCorrection}
                                                >
                                                    Dismiss
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-btn admin-btn--primary"
                                                    disabled={reviewSubmitting}
                                                    onClick={submitUnlockCorrection}
                                                >
                                                    Unlock for Edit
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>Rejection reason (required if rejecting)</label>
                                        <textarea
                                            className="admin-form-input"
                                            style={{ minHeight: 72, width: '100%', resize: 'vertical' }}
                                            value={rejectReason}
                                            onChange={e => setRejectReason(e.target.value)}
                                            placeholder="Explain what is wrong with the ID scan…"
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

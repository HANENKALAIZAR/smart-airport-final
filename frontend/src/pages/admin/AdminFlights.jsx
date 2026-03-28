import { useState, useEffect } from 'react';
import { Search, Plus, Edit3, Trash2, X, AlertCircle, RefreshCw } from 'lucide-react';
import { apiGetFlights, apiCreateFlight, apiUpdateFlight, apiDeleteFlight } from '../../services/adminApi';
import FlightTable from '../../components/admin/FlightTable';
import FlightDetailsModal from '../../components/admin/FlightDetailsModal';
import { useLanguage } from '../../context/LanguageContext';

/* ── Adapt backend data to admin table format ─── */
function adaptFlight(f) {
    return {
        id: f.id,
        flightNumber: f.flight_number,
        airline: f.airline?.name || '—',
        origin: f.origin_airport?.iata_code || '—',
        destination: f.dest_airport?.iata_code || '—',
        scheduledTime: f.scheduled_departure
            ? new Date(f.scheduled_departure).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
            : '—',
        weather: '—',
        predictedDelay: f.delay_minutes || 0,
        riskLevel: f.delay_minutes > 30 ? 'High' : f.delay_minutes > 10 ? 'Medium' : 'Low',
        status: f.status === 'on_time' ? 'On-Time'
            : f.status === 'delayed' ? 'Delayed'
            : f.status === 'cancelled' ? 'Cancelled'
            : 'Scheduled',
        aircraftType: f.aircraft_type || '—',
        trafficLevel: 'Medium',
        _raw: f,
    };
}

const emptyForm = {
    flight_number: '', airline_iata: '', origin_iata: '', destination_iata: '',
    scheduled_departure: '', scheduled_arrival: '', status: 'scheduled',
    delay_minutes: 0, distance_km: 0, aircraft_type: '',
};

export default function AdminFlights() {
    const { t } = useLanguage();
    const [flights, setFlights]       = useState([]);
    const [loading, setLoading]       = useState(true);
    const [pageError, setPageError]   = useState('');
    const [search, setSearch]         = useState('');
    const [riskFilter, setRiskFilter] = useState('all');
    const [selected, setSelected]     = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [editId, setEditId]         = useState(null);
    const [form, setForm]             = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError]   = useState('');

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        setPageError('');
        const { data, error } = await apiGetFlights();
        setLoading(false);
        if (error) { setPageError(`Could not load flights: ${error}`); return; }
        setFlights((data || []).map(adaptFlight));
    }

    const filtered = flights.filter(f => {
        const q = search.toLowerCase();
        const matchSearch = !q
            || f.flightNumber.toLowerCase().includes(q)
            || f.airline.toLowerCase().includes(q)
            || f.origin.toLowerCase().includes(q)
            || f.destination.toLowerCase().includes(q);
        const matchRisk = riskFilter === 'all' || f.riskLevel === riskFilter;
        return matchSearch && matchRisk;
    });

    async function handleCreate(e) {
        e.preventDefault();
        setFormError('');
        setSubmitting(true);
        const { error } = await apiCreateFlight({
            ...form,
            scheduled_departure: new Date(form.scheduled_departure).toISOString(),
            scheduled_arrival: new Date(form.scheduled_arrival).toISOString(),
            delay_minutes: parseInt(form.delay_minutes) || 0,
            distance_km: parseInt(form.distance_km) || 0,
        });
        setSubmitting(false);
        if (error) { setFormError(error); return; }
        setShowCreate(false);
        setForm(emptyForm);
        load();
    }

    async function handleUpdate(e) {
        e.preventDefault();
        setFormError('');
        setSubmitting(true);
        const { error } = await apiUpdateFlight(editId, {
            status: form.status,
            delay_minutes: parseInt(form.delay_minutes) || 0,
            aircraft_type: form.aircraft_type || undefined,
        });
        setSubmitting(false);
        if (error) { setFormError(error); return; }
        setEditId(null);
        load();
    }

    async function handleDelete(id) {
        if (!window.confirm(t('admin_flights_delete_confirm'))) return;
        const { error } = await apiDeleteFlight(id);
        if (error) { setPageError(`Delete failed: ${error}`); return; }
        load();
    }

    function openEdit(flight) {
        setEditId(flight.id);
        setFormError('');
        setForm({
            ...emptyForm,
            status: flight._raw?.status || 'scheduled',
            delay_minutes: flight.predictedDelay || 0,
            aircraft_type: flight.aircraftType !== '—' ? flight.aircraftType : '',
        });
    }

    const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2E8F0', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' };
    const labelStyle = { display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' };

    return (
        <div className="admin-space-y-6">
            {/* Page header */}
            <div className="admin-page-header">
                <div>
                    <h1>{t('admin_flights_title')}</h1>
                    <p>{t('admin_flights_subtitle')}</p>
                </div>
                <button className="admin-btn admin-btn--primary" onClick={() => { setShowCreate(true); setFormError(''); setForm(emptyForm); }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={16} /> {t('admin_flights_add')}
                </button>
            </div>

            {/* Error banner */}
            {pageError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '0.84rem' }}>
                    <AlertCircle size={16} />
                    <span style={{ flex: 1 }}>{pageError}</span>
                    <button onClick={() => setPageError('')} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer' }}>✕</button>
                </div>
            )}

            {/* Filters */}
            <div className="admin-card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '14px 18px' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('admin_flights_search_placeholder')}
                        style={{ ...inputStyle, paddingLeft: 32 }}
                    />
                </div>
                <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
                    <option value="all">All Risk Levels</option>
                    <option value="High">High Risk</option>
                    <option value="Medium">Medium Risk</option>
                    <option value="Low">Low Risk</option>
                </select>
                <button className="admin-btn admin-btn--outline" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Refresh">
                    <RefreshCw size={14} /> Refresh
                </button>
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
                    {loading ? 'Loading…' : `${filtered.length} flights`}
                </span>
            </div>

            {/* Flight Table */}
            <FlightTable
                flights={filtered}
                onView={setSelected}
                onEdit={openEdit}
                onDelete={handleDelete}
            />

            {/* Flight detail modal */}
            {selected && (
                <FlightDetailsModal
                    flight={selected}
                    isOpen={!!selected}
                    onClose={() => setSelected(null)}
                />
            )}

            {/* ── Create Modal ── */}
            {showCreate && (
                <div className="admin-modal-backdrop" onClick={() => setShowCreate(false)}>
                    <div className="admin-modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
                        <div className="admin-modal__header">
                            <h2>{t('admin_flights_add')}</h2>
                            <button className="admin-modal__close" onClick={() => setShowCreate(false)}><X size={22} /></button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="admin-modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                {formError && (
                                    <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '0.82rem' }}>
                                        <AlertCircle size={14} /> {formError}
                                    </div>
                                )}
                                {[
                                    { key: 'flight_number', label: 'Flight Number', placeholder: 'e.g. TU720', full: false },
                                    { key: 'airline_iata', label: 'Airline IATA', placeholder: 'e.g. TU', full: false },
                                    { key: 'origin_iata', label: 'Origin IATA', placeholder: 'e.g. TUN', full: false },
                                    { key: 'destination_iata', label: 'Destination IATA', placeholder: 'e.g. CDG', full: false },
                                    { key: 'scheduled_departure', label: 'Scheduled Departure', type: 'datetime-local', full: false },
                                    { key: 'scheduled_arrival', label: 'Scheduled Arrival', type: 'datetime-local', full: false },
                                    { key: 'distance_km', label: 'Distance (km)', type: 'number', placeholder: '0', full: false },
                                    { key: 'aircraft_type', label: 'Aircraft Type', placeholder: 'e.g. A320', full: false },
                                ].map(({ key, label, placeholder, type = 'text', full }) => (
                                    <div key={key} style={{ gridColumn: full ? '1/-1' : 'auto' }}>
                                        <label style={labelStyle}>{label}</label>
                                        <input
                                            type={type}
                                            value={form[key]}
                                            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                            placeholder={placeholder}
                                            style={inputStyle}
                                            required={['flight_number','airline_iata','origin_iata','destination_iata','scheduled_departure','scheduled_arrival'].includes(key)}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="admin-modal__footer">
                                <button type="button" className="admin-btn admin-btn--outline" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="admin-btn admin-btn--primary" disabled={submitting}>
                                    {submitting ? 'Creating…' : 'Create Flight'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Edit Modal ── */}
            {editId && (
                <div className="admin-modal-backdrop" onClick={() => setEditId(null)}>
                    <div className="admin-modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div className="admin-modal__header">
                            <h2>{t('admin_flights_edit')}</h2>
                            <button className="admin-modal__close" onClick={() => setEditId(null)}><X size={22} /></button>
                        </div>
                        <form onSubmit={handleUpdate}>
                            <div className="admin-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {formError && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '0.82rem' }}>
                                        <AlertCircle size={14} /> {formError}
                                    </div>
                                )}
                                <div>
                                    <label style={labelStyle}>Status</label>
                                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                                        {['scheduled','on_time','delayed','cancelled'].map(s => (
                                            <option key={s} value={s}>{s.replace('_',' ')}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Delay (minutes)</label>
                                    <input type="number" min="0" value={form.delay_minutes} onChange={e => setForm(f => ({ ...f, delay_minutes: e.target.value }))} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Aircraft Type</label>
                                    <input type="text" value={form.aircraft_type} onChange={e => setForm(f => ({ ...f, aircraft_type: e.target.value }))} placeholder="e.g. A320" style={inputStyle} />
                                </div>
                            </div>
                            <div className="admin-modal__footer">
                                <button type="button" className="admin-btn admin-btn--outline" onClick={() => setEditId(null)}>Cancel</button>
                                <button type="submit" className="admin-btn admin-btn--primary" disabled={submitting}>
                                    {submitting ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

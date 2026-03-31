import { useState, useEffect } from 'react';
import { Search, AlertCircle, RefreshCw } from 'lucide-react';
import { apiGetFlights } from '../../services/adminApi';
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
            : f.status === 'boarding' ? 'Boarding'
            : f.status === 'departed' ? 'Departed'
            : f.status === 'landed' ? 'Landed'
            : 'Scheduled',
        aircraftType: f.aircraft_type || '—',
        trafficLevel: 'Medium',
        _raw: f,
    };
}

export default function AdminFlights() {
    const { t } = useLanguage();
    const [flights, setFlights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState('');
    const [search, setSearch] = useState('');
    const [riskFilter, setRiskFilter] = useState('all');
    const [selected, setSelected] = useState(null);

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

    const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2E8F0', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' };

    return (
        <div className="admin-space-y-6">
            <div className="admin-page-header">
                <div>
                    <h1>{t('admin_flights_title')}</h1>
                    <p>{t('admin_flights_subtitle')}</p>
                </div>
            </div>

            {pageError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '0.84rem' }}>
                    <AlertCircle size={16} />
                    <span style={{ flex: 1 }}>{pageError}</span>
                    <button type="button" onClick={() => setPageError('')} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer' }}>✕</button>
                </div>
            )}

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
                <button type="button" className="admin-btn admin-btn--outline" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Refresh">
                    <RefreshCw size={14} /> Refresh
                </button>
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
                    {loading ? 'Loading…' : `${filtered.length} flights`}
                </span>
            </div>

            <FlightTable flights={filtered} onFlightClick={setSelected} />

            {selected && (
                <FlightDetailsModal
                    flight={selected}
                    isOpen={!!selected}
                    onClose={() => setSelected(null)}
                />
            )}
        </div>
    );
}

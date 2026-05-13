import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plane, Clock, TrendingUp, AlertTriangle, RefreshCw, ArrowDown, ArrowUp } from 'lucide-react';
import KPICard from '../../components/admin/KPICard';
import FlightDetailsModal from '../../components/admin/FlightDetailsModal';
import FilterBar from '../../components/admin/FilterBar';
import Pagination from '../../components/admin/Pagination';
import AirportAdminAIAlerts from './AirportAdminAIAlerts';
import SuperAdminAIAlerts from './SuperAdminAIAlerts';
import LiveClock from '../../components/admin/LiveClock';
import { useAirport } from '../../context/AirportContext';
import { useLanguage } from '../../context/LanguageContext';

const PAGE_SIZE = 10;

const STATUS_CLASS = {
    'on_time': 'admin-table__status--on-time',
    'scheduled': '',
    'delayed': 'admin-table__status--delayed',
    'cancelled': 'admin-table__status--cancelled',
    'landed': 'admin-table__status--departed',
    'boarding': 'admin-table__status--boarding',
    'departed': 'admin-table__status--departed',
};

const STATUS_LABEL = {
    'on_time': 'On-Time',
    'scheduled': 'Scheduled',
    'delayed': 'Delayed',
    'cancelled': 'Cancelled',
    'landed': 'Landed',
    'boarding': 'Boarding',
    'departed': 'Departed',
};

function normalizeFlightStatus(raw) {
    const s = String(raw || '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    const map = {
        scheduled: 'scheduled',
        active: 'scheduled',
        on_time: 'on_time',
        ontime: 'on_time',
        delayed: 'delayed',
        delay: 'delayed',
        boarding: 'boarding',
        departed: 'departed',
        cancelled: 'cancelled',
        canceled: 'cancelled',
        landed: 'landed',
        complete: 'landed',
    };
    return map[s] || (['scheduled', 'on_time', 'delayed', 'boarding', 'departed', 'cancelled', 'landed'].includes(s) ? s : 'scheduled');
}

function formatTime(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return '—'; }
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ── Mock fallback flights (used when API is unavailable) ── */
function buildMockFlights(iata) {
    return [
        { id: 1, flight_number: `TU721`, airline_name: 'Tunisair', direction: 'departure', dep_iata: iata, arr_iata: 'CDG', arr_airport: 'Paris Charles de Gaulle', dep_scheduled: new Date(Date.now() - 3600000).toISOString(), dep_gate: 'B3', dep_terminal: '1', arr_gate: null, arr_terminal: null, status: 'delayed', delay_minutes: 45 },
        { id: 2, flight_number: `TU302`, airline_name: 'Tunisair', direction: 'departure', dep_iata: iata, arr_iata: 'FCO', arr_airport: 'Rome Fiumicino', dep_scheduled: new Date(Date.now() + 1800000).toISOString(), dep_gate: 'A7', dep_terminal: '1', arr_gate: null, arr_terminal: null, status: 'on_time', delay_minutes: 0 },
        { id: 3, flight_number: `AF1234`, airline_name: 'Air France', direction: 'arrival', dep_iata: 'CDG', arr_iata: iata, dep_airport: 'Paris CDG', arr_scheduled: new Date(Date.now() + 2700000).toISOString(), arr_gate: 'C2', arr_terminal: '2', dep_gate: null, dep_terminal: null, status: 'boarding', delay_minutes: 0 },
        { id: 4, flight_number: `LH490`, airline_name: 'Lufthansa', direction: 'arrival', dep_iata: 'FRA', arr_iata: iata, dep_airport: 'Frankfurt', arr_scheduled: new Date(Date.now() + 5400000).toISOString(), arr_gate: 'D1', arr_terminal: '2', dep_gate: null, dep_terminal: null, status: 'delayed', delay_minutes: 20 },
        { id: 5, flight_number: `TU505`, airline_name: 'Tunisair', direction: 'departure', dep_iata: iata, arr_iata: 'LHR', arr_airport: 'London Heathrow', dep_scheduled: new Date(Date.now() + 7200000).toISOString(), dep_gate: 'B9', dep_terminal: '1', arr_gate: null, arr_terminal: null, status: 'scheduled', delay_minutes: 0 },
        { id: 6, flight_number: `IB3456`, airline_name: 'Iberia', direction: 'arrival', dep_iata: 'MAD', arr_iata: iata, dep_airport: 'Madrid Barajas', arr_scheduled: new Date(Date.now() - 900000).toISOString(), arr_gate: 'A3', arr_terminal: '1', dep_gate: null, dep_terminal: null, status: 'landed', delay_minutes: 0 },
        { id: 7, flight_number: `TU801`, airline_name: 'Tunisair', direction: 'departure', dep_iata: iata, arr_iata: 'DUS', arr_airport: 'Dusseldorf', dep_scheduled: new Date(Date.now() + 10800000).toISOString(), dep_gate: 'C5', dep_terminal: '1', arr_gate: null, arr_terminal: null, status: 'cancelled', delay_minutes: 0 },
        { id: 8, flight_number: `VY1234`, airline_name: 'Vueling', direction: 'arrival', dep_iata: 'BCN', arr_iata: iata, dep_airport: 'Barcelona', arr_scheduled: new Date(Date.now() + 3600000).toISOString(), arr_gate: 'B6', arr_terminal: '2', dep_gate: null, dep_terminal: null, status: 'departed', delay_minutes: 0 },
    ];
}

export default function AdminDashboard({ selectedDate }) {
    const { selectedAirport, role } = useAirport();
    const { t } = useLanguage();
    const isSuperAdmin = role === 'super_admin';
    const [selectedFlight, setSelectedFlight] = useState(null);
    const [filters, setFilters] = useState({ timeRange: [], riskLevels: [], statuses: [] });
    const [direction, setDirection] = useState('all'); // 'all' | 'departure' | 'arrival'

    // Live flight data
    const [flights, setFlights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    // NOTE: clock state removed — now in isolated <LiveClock /> component

    const fetchFlights = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
            const res = await fetch(`${baseUrl}/api/aviationstack/flights/${selectedAirport.iata}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const rawList = json.flights || [];
            const fetched = rawList.map((f) => ({ ...f, status: normalizeFlightStatus(f.status) }));
            if (fetched.length > 0) {
                setFlights(fetched);
            } else {
                // API returned empty — use mock data for demo
                setFlights(buildMockFlights(selectedAirport.iata));
            }
            setLastUpdated(new Date());
        } catch (err) {
            console.warn('AdminDashboard: API unavailable, using mock data:', err.message);
            setError(null); // don't show error, just use mock
            setFlights(buildMockFlights(selectedAirport.iata));
            setLastUpdated(new Date());
        } finally {
            setLoading(false);
        }
    }, [selectedAirport.iata]);

    useEffect(() => {
        fetchFlights();
        const iv = setInterval(fetchFlights, 300000);
        return () => clearInterval(iv);
    }, [fetchFlights]);

    // KPIs
    const kpi = useMemo(() => {
        const total = flights.length;
        const departures = flights.filter(f => f.direction === 'departure').length;
        const arrivals = flights.filter(f => f.direction === 'arrival').length;
        const delayed = flights.filter(f => f.status === 'delayed').length;
        const cancelled = flights.filter(f => f.status === 'cancelled').length;
        const onTime = flights.filter(f => f.status === 'on_time' || f.status === 'scheduled').length;
        const onTimePct = total > 0 ? Math.round((onTime / total) * 1000) / 10 : 100;
        const validDelays = flights.map(f => f.delay_minutes).filter(d => d != null);
        const avgDelay = validDelays.length > 0
            ? Math.round(validDelays.reduce((sum, d) => sum + d, 0) / validDelays.length)
            : 0;
        return { total, departures, arrivals, delayed, cancelled, onTimePct, avgDelay };
    }, [flights]);

    // Filtering: status + direction + risk + time
    const filtered = flights.filter(f => {
        if (direction !== 'all' && f.direction !== direction) return false;
        if (filters.statuses.length > 0) {
            const uiStatus = STATUS_LABEL[f.status] || f.status;
            if (!filters.statuses.includes(uiStatus)) return false;
        }
        if (filters.riskLevels && filters.riskLevels.length > 0) {
            const risk = f.delay_minutes == null ? 'Unknown' : f.delay_minutes > 30 ? 'High' : f.delay_minutes > 10 ? 'Medium' : 'Low';
            if (!filters.riskLevels.includes(risk)) return false;
        }
        if (filters.timeRange && filters.timeRange.length > 0) {
            const dateStr = f.direction === 'departure' ? f.dep_scheduled : f.arr_scheduled;
            if (!dateStr) return false;
            const hour = new Date(dateStr).getHours();
            let tr = 'evening';
            if (hour >= 5 && hour < 12) tr = 'morning';
            else if (hour >= 12 && hour < 18) tr = 'afternoon';
            if (!filters.timeRange.includes(tr)) return false;
        }
        return true;
    });

    // Pagination
    // Safe reset if current page exceeds total pages
    const totalFilteredPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
    const safeCurrentPage = currentPage > totalFilteredPages ? 1 : currentPage;
    if (currentPage > totalFilteredPages && currentPage !== 1) {
        // Enqueue state update gracefully
        setTimeout(() => setCurrentPage(1), 0);
    }
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(start, start + PAGE_SIZE);

    const dateLabel = `${selectedDate.getDate()} ${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

    return (
        <div className="admin-space-y-6">
            <div className="admin-page-header">
                <h1>{t('admin_dash_ops')}</h1>
                <p>
                    {t('admin_dash_realtime')} — <strong>{selectedAirport.name} ({selectedAirport.iata})</strong>
                    <LiveClock />
                </p>
            </div>

            {/* KPI Cards */}
            <div className="admin-grid-4">
                <KPICard title={t('admin_dash_total_flights')} value={kpi.total} icon={<Plane size={32} />} trend={0} />
                <KPICard title={t('admin_dash_on_time_rate')} value={kpi.onTimePct} suffix="%" icon={<TrendingUp size={32} />} trend={0} />
                <KPICard title={t('admin_dash_avg_delay')} value={kpi.avgDelay} suffix=" min" icon={<Clock size={32} />} trend={0} />
                <KPICard title={t('admin_dash_delayed_cancelled')} value={`${kpi.delayed} / ${kpi.cancelled}`} icon={<AlertTriangle size={32} />} trend={0} />
            </div>

            {/* Filter Bar */}
            <FilterBar onFilterChange={setFilters} />

            {/* Main content: flight table + AI side panel */}
            <div className="admin-dash-split">
                <div className="admin-dash-split__main">
                    {/* Direction toggle + table header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                            ✈️ {t('admin_dash_dep_arr')} — {selectedAirport.iata}
                            <span className="admin-live-badge">
                                <span className="admin-live-badge__dot" />
                                {t('admin_dash_live')}
                            </span>
                            {loading && <RefreshCw size={16} style={{ color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite' }} />}
                        </h2>

                        {/* Departures / Arrivals / All toggle */}
                        <div className="dash-dir-toggle">
                            <button
                                className={`dash-dir-btn${direction === 'all' ? ' dash-dir-btn--active' : ''}`}
                                onClick={() => setDirection('all')}
                            >
                                All
                            </button>
                            <button
                                className={`dash-dir-btn${direction === 'departure' ? ' dash-dir-btn--active dash-dir-btn--dep' : ''}`}
                                onClick={() => setDirection('departure')}
                            >
                                <ArrowUp size={13} /> Departures
                                {direction !== 'departure' && kpi.departures > 0 && (
                                    <span className="dash-dir-count">{kpi.departures}</span>
                                )}
                            </button>
                            <button
                                className={`dash-dir-btn${direction === 'arrival' ? ' dash-dir-btn--active dash-dir-btn--arr' : ''}`}
                                onClick={() => setDirection('arrival')}
                            >
                                <ArrowDown size={13} /> Arrivals
                                {direction !== 'arrival' && kpi.arrivals > 0 && (
                                    <span className="dash-dir-count">{kpi.arrivals}</span>
                                )}
                            </button>
                        </div>

                        <button onClick={fetchFlights} style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '5px 12px', borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
                            cursor: 'pointer', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)',
                        }}>
                            <RefreshCw size={14} /> {t('admin_dash_refresh')}
                        </button>
                    </div>

                    <div className="admin-table-wrap">
                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>{t('admin_dash_flight_col')}</th>
                                        <th>{t('admin_dash_airline_col')}</th>
                                        <th>{t('admin_dash_route_col')}</th>
                                        <th>{t('admin_dash_scheduled_col')}</th>
                                        <th>{t('admin_dash_terminal_col')}</th>
                                        <th>{t('admin_dash_gate_col')}</th>
                                        <th>{t('admin_dash_delay_col')}</th>
                                        <th>{t('admin_dash_status_col')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map(flight => (
                                        <tr key={flight.id + flight.direction} onClick={() => setSelectedFlight(flight)} style={{ cursor: 'pointer' }}>
                                            <td>
                                                {flight.direction === 'departure'
                                                    ? <ArrowUp size={14} style={{ color: '#3B82F6' }} />
                                                    : <ArrowDown size={14} style={{ color: '#22C55E' }} />
                                                }
                                            </td>
                                            <td style={{ fontWeight: 600, color: '#E2E8F0' }}>{flight.flight_number}</td>
                                            <td className="admin-table__muted">{flight.airline_name}</td>
                                            <td>
                                                {`${flight.dep_iata} → ${flight.arr_iata}`}
                                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                                                    {flight.direction === 'departure' ? flight.arr_airport : flight.dep_airport}
                                                </div>
                                            </td>
                                            <td>
                                                {flight.direction === 'departure'
                                                    ? formatTime(flight.dep_scheduled)
                                                    : formatTime(flight.arr_scheduled)
                                                }
                                            </td>
                                            <td className="admin-table__muted">
                                                {(flight.direction === 'departure' ? flight.dep_terminal : flight.arr_terminal) || '—'}
                                            </td>
                                            <td className="admin-table__muted">
                                                {(flight.direction === 'departure' ? flight.dep_gate : flight.arr_gate) || '—'}
                                            </td>
                                            <td>
                                                {flight.delay_minutes == null ? '—' : flight.delay_minutes > 0 ? (
                                                    <span className="admin-table__danger">
                                                        +{flight.delay_minutes} min
                                                    </span>
                                                ) : '0 min'}
                                            </td>
                                            <td>
                                                <span className={STATUS_CLASS[flight.status] || ''}>
                                                    {STATUS_LABEL[flight.status] || flight.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {paginated.length === 0 && (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.3)' }}>
                                                No flights found for this filter.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <Pagination
                            currentPage={safeCurrentPage}
                            totalItems={filtered.length}
                            pageSize={PAGE_SIZE}
                            onPageChange={setCurrentPage}
                            className="admin-pagination"
                        />
                    </div>

                    {/* Summary bar */}
                    <div style={{
                        display: 'flex', gap: 16, marginTop: 8, fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', flexWrap: 'wrap',
                    }}>
                        <span>↑ {kpi.departures} {t('admin_dash_departures_summary')}</span>
                        <span>↓ {kpi.arrivals} {t('admin_dash_arrivals_summary')}</span>
                        {kpi.delayed > 0 && <span style={{ color: '#F59E0B' }}>⚠ {kpi.delayed} {t('admin_dash_delayed_summary')}</span>}
                        {kpi.cancelled > 0 && <span style={{ color: '#EF4444' }}>✕ {kpi.cancelled} {t('admin_dash_cancelled_summary')}</span>}
                    </div>
                </div>

                {/* AI side panel (right column, fixed-width) */}
                <div className="admin-dash-split__aside">
                    {isSuperAdmin ? <SuperAdminAIAlerts /> : <AirportAdminAIAlerts />}
                </div>
            </div>


            {/* Flight Details Modal */}
            {selectedFlight && (
                <FlightDetailsModal
                    flight={{
                        ...selectedFlight,
                        flightNumber: selectedFlight.flight_number,
                        airline: selectedFlight.airline_name,
                        origin: selectedFlight.dep_iata,
                        destination: selectedFlight.arr_iata,
                        scheduledTime: formatTime(selectedFlight.dep_scheduled),
                        status: STATUS_LABEL[selectedFlight.status] || selectedFlight.status,
                        predictedDelay: selectedFlight.delay_minutes,
                        riskLevel: selectedFlight.delay_minutes > 60 ? 'High' : selectedFlight.delay_minutes > 15 ? 'Medium' : 'Low',
                    }}
                    isOpen={!!selectedFlight}
                    onClose={() => setSelectedFlight(null)}
                />
            )}
        </div>
    );
}

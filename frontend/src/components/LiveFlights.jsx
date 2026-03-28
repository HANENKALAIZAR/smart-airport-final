import { useState, useEffect } from 'react';
import { Plane, RefreshCw, ArrowDown, ArrowUp, Clock, AlertTriangle } from 'lucide-react';
import { useAirport } from '../context/AirportContext';
import Pagination from './Pagination';

const STATUS_BADGE = {
    on_time: { label: 'On Time', color: '#22C55E', bg: '#DCFCE7' },
    scheduled: { label: 'Scheduled', color: '#3B82F6', bg: '#DBEAFE' },
    delayed: { label: 'Delayed', color: '#F59E0B', bg: '#FEF3C7' },
    cancelled: { label: 'Cancelled', color: '#EF4444', bg: '#FEE2E2' },
    landed: { label: 'Landed', color: '#8B5CF6', bg: '#EDE9FE' },
};

const PAGE_SIZE = 10;

function formatTime(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return '—'; }
}

export default function LiveFlights() {
    const { selectedAirport } = useAirport();
    const [flights, setFlights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [lastUpdated, setLastUpdated] = useState(null);

    async function fetchFlights() {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/aviationstack/flights/${selectedAirport.iata}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setFlights(json.flights || []);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('LiveFlights error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchFlights();
        const iv = setInterval(fetchFlights, 300000);
        return () => clearInterval(iv);
    }, [selectedAirport.iata]);

    const filtered = filter === 'all'
        ? flights
        : flights.filter(f => f.direction === filter);

    useEffect(() => { setCurrentPage(1); }, [filter, flights]);

    const start = (currentPage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(start, start + PAGE_SIZE);

    const depCount = flights.filter(f => f.direction === 'departure').length;
    const arrCount = flights.filter(f => f.direction === 'arrival').length;

    if (loading && flights.length === 0) {
        return (
            <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: 6 }}>Loading real-time flights for {selectedAirport.iata}…</p>
            </div>
        );
    }

    if (error && flights.length === 0) {
        return (
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                <p style={{ color: '#EF4444' }}>⚠️ Could not load flight data</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{error}</p>
                <button onClick={fetchFlights} style={{
                    marginTop: 10, padding: '5px 14px', borderRadius: 8,
                    border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                    cursor: 'pointer', fontSize: '0.8rem',
                }}>Retry</button>
            </div>
        );
    }

    return (
        <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        ✈️ Real-Time Flights — {selectedAirport.iata}
                        <span style={{
                            fontSize: '0.65rem', padding: '2px 8px', borderRadius: 12,
                            background: '#DCFCE7', color: '#22C55E', fontWeight: 600,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', animation: 'pulse 2s infinite' }} />
                            Live
                        </span>
                    </h2>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {flights.length} flights · {depCount} departures · {arrCount} arrivals
                        {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
                    </span>
                </div>
                <button onClick={fetchFlights} style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                    borderRadius: 6, border: '1px solid var(--border-color)',
                    background: 'transparent', cursor: 'pointer', fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {[
                    { key: 'all', label: `All (${flights.length})` },
                    { key: 'departure', label: `↑ Departures (${depCount})` },
                    { key: 'arrival', label: `↓ Arrivals (${arrCount})` },
                ].map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)} style={{
                        padding: '4px 12px', borderRadius: 20, border: '1px solid',
                        borderColor: filter === f.key ? 'var(--primary)' : 'var(--border-color)',
                        background: filter === f.key ? 'rgba(99,102,241,0.08)' : 'transparent',
                        color: filter === f.key ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500,
                    }}>
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Flight list */}
            {filtered.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16, fontSize: '0.85rem' }}>
                    No flights found.
                </p>
            ) : (
                <>
                    <div style={{ display: 'grid', gap: 6 }}>
                        {paginated.map((flight, i) => {
                            const badge = STATUS_BADGE[flight.status] || STATUS_BADGE.scheduled;
                            const isDep = flight.direction === 'departure';
                            return (
                                <div key={flight.id + flight.direction + i} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '10px 12px', borderRadius: 10,
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                }}>
                                    {/* Direction icon */}
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                        background: isDep ? '#DBEAFE' : '#DCFCE7',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {isDep
                                            ? <ArrowUp size={16} style={{ color: '#3B82F6' }} />
                                            : <ArrowDown size={16} style={{ color: '#22C55E' }} />
                                        }
                                    </div>

                                    {/* Flight info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                {flight.flight_number}
                                            </span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                {flight.airline_name}
                                            </span>
                                            <span style={{
                                                fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4,
                                                fontWeight: 500, background: badge.bg, color: badge.color,
                                                marginLeft: 'auto',
                                            }}>
                                                {badge.label}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                            {isDep
                                                ? `${flight.dep_iata} → ${flight.arr_iata} · ${flight.arr_airport}`
                                                : `${flight.dep_iata} → ${flight.arr_iata} · from ${flight.dep_airport}`
                                            }
                                        </div>
                                        <div style={{ display: 'flex', gap: 10, marginTop: 2, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <Clock size={10} />
                                                {isDep ? formatTime(flight.dep_scheduled) : formatTime(flight.arr_scheduled)}
                                            </span>
                                            {flight.dep_terminal && <span>Terminal {flight.dep_terminal}</span>}
                                            {flight.dep_gate && <span>Gate {flight.dep_gate}</span>}
                                            {flight.delay_minutes > 0 && (
                                                <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    <AlertTriangle size={10} />
                                                    +{flight.delay_minutes} min delay
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <Pagination
                        currentPage={currentPage}
                        totalItems={filtered.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={setCurrentPage}
                    />
                </>
            )}
        </div>
    );
}

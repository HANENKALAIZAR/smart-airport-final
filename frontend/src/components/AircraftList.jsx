import { useState, useEffect } from "react";
import { Plane, RefreshCw } from "lucide-react";
import Pagination from "./Pagination";

const PAGE_SIZE = 10;

export default function AircraftList() {
    const [aircraft, setAircraft] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    async function fetchAircraft() {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch("/api/opensky/states");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setAircraft(data);
            setLastUpdated(new Date());
            // Reset page if current page would be out of bounds
            setCurrentPage(p => {
                const maxPage = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
                return p > maxPage ? 1 : p;
            });
        } catch (err) {
            console.error("Error fetching aircraft:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchAircraft();
        const interval = setInterval(fetchAircraft, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading && aircraft.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: 8 }}>Loading live aircraft data…</p>
            </div>
        );
    }

    if (error && aircraft.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '20px', color: '#e74c3c' }}>
                <p>⚠️ Could not reach OpenSky API</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Make sure the backend is running: <code>uvicorn app.main:app --reload --port 8000</code>
                </p>
                <button
                    onClick={fetchAircraft}
                    style={{
                        marginTop: 12, padding: '6px 16px', borderRadius: 8,
                        border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                        cursor: 'pointer', fontSize: '0.85rem',
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const paginatedAircraft = aircraft.slice(start, start + PAGE_SIZE);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {aircraft.length} aircraft in the Mediterranean region
                    {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
                </span>
                <button
                    onClick={fetchAircraft}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 6,
                        border: '1px solid var(--border-color)', background: 'transparent',
                        cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)',
                    }}
                >
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {aircraft.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>
                    No aircraft currently detected in the area.
                </p>
            ) : (
                <>
                    <div style={{ display: 'grid', gap: 8 }}>
                        {paginatedAircraft.map((f) => (
                            <div
                                key={f.icao24}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 14px', borderRadius: 10,
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                }}
                            >
                                <Plane
                                    size={18}
                                    style={{
                                        color: f.on_ground ? 'var(--text-muted)' : 'var(--primary)',
                                        transform: f.heading ? `rotate(${f.heading}deg)` : undefined,
                                        flexShrink: 0,
                                    }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                        {f.callsign || f.icao24}
                                        <span style={{
                                            marginLeft: 8, fontSize: '0.7rem', padding: '2px 6px',
                                            borderRadius: 4, fontWeight: 500,
                                            background: f.on_ground ? '#fef3c7' : '#dbeafe',
                                            color: f.on_ground ? '#92400e' : '#1e40af',
                                        }}>
                                            {f.on_ground ? 'Ground' : 'Airborne'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                        {f.origin_country}
                                        {f.alt != null && ` · Alt: ${Math.round(f.alt)}m`}
                                        {f.velocity != null && ` · ${Math.round(f.velocity)} m/s`}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination
                        currentPage={currentPage}
                        totalItems={aircraft.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={setCurrentPage}
                        className="admin-pagination"
                    />
                </>
            )}
        </div>
    );
}

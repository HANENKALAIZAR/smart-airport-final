import { useState, useEffect } from 'react';
import { Search, AlertCircle, RefreshCw, Plane, ArrowUp, ArrowDown, Filter } from 'lucide-react';
import { apiGetFlights } from '../../services/adminApi';
import FlightDetailsModal from '../../components/admin/FlightDetailsModal';
import { useLanguage } from '../../context/LanguageContext';
import { useAirport } from '../../context/AirportContext';
import CustomSelect from '../../components/admin/ui/CustomSelect';

interface RawFlight {
    id: number;
    flight_number: string;
    airline?: { name?: string } | null;
    origin_airport?: { iata_code?: string } | null;
    dest_airport?: { iata_code?: string } | null;
    scheduled_departure?: string | null;
    delay_minutes?: number | null;
    status?: string | null;
    aircraft_type?: string | null;
    [key: string]: any;
}

function formatCanonicalFlight(flightNumber: string, airlineIata?: string, airlineIcao?: string): string {
    if (!flightNumber) return '';
    const numPart = flightNumber.replace(/^[A-Za-z]+/, "");
    if (!numPart) return flightNumber;
    const iata = airlineIata ? `${airlineIata.toUpperCase()}${numPart}` : '';
    const icao = airlineIcao ? `${airlineIcao.toUpperCase()}${numPart}` : '';
    if (iata && icao && iata !== icao) {
        return `${iata} / ${icao}`;
    }
    return flightNumber;
}

interface AdaptedFlight {
    id: number;
    flightNumber: string;
    canonicalFlightNumber: string;
    airline: string;
    airlineIata?: string;
    airlineIcao?: string;
    origin: string;
    destination: string;
    scheduledTime: string;
    weather: string;
    predictedDelay: number | null;
    riskLevel: 'High' | 'Medium' | 'Low' | 'Unknown';
    status: string;
    aircraftType: string;
    trafficLevel: string;
    direction: 'departure' | 'arrival';
    _raw: RawFlight;
}

function adaptFlight(f: RawFlight): AdaptedFlight {
    const direction = f.direction || (f.dest_airport?.iata_code === 'TUN' ? 'arrival' : 'departure');
    const airlineIata = f.airline?.iata_code || '';
    const airlineIcao = f.airline?.icao_code || '';
    const canonicalFlightNumber = formatCanonicalFlight(f.flight_number, airlineIata, airlineIcao);
    return {
        id: f.id,
        flightNumber: f.flight_number,
        canonicalFlightNumber,
        airline: f.airline?.name || '—',
        airlineIata,
        airlineIcao,
        origin: f.origin_airport?.iata_code || '—',
        destination: f.dest_airport?.iata_code || '—',
        scheduledTime: f.scheduled_departure
            ? new Date(f.scheduled_departure).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
            : '—',
        weather: '—',
        predictedDelay: f.delay_minutes ?? null,
        riskLevel: f.delay_minutes == null ? 'Unknown' : f.delay_minutes > 30 ? 'High' : f.delay_minutes > 10 ? 'Medium' : 'Low',
        status: f.status === 'on_time' ? 'On-Time'
            : f.status === 'delayed' ? 'Delayed'
            : f.status === 'cancelled' ? 'Cancelled'
            : f.status === 'boarding' ? 'Boarding'
            : f.status === 'departed' ? 'Departed'
            : f.status === 'landed' ? 'Landed'
            : 'Scheduled',
        aircraftType: f.aircraft_type || '—',
        trafficLevel: 'Medium',
        direction: direction as 'departure' | 'arrival',
        _raw: f,
    };
}

const STATUS_CLASS: Record<string, string> = {
    'On-Time': 'admin-table__status--on-time',
    'Delayed': 'admin-table__status--delayed',
    'Boarding': 'admin-table__status--boarding',
    'Departed': 'admin-table__status--departed',
    'Landed': 'admin-table__status--departed',
    'Cancelled': 'admin-table__status--cancelled',
};

export default function AdminFlights() {
    const { t } = useLanguage();
    const { selectedAirport } = useAirport();
    const [flights, setFlights] = useState<AdaptedFlight[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState('');
    const [search, setSearch] = useState('');
    const [riskFilter, setRiskFilter] = useState('all');
    const [tab, setTab] = useState<'all' | 'departure' | 'arrival'>('all');
    const [selected, setSelected] = useState<AdaptedFlight | null>(null);

    useEffect(() => {
        load();
    }, [selectedAirport.iata]);

    async function load() {
        setLoading(true);
        setPageError('');
        const { data, error } = await apiGetFlights();
        setLoading(false);
        if (error) {
            setPageError(`Could not load flights: ${error}`);
            return;
        }
        setFlights((data || []).map(adaptFlight));
    }

    const filtered = flights.filter(f => {
        const q = search.toLowerCase();
        const cleanQuery = q.replace(/\s+/g, "").toLowerCase();
        const numericPart = f.flightNumber.replace(/^[A-Za-z]+/, "").toLowerCase();
        const iataVariant = f.airlineIata ? `${f.airlineIata}${numericPart}`.toLowerCase() : "";
        const icaoVariant = f.airlineIcao ? `${f.airlineIcao}${numericPart}`.toLowerCase() : "";
        
        const hay = `${f.flightNumber} ${f.canonicalFlightNumber} ${iataVariant} ${icaoVariant} ${f.airline} ${f.origin} ${f.destination}`.toLowerCase();
        
        const matchSearch = !q
            || hay.includes(cleanQuery)
            || hay.includes(q);
        const matchRisk = riskFilter === 'all' || f.riskLevel === riskFilter;
        const matchTab = tab === 'all' || f.direction === tab;
        return matchSearch && matchRisk && matchTab;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="animate-fade-in">
            {/* Header */}
            <div className="admin-page__header">
                <div>
                    <h1 className="admin-page__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Plane size={22} style={{ color: 'var(--adm-accent)' }} />
                        {t('admin_flights_title') || 'Flights'}
                    </h1>
                    <p className="admin-page__subtitle">
                        {t('admin_flights_subtitle') || `All scheduled, active, and historical movements at ${selectedAirport.name} (${selectedAirport.iata}).`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="admin-btn admin-btn--outline" onClick={load}>
                        <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {pageError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '0.84rem' }}>
                    <AlertCircle size={16} />
                    <span style={{ flex: 1 }}>{pageError}</span>
                    <button type="button" onClick={() => setPageError('')} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer' }}>✕</button>
                </div>
            )}

            {/* Navigation Tab Selector */}
            <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--adm-border)', borderRadius: 12, width: 'fit-content' }}>
                {[
                    { k: 'all', l: 'All Movements' },
                    { k: 'departure', l: 'Departures', icon: ArrowUp },
                    { k: 'arrival', l: 'Arrivals', icon: ArrowDown },
                ].map(t => {
                    const active = tab === t.k;
                    const Icon = (t as any).icon;
                    return (
                        <button key={t.k} onClick={() => setTab(t.k as any)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '0.5rem 1.1rem', borderRadius: 8, border: 'none',
                                background: active ? 'linear-gradient(135deg, #F59E0B, #FBBF24)' : 'transparent',
                                color: active ? '#0A1628' : 'var(--adm-text-sub)',
                                fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 180ms'
                            }}
                        >
                            {Icon && <Icon size={13} style={{ opacity: 0.8 }} />}
                            {t.l}
                        </button>
                    );
                })}
            </div>

            {/* Filter & Toolbar */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                gap: '0.75rem', padding: '0.85rem',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--adm-border)', borderRadius: 14,
            }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                    <input
                        id="flight-list-search"
                        name="search"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('admin_flights_search_placeholder') || 'Search flights…'}
                        style={{
                            width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--adm-border)',
                            color: '#E2E8F0', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box'
                        }}
                    />
                </div>
                <div style={{ width: 180 }}>
                    <CustomSelect
                        options={[
                            { value: 'all', label: 'All Risk Levels' },
                            { value: 'High', label: 'High Risk' },
                            { value: 'Medium', label: 'Medium Risk' },
                            { value: 'Low', label: 'Low Risk' },
                            { value: 'Unknown', label: 'Unknown Risk' },
                        ]}
                        value={riskFilter}
                        onChange={(val: any) => setRiskFilter(val)}
                    />
                </div>

                <span style={{ fontSize: '0.78rem', color: 'var(--adm-text-muted)', marginLeft: 'auto', fontWeight: 600 }}>
                    {loading ? 'Loading…' : `${filtered.length} flights`}
                </span>
            </div>

            {/* Flights Table */}
            <div className="admin-table-wrap" style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--adm-border)' }}>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Flight</th>
                            <th>Airline</th>
                            <th>Route</th>
                            <th>Scheduled Time</th>
                            <th>Gate</th>
                            <th>Risk</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(f => (
                            <tr key={`${f.id}-${f.direction}`} onClick={() => setSelected(f)} style={{ cursor: 'pointer' }}>
                                <td style={{ width: 40, textAlign: 'center' }}>
                                    {f.direction === 'departure'
                                        ? <ArrowUp size={14} style={{ color: '#60A5FA' }} />
                                        : <ArrowDown size={14} style={{ color: '#34D399' }} />
                                    }
                                </td>
                                <td style={{ fontWeight: 700, color: '#E2E8F0' }}>{f.canonicalFlightNumber || f.flightNumber}</td>
                                <td>{f.airline}</td>
                                <td style={{ fontWeight: 600 }}>
                                    {f.direction === 'departure' 
                                        ? `${f.origin} → ${f.destination}` 
                                        : `${f.origin} → ${f.destination}`}
                                </td>
                                <td>{f.scheduledTime}</td>
                                <td className="admin-table__muted">{f._raw.dep_gate || f._raw.arr_gate || '—'}</td>
                                <td>
                                    <span className={`aviation-badge aviation-badge--${f.riskLevel.toLowerCase()}`}>
                                        {f.riskLevel.toUpperCase()}
                                    </span>
                                </td>
                                <td>
                                    <span className={STATUS_CLASS[f.status] || ''}>
                                        {f.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && !loading && (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--adm-text-muted)' }}>
                                    No tracked flight found for this search. Some external flights may not yet be synchronized from the realtime provider.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

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

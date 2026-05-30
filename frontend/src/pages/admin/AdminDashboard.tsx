import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Plane, Clock, AlertTriangle, TrendingUp, TrendingDown, RefreshCw,
    ArrowUp, ArrowDown, Search, ChevronDown, Check,
    XCircle, BellRing, Users as UsersIcon, Wrench, Radio, Cloud,
    ChevronLeft, ChevronRight, X, MapPin, CloudRain,
} from 'lucide-react';
import AirportAdminAIAlerts from './AirportAdminAIAlerts';
import SuperAdminAIAlerts from './SuperAdminAIAlerts';
import FlightAIModal from '../../components/admin/FlightAIModal';
import { useAirport } from '../../context/AirportContext';
import { useLanguage } from '../../context/LanguageContext';

const PAGE_SIZE = 8;

// ── Status display helpers ──────────────────────────────────────────────────
// Labels are keyed — components call getStatusLabel(status, t) to get translated label
const STATUS_META: Record<string, { labelKey: string; dot: string; glowClass?: string }> = {
    on_time:   { labelKey: 'status_label_on_time',   dot: '#10B981' },
    scheduled: { labelKey: 'status_label_scheduled', dot: '#10B981' },
    delayed:   { labelKey: 'status_label_delayed',   dot: '#EF4444', glowClass: 'glow-delayed' },
    cancelled: { labelKey: 'status_label_cancelled', dot: '#6B7280', glowClass: 'glow-cancelled' },
    boarding:  { labelKey: 'status_label_boarding',  dot: '#F59E0B', glowClass: 'glow-boarding' },
    taxiing:   { labelKey: 'status_label_taxiing',   dot: '#3B82F6', glowClass: 'glow-taxiing' },
    in_air:    { labelKey: 'status_label_in_air',    dot: '#10B981', glowClass: 'glow-in-air' },
    departed:  { labelKey: 'status_label_departed',  dot: '#9B9C9E' },
    landed:    { labelKey: 'status_label_landed',    dot: '#6366F1' },
    stale_unresolved: { labelKey: 'status_label_unavailable', dot: '#94A3B8' },
};


interface FlightRow {
    id: number;
    flight_number: string;
    airline_name: string;
    dep_iata: string;
    arr_iata: string;
    dep_airport: string;
    arr_airport: string;
    dep_scheduled: string;
    arr_scheduled: string;
    dep_terminal?: string | null;
    arr_terminal?: string | null;
    dep_gate?: string | null;
    arr_gate?: string | null;
    delay_minutes?: number | null;
    status: string;
    direction: 'departure' | 'arrival';
}

function normalizeFlightStatus(raw?: string): string {
    const s = String(raw || '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    const map: Record<string, string> = {
        scheduled: 'scheduled', active: 'in_air', en_route: 'in_air', in_air: 'in_air',
        on_time: 'on_time', ontime: 'on_time',
        delayed: 'delayed', delay: 'delayed', boarding: 'boarding',
        taxiing: 'taxiing',
        departed: 'departed', cancelled: 'cancelled', canceled: 'cancelled',
        landed: 'landed', complete: 'landed',
        stale_unresolved: 'stale_unresolved'
    };
    return map[s] || (['scheduled','on_time','delayed','boarding','taxiing','in_air','departed','cancelled','landed','stale_unresolved'].includes(s) ? s : 'scheduled');
}


function formatTime(iso?: string): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch { return '—'; }
}

// ── KPI Card — exact Skyward kpi-card structure ─────────────────────────────
function KPICard({ title, value, suffix, icon, trend }: {
    title: string; value: string | number; suffix?: string;
    icon: React.ReactNode; trend?: number;
}) {
    const isUp = trend !== undefined && trend > 0;
    const isDown = trend !== undefined && trend < 0;
    return (
        <div className="kpi-card">
            <div className="kpi-card__header">
                <div>
                    <p className="kpi-card__title">{title}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span className="kpi-card__value">
                            {value}
                            {suffix && <span className="kpi-card__suffix">{suffix}</span>}
                        </span>
                    </div>
                    {trend !== undefined && (
                        <div className={`kpi-card__trend ${isUp ? 'kpi-card__trend--up' : isDown ? 'kpi-card__trend--down' : 'kpi-card__trend--neutral'}`}>
                            {isUp && <TrendingUp size={16} />}
                            {isDown && <TrendingDown size={16} />}
                            <span>{isUp ? '+' : ''}{trend}%</span>
                        </div>
                    )}
                </div>
                <div className="kpi-card__icon">{icon}</div>
            </div>
        </div>
    );
}

// ── CustomSelect — Skyward polished dropdown ────────────────────────────────
function CustomSelect<T extends string>({
    label, value, options, onChange, width = 170,
}: {
    label: string;
    value: T;
    options: { value: T; label: string; dot?: string }[];
    onChange: (v: T) => void;
    width?: number;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);
    const current = options.find(o => o.value === value);
    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', gap: 4, minWidth: width }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--adm-text-muted)' }}>{label}</span>
            <button
                type="button"
                className="csel__btn"
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8, padding: '0.5rem 0.7rem',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--adm-border)',
                    borderRadius: 10, cursor: 'pointer',
                    color: 'var(--adm-text)', fontSize: '0.8rem', fontWeight: 600,
                    fontFamily: 'inherit', minHeight: 36, width: '100%',
                    transition: 'all 200ms ease',
                }}
            >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {current?.dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: current.dot, boxShadow: `0 0 6px ${current.dot}88` }} />}
                    {current?.label}
                </span>
                <ChevronDown size={14} style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0)', color: 'var(--adm-text-muted)', flexShrink: 0 }} />
            </button>
            {open && (
                <ul
                    style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                        margin: 0, padding: 4, listStyle: 'none', zIndex: 60,
                        background: 'var(--adm-card)', border: '1px solid var(--adm-border)',
                        borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                        maxHeight: 260, overflowY: 'auto',
                    }}
                >
                    {options.map(o => {
                        const active = o.value === value;
                        return (
                            <li
                                key={o.value}
                                onClick={() => { onChange(o.value); setOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '0.5rem 0.65rem', borderRadius: 7, cursor: 'pointer',
                                    fontSize: '0.8rem', fontWeight: active ? 700 : 500,
                                    color: active ? 'var(--adm-accent)' : 'var(--adm-text-sub)',
                                    background: active ? 'var(--adm-accent-light)' : 'transparent',
                                    transition: 'background 120ms ease',
                                }}
                                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                            >
                                {o.dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.dot }} />}
                                <span style={{ flex: 1 }}>{o.label}</span>
                                {active && <Check size={13} />}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

// ── Status options for filter selects ────────────────────────────────────────
export const AIRPORT_CODES = ["TUN", "DJE", "NBE", "MIR"] as const;
export const IATA_TO_ICAO: Record<string, string> = {
    TUN: "DTTA",
    MIR: "DTMB",
    DJE: "DTTJ",
    NBE: "DTNH",
};
export type AirportCode = (typeof AIRPORT_CODES)[number];
export type AirportFilter = "all" | AirportCode;

type StatusFilter = 'all' | string;
type RiskFilter = 'all' | 'low' | 'medium' | 'high';
type TimeRange = 'all' | 'morning' | 'afternoon' | 'evening';

const STATUS_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'scheduled', label: 'Scheduled', dot: '#10B981' },
    { value: 'boarding', label: 'Boarding', dot: '#F59E0B' },
    { value: 'taxiing', label: 'Taxiing', dot: '#3B82F6' },
    { value: 'in_air', label: 'In Air', dot: '#10B981' },
    { value: 'delayed', label: 'Delayed', dot: '#EF4444' },
    { value: 'cancelled', label: 'Canceled', dot: '#6B7280' },
    { value: 'landed', label: 'Landed', dot: '#6366F1' },
];


const RISK_OPTIONS = [
    { value: 'all', label: 'All Risk' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
];

const TIME_OPTIONS = [
    { value: 'all', label: 'All Day' },
    { value: 'morning', label: 'Morning' },
    { value: 'afternoon', label: 'Afternoon' },
    { value: 'evening', label: 'Evening' },
];

const AIRPORT_OPTIONS: { value: AirportFilter; label: string }[] = [
    { value: "all", label: "all" }, // label resolved via t() in component
    ...AIRPORT_CODES.map(c => ({ value: c as AirportFilter, label: c })),
];

function inTimeRange(time: string, range: TimeRange) {
    if (range === 'all') return true;
    const [h] = time.split(':').map(Number);
    if (range === 'morning') return h >= 0 && h < 12;
    if (range === 'afternoon') return h >= 12 && h < 18;
    return h >= 18 && h <= 23;
}

function formatDelay(minutes: number | null | undefined, includePlus = true): string {
    if (minutes == null || minutes <= 0) return '0 min';
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const prefix = includePlus ? '+' : '';
    if (h > 0) return `${prefix}${h}h ${m}m`;
    return `${prefix}${m}m`;
}

interface AdminDashboardProps {
    selectedDate: Date;
    onDateChange?: (date: Date) => void;
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

export default function AdminDashboard({ selectedDate, onDateChange }: AdminDashboardProps) {
    const { selectedAirport, role } = useAirport();
    const { t } = useLanguage();
    const isSuperAdmin = role === 'super_admin';

    // Translated filter options (reactive to language changes)
    const STATUS_OPTIONS = [
        { value: 'all', label: t('filter_opt_all') || 'All' },
        { value: 'scheduled', label: t('status_label_scheduled') || 'Scheduled', dot: '#10B981' },
        { value: 'boarding',  label: t('status_label_boarding')  || 'Boarding',  dot: '#F59E0B' },
        { value: 'taxiing',   label: t('status_label_taxiing')   || 'Taxiing',   dot: '#3B82F6' },
        { value: 'in_air',    label: t('status_label_in_air')    || 'In Air',    dot: '#10B981' },
        { value: 'delayed',   label: t('status_label_delayed')   || 'Delayed',   dot: '#EF4444' },
        { value: 'cancelled', label: t('status_label_cancelled') || 'Cancelled', dot: '#6B7280' },
        { value: 'landed',    label: t('status_label_landed')    || 'Landed',    dot: '#6366F1' },
    ];
    const RISK_OPTIONS = [
        { value: 'all',    label: t('filter_opt_all_risk') || 'All Risk' },
        { value: 'low',    label: t('filter_opt_low')      || 'Low' },
        { value: 'medium', label: t('filter_opt_medium')   || 'Medium' },
        { value: 'high',   label: t('filter_opt_high')     || 'High' },
    ];
    const TIME_OPTIONS = [
        { value: 'all',       label: t('filter_opt_all_day')   || 'All Day' },
        { value: 'morning',   label: t('filter_opt_morning')   || 'Morning' },
        { value: 'afternoon', label: t('filter_opt_afternoon') || 'Afternoon' },
        { value: 'evening',   label: t('filter_opt_evening')   || 'Evening' },
    ];
    const AIRPORT_OPTIONS_TR: { value: AirportFilter; label: string }[] = [
        { value: 'all', label: t('filter_opt_all') || 'All' },
        ...AIRPORT_CODES.map(c => ({ value: c as AirportFilter, label: c })),
    ];

    const [flights, setFlights] = useState<FlightRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    // Draft filter values
    const [draftStatus, setDraftStatus] = useState<StatusFilter>('all');
    const [draftRisk, setDraftRisk] = useState<RiskFilter>('all');
    const [draftAirport, setDraftAirport] = useState<AirportFilter>('all');
    const [draftTime, setDraftTime] = useState<TimeRange>('all');
    // Applied filter values
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
    const [airportFilter, setAirportFilter] = useState<AirportFilter>('all');
    const [timeFilter, setTimeFilter] = useState<TimeRange>('all');
    const [directionTab, setDirectionTab] = useState<'all' | 'departure' | 'arrival'>('all');
    const [page, setPage] = useState(1);
    const [selectedFlight, setSelectedFlight] = useState<FlightRow | null>(null);

    const [localDate, setLocalDate] = useState<Date>(selectedDate);

    useEffect(() => {
        setLocalDate(selectedDate);
    }, [selectedDate]);

    const handlePrevDay = () => {
        const d = new Date(localDate);
        d.setDate(d.getDate() - 1);
        setLocalDate(d);
        if (onDateChange) onDateChange(d);
    };

    const handleNextDay = () => {
        const d = new Date(localDate);
        d.setDate(d.getDate() + 1);
        setLocalDate(d);
        if (onDateChange) onDateChange(d);
    };

    const dateLabel = new Date().toLocaleDateString(t('__locale__') === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const fetchFlights = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0');
            const day = String(localDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
            const res = await fetch(`${baseUrl}/api/aviation-edge/flights/${selectedAirport.iata}?date=${dateStr}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const rawList = json.flights || [];
            const fetched = rawList.map((f: any) => ({ ...f, status: normalizeFlightStatus(f.status) }));
            setFlights(fetched);
        } catch {
            setError(t('admin_dash_live_feed_unavailable') || 'Live feed unavailable');
            setFlights([]);
        } finally {
            setLoading(false);
        }
    }, [selectedAirport.iata, localDate]);

    useEffect(() => {
        fetchFlights();
        const iv = setInterval(fetchFlights, 60000);
        return () => clearInterval(iv);
    }, [fetchFlights]);


    const kpi = useMemo(() => {
        const total = flights.length;
        const departures = flights.filter(f => f.direction === 'departure').length;
        const arrivals = flights.filter(f => f.direction === 'arrival').length;
        const delayed = flights.filter(f => f.status === 'delayed').length;
        const cancelled = flights.filter(f => f.status === 'cancelled').length;
        const onTime = flights.filter(f => f.status === 'on_time' || f.status === 'scheduled').length;
        const onTimePct = total > 0 ? Math.round((onTime / total) * 1000) / 10 : 100;
        const validDelays = flights.map(f => f.delay_minutes).filter((d): d is number => d != null);
        const avgDelay = validDelays.length > 0 ? Math.round(validDelays.reduce((s, d) => s + d, 0) / validDelays.length) : 0;
        const activeDeparting = flights.filter(f => 
            f.direction === 'departure' && 
            ['boarding', 'taxiing', 'in_air'].includes(f.status)
        ).length;
        return { total, departures, arrivals, delayed, cancelled, onTimePct, avgDelay, activeDeparting };
    }, [flights]);


    const draftDirty =
        draftStatus !== statusFilter ||
        draftRisk !== riskFilter ||
        draftAirport !== airportFilter ||
        draftTime !== timeFilter;

    const activeFilterCount =
        (statusFilter !== 'all' ? 1 : 0) +
        (riskFilter !== 'all' ? 1 : 0) +
        (airportFilter !== 'all' ? 1 : 0) +
        (timeFilter !== 'all' ? 1 : 0);

    const applyFilters = () => {
        setStatusFilter(draftStatus);
        setRiskFilter(draftRisk);
        setAirportFilter(draftAirport);
        setTimeFilter(draftTime);
        setPage(1);
    };

    const resetFilters = () => {
        setDraftStatus('all'); setDraftRisk('all'); setDraftAirport('all'); setDraftTime('all');
        setStatusFilter('all'); setRiskFilter('all'); setAirportFilter('all'); setTimeFilter('all');
        setSearch(''); setPage(1);
    };

    const filtered = useMemo(() => flights.filter(f => {
        if (statusFilter !== 'all' && f.status !== statusFilter) return false;
        if (riskFilter !== 'all') {
            const r = (f.delay_minutes ?? 0) > 30 ? 'high' : (f.delay_minutes ?? 0) > 10 ? 'medium' : 'low';
            if (r !== riskFilter) return false;
        }
        if (airportFilter !== 'all') {
            const icao = IATA_TO_ICAO[airportFilter];
            const matchesDep = f.dep_iata === airportFilter || (icao && f.dep_iata === icao);
            const matchesArr = f.arr_iata === airportFilter || (icao && f.arr_iata === icao);
            if (!matchesDep && !matchesArr) return false;
        }
        if (directionTab !== 'all' && f.direction !== directionTab) return false;
        const time = formatTime(f.direction === 'arrival' ? f.arr_scheduled : f.dep_scheduled);
        if (!inTimeRange(time, timeFilter)) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            const cleanQuery = q.replace(/\s+/g, "").toLowerCase();
            const numericPart = f.flight_number.replace(/^[A-Za-z]+/, "").toLowerCase();
            const iataVariant = f.airline_iata ? `${f.airline_iata}${numericPart}`.toLowerCase() : "";
            const icaoVariant = f.airline_icao ? `${f.airline_icao}${numericPart}`.toLowerCase() : "";
            
            const hay = `${f.flight_number} ${iataVariant} ${icaoVariant} ${f.airline_name} ${f.dep_iata} ${f.arr_iata}`.toLowerCase();
            if (!hay.includes(cleanQuery) && !hay.includes(q)) return false;
        }
        return true;
    }), [flights, statusFilter, riskFilter, airportFilter, directionTab, timeFilter, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const getVisiblePages = () => {
        const pages: (number | string)[] = [];
        const delta = 1; // number of pages to show around current active page
        const left = Math.max(2, safePage - delta);
        const right = Math.min(totalPages - 1, safePage + delta);

        pages.push(1);
        if (left > 2) {
            pages.push('...');
        }
        for (let i = left; i <= right; i++) {
            pages.push(i);
        }
        if (right < totalPages - 1) {
            pages.push('...');
        }
        if (totalPages > 1) {
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes pulse-green {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                    70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                @keyframes pulse-yellow {
                    0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
                    70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                }
                .glow-in-air {
                    box-shadow: 0 0 8px rgba(16, 185, 129, 0.7);
                    animation: pulse-green 2s infinite;
                }
                .glow-taxiing {
                    box-shadow: 0 0 8px rgba(59, 130, 246, 0.8);
                }
                .glow-boarding {
                    box-shadow: 0 0 8px rgba(245, 158, 11, 0.7);
                    animation: pulse-yellow 2s infinite;
                }
                .glow-delayed {
                    box-shadow: 0 0 8px rgba(239, 68, 68, 0.7);
                }
                .glow-cancelled {
                    box-shadow: 0 0 8px rgba(107, 114, 128, 0.6);
                }
                .pagination-scroll::-webkit-scrollbar {
                    display: none;
                }
                .pagination-scroll {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            ` }} />
            {/* ── Page Header ── */}
            <div className="admin-page__header">
                <div>
                    <h1 className="admin-page__title">{t('admin_dash_ops') || 'Operations Overview'}</h1>
                    <p className="admin-page__subtitle">
                        Live ops snapshot — <strong>{selectedAirport.name} ({selectedAirport.iata})</strong>, {dateLabel}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="admin-btn admin-btn--outline" onClick={fetchFlights}>
                        <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
                        <span>{t('admin_dash_refresh') || 'Refresh'}</span>
                    </button>
                </div>
            </div>

            {/* ── KPI Cards — exact Skyward grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <KPICard title={t('admin_dash_total_today') || 'Flights Today'} value={loading ? '…' : kpi.total} icon={<Plane size={28} />} trend={6} />
                <KPICard title={t('admin_dash_on_time_rate') || 'On-Time Rate'} value={loading ? '…' : kpi.onTimePct} suffix="%" icon={<Clock size={28} />} trend={2} />
                <KPICard title={t('admin_dash_avg_delay') || 'Avg Delay'} value={loading ? '…' : formatDelay(kpi.avgDelay, false)} icon={<AlertTriangle size={28} />} trend={kpi.avgDelay > 15 ? -4 : 2} />
                <KPICard title={t('admin_dash_active_departures') || 'Active Departures'} value={loading ? '…' : kpi.activeDeparting} icon={<TrendingUp size={28} />} trend={0} />
            </div>

            {/* ── Data-control toolbar — exact Skyward layout ── */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                gap: '0.75rem', padding: '0.85rem', marginBottom: '1rem',
                background: 'var(--adm-card)',
                border: '1px solid var(--adm-border)',
                borderRadius: 14,
                boxShadow: 'var(--adm-shadow)',
            }}>
                {/* Search */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '0.5rem 0.85rem',
                    background: 'var(--adm-input-bg)',
                    border: '1px solid var(--adm-border)',
                    borderRadius: 10,
                    minWidth: 240, flex: '0 1 280px',
                    transition: 'all 0.2s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--adm-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--adm-accent-light)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--adm-border)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                    <Search size={15} style={{ color: 'var(--adm-text-muted)' }} />
                    <input
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        placeholder={t('admin_dash_search_placeholder') || 'Search flights, airlines, gates…'}
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--adm-text)', fontSize: '0.82rem' }}
                    />
                    {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'var(--adm-text-muted)', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>}
                </div>

                <CustomSelect<StatusFilter>
                    label={t('admin_dash_filter_status') || 'Status'}
                    options={STATUS_OPTIONS}
                    value={draftStatus}
                    onChange={setDraftStatus}
                />
                <CustomSelect<RiskFilter>
                    label={t('admin_dash_filter_risk') || 'Risk'}
                    options={RISK_OPTIONS}
                    value={draftRisk}
                    onChange={setDraftRisk}
                    width={150}
                />
                <CustomSelect<AirportFilter>
                    label={t('admin_dash_filter_airport') || 'Airport'}
                    options={AIRPORT_OPTIONS_TR}
                    value={draftAirport}
                    onChange={setDraftAirport}
                    width={140}
                />
                <CustomSelect<TimeRange>
                    label={t('admin_dash_filter_time') || 'Time'}
                    options={TIME_OPTIONS}
                    value={draftTime}
                    onChange={setDraftTime}
                    width={160}
                />

                {/* Active filter indicator + actions */}
                <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {activeFilterCount > 0 && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '0.35rem 0.65rem', borderRadius: 8,
                            background: 'var(--adm-accent-light)', color: 'var(--adm-accent)',
                            fontSize: '0.72rem', fontWeight: 600,
                        }}>
                            {activeFilterCount} {t('admin_dash_active_filters') || 'active filter(s)'}
                        </span>
                    )}

                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            className="admin-btn admin-btn--outline"
                            onClick={resetFilters}
                            disabled={activeFilterCount === 0 && search === ''}
                            style={{ padding: '0.45rem 0.85rem', fontSize: '0.75rem', opacity: activeFilterCount === 0 && search === '' ? 0.5 : 1 }}
                        >
                            {t('admin_dash_reset') || 'Reset'}
                        </button>
                        <button
                            className="admin-btn admin-btn--primary"
                            onClick={applyFilters}
                            disabled={!draftDirty}
                            style={{ 
                                padding: '0.45rem 1.25rem', fontSize: '0.75rem', 
                                opacity: !draftDirty ? 0.5 : 1,
                                fontWeight: 700,
                                boxShadow: draftDirty ? 'var(--adm-shadow)' : 'none'
                            }}
                        >
                            {t('admin_dash_apply_filters') || 'Apply Filters'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Tabs (All / Departures / Arrivals) ── */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--adm-border)' }}>
                {(['all', 'departure', 'arrival'] as const).map(tab => {
                    const active = directionTab === tab;
                    const tabLabel = tab === 'all'
                        ? (t('admin_dash_tab_all') || 'All Live Flights')
                        : tab === 'departure'
                            ? (t('admin_dash_tab_departures') || 'Departures')
                            : (t('admin_dash_tab_arrivals') || 'Arrivals');
                    return (
                        <button
                            key={tab}
                            onClick={() => { setDirectionTab(tab); setPage(1); }}
                            style={{
                                padding: '0.75rem 1.25rem',
                                background: 'none', border: 'none',
                                color: active ? 'var(--adm-accent)' : 'var(--adm-text-sub)',
                                fontSize: '0.8rem', fontWeight: active ? 700 : 500,
                                borderBottom: active ? '2px solid var(--adm-accent)' : '2px solid transparent',
                                cursor: 'pointer',
                                transition: 'all 150ms ease',
                            }}
                        >
                            {tabLabel}
                        </button>
                    );
                })}
            </div>

            {/* ── Main Grid: Flight Table + AI Panel ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: '1rem', alignItems: 'flex-start' }}>
                {/* Departures & Arrivals table */}
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--adm-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Plane size={18} style={{ color: 'var(--adm-accent)' }} />
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--adm-text)' }}>
                                {t('admin_dash_dep_arr') || 'Departures & Arrivals'}
                            </h3>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, background: 'rgba(52,211,153,0.12)', color: '#34D399', fontSize: '0.68rem', fontWeight: 700 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399' }} />
                                {loading ? (t('admin_dash_loading') || 'LOADING') : (t('admin_dash_live') || 'LIVE')}
                            </span>
                        </div>
                        {/* Date Navigation Button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.35rem 0.5rem', background: 'var(--adm-input-bg)', border: '1px solid var(--adm-border)', borderRadius: 999 }}>
                            <button onClick={handlePrevDay} style={{ background: 'none', border: 'none', color: 'var(--adm-text-sub)', cursor: 'pointer', display: 'flex', padding: 4, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--adm-text)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--adm-text-sub)'}>
                                <ChevronLeft size={16} />
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--adm-text)', letterSpacing: '0.02em' }}>
                                    {localDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })}
                                </span>
                                {localDate.toDateString() === new Date().toDateString() && (
                                    <span style={{ background: 'var(--adm-accent-glow)', color: 'var(--adm-accent)', fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: 8, letterSpacing: '0.05em' }}>
                                        {t('admin_dash_today_label') || 'TODAY'}
                                    </span>
                                )}
                            </div>
                            <button onClick={handleNextDay} style={{ background: 'none', border: 'none', color: 'var(--adm-text-sub)', cursor: 'pointer', display: 'flex', padding: 4, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--adm-text)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--adm-text-sub)'}>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div style={{ margin: '0.75rem 1rem', padding: '0.6rem 1rem', borderRadius: 8, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171', fontSize: '0.8rem' }}>
                            ⚠ {error}
                        </div>
                    )}

                    <div style={{ overflowX: 'auto' }}>
                        <table className="admin-table">
                            <thead>
                                <tr><th></th><th>{t('admin_dash_flight_col') || 'Flight'}</th><th>{t('admin_dash_airline_col') || 'Airline'}</th><th>{t('admin_dash_route_col') || 'Route'}</th><th>{t('admin_dash_scheduled_col') || 'Scheduled'}</th><th>{t('admin_dash_terminal_col') || 'Terminal'}</th><th>{t('admin_dash_gate_col') || 'Gate'}</th><th>{t('admin_dash_delay_col') || 'Delay'}</th><th>{t('admin_dash_status_col') || 'Status'}</th></tr>
                            </thead>
                            <tbody>
                                {pageRows.map(f => {
                                    const isArr = f.direction === 'arrival';
                                    const Dir = isArr ? ArrowDown : ArrowUp;
                                    const dirColor = isArr ? '#34D399' : '#60A5FA';
                                    const meta = STATUS_META[f.status] || STATUS_META.scheduled;
                                    const statusLabel = t(meta.labelKey) || meta.labelKey;
                                    const time = isArr ? formatTime(f.arr_scheduled) : formatTime(f.dep_scheduled);
                                    const terminal = (isArr ? f.arr_terminal : f.dep_terminal) || '—';
                                    const gate = (isArr ? f.arr_gate : f.dep_gate) || '—';
                                    
                                    // Smart Date Mismatch Badge logic
                                    const schedTimeStr = isArr ? f.arr_scheduled : f.dep_scheduled;
                                    let showHistoricalBadge = false;
                                    if (schedTimeStr) {
                                        try {
                                            const schedDate = new Date(schedTimeStr);
                                            const isDifferentDay = (
                                                schedDate.getFullYear() !== localDate.getFullYear() ||
                                                schedDate.getMonth() !== localDate.getMonth() ||
                                                schedDate.getDate() !== localDate.getDate()
                                            );
                                            const ageHours = (new Date().getTime() - schedDate.getTime()) / (3600 * 1000);
                                            if (isDifferentDay && ageHours > 24) {
                                                showHistoricalBadge = true;
                                            }
                                        } catch (e) {}
                                    }

                                    return (
                                        <tr key={`${f.id}-${f.direction}`} onClick={() => setSelectedFlight(f)} style={{ cursor: 'pointer' }}>
                                            <td><Dir size={16} style={{ color: dirColor }} /></td>
                                            <td style={{ fontWeight: 700 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                                                    <span>{formatCanonicalFlight(f.flight_number, f.airline_iata, f.airline_icao)}</span>
                                                    {showHistoricalBadge && (
                                                        <span 
                                                            title={t('admin_dash_historical_badge') || 'Historical data — different calendar day'}
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center',
                                                                padding: '1px 5px', borderRadius: 4,
                                                                background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444',
                                                                fontSize: '0.62rem', fontWeight: 700,
                                                                letterSpacing: '0.02em', border: '1px solid rgba(239, 68, 68, 0.25)'
                                                            }}
                                                        >
                                                            {t('admin_dash_historical_badge') || 'Historical Data'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="admin-table__muted">{f.airline_name}</td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{f.dep_iata} → {f.arr_iata}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--adm-text-muted)' }}>{isArr ? f.dep_airport : f.arr_airport}</div>
                                            </td>
                                            <td>{time}</td>
                                            <td>{terminal}</td>
                                            <td>{gate}</td>
                                            <td><span className={f.delay_minutes != null && f.delay_minutes > 0 ? 'admin-table__danger' : ''}>{formatDelay(f.delay_minutes)}</span></td>
                                            <td>
                                                <span 
                                                    title={f.status === 'stale_unresolved' ? "Realtime provider updates are no longer available for this flight." : undefined}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                                        padding: '3px 9px', borderRadius: 999,
                                                        background: `${meta.dot}1f`, color: meta.dot,
                                                        fontSize: '0.72rem', fontWeight: 700,
                                                        border: `1px solid ${meta.dot}40`,
                                                        cursor: f.status === 'stale_unresolved' ? 'help' : 'default',
                                                    }}
                                                >
                                                    <span className={meta.glowClass || ''} style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot }} />
                                                    {statusLabel}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {pageRows.length === 0 && !loading && (
                                    <tr><td colSpan={9}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', color: 'var(--adm-text-muted)' }}>
                                            <div style={{ background: 'var(--adm-bg)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem', border: '1px solid var(--adm-border)' }}>
                                                {error ? <AlertTriangle size={32} style={{ color: '#EF4444' }} /> : <Plane size={32} style={{ opacity: 0.5 }} />}
                                            </div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--adm-text)', marginBottom: '0.25rem' }}>
                                                {error ? (t('admin_dash_live_feed_unavailable') || 'Live feed unavailable') : (t('admin_dash_no_flights_found') || 'No tracked flight found for this search')}
                                            </div>
                                            <div style={{ fontSize: '0.85rem' }}>
                                                {error ? (t('admin_dash_check_connection') || 'Check backend connection or AviationEdge API key.') : (t('admin_dash_external_note') || 'Some external flights may not yet be synchronized from the realtime provider.')}
                                            </div>
                                            {activeFilterCount > 0 && !error && (
                                                <button onClick={resetFilters} className="admin-btn admin-btn--outline" style={{ marginTop: '1.25rem', fontSize: '0.75rem' }}>
                                                    {t('admin_dash_clear_filters') || 'Clear active filters'}
                                                </button>
                                            )}
                                        </div>
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {filtered.length > 0 && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem 1.1rem',
                            borderTop: '1px solid var(--adm-border)',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                        }}>
                            <span style={{ fontSize: '0.74rem', color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>
                                {t('__showing__')?.replace('{x}', String((safePage - 1) * PAGE_SIZE + 1)).replace('{y}', String(Math.min(safePage * PAGE_SIZE, filtered.length))).replace('{z}', String(filtered.length)) ||
                                    `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} / ${filtered.length}`}
                            </span>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                overflowX: 'auto',
                                maxWidth: '100%',
                                paddingBottom: '2px',
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none',
                            }} className="pagination-scroll">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--adm-border)', background: 'transparent', color: 'var(--adm-text-sub)', cursor: safePage === 1 ? 'not-allowed' : 'pointer', opacity: safePage === 1 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                    aria-label="Previous page">
                                    <ChevronLeft size={14} />
                                </button>
                                {getVisiblePages().map((n, idx) => {
                                    if (n === '...') {
                                        return (
                                            <span key={`e-${idx}`}
                                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, height: 32, flexShrink: 0, color: 'var(--adm-text-muted)', fontSize: '0.78rem', userSelect: 'none' }}>
                                                …
                                            </span>
                                        );
                                    }
                                    const active = n === safePage;
                                    return (
                                        <button key={n} onClick={() => setPage(Number(n))}
                                            style={{ minWidth: 32, height: 32, padding: '0 10px', borderRadius: 8, border: active ? '1px solid var(--adm-accent)' : '1px solid var(--adm-border)', background: active ? 'linear-gradient(135deg, #F59E0B, #FBBF24)' : 'transparent', color: active ? '#0A1628' : 'var(--adm-text-sub)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                                            {n}
                                        </button>
                                    );
                                })}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--adm-border)', background: 'transparent', color: 'var(--adm-text-sub)', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', opacity: safePage === totalPages ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                    aria-label="Next page">
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* AI Decision-Support panel */}
                <div className="admin-card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 7rem)' }}>
                    {isSuperAdmin ? <SuperAdminAIAlerts /> : <AirportAdminAIAlerts />}
                </div>
            </div>

            {/* Flight AI Modal */}
            {selectedFlight && (
                <FlightAIModal flight={selectedFlight} onClose={() => setSelectedFlight(null)} />
            )}
        </>
    );
}

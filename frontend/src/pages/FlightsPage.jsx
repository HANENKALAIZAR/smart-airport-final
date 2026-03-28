import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, AlertTriangle, ChevronLeft, ChevronRight, PlaneTakeoff, PlaneLanding, RefreshCw } from 'lucide-react';
import { getFlights } from '../services/api';
import { useAirport } from '../context/AirportContext';
import { useLanguage } from '../context/LanguageContext';
import LiveFlights from '../components/LiveFlights';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All', 'on_time', 'delayed', 'boarding', 'cancelled'];
const AUTO_REFRESH_INTERVAL = 90000; // 90 seconds

export default function FlightsPage() {
    const { selectedAirport } = useAirport();
    const { t } = useLanguage();
    const [flights, setFlights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [direction, setDirection] = useState('departures');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedDate, setSelectedDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
    const [currentPage, setCurrentPage] = useState(1);

    // New state for enhancements
    const [lastUpdated, setLastUpdated] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [autoRetryCountdown, setAutoRetryCountdown] = useState(0);
    const retryTimerRef = useRef(null);
    const autoRefreshRef = useRef(null);

    const loadFlights = useCallback(async () => {
        setRefreshing(true);
        setError(null);
        try {
            if (!flights.length) setLoading(true);
            const data = await getFlights();
            setFlights(data);
            setLastUpdated(new Date());
            setLoading(false);
        } catch (err) {
            setError(err.message || 'unknown');
            setLoading(false);
            // Start auto-retry countdown
            setAutoRetryCountdown(30);
        } finally {
            setRefreshing(false);
        }
    }, [flights.length]);

    // Initial load
    useEffect(() => { loadFlights(); }, []);

    // Auto-refresh every 90 seconds
    useEffect(() => {
        autoRefreshRef.current = setInterval(() => {
            loadFlights();
        }, AUTO_REFRESH_INTERVAL);
        return () => clearInterval(autoRefreshRef.current);
    }, [loadFlights]);

    // Auto-retry countdown
    useEffect(() => {
        if (autoRetryCountdown > 0) {
            retryTimerRef.current = setTimeout(() => {
                setAutoRetryCountdown(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(retryTimerRef.current);
        } else if (autoRetryCountdown === 0 && error) {
            loadFlights();
        }
    }, [autoRetryCountdown, error, loadFlights]);

    const dateStr = selectedDate.toISOString().slice(0, 10);
    const airportIata = selectedAirport.iata;

    const filtered = useMemo(() => {
        return flights.filter(f => {
            const depDate = f.scheduled_departure?.slice(0, 10);
            if (depDate !== dateStr) return false;
            if (direction === 'departures' && f.origin_airport?.iata_code !== airportIata) return false;
            if (direction === 'arrivals' && f.dest_airport?.iata_code !== airportIata) return false;
            const matchSearch = !search
                || f.flight_number.toLowerCase().includes(search.toLowerCase())
                || f.origin_airport?.iata_code?.toLowerCase().includes(search.toLowerCase())
                || f.dest_airport?.iata_code?.toLowerCase().includes(search.toLowerCase())
                || f.airline?.name?.toLowerCase().includes(search.toLowerCase());
            const matchStatus = statusFilter === 'All' || f.status === statusFilter;
            return matchSearch && matchStatus;
        });
    }, [flights, dateStr, airportIata, direction, search, statusFilter]);

    useEffect(() => { setCurrentPage(1); }, [search, statusFilter, dateStr, direction]);

    const pStart = (currentPage - 1) * PAGE_SIZE;
    const paginatedFlights = filtered.slice(pStart, pStart + PAGE_SIZE);

    function formatTime(dt) {
        if (!dt) return '--:--';
        return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    function shiftDate(days) {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d);
    }

    // Delay severity helpers
    function getDelaySeverity(minutes) {
        if (!minutes || minutes <= 0) return 'on-time';
        if (minutes <= 15) return 'on-time';
        if (minutes <= 45) return 'moderate';
        return 'severe';
    }

    function getDelayColor(minutes) {
        const severity = getDelaySeverity(minutes);
        if (severity === 'on-time') return '#22C55E';
        if (severity === 'moderate') return '#F59E0B';
        return '#EF4444';
    }

    function getCardExtraClasses(flight) {
        const classes = [];
        if (flight.status === 'cancelled') classes.push('flight-card--cancelled');
        if (flight.status === 'delayed' && flight.delay_minutes > 120) classes.push('flight-card--severe');
        if (flight.status === 'delayed' && flight.delay_minutes > 45) classes.push('flight-card--delayed-heavy');
        return classes.join(' ');
    }

    const d = selectedDate;
    const dateFmt = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    const todayStr = new Date().toISOString().slice(0, 10);
    const isToday = dateStr === todayStr;

    const STATUS_LABELS = {
        All: t('status_all'), on_time: t('status_on_time'), delayed: t('status_delayed'),
        boarding: t('status_boarding'), cancelled: t('status_cancelled'), scheduled: t('status_scheduled')
    };
    const STATUS_BADGE = {
        on_time: t('badge_on_time'), cancelled: t('badge_cancelled'),
        scheduled: t('badge_scheduled'), boarding: t('badge_boarding'),
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1 className="page-title">{t('flights_title')}</h1>
                <p className="page-subtitle">{t('flights_subtitle')}</p>
            </div>

            {/* Real-time OpenSky flights */}
            <LiveFlights />

            {/* ── Last Updated Bar ──────────────────────────── */}
            <div className="last-updated-bar">
                <div className="last-updated-bar__left">
                    <RefreshCw size={13} className={refreshing ? 'sync-spin' : ''} />
                    <span>
                        {t('last_updated')}: {lastUpdated ? lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                    </span>
                    <span className="last-updated-bar__live">
                        <span className="last-updated-bar__dot" />
                        {t('live_label')}
                    </span>
                </div>
                <span style={{ fontSize: '0.7rem' }}>{t('auto_refresh')} ~90s</span>
            </div>

            {/* ── Modern Toolbar ──────────────────────────── */}
            <div className="flights-toolbar">
                <div className="flights-toolbar__search">
                    <input
                        type="text"
                        className="flights-toolbar__input"
                        placeholder={t('flights_search_placeholder')}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <Search size={18} className="flights-toolbar__search-icon" />
                </div>

                <div className="flights-dir-toggle">
                    <button
                        className={`flights-dir-btn${direction === 'departures' ? ' flights-dir-btn--active' : ''}`}
                        onClick={() => setDirection('departures')}
                    >
                        <PlaneTakeoff size={15} />
                        {t('departures') || 'Departures'}
                    </button>
                    <button
                        className={`flights-dir-btn${direction === 'arrivals' ? ' flights-dir-btn--active' : ''}`}
                        onClick={() => setDirection('arrivals')}
                    >
                        <PlaneLanding size={15} />
                        {t('arrivals') || 'Arrivals'}
                    </button>
                </div>

                <div className="flights-date-nav">
                    <button className="flights-date-nav__arrow" onClick={() => shiftDate(-1)}>
                        <ChevronLeft size={16} />
                    </button>
                    <div className="flights-date-nav__label">
                        <span className="flights-date-nav__date">{dateFmt}</span>
                        {isToday && <span className="flights-date-nav__today">{t('today')}</span>}
                    </div>
                    <button className="flights-date-nav__arrow" onClick={() => shiftDate(1)}>
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Status Filters */}
            <div className="filters">
                {STATUS_FILTERS.map(s => (
                    <button key={s} className={`filter-pill${statusFilter === s ? ' active' : ''}`}
                        onClick={() => setStatusFilter(s)}>
                        {STATUS_LABELS[s] || s}
                    </button>
                ))}
            </div>

            {/* Flight count */}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                {filtered.length} {t('flights_found')}
            </div>

            {/* ── Error State ──────────────────────────── */}
            {error && !loading && (
                <div className="error-state">
                    <div className="error-state__icon">⚠️</div>
                    <div className="error-state__title">{t('error')}</div>
                    <div className="error-state__reason">
                        {error.includes('timeout') ? t('error_api_timeout') : t('error_data_unavailable')}
                    </div>
                    <div className="error-state__actions">
                        <button className="error-state__retry-btn" onClick={loadFlights}>
                            <RefreshCw size={13} /> {t('refresh')}
                        </button>
                        {autoRetryCountdown > 0 && (
                            <span className="error-state__auto-retry">
                                {t('error_auto_retry')} {autoRetryCountdown} {t('error_seconds')}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Flight list */}
            {loading ? (
                <div className="flight-list">
                    {[1, 2, 3].map(i => <div key={i} className="card"><div className="skeleton skeleton--card" /></div>)}
                </div>
            ) : !error && filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state__icon">🔍</div>
                    <div className="empty-state__text">{t('flights_no_results')} {dateFmt}</div>
                </div>
            ) : !error && (
                <>
                    <div className="flight-list">
                        {paginatedFlights.map(flight => (
                            <Link key={flight.id} to={`/flights/${flight.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <div className={`card card--clickable flight-card ${getCardExtraClasses(flight)}`}>
                                    <div className="card__header">
                                        <div>
                                            <div className="card__title">{flight.flight_number}</div>
                                            <div className="card__subtitle">{flight.airline?.name} • {flight.aircraft_type}</div>
                                        </div>
                                        <span
                                            className={`badge badge--${flight.status}`}
                                            style={flight.status === 'delayed' ? { background: `${getDelayColor(flight.delay_minutes)}18`, color: getDelayColor(flight.delay_minutes), borderColor: `${getDelayColor(flight.delay_minutes)}40` } : {}}
                                            title={flight.delay_cause ? `${flight.delay_cause.icon} ${flight.delay_cause.title}: ${flight.delay_cause.summary}` : ''}
                                        >
                                            {flight.status === 'delayed'
                                                ? `⚠ +${flight.delay_minutes >= 60 ? Math.floor(flight.delay_minutes / 60) + 'h' + (flight.delay_minutes % 60 > 0 ? flight.delay_minutes % 60 + 'min' : '') : flight.delay_minutes + 'min'}`
                                                : STATUS_BADGE[flight.status] || STATUS_BADGE.scheduled}
                                        </span>
                                    </div>

                                    <div className="flight-card__route">
                                        <div className="flight-card__airport">
                                            <div className="flight-card__iata">{flight.origin_airport?.iata_code}</div>
                                            <div className="flight-card__city">{flight.origin_airport?.city}</div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: flight.status === 'cancelled' ? '#EF4444' : '#1E293B', marginTop: 4 }}>
                                                {flight.status === 'cancelled' ? t('flights_cancelled') : flight.actual_departure ? formatTime(flight.actual_departure) : formatTime(flight.scheduled_departure)}
                                            </div>
                                            {flight.status !== 'cancelled' && flight.actual_departure && flight.actual_departure !== flight.scheduled_departure && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                                    {t('flights_est')} {formatTime(flight.scheduled_departure)}
                                                </div>
                                            )}
                                            {flight.status === 'boarding' && flight.gate && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--primary-600)', fontWeight: 600, marginTop: 2 }}>
                                                    {t('flights_gate')} {flight.gate}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flight-card__arrow">
                                            <div className={`flight-card__line${flight.status === 'cancelled' ? ' flight-card__line--cancelled' : ''}`} />
                                            <div className="flight-card__duration">{flight.distance_km} km</div>
                                        </div>
                                        <div className="flight-card__airport">
                                            <div className="flight-card__iata">{flight.dest_airport?.iata_code}</div>
                                            <div className="flight-card__city">{flight.dest_airport?.city}</div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: flight.status === 'cancelled' ? '#EF4444' : '#1E293B', marginTop: 4 }}>
                                                {flight.status === 'cancelled' ? t('flights_cancelled') : flight.actual_arrival ? formatTime(flight.actual_arrival) : formatTime(flight.scheduled_arrival)}
                                            </div>
                                            {flight.status !== 'cancelled' && flight.actual_arrival && flight.actual_arrival !== flight.scheduled_arrival && (
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                                    {t('flights_est')} {formatTime(flight.scheduled_arrival)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flight-card__meta">
                                        {flight.status === 'delayed' && (
                                            <span className="flight-card__meta-item" style={{ color: getDelayColor(flight.delay_minutes) }}>
                                                <AlertTriangle size={14} /> {flight.delay_minutes >= 60 ? Math.floor(flight.delay_minutes / 60) + 'h' + (flight.delay_minutes % 60 > 0 ? ' ' + flight.delay_minutes % 60 + 'min' : '') : flight.delay_minutes + ' min'} {t('flights_delay')}
                                                {flight.delay_cause && (
                                                    <span style={{ marginLeft: 6, opacity: 0.75, fontSize: '0.72rem' }}>
                                                        — {flight.delay_cause.icon} {flight.delay_cause.title}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                        {flight.status === 'cancelled' && flight.delay_cause && (
                                            <span className="flight-card__meta-item" style={{ color: '#EF4444' }}>
                                                {flight.delay_cause.icon} {flight.delay_cause.title}
                                            </span>
                                        )}
                                        {flight.status === 'boarding' && flight.gate && (
                                            <span className="flight-card__meta-item" style={{ color: 'var(--primary-600)', fontWeight: 600 }}>
                                                🛫 {t('flights_now_boarding')} {flight.gate}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
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

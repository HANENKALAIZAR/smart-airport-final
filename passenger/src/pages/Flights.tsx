import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { addDays, format, formatDistanceToNow, isSameDay, isPast, isFuture, subDays } from "date-fns";
import {
  ArrowUpDown, ArrowDown, ArrowUp, Search, RotateCw, Plane,
  PlaneTakeoff, PlaneLanding, Radio, ChevronLeft, ChevronRight, Building2, Loader2,
  RefreshCw, Clock,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PublicNav } from "@/components/PublicNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import logoUrl from "@/assets/logo.png";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import flightsHero from "@/assets/flights-hero.jpg";
import { getPassengerFlights, type Flight, type FlightStatus } from "@/services/api";
import { TUNISIAN_AIRPORTS } from "@smart-airport/shared-core/constants/airports.js";

type SortKey = "flightNumber" | "airline" | "from" | "to" | "scheduled" | "estimated" | "status";
type SortDir = "asc" | "desc";
type Direction = "departures" | "arrivals";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { value: FlightStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "scheduled", label: "On time" },
  { value: "boarding", label: "Boarding" },
  { value: "taxiing", label: "Taxiing" },
  { value: "in_air", label: "Departed" },
  { value: "landed", label: "Landed" },
  { value: "delayed", label: "Delayed" },
  { value: "cancelled", label: "Cancelled" },
];


type TnCode = "TUN" | "MIR" | "NBE" | "DJE";

const IATA_TO_ICAO: Record<string, string> = {
  TUN: "DTTA",
  MIR: "DTMB",
  DJE: "DTTJ",
  NBE: "DTNH",
};

import { useTranslation } from "react-i18next";

const Flights = () => {
  const { t } = useTranslation();

  const statusOptions = useMemo(() => [
    { value: "all" as const, label: t("status_all", "All statuses") },
    { value: "scheduled" as const, label: t("status_on_time", "On time") },
    { value: "boarding" as const, label: t("status_boarding", "Boarding") },
    { value: "taxiing" as const, label: t("status_taxiing", "Taxiing") },
    { value: "in_air" as const, label: t("status_departed", "Departed") },
    { value: "landed" as const, label: t("status_landed", "Landed") },
    { value: "delayed" as const, label: t("status_delayed", "Delayed") },
    { value: "cancelled" as const, label: t("status_cancelled", "Cancelled") },
  ], [t]);

  const [allFlights, setAllFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [airportCode, setAirportCode] = useState<TnCode>("TUN");
  const [direction, setDirection] = useState<Direction>("departures");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FlightStatus | "all">("all");
  const [date, setDate] = useState<Date | undefined>(() => new Date());
  const [sortKey, setSortKey] = useState<SortKey>("scheduled");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const lastAutoPagedKey = useRef<string>("");


  // Load flights from DB cache (no polling — data is kept fresh by backend scheduler)
  const loadFlights = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    // direction 'both' includes departures and arrivals
    // Pass the selected date so the backend filters flights server-side
    const dateStr = date ? format(date, "yyyy-MM-dd") : undefined;
    const data = await getPassengerFlights(airportCode, 'both', dateStr);
    setAllFlights(data);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, [airportCode, date]);

  // Load once when airport changes — no polling interval
  useEffect(() => {
    loadFlights(false);
  }, [loadFlights]);

  const handleRefresh = () => loadFlights(true);

  // Reset page when search query, status filter or sort column changes
  useEffect(() => { setPage(1); }, [query, status, sortKey, sortDir]);



  const selectedAirport = TUNISIAN_AIRPORTS.find(a => a.code === airportCode);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();

    const icao = IATA_TO_ICAO[airportCode];
    let rows = allFlights.filter(f => {
      if (direction === "departures" && f.from.code !== airportCode && f.from.code !== icao) return false;
      if (direction === "arrivals" && f.to.code !== airportCode && f.to.code !== icao) return false;
      if (status !== "all" && f.status !== status) return false;
      if (date) {
        const ref = direction === "arrivals" ? f.scheduledArrival : f.scheduledDeparture;
        if (!isSameDay(new Date(ref), date)) return false;
      }
      if (q) {
        const cleanQuery = q.replace(/\s+/g, "").toLowerCase();
        const numericPart = f.flightNumber.replace(/^[A-Za-z]+/, "").toLowerCase();
        const iataVariant = f.airlineCode ? `${f.airlineCode}${numericPart}`.toLowerCase() : "";
        const icaoVariant = f.airlineIcao ? `${f.airlineIcao}${numericPart}`.toLowerCase() : "";
        
        const hay = [
          f.flightNumber.toLowerCase(),
          f.canonicalFlightNumber.toLowerCase(),
          cleanQuery.includes(numericPart) ? cleanQuery : "",
          iataVariant,
          icaoVariant,
          numericPart,
          f.airline.toLowerCase(),
          f.from.code.toLowerCase(),
          f.from.city.toLowerCase(),
          f.to.code.toLowerCase(),
          f.to.city.toLowerCase()
        ].join(" ");
        
        if (!hay.includes(cleanQuery) && !hay.includes(q)) return false;
      }
      return true;
    });

    // Chronological sorting of flights by scheduled time for the selected day
    if (sortKey === "scheduled") {
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const refA = direction === "arrivals"
          ? (a.scheduledArrival || a.arrivalTime)
          : (a.scheduledDeparture || a.departureTime);
        const refB = direction === "arrivals"
          ? (b.scheduledArrival || b.arrivalTime)
          : (b.scheduledDeparture || b.departureTime);
        return (new Date(refA).getTime() - new Date(refB).getTime()) * dir;
      });
    } else {
      // Manual column sort
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        switch (sortKey) {
          case "flightNumber": return a.flightNumber.localeCompare(b.flightNumber) * dir;
          case "airline":      return a.airline.localeCompare(b.airline) * dir;
          case "from":         return a.from.code.localeCompare(b.from.code) * dir;
          case "to":           return a.to.code.localeCompare(b.to.code) * dir;
          case "estimated":    return (new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()) * dir;
          case "status":       return a.status.localeCompare(b.status) * dir;
          default:             return 0;
        }
      });
    }

    return rows;
  }, [allFlights, airportCode, direction, query, status, date, sortKey, sortDir]);

  // Auto-pagination to the flight closest to the current time
  useEffect(() => {
    if (allFlights.length === 0) return;

    // Construct the context key for first-load / airport / date / direction change
    const contextKey = `${airportCode}_${direction}_${date ? format(date, "yyyy-MM-dd") : "any"}`;
    if (lastAutoPagedKey.current === contextKey) {
      return;
    }

    // Rule 14: If date is not today, open page 1 normally.
    const today = new Date();
    if (!date || !isSameDay(date, today)) {
      setPage(1);
      lastAutoPagedKey.current = contextKey;
      return;
    }

    // Rule 8: If the user changes sort column manually, do not force the auto-page again.
    if (sortKey !== "scheduled" || sortDir !== "asc") {
      return;
    }

    const nowTime = today.getTime();
    
    // Find the index of the first flight whose time is greater than or equal to now
    let firstUpcomingIndex = -1;
    for (let i = 0; i < filtered.length; i++) {
      const f = filtered[i];
      const timeStr = direction === "arrivals"
        ? (f.scheduledArrival || f.arrivalTime)
        : (f.scheduledDeparture || f.departureTime);
      const fTime = new Date(timeStr).getTime();
      if (fTime >= nowTime) {
        firstUpcomingIndex = i;
        break;
      }
    }

    if (firstUpcomingIndex !== -1) {
      const targetPage = Math.floor(firstUpcomingIndex / PAGE_SIZE) + 1;
      setPage(targetPage);
    } else if (filtered.length > 0) {
      const lastPage = Math.ceil(filtered.length / PAGE_SIZE);
      setPage(lastPage);
    } else {
      setPage(1);
    }

    // Mark as auto-paged for this context
    lastAutoPagedKey.current = contextKey;
  }, [allFlights, airportCode, date, direction, filtered, sortKey, sortDir]);


  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Reset = clear search/status filters only.
  const resetFilters = () => {
    setQuery(""); setStatus("all"); setDate(new Date()); setPage(1);
  };
  const icao = IATA_TO_ICAO[airportCode];
  const departuresCount = allFlights.filter(f => f.from.code === airportCode || f.from.code === icao).length;
  const arrivalsCount = allFlights.filter(f => f.to.code === airportCode || f.to.code === icao).length;


  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey !== col ? <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      : sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
        : <ArrowDown className="h-3.5 w-3.5 text-primary" />;

  const Th = ({ col, label, className }: { col: SortKey; label: string; className?: string }) => (
    <TableHead className={cn("whitespace-nowrap", className)}>
      <button type="button" onClick={() => toggleSort(col)}
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider hover:text-foreground transition-colors">
        {label} <SortIcon col={col} />
      </button>
    </TableHead>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav overlay />

      {/* HERO */}
      <section className="relative min-h-[70svh] w-full overflow-hidden">
        <img src={flightsHero} alt="Runway" className="absolute inset-0 h-full w-full object-cover" width={1920} height={1080} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_25%,_hsl(0_0%_0%/0.55))]" />
        <div className="relative z-10 min-h-[70svh] flex items-center pt-28 pb-20">
          <div className="max-w-[1200px] mx-auto px-6 md:px-8 w-full">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[11px] uppercase tracking-[0.22em] text-white/90 mb-6">
                <Radio className="h-3 w-3 text-primary animate-pulse" />
                {t("flights_realtime_updates", "Real-time flight updates")}
              </div>
              <h1 className="font-display text-5xl sm:text-6xl md:text-7xl text-white leading-[0.98] drop-shadow-lg">
                {t("explore_flights")}
              </h1>
              <p className="mt-6 max-w-xl mx-auto text-base md:text-lg text-white/85 leading-relaxed">
                {t("explore_flights_desc")}
              </p>
              <div className="mt-10 max-w-xl mx-auto">
                <div className="relative">
                  <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="global-flight-search"
                    name="query"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={t("flights_search_hero_placeholder", "Search flight number, city or airline…")}
                    className="ps-12 h-14 rounded-full bg-white/95 dark:bg-background/95 backdrop-blur-md border-white/30 text-base shadow-2xl focus-visible:ring-primary" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* RESULTS */}
      <section className="px-6 md:px-8 py-16 md:py-20">
        <div className="max-w-[1300px] mx-auto space-y-6">

          {/* Airport selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground me-2">{t("flights_airport_label", "Airport")}</span>
            {TUNISIAN_AIRPORTS.map(a => {
              const active = a.code === airportCode;
              return (
                <button key={a.code} type="button" onClick={() => setAirportCode(a.code as TnCode)}
                  className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all",
                    active ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-card/60 text-foreground hover:border-primary/50 hover:bg-primary/5")}>
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="font-mono font-semibold">{a.code}</span>
                  <span className={cn("text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{t(`airport_${a.code}_city`, a.city)}</span>
                </button>
              );
            })}
          </div>

          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-primary font-medium">{selectedAirport?.name ?? airportCode}</div>
              <h2 className="font-display text-3xl md:text-4xl mt-2">
                {direction === "departures" ? t("flights_departures", "Departures") : t("flights_arrivals", "Arrivals")} ·{" "}
                <span className="text-muted-foreground">
                  {loading ? "…" : (
                    filtered.length === 1
                      ? t("flights_count_one", "1 flight")
                      : t("flights_count_other", { count: filtered.length })
                  )}
                </span>
              </h2>
            </div>
          <div className="flex items-center gap-3">
            {/* Date state badge — shows Historical / Today / Future Schedule */}
            {(() => {
              const today = new Date();
              const selDate = date ?? today;
              const isSelectedToday = isSameDay(selDate, today);
              const isPastDate = !isSelectedToday && (isPast(selDate) || selDate < today);
              const isFutureDate = !isSelectedToday && (isFuture(selDate) || selDate > today);
              let badgeLabel: string;
              let badgeClasses: string;
              if (isSelectedToday) {
                badgeLabel = t("flights_today_badge", "Today");
                badgeClasses = "border-primary/30 bg-primary/10 text-primary";
              } else if (isPastDate) {
                badgeLabel = t("flights_historical_badge", "Historical");
                badgeClasses = "border-muted-foreground/30 bg-muted/10 text-muted-foreground";
              } else {
                badgeLabel = t("flights_future_badge", "Future Schedule");
                badgeClasses = "border-amber-500/30 bg-amber-500/10 text-amber-500";
              }
              return (
                <div className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                  badgeClasses
                )}>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className={cn(
                      "absolute inline-flex h-full w-full rounded-full opacity-60",
                      refreshing ? "animate-spin" : "",
                      isSelectedToday ? "bg-primary" : isPastDate ? "bg-muted-foreground" : "bg-amber-500"
                    )} />
                    <span className={cn(
                      "relative inline-flex rounded-full h-1.5 w-1.5",
                      isSelectedToday ? "bg-primary" : isPastDate ? "bg-muted-foreground" : "bg-amber-500"
                    )} />
                  </span>
                  {refreshing ? t("flights_refreshing", "Refreshing…") : badgeLabel}
                </div>
              );
            })()}
              {lastUpdated && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  <Clock className="inline h-3 w-3 mr-1 opacity-60" />
                  {formatDistanceToNow(lastUpdated, { addSuffix: true })}
                </span>
              )}
              {/* Refresh flight list */}
              <Button
                variant="outline" size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="gap-2 rounded-full"
                title="Refresh flight board with the latest updates"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                {refreshing ? t("flights_refreshing", "Refreshing…") : t("flights_refresh_btn", "Refresh Flights")}
              </Button>
            </div>
          </div>

          {/* Departures/Arrivals toggle + date */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex h-11 items-center rounded-full border border-border bg-card/60 p-1 shadow-sm">
              {(["departures", "arrivals"] as Direction[]).map(d => (
                <button key={d} type="button" onClick={() => setDirection(d)}
                  className={cn("inline-flex h-9 items-center gap-2 rounded-full px-5 text-sm font-medium transition-all",
                    direction === d ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                  {d === "departures" ? <PlaneTakeoff className="h-4 w-4" /> : <PlaneLanding className="h-4 w-4" />}
                  {d === "departures" ? t("common.departure") : t("common.arrival")}
                  <span className={cn("ms-1 rounded-full px-2 py-0.5 text-[10px] font-mono",
                    direction === d ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                    {d === "departures" ? departuresCount : arrivalsCount}
                  </span>
                </button>
              ))}
            </div>

            {/* Date stepper */}
            <div className="inline-flex h-11 items-center rounded-full border border-border bg-card/60 p-1 shadow-sm">
              <button type="button" onClick={() => setDate(d => subDays(d ?? new Date(), 1))} aria-label="Previous day"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold tabular-nums tracking-tight text-foreground hover:bg-secondary transition-colors">
                    {format(date ?? new Date(), "d/M/yyyy")}
                    {date && isSameDay(date, new Date()) && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">{t("flights_today", "Today")}</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <button type="button" onClick={() => setDate(d => addDays(d ?? new Date(), 1))} aria-label="Next day"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-sm shadow-sm">
            <div className="grid gap-3 md:grid-cols-12">
              <div className="relative md:col-span-7">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="filter-flight-query"
                  name="query"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t("common.search")}
                  className="ps-9"
                />
              </div>
              <div className="md:col-span-4">
                <Select name="status" value={status} onValueChange={v => setStatus(v as FlightStatus | "all")}>
                  <SelectTrigger id="filter-flight-status"><SelectValue placeholder={t("common.status", "Status")} /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Reset filters — only clears search + status */}
              <div className="md:col-span-1 flex items-center">
                <Button
                  variant="ghost" size="sm"
                  onClick={resetFilters}
                  disabled={query === "" && status === "all"}
                  className="gap-1.5 text-muted-foreground hover:text-foreground w-full"
                  title="Clear search and status filters"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span className="hidden md:inline text-xs">{t("flights_reset", "Reset")}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Tableau */}
          <div className="rounded-2xl border border-border bg-card/40 overflow-hidden shadow-sm">
            {loading ? (
              <div className="py-24 flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm">{t("common.loading", "Loading...")}</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                    <Th col="flightNumber" label={t("common.flightNumber")} />
                    <Th col="airline" label={t("common.airline", "Airline")} />
                    <Th col="from" label={t("common.departure")} />
                    <Th col="to" label={t("common.arrival")} />
                    <Th col="scheduled" label={t("common.scheduled")} />
                    <TableHead className="text-xs uppercase tracking-wider">{t("common.flightDate", "Flight Date")}</TableHead>
                    <Th col="estimated" label={t("common.estimated", "Estimated")} />
                    <TableHead className="text-xs uppercase tracking-wider">{t("common.gate")}</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">{t("common.terminal")}</TableHead>
                    <Th col="status" label={t("common.status", "Status")} />
                    <TableHead className="text-right text-xs uppercase tracking-wider">{t("common.viewDetails", "Action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-16 text-center text-muted-foreground">
                        <Plane className="h-8 w-8 mx-auto mb-3 opacity-40" />
                        {t("flights_no_results", "No tracked flight found for this search. Some external flights may not yet be synchronized from the realtime provider.")}
                      </TableCell>
                    </TableRow>
                  ) : pageRows.map(f => <FlightRow key={f.id} flight={f} />)}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{start + 1}</span>
                –<span className="font-medium text-foreground">{Math.min(start + PAGE_SIZE, filtered.length)}</span>
                {" "}of <span className="font-medium text-foreground">{filtered.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full"
                  onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} aria-label="Previous page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <Button key={p} variant={p === safePage ? "default" : "ghost"} size="sm"
                    className="h-8 min-w-8 px-2 rounded-full font-mono text-xs" onClick={() => setPage(p)}>
                    {p}
                  </Button>
                ))}
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} aria-label="Next page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-border py-10 px-6 md:px-8">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo" className="h-9 w-auto object-contain" />
            <span className="text-muted-foreground text-sm">Smart Airport · Tunisia</span>
          </div>
          <div className="text-xs text-muted-foreground tabular">© {new Date().getFullYear()}</div>
        </div>
      </footer>
    </div>
  );
};

function FlightRow({ flight: f }: { flight: Flight }) {
  const { t } = useTranslation();
  const isDelayed = (f.delayMin !== null && f.delayMin > 0) || f.status === "delayed";
  const isHighlight = f.status === "boarding" || isDelayed;

  return (
    <TableRow className={cn("group transition-colors", isHighlight && "bg-primary/[0.04] hover:bg-primary/[0.08]")}>
      <TableCell className="font-mono font-semibold tracking-tight">{f.canonicalFlightNumber || f.flightNumber}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-[10px] font-bold tracking-wider">{f.airlineCode}</span>
          <span className="text-sm text-muted-foreground">{f.airline}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{f.from.code}</div>
        <div className="text-xs text-muted-foreground">{t(`airport_${f.from.code.substring(0, 3)}_city`, f.from.city)}</div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{f.to.code}</div>
        <div className="text-xs text-muted-foreground">{t(`airport_${f.to.code.substring(0, 3)}_city`, f.to.city)}</div>
      </TableCell>
      <TableCell className="font-mono text-sm">{formatTime(f.scheduledDeparture)}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {f.flightDate ? format(new Date(f.flightDate), "d/M/yyyy") : format(new Date(f.scheduledDeparture), "d/M/yyyy")}
      </TableCell>
      <TableCell>
        <span className={cn("font-mono text-sm", isDelayed && "text-destructive font-semibold")}>
          {f.delayMin === null ? "—" : formatTime(f.departureTime)}
        </span>
        {f.delayMin !== null && f.delayMin > 0 && <span className="ms-2 text-[10px] uppercase tracking-wider text-destructive">+{f.delayMin}m</span>}
      </TableCell>
      <TableCell className="text-sm">{f.gate ?? <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="text-sm">{f.terminal ?? <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell><StatusBadge status={f.status} /></TableCell>
      <TableCell className="text-right">
        <Button asChild variant="ghost" size="sm" className="opacity-70 group-hover:opacity-100">
          <Link to={`/flights/${f.id}`} state={{ flight: f }}>{t("common.viewDetails", "Details")}</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default Flights;

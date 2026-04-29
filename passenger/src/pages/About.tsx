import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PublicNav } from "@/components/PublicNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { airportsInfo, type AirportInfo } from "@/data/airportsInfo";
import {
  Plane,
  MapPin,
  Users,
  Building2,
  Calendar,
  Phone,
  Globe,
  Search,
  ArrowRight,
  Navigation,
  Package,
  Mountain,
  Compass,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import heroImg from "@/assets/about-hero.jpg";
import { Link } from "react-router-dom";

const airlineTypeStyle: Record<string, string> = {
  national: "bg-primary/15 text-primary border-primary/30",
  international: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "low-cost": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  charter: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-5 hover:border-primary/40 transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function AirportPanel({ airport }: { airport: AirportInfo }) {
  const [airlineFilter, setAirlineFilter] = useState<string>("all");

  const filteredAirlines = useMemo(() => {
    if (airlineFilter === "all") return airport.airlines;
    return airport.airlines.filter((a) => a.type === airlineFilter);
  }, [airport.airlines, airlineFilter]);

  const types = ["all", "national", "international", "low-cost", "charter"] as const;

  return (
    <motion.div
      key={airport.code}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-10"
    >
      {/* Identity card */}
      <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-card/40">
        <div className="p-6 md:p-10 grid lg:grid-cols-[1.4fr_1fr] gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/20">
                {airport.iata} · {airport.icao}
              </Badge>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {airport.area}
              </span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground leading-tight">
              {airport.name}
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
              {airport.description}
            </p>

            <ul className="mt-6 grid sm:grid-cols-2 gap-2.5">
              {airport.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2 text-sm text-foreground/90">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3 self-start">
            <StatCard icon={Users} label="Annual passengers" value={`${airport.passengers2023Millions}M`} hint={`${airport.capacityMillions}M capacity`} />
            <StatCard icon={Building2} label="Terminals" value={`${airport.terminals}`} hint={`${airport.runways} runway${airport.runways > 1 ? "s" : ""}`} />
            <StatCard icon={Globe} label="Destinations" value={`${airport.destinationsCount}`} hint="direct routes" />
            <StatCard icon={Package} label="Cargo / yr" value={`${(airport.cargoTons / 1000).toFixed(1)}k t`} hint="freight handled" />
            <StatCard icon={Calendar} label="Since" value={`${airport.established}`} />
            <StatCard icon={Mountain} label="Elevation" value={`${airport.elevationM} m`} />
          </div>
        </div>

        <div className="border-t border-border/60 px-6 md:px-10 py-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm bg-secondary/30">
          <span className="inline-flex items-center gap-2 text-foreground/80">
            <Building2 className="h-4 w-4 text-primary" /> {airport.operator}
          </span>
          <a href={`tel:${airport.phone}`} className="inline-flex items-center gap-2 text-foreground/80 hover:text-primary">
            <Phone className="h-4 w-4 text-primary" /> {airport.phone}
          </a>
          <a href={airport.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-foreground/80 hover:text-primary">
            <Globe className="h-4 w-4 text-primary" /> Official website
          </a>
          <span className="inline-flex items-center gap-2 text-foreground/80 ms-auto">
            <Compass className="h-4 w-4 text-primary" />
            {airport.coordinates.lat.toFixed(3)}°N · {airport.coordinates.lng.toFixed(3)}°E
          </span>
        </div>
      </Card>

      {/* Airlines */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <h3 className="font-display text-2xl font-semibold text-foreground">
              Compagnies aériennes desservant {airport.shortName}
            </h3>
            <p className="text-muted-foreground text-sm mt-1">
              {airport.airlines.length} airlines currently operate scheduled or seasonal flights.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setAirlineFilter(t)}
                className={`px-3 h-8 text-xs rounded-full border transition-colors capitalize ${
                  airlineFilter === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card/40 text-muted-foreground border-border/60 hover:text-foreground hover:border-primary/40"
                }`}
              >
                {t === "all" ? "All" : t.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredAirlines.map((al) => (
              <motion.div
                key={al.code}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-4 border-border/60 hover:border-primary/40 hover:shadow-amber/10 hover:shadow-lg transition-all group">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-amber/15 grid place-items-center text-primary font-mono font-bold text-sm shrink-0 group-hover:bg-gradient-amber/25 transition-colors">
                      {al.code}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{al.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{al.country}</div>
                      <Badge
                        variant="outline"
                        className={`mt-2 text-[10px] uppercase tracking-wider border ${airlineTypeStyle[al.type]}`}
                      >
                        {al.type.replace("-", " ")}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* Destinations + Transport */}
      <section className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 border-border/60">
          <div className="flex items-center gap-2 mb-5">
            <Navigation className="h-5 w-5 text-primary" />
            <h3 className="font-display text-xl font-semibold text-foreground">
              Top destinations
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {airport.topDestinations.map((d) => (
              <div
                key={d.city}
                className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-transparent hover:border-primary/30 transition-colors"
              >
                <span className="text-2xl">{d.flag}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{d.city}</div>
                  <div className="text-xs text-muted-foreground truncate">{d.country}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 border-border/60">
          <div className="flex items-center gap-2 mb-5">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="font-display text-xl font-semibold text-foreground">
              Getting to {airport.shortName}
            </h3>
          </div>
          <div className="space-y-3">
            {airport.groundTransport.map((g) => (
              <div key={g.mode} className="p-3 rounded-xl border border-border/60 hover:border-primary/40 transition-colors">
                <div className="text-sm font-semibold text-foreground">{g.mode}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{g.description}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </motion.div>
  );
}

export default function About() {
  const [activeCode, setActiveCode] = useState(airportsInfo[0].code);
  const [query, setQuery] = useState("");

  const visibleAirports = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return airportsInfo;
    return airportsInfo.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.iata.toLowerCase().includes(q) ||
        a.region.toLowerCase().includes(q)
    );
  }, [query]);

  const active = airportsInfo.find((a) => a.code === activeCode) ?? airportsInfo[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav overlay />

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={heroImg}
            alt="Tunisian airport at twilight"
            className="w-full h-full object-cover"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/70 to-background" />
        </div>

        <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-32 md:pt-44 pb-16 md:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/20 mb-5">
              <Sparkles className="h-3 w-3 me-1.5" />
              About our airports
            </Badge>
            <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight text-foreground leading-[1.05]">
              Discover Tunisia's<br />
              <span className="bg-gradient-amber bg-clip-text text-transparent">international gateways</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Detailed information on each Tunisian airport — infrastructure, airlines serving them,
              top destinations and how to get there. Updated for travellers who want the full picture.
            </p>

            <div className="mt-8 max-w-md relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="airport-search"
                name="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search airport, city or IATA code…"
                className="h-12 pl-11 rounded-full bg-card/70 backdrop-blur-md border-border/60 focus-visible:ring-primary/40"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Airport selector */}
      <section className="sticky top-16 md:top-20 z-30 bg-background/85 backdrop-blur-xl border-y border-border/60">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-3 flex gap-2 overflow-x-auto no-scrollbar">
          {visibleAirports.map((a) => {
            const isActive = a.code === activeCode;
            return (
              <button
                key={a.code}
                onClick={() => setActiveCode(a.code)}
                className={`shrink-0 inline-flex items-center gap-2.5 px-4 h-11 rounded-full border transition-all ${
                  isActive
                    ? "bg-gradient-amber text-primary-foreground border-primary shadow-amber"
                    : "bg-card/40 text-foreground/80 border-border/60 hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <Plane className={`h-4 w-4 ${isActive ? "" : "text-primary"}`} />
                <span className="font-medium text-sm">{a.shortName}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isActive ? "bg-primary-foreground/20" : "bg-secondary"}`}>
                  {a.iata}
                </span>
              </button>
            );
          })}
          {visibleAirports.length === 0 && (
            <div className="text-sm text-muted-foreground py-2">No airport matches your search.</div>
          )}
        </div>
      </section>

      {/* Active airport content */}
      <section className="max-w-[1400px] mx-auto px-4 md:px-8 py-12 md:py-16">
        <AnimatePresence mode="wait">
          <AirportPanel airport={active} key={active.code} />
        </AnimatePresence>

        {/* CTA */}
        <div className="mt-16 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
          <div className="flex-1">
            <h3 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
              Need real-time flight info?
            </h3>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Check live flight status, gate and terminal information across all Tunisian airports.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full bg-gradient-amber text-primary-foreground hover:opacity-90 shadow-amber">
              <Link to="/flights">
                Live flights
                <ArrowRight className="h-4 w-4 ms-1.5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link to="/services">Airport services</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 mt-8">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Smart Airport · Public information platform for Tunisian airports
        </div>
      </footer>
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coffee,
  Crown,
  ShoppingBag,
  HeartHandshake,
  Sparkles,
  MapPin,
  Star,
  Clock,
  Search,
  Plane,
  Building2,
} from "lucide-react";
import { PublicNav } from "@/components/PublicNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  tunisianAirports,
  tunisianServices,
  type AirportService,
  type TunisianAirportCode,
} from "@/data/mockFlights";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/logo.png";
import servicesHero from "@/assets/services-hero.jpg";

const categories = [
  { key: "all", label: "All", icon: Sparkles },
  { key: "lounges", label: "Lounges", icon: Crown },
  { key: "dining", label: "Dining", icon: Coffee },
  { key: "shopping", label: "Shopping", icon: ShoppingBag },
  { key: "assistance", label: "Assistance", icon: HeartHandshake },
  { key: "wellness", label: "Wellness", icon: Sparkles },
] as const;

const Services = () => {
  const { t } = useTranslation();
  const [airport, setAirport] = useState<TunisianAirportCode>("TUN");
  const [active, setActive] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [stuck, setStuck] = useState(false);

  // Sticky shadow effect
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tunisianServices.filter((s) => {
      if (s.airport !== airport) return false;
      if (active !== "all" && s.category !== active) return false;
      if (q) {
        const sKey = `service_${s.id.replace(/-/g, "_")}`;
        const tName = t(`${sKey}_name`, s.name).toLowerCase();
        const tDesc = t(`${sKey}_desc`, s.description).toLowerCase();
        const hay = `${tName} ${tDesc} ${s.terminal} ${s.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [airport, active, query, t]);

  const activeAirport = tunisianAirports.find((a) => a.code === airport)!;

  // Per-category counts for the active airport
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: 0 };
    tunisianServices.forEach((s) => {
      if (s.airport !== airport) return;
      map.all += 1;
      map[s.category] = (map[s.category] ?? 0) + 1;
    });
    return map;
  }, [airport]);

  const activeAirportName = t(`airport_${activeAirport.code}_name`, activeAirport.name);
  const activeAirportRegion = t(`airport_${activeAirport.code}_region`, activeAirport.region);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav overlay />

      {/* HERO */}
      <section className="relative min-h-[68svh] w-full overflow-hidden">
        <img
          src={servicesHero}
          alt="Sunset light streaming through a modern Tunisian airport terminal with palm trees in the distance"
          className="absolute inset-0 h-full w-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_25%,_hsl(0_0%_0%/0.55))]" />

        <div className="relative z-10 min-h-[68svh] flex items-center pt-28 pb-24">
          <div className="max-w-[1200px] mx-auto px-6 md:px-8 w-full">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              className="max-w-3xl mx-auto text-center"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[11px] uppercase tracking-[0.22em] text-white/90 mb-6">
                <Building2 className="h-3 w-3 text-primary" />
                {t("services_hero_eyebrow", "Tunisian airports · Services & amenities")}
              </div>
              <h1 className="font-display text-5xl sm:text-6xl md:text-7xl text-white leading-[0.98] drop-shadow-lg">
                {t("services_hero_title", "Everything you need,")}{" "}
                <span className="italic text-primary">{t("services_hero_title_accent", "terminal side")}</span>
              </h1>
              <p className="mt-6 max-w-xl mx-auto text-base md:text-lg text-white/85 leading-relaxed">
                {t("services_hero_subtitle", "Lounges, dining, shopping, assistance and wellness across Tunisia's four international airports — Tunis, Monastir, Enfidha and Djerba.")}
              </p>

              <div className="mt-10 max-w-xl mx-auto">
                <div className="relative">
                  <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("services_search_placeholder", "Search a lounge, café, boutique or service…")}
                    className="ps-12 h-14 rounded-full bg-white/95 dark:bg-background/95 backdrop-blur-md border-white/30 text-base shadow-2xl focus-visible:ring-primary"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* STICKY AIRPORT SELECTOR */}
      <div
        className={cn(
          "sticky top-16 md:top-20 z-40 bg-background/85 backdrop-blur-xl border-b border-border/60 transition-shadow",
          stuck && "shadow-md"
        )}
      >
        <div className="max-w-[1300px] mx-auto px-4 md:px-8 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground hidden md:flex items-center gap-2 me-2">
              <Plane className="h-3.5 w-3.5 text-primary rtl-flip rotate-[-35deg]" />
              {t("services_airport", "Airport")}
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 flex-1">
              {tunisianAirports.map((a) => {
                const isActive = a.code === airport;
                const translatedCity = t(`airport_${a.code}_city`, a.city);
                const translatedRegion = t(`airport_${a.code}_region`, a.region);
                return (
                  <button
                    key={a.code}
                    onClick={() => setAirport(a.code)}
                    className={cn(
                      "shrink-0 group relative inline-flex items-center gap-3 ps-3 pe-4 h-12 rounded-full border text-sm transition-all",
                      isActive
                        ? "bg-foreground text-background border-foreground shadow-md"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center justify-center h-7 min-w-[44px] px-2 rounded-full text-[11px] font-semibold tracking-wider tabular",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
                      )}
                    >
                      {a.code}
                    </span>
                    <span className="flex flex-col items-start leading-tight">
                      <span className="font-medium">{translatedCity}</span>
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          isActive ? "text-background/70" : "text-muted-foreground"
                        )}
                      >
                        {translatedRegion}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS */}
      <section className="px-6 md:px-8 py-14 md:py-20">
        <div className="max-w-[1300px] mx-auto space-y-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={airport}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-end justify-between gap-4"
            >
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-primary font-medium">
                  {activeAirport.iata} · {activeAirportRegion}
                </div>
                <h2 className="font-display text-3xl md:text-4xl mt-2">
                  {activeAirportName}
                </h2>
                <p className="text-muted-foreground mt-1.5">
                  {filtered.length === 1
                    ? t("services_count_one", "1 service available")
                    : t("services_count_other", { count: filtered.length })}
                  {active !== "all" && ` ${t("services_in")} ${t(`services.${active}`)}`}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                {t("services_open_now", { count: filtered.filter((s) => s.open).length })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {categories.map((c) => {
              const isActive = active === c.key;
              const n = counts[c.key] ?? 0;
              return (
                <button
                  key={c.key}
                  onClick={() => setActive(c.key)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-2 px-4 h-10 rounded-full border text-sm transition-all",
                    isActive
                      ? "bg-foreground text-background border-foreground shadow-md"
                      : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  <c.icon className="h-3.5 w-3.5" />
                  {t(`services.${c.key}`, c.label)}
                  <span
                    className={cn(
                      "inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-semibold tabular",
                      isActive ? "bg-background/20 text-background" : "bg-secondary text-foreground"
                    )}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Cards grid */}
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`${airport}-${active}-${query}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {filtered.map((s, i) => (
                <ServiceCard key={s.id} service={s} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>

          {filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 border border-dashed border-border rounded-2xl"
            >
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-foreground font-medium">{t("services_no_results", "No services match your search")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("services_try_different", "Try a different category or clear the search.")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setActive("all");
                }}
                className="mt-4 rounded-full"
              >
                {t("services_reset_filters", "Reset filters")}
              </Button>
            </motion.div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="max-w-[1300px] mx-auto px-6 md:px-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo" className="h-9 w-auto object-contain" />
            <span>{t("services_platform_tunisia", "Smart Airport platform for Tunisia")}</span>
          </div>
          <div>© {new Date().getFullYear()} — TUN · MIR · NBE · DJE</div>
        </div>
      </footer>
    </div>
  );
};

function ServiceCard({ service, index }: { service: AirportService; index: number }) {
  const { t } = useTranslation();
  const Icon = categories.find((c) => c.key === service.category)?.icon ?? Sparkles;
  const serviceKey = `service_${service.id.replace(/-/g, "_")}`;
  const translatedName = t(`${serviceKey}_name`, service.name);
  const translatedDesc = t(`${serviceKey}_desc`, service.description);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="group relative rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-sm hover:border-primary/40 hover:shadow-lg transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid place-items-center h-11 w-11 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
          <Icon className="h-5 w-5" />
        </div>
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-full border",
            service.open
              ? "bg-success/10 text-success border-success/30"
              : "bg-muted text-muted-foreground border-border"
          )}
        >
          {service.open ? t("services_open", "Open") : t("services_closed", "Closed")}
        </span>
      </div>
      <h4 className="mt-4 font-display text-xl leading-tight">{translatedName}</h4>
      <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{translatedDesc}</p>
      <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3 w-3" /> {service.terminal}
        </span>
        <span className="inline-flex items-center gap-1.5 tabular">
          <Clock className="h-3 w-3" /> {t("services.walkMin", { n: service.walkMin })}
        </span>
        <span className="inline-flex items-center gap-1 text-foreground tabular">
          <Star className="h-3 w-3 fill-primary text-primary" /> {service.rating}
        </span>
      </div>
    </motion.div>
  );
}

export default Services;
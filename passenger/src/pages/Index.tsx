import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { NextFlightHero } from "@/components/NextFlightHero";
import { FlightSearchBar } from "@/components/FlightSearchBar";
import { FlightCard } from "@/components/FlightCard";
import { nextFlight, upcomingFlights, pastFlights } from "@/data/mockFlights";
import { TrendingUp, Plane, Globe2, Timer } from "lucide-react";

const Index = () => {
  const { t } = useTranslation();
  const upcoming = upcomingFlights.filter((f) => f.id !== nextFlight.id);

  const stats = [
    { icon: Plane, label: t("dashboard.flightsThisYear"), value: "24" },
    { icon: TrendingUp, label: t("dashboard.milesFlown"), value: "78,420" },
    { icon: Globe2, label: t("dashboard.countriesVisited"), value: "12" },
    { icon: Timer, label: t("dashboard.onTimeRate"), value: "92%" },
  ];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {t("dashboard.greeting")}, Amine
        </div>
        <h2 className="mt-1 font-display text-3xl md:text-4xl">
          {t("dashboard.subtitle")}
        </h2>
      </motion.div>

      {/* Search */}
      <FlightSearchBar />

      {/* Hero */}
      <NextFlightHero flight={nextFlight} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }}
            className="surface-card rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <s.icon className="h-4 w-4 text-primary/70" />
            </div>
            <div className="mt-3 font-display text-2xl tabular">{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Upcoming */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h3 className="font-display text-2xl">{t("dashboard.upcoming")}</h3>
          </div>
          <button className="text-xs uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors">
            {t("common.seeAll")}
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {upcoming.map((f, i) => <FlightCard key={f.id} flight={f} index={i} />)}
        </div>
      </section>

      {/* History */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <h3 className="font-display text-2xl">{t("dashboard.history")}</h3>
          <button className="text-xs uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors">
            {t("common.seeAll")}
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {pastFlights.map((f, i) => <FlightCard key={f.id} flight={f} index={i} />)}
        </div>
      </section>
    </div>
  );
};

export default Index;

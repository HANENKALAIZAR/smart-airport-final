import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Plane, Bell, Languages, Sparkles, MapPinned, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicNav } from "@/components/PublicNav";
import { FlightSearchBar } from "@/components/FlightSearchBar";
import heroImage from "@/assets/landing-hero.jpg";
import logoUrl from "@/assets/logo.png";

const Landing = () => {
  const { t } = useTranslation();

  const features = [
    { icon: Sparkles, key: "f1" },
    { icon: MapPinned, key: "f2" },
    { icon: Languages, key: "f3" },
    { icon: Bell, key: "f4" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav overlay />

      {/* HERO */}
      <section className="relative min-h-[100svh] w-full overflow-hidden">
        {/* Background image */}
        <img
          src={heroImage}
          alt="Tropical sunset over a turquoise atoll"
          className="absolute inset-0 h-full w-full object-cover"
          width={1920}
          height={1080}
        />
        {/* Layered overlays for legibility + brand tint */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_hsl(0_0%_0%/0.55))]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/0 to-transparent" />

        {/* Plane silhouette flying across with dotted trail */}
        <div className="absolute inset-x-0 top-[28%] pointer-events-none">
          <svg viewBox="0 0 1200 200" className="w-full h-[180px] md:h-[240px]" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="trail" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="white" stopOpacity="0" />
                <stop offset="100%" stopColor="white" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            <motion.path
              d="M 60 150 Q 350 40 700 110 T 1140 70"
              fill="none"
              stroke="url(#trail)"
              strokeWidth="1.5"
              strokeDasharray="2 8"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            />
          </svg>
        </div>

        <motion.div
          initial={{ x: -120, y: 30, opacity: 0, rotate: -8 }}
          animate={{ x: 0, y: 0, opacity: 1, rotate: -8 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="absolute top-[24%] start-[6%] md:top-[22%] md:start-[10%] pointer-events-none"
        >
          <Plane
            className="h-16 w-16 md:h-24 md:w-24 text-white drop-shadow-2xl animate-float-plane rtl-flip"
            strokeWidth={1.2}
            fill="white"
            fillOpacity={0.95}
          />
        </motion.div>

        {/* Hero content */}
        <div className="relative z-10 min-h-[100svh] flex flex-col">
          <div className="flex-1 flex items-center">
            <div className="max-w-[1400px] mx-auto px-6 md:px-8 w-full pt-24">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
                className="max-w-3xl mx-auto text-center"
              >
                <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white leading-[0.95] drop-shadow-lg">
                  {t("landing.headline")}{" "}
                  <span className="italic text-primary">{t("landing.headlineAccent")}</span>
                </h1>

                <p className="mt-6 max-w-xl mx-auto text-base md:text-lg text-white/85 leading-relaxed">
                  {t("landing.subhead")}
                </p>

                <div className="mt-10 max-w-xl mx-auto">
                  <FlightSearchBar />
                </div>

                <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="rounded-full h-12 px-7 bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20 hover:text-white font-medium"
                  >
                    <Link to="/flights">{t("landing.cta_secondary")}</Link>
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Quick action chips at bottom (echo of reference) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="pb-10 md:pb-14"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 px-1 py-1 rounded-full bg-gradient-amber shadow-amber">
                {[Plane, MapPinned, Bell, Sparkles].map((Icon, i) => (
                  <Link
                    key={i}
                    to={["/app", "/services", "/notifications", "/app"][i]}
                    className="h-11 w-11 grid place-items-center rounded-full text-primary-foreground hover:bg-white/20 transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                ))}
              </div>
              <div className="flex items-center gap-2 text-white/60 text-[11px] uppercase tracking-[0.25em]">
                {t("landing.scroll")} <ChevronDown className="h-3 w-3 animate-bounce" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 md:py-32 px-6 md:px-8">
        <div className="max-w-[1200px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="max-w-2xl"
          >
            <div className="text-xs uppercase tracking-[0.22em] text-primary font-medium">
              {t("landing.features_eyebrow")}
            </div>
            <h2 className="mt-3 font-display text-4xl md:text-5xl">
              {t("landing.features_title")}
            </h2>
          </motion.div>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.08, duration: 0.6 }}
                className="surface-card rounded-2xl p-6 hover:border-primary/40 transition-all group"
              >
                <div className="grid place-items-center h-12 w-12 rounded-xl bg-primary/10 text-primary group-hover:bg-gradient-amber group-hover:text-primary-foreground group-hover:shadow-amber transition-all">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-2xl">{t(`landing.${f.key}_title`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {t(`landing.${f.key}_body`)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* JOURNEY CTA */}
      <section id="about" className="px-6 md:px-8 pb-24 md:pb-32">
        <div className="max-w-[1200px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="relative overflow-hidden rounded-3xl border border-border bg-gradient-card p-8 md:p-16"
          >
            {/* Decorative arc */}
            <div className="absolute -top-32 -end-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -start-24 h-72 w-72 rounded-full bg-info/10 blur-3xl pointer-events-none" />

            <div className="relative grid md:grid-cols-[1.2fr_1fr] gap-10 items-center">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-primary font-medium">
                  {t("landing.journey_eyebrow")}
                </div>
                <h2 className="mt-3 font-display text-4xl md:text-5xl leading-[1.05]">
                  {t("landing.journey_title")}
                </h2>
                <p className="mt-5 text-muted-foreground max-w-lg leading-relaxed">
                  {t("landing.journey_body")}
                </p>
                <div className="mt-8 flex gap-3 flex-wrap">
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full h-12 px-7 bg-foreground text-background hover:bg-foreground/90 gap-2"
                  >
                    <Link to="/app">
                      {t("landing.cta_primary")} <ArrowRight className="h-4 w-4 rtl-flip" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    size="lg"
                    className="rounded-full h-12 px-7 hover:bg-secondary"
                  >
                    <Link to="/services">{t("nav.services")}</Link>
                  </Button>
                </div>
              </div>

              {/* Mock dashboard preview */}
              <div className="relative">
                <div className="surface-card rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold">AF 1681</span>
                    <span className="px-2 py-1 rounded-full bg-primary/15 text-primary text-[10px] uppercase tracking-wider border border-primary/30 inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      {t("common.boarding")}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div>
                      <div className="font-display text-2xl tabular">10:45</div>
                      <div className="text-[10px] font-mono text-muted-foreground">CDG</div>
                    </div>
                    <Plane className="h-4 w-4 text-primary rtl-flip rotate-[-35deg]" />
                    <div className="text-end">
                      <div className="font-display text-2xl tabular">13:20</div>
                      <div className="text-[10px] font-mono text-muted-foreground">JFK</div>
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: "32%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.4, ease: "easeOut" }}
                      className="h-full bg-gradient-amber"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Boarding K42</span>
                    <span>32%</span>
                  </div>
                </div>
                <div className="absolute -bottom-4 -end-4 surface-card rounded-xl p-3 shadow-md hidden sm:flex items-center gap-2 max-w-[180px]">
                  <div className="grid place-items-center h-7 w-7 rounded-md bg-info/15 text-info">
                    <Bell className="h-3 w-3" />
                  </div>
                  <div className="text-[11px] leading-tight">
                    Gate change<br /><span className="text-muted-foreground">EK 203 → A12</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-10 px-6 md:px-8">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo" className="h-9 w-auto object-contain" />
            <span className="text-muted-foreground text-sm">{t("landing.footer_tag")}</span>
          </div>
          <div className="text-xs text-muted-foreground tabular">© {new Date().getFullYear()}</div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

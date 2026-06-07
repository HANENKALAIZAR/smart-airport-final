import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Menu,
  X,
  Sparkles,
  ChevronDown,
  Building2,
  HelpCircle,
  Mail,
  ArrowUpRight,
  Compass,
  MessageSquare,
} from "lucide-react";
import { Button } from "./ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/logo.png";

export function PublicNav({ overlay = true }: { overlay?: boolean }) {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { to: "/flights", label: t("landing.nav_home") },
    { to: "/passenger-rights", label: t("landing.nav_features") },
    { to: "/services", label: t("landing.nav_services") },
  ];

  const [exploreOpen, setExploreOpen] = useState(false);

  const exploreItems = [
    {
      to: "/about",
      label: t("explore.about"),
      desc: t("explore.about_desc"),
      icon: Building2,
      accent: "from-amber-500/20 to-orange-500/10",
    },
    {
      to: "/faq",
      label: t("explore.faq"),
      desc: t("explore.faq_desc"),
      icon: HelpCircle,
      accent: "from-sky-500/20 to-blue-500/10",
    },
    {
      to: "/contact",
      label: t("explore.contact"),
      desc: t("explore.contact_desc"),
      icon: Mail,
      accent: "from-emerald-500/20 to-teal-500/10",
    },
  ];

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500",
        overlay && !scrolled
          ? "bg-transparent"
          : "bg-background/80 backdrop-blur-xl border-b border-border/60"
      )}
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center gap-4">
        {/* Logo */}
        <Link
          to="/"
          aria-label="Home"
          className="flex items-center shrink-0 group transition-transform hover:scale-[1.03]"
        >
          <img
            src={logoUrl}
            alt="Logo"
            className={cn(
              "h-10 md:h-12 w-auto object-contain select-none transition-[filter] duration-300",
              overlay && !scrolled && "drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
            )}
            draggable={false}
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ms-6">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={cn(
                "px-3 h-9 inline-flex items-center text-sm rounded-full transition-colors",
                overlay && !scrolled
                  ? "text-white/85 hover:text-white hover:bg-white/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {l.label}
            </NavLink>
          ))}

          {/* Explore — modern mega popover */}
          <Popover open={exploreOpen} onOpenChange={setExploreOpen}>
            <PopoverTrigger
              onMouseEnter={() => setExploreOpen(true)}
              className={cn(
                "relative px-3 h-9 inline-flex items-center gap-1.5 text-sm rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group",
                overlay && !scrolled
                  ? "text-white/85 hover:text-white data-[state=open]:text-white"
                  : "text-muted-foreground hover:text-foreground data-[state=open]:text-foreground"
              )}
            >
              <Compass
                className={cn(
                  "h-3.5 w-3.5 transition-all duration-500 group-data-[state=open]:text-primary group-data-[state=open]:rotate-[360deg]"
                )}
              />
              <span>{t("explore.title")}</span>
              <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-data-[state=open]:rotate-180" />
              {/* underline indicator */}
              <span
                className={cn(
                  "absolute left-3 right-3 -bottom-0.5 h-px origin-left scale-x-0 bg-gradient-to-r from-transparent via-primary to-transparent transition-transform duration-300 group-data-[state=open]:scale-x-100"
                )}
              />
            </PopoverTrigger>

            <PopoverContent
              align="start"
              sideOffset={14}
              onMouseLeave={() => setExploreOpen(false)}
              className={cn(
                "w-[640px] p-0 rounded-3xl border-border/60 bg-popover/85 backdrop-blur-2xl shadow-2xl overflow-hidden",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
                "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
                "data-[state=open]:slide-in-from-top-2"
              )}
            >
              {/* ambient glow */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                  background:
                    "radial-gradient(600px 200px at 0% 0%, hsl(var(--primary) / 0.18), transparent 60%), radial-gradient(400px 200px at 100% 100%, hsl(var(--primary) / 0.08), transparent 60%)",
                }}
              />

              <div className="relative grid grid-cols-[1fr_220px]">
                {/* Left — items */}
                <div className="p-3">
                  <div className="px-3 pt-2 pb-3 flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t("explore.explore_airport")}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70">
                      {t("explore.sections", { count: exploreItems.length })}
                    </div>
                  </div>

                  <ul className="flex flex-col gap-1">
                    {exploreItems.map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.to}>
                          <Link
                            to={item.to}
                            onClick={() => setExploreOpen(false)}
                            style={{ animationDelay: `${i * 60}ms` }}
                            className={cn(
                              "group/item relative flex items-center gap-3.5 px-3 py-3 rounded-2xl outline-none",
                              "transition-all duration-300",
                              "hover:bg-gradient-to-r hover:from-secondary/80 hover:to-secondary/30",
                              "focus-visible:ring-2 focus-visible:ring-primary/40",
                              "animate-fade-in"
                            )}
                          >
                            {/* icon tile with gradient + glow */}
                            <div
                              className={cn(
                                "relative shrink-0 h-11 w-11 rounded-xl grid place-items-center",
                                "bg-gradient-to-br border border-border/60",
                                "transition-all duration-300",
                                "group-hover/item:scale-105 group-hover/item:border-primary/40",
                                item.accent
                              )}
                            >
                              <Icon className="h-[18px] w-[18px] text-foreground/90 group-hover/item:text-primary transition-colors" />
                              <span
                                aria-hidden
                                className="absolute inset-0 rounded-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-500 ring-1 ring-primary/30 shadow-[0_0_22px_-4px_hsl(var(--primary)/0.55)]"
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground leading-tight flex items-center gap-1.5">
                                {item.label}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                                {item.desc}
                              </div>
                            </div>

                            <ArrowUpRight
                              className={cn(
                                "h-4 w-4 text-muted-foreground/60 shrink-0 rtl-flip",
                                "transition-all duration-300",
                                "opacity-0 -translate-x-1 group-hover/item:opacity-100 group-hover/item:translate-x-0 group-hover/item:text-primary"
                              )}
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Right — featured card */}
                <div className="relative border-l rtl:border-l-0 rtl:border-r border-border/60 bg-gradient-to-br from-primary/12 via-card/40 to-transparent p-5 flex flex-col">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80 mb-3">
                    {t("explore.featured")}
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-gradient-amber grid place-items-center shadow-amber mb-3">
                    <Sparkles className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="font-display text-base font-semibold text-foreground leading-snug">
                    {t("explore.assistant_title")}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {t("explore.assistant_desc")}
                  </p>

                  <Link
                    to="/assistant"
                    onClick={() => setExploreOpen(false)}
                    className="mt-auto inline-flex items-center justify-center gap-1.5 h-9 rounded-full px-4 bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors group/cta"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {t("explore.try_assistant")}
                    <ArrowUpRight className="h-3.5 w-3.5 rtl-flip transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
                  </Link>
                </div>
              </div>

              {/* footer strip */}
              <div className="relative border-t border-border/60 px-4 py-2.5 flex items-center justify-between text-[11px] text-muted-foreground bg-background/40">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t("explore.live_info")}
                </span>
                <Link
                  to="/about"
                  onClick={() => setExploreOpen(false)}
                  className="text-foreground/80 hover:text-primary inline-flex items-center gap-1 transition-colors"
                >
                  {t("explore.browse_all")}
                  <ArrowUpRight className="h-3 w-3 rtl-flip" />
                </Link>
              </div>
            </PopoverContent>
          </Popover>
        </nav>

        {/* Right cluster */}
        <div className="ms-auto flex items-center gap-1">
          <div className={cn(overlay && !scrolled && "[&_button]:text-white [&_button:hover]:bg-white/10")}>
            <LanguageSwitcher />
          </div>
          <div className={cn("hidden sm:block", overlay && !scrolled && "[&_button]:text-white [&_button:hover]:bg-white/10")}>
            <ThemeToggle />
          </div>
          <Button
            asChild
            size="sm"
            className="ms-2 rounded-full h-10 px-5 bg-gradient-amber text-primary-foreground hover:opacity-90 shadow-amber font-medium gap-2"
          >
            <Link to="/assistant">
              <Sparkles className="h-4 w-4" />
              {t("landing.cta_assistant")}
            </Link>
          </Button>
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "md:hidden ms-1 h-10 w-10 grid place-items-center rounded-full",
              overlay && !scrolled ? "text-white" : "text-foreground"
            )}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-t border-border">
          <nav className="px-4 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="px-3 h-11 inline-flex items-center text-sm rounded-lg text-foreground hover:bg-secondary"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 pt-3 border-t border-border/60">
              <div className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                <Compass className="h-3 w-3 text-primary" />
                {t("explore.title")}
              </div>
              {exploreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary group"
                  >
                    <div className={cn(
                      "shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br border border-border/60 grid place-items-center text-foreground/80 group-hover:text-primary group-hover:border-primary/40 transition-colors",
                      item.accent
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground leading-tight">
                        {item.label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/60 rtl-flip group-hover:text-primary transition-colors" />
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

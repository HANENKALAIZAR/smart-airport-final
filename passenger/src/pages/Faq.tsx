import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PublicNav } from "@/components/PublicNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HelpCircle,
  Search,
  Plane,
  Luggage,
  ShieldCheck,
  Building2,
  Sparkles,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import faqHero from "@/assets/faq-hero.jpg";

type FaqCategory = "all" | "delays" | "baggage" | "airport" | "ai" | "general";

interface FaqItem {
  q: string;
  a: string;
  category: Exclude<FaqCategory, "all">;
}

export default function Faq() {
  const { t } = useTranslation();
  const [active, setActive] = useState<FaqCategory>("all");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => [
    { id: "all" as FaqCategory, label: t("all", "All"), icon: Sparkles },
    { id: "delays" as FaqCategory, label: t("faq_cat_delays", "Delays & Compensation"), icon: ShieldCheck },
    { id: "baggage" as FaqCategory, label: t("faq_cat_baggage", "Baggage"), icon: Luggage },
    { id: "airport" as FaqCategory, label: t("faq_cat_airport", "Airport & Facilities"), icon: Building2 },
    { id: "ai" as FaqCategory, label: t("faq_cat_ai", "AI Predictions"), icon: Sparkles },
    { id: "general" as FaqCategory, label: t("faq_cat_general", "General"), icon: HelpCircle },
  ], [t]);

  const faqs: FaqItem[] = useMemo(() => [
    // Delays
    { category: "delays", q: t("faq_delays_q1"), a: t("faq_delays_a1") },
    { category: "delays", q: t("faq_delays_q2"), a: t("faq_delays_a2") },
    { category: "delays", q: t("faq_delays_q3"), a: t("faq_delays_a3") },
    { category: "delays", q: t("faq_delays_q4"), a: t("faq_delays_a4") },
    { category: "delays", q: t("faq_delays_q5"), a: t("faq_delays_a5") },
    { category: "delays", q: t("faq_delays_q6"), a: t("faq_delays_a6") },

    // Baggage
    { category: "baggage", q: t("faq_baggage_q1"), a: t("faq_baggage_a1") },
    { category: "baggage", q: t("faq_baggage_q2"), a: t("faq_baggage_a2") },
    { category: "baggage", q: t("faq_baggage_q3"), a: t("faq_baggage_a3") },
    { category: "baggage", q: t("faq_baggage_q4"), a: t("faq_baggage_a4") },

    // Airport
    { category: "airport", q: t("faq_airport_q1"), a: t("faq_airport_a1") },
    { category: "airport", q: t("faq_airport_q2"), a: t("faq_airport_a2") },
    { category: "airport", q: t("faq_airport_q3"), a: t("faq_airport_a3") },
    { category: "airport", q: t("faq_airport_q4"), a: t("faq_airport_a4") },
    { category: "airport", q: t("faq_airport_q5"), a: t("faq_airport_a5") },

    // AI
    { category: "ai", q: t("faq_ai_q1"), a: t("faq_ai_a1") },
    { category: "ai", q: t("faq_ai_q2"), a: t("faq_ai_a2") },
    { category: "ai", q: t("faq_ai_q3"), a: t("faq_ai_a3") },
    { category: "ai", q: t("faq_ai_q4"), a: t("faq_ai_a4") },

    // General
    { category: "general", q: t("faq_general_q1"), a: t("faq_general_a1") },
    { category: "general", q: t("faq_general_q2"), a: t("faq_general_a2") },
    { category: "general", q: t("faq_general_q3"), a: t("faq_general_a3") },
  ], [t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter((f) => {
      const matchesCat = active === "all" || f.category === active;
      const matchesQuery = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [active, query, faqs]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav overlay />

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img src={faqHero} alt="Airport at sunset" className="w-full h-full object-cover" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/75 to-background" />
        </div>

        <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-32 md:pt-44 pb-16 md:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/20 mb-5">
              <HelpCircle className="h-3 w-3 me-1.5" />
              {t("faq", "Frequently Asked Questions")}
            </Badge>
            <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight text-foreground leading-[1.05]">
              {t("faq_title", "Frequently Asked Questions")}
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              {t("faq_subtitle")}
            </p>

            <div className="mt-8 max-w-md relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("faq_search_placeholder", "Search questions…")}
                className="h-12 pl-11 rounded-full bg-card/70 backdrop-blur-md border-border/60 focus-visible:ring-primary/40"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Category chips */}
      <section className="sticky top-16 md:top-20 z-30 bg-background/85 backdrop-blur-xl border-y border-border/60">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-3 flex gap-2 overflow-x-auto">
          {categories.map((c) => {
            const Icon = c.icon;
            const isActive = c.id === active;
            return (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={`shrink-0 inline-flex items-center gap-2 px-4 h-10 rounded-full border transition-all text-sm ${
                  isActive
                    ? "bg-gradient-amber text-primary-foreground border-primary shadow-amber"
                    : "bg-card/40 text-foreground/80 border-border/60 hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* FAQ list */}
      <section className="max-w-[900px] mx-auto px-4 md:px-8 py-12 md:py-16">
        {filtered.length === 0 ? (
          <Card className="p-10 text-center border-border/60">
            <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t("services_no_results", "No results found matching your search.")}</p>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="space-y-3">
            {filtered.map((f, i) => (
              <motion.div
                key={`${f.category}-${i}-${f.q}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.2) }}
              >
                <AccordionItem
                  value={`item-${i}`}
                  className="border border-border/60 rounded-2xl bg-card/40 backdrop-blur-sm px-5 data-[state=open]:border-primary/40 data-[state=open]:bg-card/70 transition-colors"
                >
                  <AccordionTrigger className="text-start hover:no-underline py-5 text-base font-medium text-foreground">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        )}

        {/* CTA */}
        <div className="mt-14 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex-1">
            <h3 className="font-display text-2xl font-semibold text-foreground">
              {t("faq_still_have_questions", "Still have questions?")}
            </h3>
            <p className="text-muted-foreground mt-2">
              {t("faq_still_have_questions_desc")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full bg-gradient-amber text-primary-foreground hover:opacity-90 shadow-amber">
              <Link to="/contact">
                {t("contact", "Contact")}
                <ArrowRight className="h-4 w-4 ms-1.5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link to="/assistant">
                <MessageSquare className="h-4 w-4 me-1.5" />
                {t("landing.cta_assistant", "AI Assistant")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 mt-8">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {t("about_footer_info")}
        </div>
      </footer>
    </div>
  );
}
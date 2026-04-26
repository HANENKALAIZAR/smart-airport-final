import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PublicNav } from "@/components/PublicNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Wifi,
  Coffee,
  CreditCard,
  Sparkles,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import faqHero from "@/assets/faq-hero.jpg";

type FaqCategory = "all" | "flights" | "baggage" | "security" | "services" | "transport" | "assistance";

interface FaqItem {
  q: string;
  a: string;
  category: Exclude<FaqCategory, "all">;
}

const categories: { id: FaqCategory; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All topics", icon: Sparkles },
  { id: "flights", label: "Flights", icon: Plane },
  { id: "baggage", label: "Baggage", icon: Luggage },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "services", label: "Services & Wi-Fi", icon: Wifi },
  { id: "transport", label: "Transport", icon: Coffee },
  { id: "assistance", label: "Assistance & payment", icon: CreditCard },
];

const faqs: FaqItem[] = [
  // Flights
  {
    category: "flights",
    q: "How early should I arrive at the airport before my flight?",
    a: "We recommend arriving 2 hours before domestic flights and at least 3 hours before international flights to allow time for check-in, baggage drop, and security screening.",
  },
  {
    category: "flights",
    q: "Where can I check my flight status in real time?",
    a: "Visit our Live Flights page to see departures and arrivals across all four Tunisian airports, including gate, terminal and estimated times updated continuously.",
  },
  {
    category: "flights",
    q: "What should I do if my flight is delayed or cancelled?",
    a: "Contact your airline first for rebooking. You may also be entitled to compensation under EU Regulation 261/2004 — see our Passenger Rights page for details and a free claim eligibility check.",
  },
  {
    category: "flights",
    q: "Can I change gate or terminal information?",
    a: "Gate and terminal assignments are managed by airlines and may change. Always check the live information screens or our Live Flights page within 1 hour of departure.",
  },

  // Baggage
  {
    category: "baggage",
    q: "What is the standard cabin baggage allowance?",
    a: "Each airline sets its own rules, but most allow one cabin bag (max 55×40×20 cm, 8–10 kg) plus a small personal item. Check your airline's website before travelling.",
  },
  {
    category: "baggage",
    q: "What can I do if my baggage is lost or damaged?",
    a: "Report it immediately at your airline's baggage service desk in the arrivals hall before leaving the airport. Keep your baggage tag and boarding pass — you'll need them for your claim.",
  },
  {
    category: "baggage",
    q: "Is there left-luggage storage at the airport?",
    a: "Yes, Tunis–Carthage and Enfidha–Hammamet offer secure left-luggage facilities in the arrivals area. Pricing depends on size and duration.",
  },

  // Security
  {
    category: "security",
    q: "What liquids can I bring through security?",
    a: "Containers must not exceed 100 ml each, all placed in a single transparent resealable bag of max 1 litre. Larger quantities must go in checked baggage.",
  },
  {
    category: "security",
    q: "Are power banks allowed in cabin baggage?",
    a: "Yes, but only in cabin baggage (never in checked luggage). Capacity must not exceed 100 Wh without prior airline approval.",
  },
  {
    category: "security",
    q: "Do I need to remove laptops and electronics at security?",
    a: "Yes, laptops, tablets and large electronics must be placed in a separate tray for X-ray screening. Phones and small devices can stay in your bag.",
  },

  // Services
  {
    category: "services",
    q: "Is Wi-Fi available across all terminals?",
    a: "Yes, free Wi-Fi is available in all four Tunisian airports. Connect to the network 'AirportFreeWiFi' and follow the on-screen instructions.",
  },
  {
    category: "services",
    q: "What dining and shopping options are available?",
    a: "Each airport offers cafés, restaurants, duty-free shops and local craft boutiques. Visit our Services page to browse options per airport with opening hours.",
  },
  {
    category: "services",
    q: "Are there VIP lounges I can access?",
    a: "Yes, all four Tunisian airports offer VIP lounges. Access is included with eligible airline tickets, Priority Pass, or can be purchased on the spot.",
  },

  // Transport
  {
    category: "transport",
    q: "How do I get from the airport to the city?",
    a: "Taxis, public buses, car rentals and pre-booked transfers are available at all airports. See the 'Getting to' section on each airport page for detailed options and fares.",
  },
  {
    category: "transport",
    q: "Is there parking at the airport?",
    a: "Yes, all Tunisian airports offer short-term and long-term parking with secure 24/7 surveillance. Online reservation is recommended during peak season.",
  },

  // Assistance & payment
  {
    category: "assistance",
    q: "Is there assistance for passengers with reduced mobility?",
    a: "Yes, free PRM assistance is available at all airports. Request the service via your airline at least 48 hours before departure for the best experience.",
  },
  {
    category: "assistance",
    q: "Where can I exchange currency or withdraw cash?",
    a: "Currency exchange counters and ATMs are available in arrivals and departures at all airports. Major credit cards are widely accepted.",
  },
  {
    category: "assistance",
    q: "What languages are spoken at airport service desks?",
    a: "Staff typically speak Arabic, French and English. Many also speak Italian, German or Russian, especially during the tourist season.",
  },
  {
    category: "assistance",
    q: "How do I contact a specific airport?",
    a: "Visit our Contact page to find direct phone numbers, emails and addresses for each Tunisian airport, or use the contact form to send a message directly.",
  },
];

export default function Faq() {
  const [active, setActive] = useState<FaqCategory>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter((f) => {
      const matchesCat = active === "all" || f.category === active;
      const matchesQuery = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [active, query]);

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
              Frequently asked questions
            </Badge>
            <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight text-foreground leading-[1.05]">
              Answers to your<br />
              <span className="bg-gradient-amber bg-clip-text text-transparent">most common questions</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Everything you need to know about flying through Tunisian airports — from check-in
              and baggage to security, services and transport.
            </p>

            <div className="mt-8 max-w-md relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions…"
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
            <p className="text-muted-foreground">No questions match your search.</p>
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
              Still have questions?
            </h3>
            <p className="text-muted-foreground mt-2">
              Get in touch with the airport directly or chat with our AI assistant for instant help.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full bg-gradient-amber text-primary-foreground hover:opacity-90 shadow-amber">
              <Link to="/contact">
                Contact airport
                <ArrowRight className="h-4 w-4 ms-1.5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link to="/app/assistant">
                <MessageSquare className="h-4 w-4 me-1.5" />
                Ask the AI
              </Link>
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
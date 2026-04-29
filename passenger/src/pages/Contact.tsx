import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PublicNav } from "@/components/PublicNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { airportsInfo } from "@/data/airportsInfo";
import type { TunisianAirportCode } from "@/data/mockFlights";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  Globe,
  MessageSquare,
  Plane,
  CheckCircle2,
  Building2,
  Compass,
  Sparkles,
} from "lucide-react";
import contactHero from "@/assets/contact-hero.jpg";
import { useToast } from "@/hooks/use-toast";

interface AirportContact {
  code: TunisianAirportCode;
  email: string;
  pressEmail: string;
  lostFoundPhone: string;
  lostFoundEmail: string;
  hours: string;
  address: string;
}

const airportContacts: AirportContact[] = [
  {
    code: "TUN",
    email: "info.tun@oaca.nat.tn",
    pressEmail: "press.tun@oaca.nat.tn",
    lostFoundPhone: "+216 71 755 200",
    lostFoundEmail: "lostfound.tun@oaca.nat.tn",
    hours: "24/7 (passenger services) · 08:00–17:00 (admin)",
    address: "Aéroport Tunis–Carthage, Route X20, 2035 Tunis, Tunisia",
  },
  {
    code: "MIR",
    email: "monastir@tav.aero",
    pressEmail: "press.mir@tav.aero",
    lostFoundPhone: "+216 73 521 314",
    lostFoundEmail: "lostfound.mir@tav.aero",
    hours: "06:00–23:00 daily",
    address: "Aéroport Monastir Habib Bourguiba, 5065 Skanes, Monastir, Tunisia",
  },
  {
    code: "NBE",
    email: "enfidha@tav.aero",
    pressEmail: "press.nbe@tav.aero",
    lostFoundPhone: "+216 73 100 712",
    lostFoundEmail: "lostfound.nbe@tav.aero",
    hours: "24/7 (passenger services)",
    address: "Aéroport Enfidha–Hammamet, Route Régionale 24, 4030 Enfidha, Tunisia",
  },
  {
    code: "DJE",
    email: "info.dje@oaca.nat.tn",
    pressEmail: "press.dje@oaca.nat.tn",
    lostFoundPhone: "+216 75 650 247",
    lostFoundEmail: "lostfound.dje@oaca.nat.tn",
    hours: "06:00–23:00 daily",
    address: "Aéroport Djerba–Zarzis, Mellita, 4116 Djerba, Tunisia",
  },
];

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-secondary/40 transition-colors">
      <div className="h-9 w-9 shrink-0 rounded-lg bg-gradient-amber/15 grid place-items-center text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-medium text-foreground mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
  return href ? (
    <a href={href} className="block group">
      {content}
    </a>
  ) : (
    content
  );
}

export default function Contact() {
  const { toast } = useToast();
  const [activeCode, setActiveCode] = useState<TunisianAirportCode>("TUN");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "general",
    airport: "TUN" as TunisianAirportCode,
    message: "",
  });

  const activeAirport = useMemo(
    () => airportsInfo.find((a) => a.code === activeCode)!,
    [activeCode]
  );
  const activeContact = useMemo(
    () => airportContacts.find((c) => c.code === activeCode)!,
    [activeCode]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast({
        title: "Missing information",
        description: "Please fill in your name, email and message.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast({
        title: "Message sent",
        description: `Your message has been forwarded to ${airportsInfo.find((a) => a.code === form.airport)?.shortName}. We'll reply within 48 hours.`,
      });
      setForm({ name: "", email: "", subject: "general", airport: form.airport, message: "" });
    }, 900);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav overlay />

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img src={contactHero} alt="Airport information desk" className="w-full h-full object-cover" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/70 to-background" />
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
              Contact us
            </Badge>
            <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight text-foreground leading-[1.05]">
              Get in touch with<br />
              <span className="bg-gradient-amber bg-clip-text text-transparent">any Tunisian airport</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Direct phone numbers, emails and addresses for each airport — or send us a message
              and we'll route it to the right team.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Airport tabs */}
      <section className="sticky top-16 md:top-20 z-30 bg-background/85 backdrop-blur-xl border-y border-border/60">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-3 flex gap-2 overflow-x-auto">
          {airportsInfo.map((a) => {
            const isActive = a.code === activeCode;
            return (
              <button
                key={a.code}
                onClick={() => {
                  setActiveCode(a.code);
                  setForm((f) => ({ ...f, airport: a.code }));
                }}
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
        </div>
      </section>

      {/* Content grid */}
      <section className="max-w-[1400px] mx-auto px-4 md:px-8 py-12 md:py-16 grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12">
        {/* Left — airport contact details */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCode}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <div>
              <Badge variant="outline" className="border-primary/30 text-primary mb-3">
                {activeAirport.iata} · {activeAirport.icao}
              </Badge>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground leading-tight">
                {activeAirport.name}
              </h2>
              <p className="text-muted-foreground mt-3">{activeAirport.description}</p>
            </div>

            <Card className="p-5 md:p-6 border-border/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                General contact
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <ContactRow
                  icon={Phone}
                  label="Switchboard"
                  value={activeAirport.phone}
                  href={`tel:${activeAirport.phone.replace(/\s/g, "")}`}
                />
                <ContactRow
                  icon={Mail}
                  label="Email"
                  value={activeContact.email}
                  href={`mailto:${activeContact.email}`}
                />
                <ContactRow
                  icon={MapPin}
                  label="Address"
                  value={activeContact.address}
                />
                <ContactRow icon={Clock} label="Hours" value={activeContact.hours} />
                <ContactRow
                  icon={Globe}
                  label="Website"
                  value={activeAirport.website.replace(/^https?:\/\//, "")}
                  href={activeAirport.website}
                />
                <ContactRow
                  icon={Compass}
                  label="Coordinates"
                  value={`${activeAirport.coordinates.lat.toFixed(3)}°N · ${activeAirport.coordinates.lng.toFixed(3)}°E`}
                />
              </div>
            </Card>

            <Card className="p-5 md:p-6 border-border/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                Specialised desks
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <ContactRow
                  icon={Phone}
                  label="Lost & found"
                  value={activeContact.lostFoundPhone}
                  href={`tel:${activeContact.lostFoundPhone.replace(/\s/g, "")}`}
                />
                <ContactRow
                  icon={Mail}
                  label="Lost & found email"
                  value={activeContact.lostFoundEmail}
                  href={`mailto:${activeContact.lostFoundEmail}`}
                />
                <ContactRow
                  icon={Mail}
                  label="Press & media"
                  value={activeContact.pressEmail}
                  href={`mailto:${activeContact.pressEmail}`}
                />
                <ContactRow
                  icon={Building2}
                  label="Operator"
                  value={activeAirport.operator}
                />
              </div>
            </Card>

            <Card className="p-5 md:p-6 border-border/60 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm text-foreground/90 leading-relaxed">
                  Reply times: typically <strong>under 24 hours</strong> on business days, up to{" "}
                  <strong>48 hours</strong> on weekends and public holidays.
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Right — contact form */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Card className="p-6 md:p-8 border-border/60 bg-card/60 backdrop-blur-md">
            <h3 className="font-display text-2xl font-semibold text-foreground">
              Send us a message
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              We'll route your message to the airport you select below.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Your name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="airport">Airport</Label>
                  <Select
                    name="airport"
                    value={form.airport}
                    onValueChange={(v) => {
                      const code = v as TunisianAirportCode;
                      setForm({ ...form, airport: code });
                      setActiveCode(code);
                    }}
                  >
                    <SelectTrigger id="airport">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {airportsInfo.map((a) => (
                        <SelectItem key={a.code} value={a.code}>
                          {a.shortName} ({a.iata})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subject">Subject</Label>
                  <Select
                    name="subject"
                    value={form.subject}
                    onValueChange={(v) => setForm({ ...form, subject: v })}
                  >
                    <SelectTrigger id="subject">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General inquiry</SelectItem>
                      <SelectItem value="flight">Flight information</SelectItem>
                      <SelectItem value="baggage">Baggage / lost & found</SelectItem>
                      <SelectItem value="assistance">Special assistance</SelectItem>
                      <SelectItem value="press">Press & media</SelectItem>
                      <SelectItem value="feedback">Feedback or complaint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  name="message"
                  rows={6}
                  placeholder="How can we help?"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                size="lg"
                className="w-full rounded-full bg-gradient-amber text-primary-foreground hover:opacity-90 shadow-amber font-medium gap-2"
              >
                {submitting ? (
                  "Sending…"
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send message
                  </>
                )}
              </Button>

              <p className="text-[11px] text-muted-foreground text-center">
                By sending, you agree we may use your email solely to reply to your inquiry.
              </p>
            </form>
          </Card>
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
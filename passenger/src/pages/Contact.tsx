import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PublicNav } from "@/components/PublicNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeCode, setActiveCode] = useState<TunisianAirportCode>("TUN");
  const [submitting, setSubmitting] = useState(false);
  const [reopenConfirm, setReopenConfirm] = useState<{ referenceId: string; message: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "general",
    airport: "TUN" as TunisianAirportCode,
    message: "",
  });

  const airportContacts: AirportContact[] = useMemo(() => [
    {
      code: "TUN",
      email: "info.tun@oaca.nat.tn",
      pressEmail: "press.tun@oaca.nat.tn",
      lostFoundPhone: "+216 71 755 200",
      lostFoundEmail: "lostfound.tun@oaca.nat.tn",
      hours: t("contact_hours_tun", "24/7 (passenger services) · 08:00–17:00 (admin)"),
      address: t("contact_address_tun", "Aéroport Tunis–Carthage, Route X20, 2035 Tunis, Tunisia"),
    },
    {
      code: "MIR",
      email: "monastir@tav.aero",
      pressEmail: "press.mir@tav.aero",
      lostFoundPhone: "+216 73 521 314",
      lostFoundEmail: "lostfound.mir@tav.aero",
      hours: t("contact_hours_mir", "06:00–23:00 daily"),
      address: t("contact_address_mir", "Aéroport Monastir Habib Bourguiba, 5065 Skanes, Monastir, Tunisia"),
    },
    {
      code: "NBE",
      email: "enfidha@tav.aero",
      pressEmail: "press.nbe@tav.aero",
      lostFoundPhone: "+216 73 100 712",
      lostFoundEmail: "lostfound.nbe@tav.aero",
      hours: t("contact_hours_nbe", "24/7 (passenger services)"),
      address: t("contact_address_nbe", "Aéroport Enfidha–Hammamet, Route Régionale 24, 4030 Enfidha, Tunisia"),
    },
    {
      code: "DJE",
      email: "info.dje@oaca.nat.tn",
      pressEmail: "press.dje@oaca.nat.tn",
      lostFoundPhone: "+216 75 650 247",
      lostFoundEmail: "lostfound.dje@oaca.nat.tn",
      hours: t("contact_hours_dje", "06:00–23:00 daily"),
      address: t("contact_address_dje", "Aéroport Djerba–Zarzis, Mellita, 4116 Djerba, Tunisia"),
    },
  ], [t]);

  const activeAirport = useMemo(
    () => airportsInfo.find((a) => a.code === activeCode)!,
    [activeCode]
  );
  const activeContact = useMemo(
    () => airportContacts.find((c) => c.code === activeCode)!,
    [activeCode, airportContacts]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Basic validation
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast({
        title: t("contact_missing_info", "Missing information"),
        description: t("contact_fill_fields", "Please fill in your name, email and message."),
        variant: "destructive",
      });
      return;
    }

    // 2. Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      toast({
        title: t("contact_invalid_email", "Invalid Email Address"),
        description: t("contact_valid_email_format", "Please enter a valid email format."),
        variant: "destructive",
      });
      return;
    }

    // 3. Minimum length validation
    if (form.message.trim().length < 10) {
      toast({
        title: t("contact_message_too_short", "Message Too Short"),
        description: t("contact_message_min_chars", "Please enter a message containing at least 10 characters."),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api');
      const body = JSON.stringify({
        fullName: form.name.trim(),
        email: form.email.trim(),
        airportIata: form.airport,
        subject: form.subject,
        message: form.message.trim(),
        ...(reopenConfirm ? { confirm_reopen: true } : {}),
      });
      const response = await fetch(`${apiBase}/public/contact-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });

      const resText = await response.text();
      let resData;
      try {
        resData = JSON.parse(resText);
      } catch {
        resData = { error: resText || "Internal server error" };
      }

      if (!response.ok) {
        toast({
          title: t("contact_network_error", "Submission Failed"),
          description: resData?.error || resData?.detail || "Could not send message. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (resData.requires_confirmation) {
        // Resolved ticket - ask passenger to confirm reopen
        setReopenConfirm({ referenceId: resData.reference_id, message: form.message.trim() });
        toast({
          title: t("contact_ticket_resolved", "Ticket Already Resolved"),
          description: resData.message || "This ticket is already resolved. Please confirm to reopen.",
          variant: "default",
        });
        return;
      }

      // Clear reopen confirm state after successful resubmission
      setReopenConfirm(null);

      if (resData.appended) {
        // Spam/duplicate merged warning
        toast({
          title: t("contact_duplicate_req", "Duplicate Request Detected"),
          description: `Your previous request is already being processed. Reference ID: ${resData.reference_id}`,
          variant: "default",
        });
      } else if (resData.thread_appended) {
        // Reply added to existing ticket thread
        toast({
          title: t("contact_reply_added", "Reply Received"),
          description: resData.message || `Your message has been added to ticket ${resData.reference_id}.`,
          variant: "default",
        });
      } else {
        toast({
          title: t("contact_success_title", "Message Sent Successfully"),
          description: `Your message has been sent to the selected airport operations team. Ticket ID: ${resData.reference_id}`,
        });
      }

      // Reset message and subject, preserve name/email/airport for convenience
      setForm({
        name: form.name,
        email: form.email,
        subject: "general",
        airport: form.airport,
        message: "",
      });
    } catch (err: any) {
      toast({
        title: t("contact_network_error", "Network Error"),
        description: "Cannot connect to the helpdesk server. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
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
              {t("footer_contact_us", "Contact us")}
            </Badge>
            <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight text-foreground leading-[1.05]">
              {t("contact_headline", "Get in touch with any Tunisian airport")}
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              {t("contact_desc")}
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
                {t("footer_contact_info", "General contact")}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <ContactRow
                  icon={Phone}
                  label={t("contact_switchboard", "Switchboard")}
                  value={activeAirport.phone}
                  href={`tel:${activeAirport.phone.replace(/\s/g, "")}`}
                />
                <ContactRow
                  icon={Mail}
                  label={t("contact_email", "Email")}
                  value={activeContact.email}
                  href={`mailto:${activeContact.email}`}
                />
                <ContactRow
                  icon={MapPin}
                  label={t("contact_address", "Address")}
                  value={activeContact.address}
                />
                <ContactRow icon={Clock} label={t("contact_hours", "Hours")} value={activeContact.hours} />
                <ContactRow
                  icon={Globe}
                  label={t("about_official_website", "Website")}
                  value={activeAirport.website.replace(/^https?:\/\//, "")}
                  href={activeAirport.website}
                />
                <ContactRow
                  icon={Compass}
                  label={t("admin_nav_map", "Coordinates")}
                  value={`${activeAirport.coordinates.lat.toFixed(3)}°N · ${activeAirport.coordinates.lng.toFixed(3)}°E`}
                />
              </div>
            </Card>

            <Card className="p-5 md:p-6 border-border/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                {t("contact_specialised_desks", "Specialised desks")}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <ContactRow
                  icon={Phone}
                  label={t("contact_lost_found_label", "Lost & found")}
                  value={activeContact.lostFoundPhone}
                  href={`tel:${activeContact.lostFoundPhone.replace(/\s/g, "")}`}
                />
                <ContactRow
                  icon={Mail}
                  label={t("contact_lost_found_email", "Lost & found email")}
                  value={activeContact.lostFoundEmail}
                  href={`mailto:${activeContact.lostFoundEmail}`}
                />
                <ContactRow
                  icon={Mail}
                  label={t("contact_press_media", "Press & media")}
                  value={activeContact.pressEmail}
                  href={`mailto:${activeContact.pressEmail}`}
                />
                <ContactRow
                  icon={Building2}
                  label={t("contact_operator", "Operator")}
                  value={activeAirport.operator}
                />
              </div>
            </Card>

            <Card className="p-5 md:p-6 border-border/60 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm text-foreground/90 leading-relaxed">
                  {t("contact_reply_times")}
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Right — contact form */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Card className="p-6 md:p-8 border-border/60 bg-card/60 backdrop-blur-md">
            <h3 className="font-display text-2xl font-semibold text-foreground">
              {t("contact_send_message", "Send us a message")}
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              {t("contact_route_message_desc", "We'll route your message to the airport you select below.")}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">{t("contact_your_name", "Full name")}</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Your name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("contact_email_address", "Email")}</Label>
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
                  <Label htmlFor="airport">{t("admin_login_airport_label", "Airport")}</Label>
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
                  <Label htmlFor="subject">{t("admin_login_role_label", "Subject")}</Label>
                  <Select
                    name="subject"
                    value={form.subject}
                    onValueChange={(v) => setForm({ ...form, subject: v })}
                  >
                    <SelectTrigger id="subject">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">{t("contact_subject_general", "General inquiry")}</SelectItem>
                      <SelectItem value="flight">{t("contact_subject_flight", "Flight information")}</SelectItem>
                      <SelectItem value="baggage">{t("contact_subject_baggage", "Baggage / lost & found")}</SelectItem>
                      <SelectItem value="assistance">{t("contact_subject_assistance", "Special assistance")}</SelectItem>
                      <SelectItem value="press">{t("contact_subject_press", "Press & media")}</SelectItem>
                      <SelectItem value="feedback">{t("contact_subject_feedback_complaint", "Feedback or complaint")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <Label htmlFor="message">{t("contact_your_message", "Message")}</Label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {form.message.length} chars {form.message.length < 10 && "(min 10)"}
                  </span>
                </div>
                <Textarea
                  id="message"
                  name="message"
                  rows={6}
                  placeholder="How can we help? (Please write at least 10 characters)"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="resize-none"
                  maxLength={4000}
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                size="lg"
                className="w-full rounded-full bg-gradient-amber text-primary-foreground hover:opacity-90 shadow-amber font-medium gap-2"
              >
                {submitting ? (
                  t("loading", "Sending…")
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {t("contact_send_btn", "Send message")}
                  </>
                )}
              </Button>

              {reopenConfirm && (
                <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {t("contact_reopen_title", "This ticket is already resolved.")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("contact_reopen_desc", "Your message will be added to the existing conversation and the ticket will be reopened.")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                      disabled={submitting}
                    >
                      {t("contact_reopen_confirm", "Reopen & Send")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setReopenConfirm(null)}
                    >
                      {t("contact_cancel", "Cancel")}
                    </Button>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground text-center">
                {t("contact_terms_note")}
              </p>
            </form>
          </Card>
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
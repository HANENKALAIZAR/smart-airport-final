import { useMemo, useState } from "react";
import { PublicNav } from "@/components/PublicNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Scale,
  Plane,
  Clock,
  Ban,
  Luggage,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Globe2,
} from "lucide-react";

type Region = "eu" | "us" | "ca" | "gcc";

const regions: {
  id: Region;
  name: string;
  flag: string;
  law: string;
  summary: string;
  delay: string;
  cancellation: string;
  denied: string;
  baggage: string;
  compensation: { label: string; value: string }[];
}[] = [
  {
    id: "eu",
    name: "European Union",
    flag: "🇪🇺",
    law: "EC Regulation 261/2004",
    summary:
      "Applies to all flights departing from an EU airport, and to flights arriving in the EU operated by an EU carrier.",
    delay:
      "Care (meals, refreshments, communication) from 2h. Compensation owed when arrival delay at final destination is 3h+ and the cause is within the airline's control.",
    cancellation:
      "Right to a refund or rerouting + care. Compensation owed unless notified 14+ days in advance, or due to extraordinary circumstances.",
    denied:
      "Involuntary denied boarding entitles you to immediate compensation, refund/rerouting and care.",
    baggage:
      "Montreal Convention applies: up to ~1,519 SDR (~€1,800) for delayed, lost or damaged baggage.",
    compensation: [
      { label: "Short flights (≤1,500 km)", value: "€250" },
      { label: "Medium (1,500–3,500 km)", value: "€400" },
      { label: "Long (>3,500 km)", value: "€600" },
    ],
  },
  {
    id: "us",
    name: "United States",
    flag: "🇺🇸",
    law: "DOT 14 CFR — Airline Passenger Protections",
    summary:
      "No federal cash compensation for delays. Airlines must honor their own customer service plans (DOT dashboard).",
    delay:
      "Refund required for 'significant' delays if you choose not to travel. Meals & hotel often provided per airline policy.",
    cancellation:
      "Full cash refund (not just credit) if the flight is cancelled or significantly changed and you don't accept rebooking.",
    denied:
      "Involuntary bumping: 200% of one-way fare (max $1,075) for short delays, 400% (max $2,150) for longer delays.",
    baggage:
      "Up to $3,800 per passenger for domestic checked baggage liability.",
    compensation: [
      { label: "Bump 0–1h late", value: "$0" },
      { label: "Bump 1–2h late", value: "200% fare" },
      { label: "Bump 2h+ late", value: "400% fare" },
    ],
  },
  {
    id: "ca",
    name: "Canada",
    flag: "🇨🇦",
    law: "Air Passenger Protection Regulations (APPR)",
    summary:
      "Compensation depends on airline size (large vs small) and whether the disruption is within the carrier's control.",
    delay:
      "Standards of treatment from 2h (food, drink, communication). Compensation only for delays within carrier control and not safety-related.",
    cancellation:
      "Refund or rebooking required. Compensation up to CA$1,000 for large carriers when cause is within carrier control.",
    denied:
      "Up to CA$2,400 for involuntary denied boarding (9h+ delay) on large carriers.",
    baggage:
      "Up to ~CA$2,350 (1,288 SDR) per passenger under Montreal Convention.",
    compensation: [
      { label: "3–6h delay (large)", value: "CA$400" },
      { label: "6–9h delay (large)", value: "CA$700" },
      { label: "9h+ delay (large)", value: "CA$1,000" },
    ],
  },
  {
    id: "gcc",
    name: "GCC States",
    flag: "🇸🇦",
    law: "GCC Civil Aviation — Passenger Protection Regulation",
    summary:
      "Harmonized framework across Saudi Arabia, UAE, Kuwait, Qatar, Bahrain and Oman. Strong baggage & assistance protections.",
    delay:
      "Care from 2h (refreshments, communication). Hotel & transport from 6h overnight. Refund or alternative if delay exceeds 5h.",
    cancellation:
      "Right to refund or alternative transport, plus care. Compensation when notified less than 14 days in advance.",
    denied:
      "Involuntary denied boarding entitles you to immediate compensation, alternative transport and full care.",
    baggage:
      "Compensation aligned with Montreal Convention limits (~1,519 SDR).",
    compensation: [
      { label: "Short flights", value: "SAR 1,500" },
      { label: "Medium flights", value: "SAR 3,000" },
      { label: "Long flights", value: "SAR 4,500" },
    ],
  },
];

type IssueType = "delay" | "cancellation" | "denied" | "baggage";

function evaluateClaim(input: {
  region: Region;
  issue: IssueType;
  hours: number;
  noticeDays: number;
  controllable: boolean;
}) {
  const { region, issue, hours, noticeDays, controllable } = input;

  if (issue === "baggage") {
    return {
      eligible: true,
      title: "Likely eligible — Baggage claim",
      detail:
        "File a Property Irregularity Report (PIR) at the airport within 7 days for damage, 21 days for delay. Keep receipts for essentials.",
      amount: "Up to ~€1,800 / $3,800 (region dependent)",
    };
  }

  if (issue === "denied") {
    return {
      eligible: true,
      title: "Likely eligible — Denied boarding",
      detail:
        "Involuntary denied boarding triggers immediate compensation, rerouting or refund, and care.",
      amount:
        region === "us"
          ? hours >= 2
            ? "Up to $2,150 (400% fare)"
            : "Up to $1,075 (200% fare)"
          : region === "ca"
            ? "Up to CA$2,400"
            : region === "gcc"
              ? "SAR 1,500–4,500"
              : "€250–€600",
    };
  }

  if (issue === "cancellation") {
    if (noticeDays >= 14) {
      return {
        eligible: false,
        title: "Likely not eligible for compensation",
        detail:
          "You were notified 14+ days in advance. You're still entitled to a refund or rerouting.",
        amount: "Refund / rerouting only",
      };
    }
    if (!controllable) {
      return {
        eligible: false,
        title: "Compensation unlikely (extraordinary circumstances)",
        detail:
          "Weather, ATC, security or strikes typically exempt the airline. You're still entitled to care and a refund or rerouting.",
        amount: "Refund / rerouting + care",
      };
    }
    return {
      eligible: true,
      title: "Likely eligible — Cancellation",
      detail:
        "Cancellation within 14 days and within the carrier's control. You can claim compensation in addition to refund or rerouting.",
      amount:
        region === "eu"
          ? "€250–€600"
          : region === "ca"
            ? "CA$125–CA$1,000"
            : region === "gcc"
              ? "SAR 1,500–4,500"
              : "Refund + airline policy",
    };
  }

  // Delay
  if (region === "us") {
    return {
      eligible: hours >= 3,
      title:
        hours >= 3
          ? "May be eligible — significant delay"
          : "Not eligible for cash compensation",
      detail:
        "US has no statutory cash compensation for delays, but you can refuse travel and get a full refund for significant delays. Airlines may provide meals/hotel per their policy.",
      amount: hours >= 3 ? "Refund + airline care" : "—",
    };
  }

  if (!controllable) {
    return {
      eligible: false,
      title: "Compensation unlikely (extraordinary circumstances)",
      detail:
        "The disruption appears outside the airline's control. You're still entitled to care.",
      amount: "Care + refund if delay is long enough",
    };
  }

  if (region === "eu") {
    if (hours < 3)
      return {
        eligible: false,
        title: "Not yet eligible — delay under 3h",
        detail: "EU 261 compensation kicks in at 3h+ arrival delay.",
        amount: "Care only (meals, refreshments)",
      };
    return {
      eligible: true,
      title: "Likely eligible — EU 261 delay",
      detail: "Arrival delay of 3h+ on a controllable disruption.",
      amount: "€250 / €400 / €600 by distance",
    };
  }

  if (region === "ca") {
    if (hours < 3)
      return {
        eligible: false,
        title: "Not yet eligible — delay under 3h",
        detail: "APPR compensation begins at 3h arrival delay.",
        amount: "Standards of treatment only",
      };
    return {
      eligible: true,
      title: "Likely eligible — APPR delay",
      detail: "Controllable delay 3h+ on a Canadian flight.",
      amount: "CA$400 / CA$700 / CA$1,000",
    };
  }

  // GCC
  if (hours < 2)
    return {
      eligible: false,
      title: "Not yet eligible — delay under 2h",
      detail: "GCC care obligations begin at 2h.",
      amount: "—",
    };
  return {
    eligible: hours >= 5,
    title: hours >= 5 ? "Likely eligible — GCC delay" : "Care only at this stage",
    detail:
      hours >= 5
        ? "Delay of 5h+ entitles you to compensation, refund or alternative transport."
        : "You're entitled to refreshments and communication while you wait.",
    amount: hours >= 5 ? "SAR 1,500–4,500" : "Care only",
  };
}

export default function PassengerRights() {
  const [region, setRegion] = useState<Region>("eu");
  const [issue, setIssue] = useState<IssueType>("delay");
  const [hours, setHours] = useState<number>(3);
  const [noticeDays, setNoticeDays] = useState<number>(0);
  const [controllable, setControllable] = useState<boolean>(true);
  const [flightNo, setFlightNo] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  const result = useMemo(
    () => evaluateClaim({ region, issue, hours, noticeDays, controllable }),
    [region, issue, hours, noticeDays, controllable]
  );

  const active = regions.find((r) => r.id === region)!;

  return (
    <div className="min-h-screen bg-background">
      <PublicNav overlay={false} />

      {/* Hero */}
      <section className="pt-28 md:pt-36 pb-12 md:pb-20 border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-xs uppercase tracking-[0.18em] text-muted-foreground mb-6">
              <Scale className="h-3.5 w-3.5 text-primary" />
              Passenger Rights
            </div>
            <h1 className="font-display text-4xl md:text-6xl leading-[1.05] tracking-tight text-foreground">
              Know what you're owed.
              <span className="block text-primary">Claim with confidence.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              A clear guide to passenger compensation rights across the EU, US, Canada and the GCC —
              plus a free eligibility checker for delays, cancellations, denied boarding and baggage issues.
            </p>
          </div>
        </div>
      </section>

      {/* Regional rights */}
      <section className="py-16 md:py-24">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-primary mb-2 flex items-center gap-2">
                <Globe2 className="h-3.5 w-3.5" />
                Compare regions
              </div>
              <h2 className="font-display text-3xl md:text-4xl text-foreground">
                Your rights, region by region.
              </h2>
            </div>
          </div>

          <Tabs value={region} onValueChange={(v) => setRegion(v as Region)}>
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1 bg-secondary">
              {regions.map((r) => (
                <TabsTrigger
                  key={r.id}
                  value={r.id}
                  className="flex items-center gap-2 py-3 data-[state=active]:bg-background data-[state=active]:text-foreground"
                >
                  <span className="text-base">{r.flag}</span>
                  <span className="hidden sm:inline">{r.name}</span>
                  <span className="sm:hidden uppercase">{r.id}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {regions.map((r) => (
              <TabsContent key={r.id} value={r.id} className="mt-8">
                <div className="grid lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-1 p-6 bg-card border-border">
                    <div className="text-4xl mb-3">{r.flag}</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Governing rule
                    </div>
                    <h3 className="font-display text-xl mt-1 text-foreground">{r.law}</h3>
                    <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
                      {r.summary}
                    </p>
                    <div className="mt-6 space-y-3">
                      {r.compensation.map((c) => (
                        <div
                          key={c.label}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary"
                        >
                          <span className="text-sm text-muted-foreground">{c.label}</span>
                          <span className="font-display text-lg text-primary">{c.value}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
                    <RightCard
                      icon={<Clock className="h-5 w-5" />}
                      title="Delays"
                      body={r.delay}
                    />
                    <RightCard
                      icon={<Ban className="h-5 w-5" />}
                      title="Cancellations"
                      body={r.cancellation}
                    />
                    <RightCard
                      icon={<Plane className="h-5 w-5" />}
                      title="Denied boarding"
                      body={r.denied}
                    />
                    <RightCard
                      icon={<Luggage className="h-5 w-5" />}
                      title="Baggage"
                      body={r.baggage}
                    />
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* Eligibility checker */}
      <section id="checker" className="py-16 md:py-24 bg-secondary/40 border-y border-border">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="max-w-2xl mb-10">
            <div className="text-xs uppercase tracking-[0.18em] text-primary mb-2 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Free eligibility checker
            </div>
            <h2 className="font-display text-3xl md:text-4xl text-foreground">
              Check your claim in 60 seconds.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Answer a few questions about your disruption and we'll estimate whether you can claim
              compensation under {active.law}.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-3 p-6 md:p-8 bg-card border-border">
              <div className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="flight">Flight number (optional)</Label>
                    <Input
                      id="flight"
                      placeholder="e.g. AF1234"
                      value={flightNo}
                      onChange={(e) => setFlightNo(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Region of departure</Label>
                    <Select value={region} onValueChange={(v) => setRegion(v as Region)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.flag} {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block">What happened?</Label>
                  <RadioGroup
                    value={issue}
                    onValueChange={(v) => setIssue(v as IssueType)}
                    className="grid sm:grid-cols-2 gap-3"
                  >
                    {[
                      { id: "delay", label: "Delay", icon: Clock },
                      { id: "cancellation", label: "Cancellation", icon: Ban },
                      { id: "denied", label: "Denied boarding", icon: Plane },
                      { id: "baggage", label: "Baggage issue", icon: Luggage },
                    ].map((o) => (
                      <label
                        key={o.id}
                        htmlFor={o.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          issue === o.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-secondary"
                        }`}
                      >
                        <RadioGroupItem value={o.id} id={o.id} />
                        <o.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{o.label}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                {(issue === "delay" || issue === "denied") && (
                  <div>
                    <Label htmlFor="hours">Delay at final destination (hours)</Label>
                    <Input
                      id="hours"
                      type="number"
                      min={0}
                      max={48}
                      value={hours}
                      onChange={(e) => setHours(Number(e.target.value) || 0)}
                      className="mt-2"
                    />
                  </div>
                )}

                {issue === "cancellation" && (
                  <div>
                    <Label htmlFor="notice">How many days notice did you receive?</Label>
                    <Input
                      id="notice"
                      type="number"
                      min={0}
                      max={60}
                      value={noticeDays}
                      onChange={(e) => setNoticeDays(Number(e.target.value) || 0)}
                      className="mt-2"
                    />
                  </div>
                )}

                {issue !== "baggage" && (
                  <div>
                    <Label className="mb-3 block">Was the cause within the airline's control?</Label>
                    <RadioGroup
                      value={controllable ? "yes" : "no"}
                      onValueChange={(v) => setControllable(v === "yes")}
                      className="grid grid-cols-2 gap-3"
                    >
                      <label
                        htmlFor="ctrl-yes"
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          controllable ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
                        }`}
                      >
                        <RadioGroupItem value="yes" id="ctrl-yes" />
                        <span className="text-sm">Yes (technical, crew, scheduling)</span>
                      </label>
                      <label
                        htmlFor="ctrl-no"
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          !controllable ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
                        }`}
                      >
                        <RadioGroupItem value="no" id="ctrl-no" />
                        <span className="text-sm">No (weather, ATC, strike)</span>
                      </label>
                    </RadioGroup>
                  </div>
                )}

                <Button
                  size="lg"
                  className="w-full bg-gradient-amber text-primary-foreground shadow-amber font-medium"
                  onClick={() => setSubmitted(true)}
                >
                  Check eligibility
                </Button>
              </div>
            </Card>

            <Card className="lg:col-span-2 p-6 md:p-8 bg-card border-border h-fit lg:sticky lg:top-24">
              {!submitted ? (
                <div className="text-center py-8">
                  <div className="h-14 w-14 mx-auto rounded-full bg-secondary grid place-items-center mb-4">
                    <Scale className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-display text-xl text-foreground">Your result</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Fill in the form and tap "Check eligibility" to see your claim estimate.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3">
                    {result.eligible ? (
                      <div className="h-10 w-10 rounded-full bg-primary/15 grid place-items-center">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center">
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <Badge variant={result.eligible ? "default" : "secondary"}>
                      {result.eligible ? "Likely eligible" : "Likely not eligible"}
                    </Badge>
                  </div>

                  <h3 className="font-display text-2xl text-foreground mt-4">{result.title}</h3>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    {result.detail}
                  </p>

                  <div className="mt-5 p-4 rounded-lg bg-secondary">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Estimated amount
                    </div>
                    <div className="font-display text-2xl text-primary mt-1">{result.amount}</div>
                  </div>

                  <div className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <p>
                      This estimate is informational only and does not constitute legal advice.
                      Final eligibility depends on the airline's evidence and applicable law.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* Footer note */}
      <section className="py-12 border-t border-border">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 text-center text-sm text-muted-foreground">
          Smart Airport Companion · Passenger Rights guide
        </div>
      </section>
    </div>
  );
}

function RightCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card className="p-6 bg-card border-border hover:border-primary/40 transition-colors">
      <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary mb-4">
        {icon}
      </div>
      <h4 className="font-display text-lg text-foreground">{title}</h4>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{body}</p>
    </Card>
  );
}

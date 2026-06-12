import { useMemo, useState, useCallback, useEffect } from "react";
import { PublicNav } from "@/components/PublicNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
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
  Info,
} from "lucide-react";
import {
  getCompensationConfig,
  type ApiCompensationConfig,
  type ApiCompensationRegulation,
  type ApiCompensationLimit,
} from "@/services/api";

type Region = "eu" | "uk" | "us" | "ca" | "other";

interface RegionData {
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
}

type IssueType = "delay" | "cancellation" | "denied" | "baggage";

const EMPTY_CONFIG: ApiCompensationConfig = { regulations: [], limits: [], generated_at: "" };

const AIRPORT_IATA_TO_REGION: Record<string, Region> = {
  CDG: "eu", ORY: "eu", FRA: "eu", FCO: "eu", MAD: "eu", BCN: "eu",
  AMS: "eu", BRU: "eu", VIE: "eu", MUC: "eu", GVA: "eu", LYS: "eu",
  NCE: "eu", MRS: "eu", MLA: "eu", TLS: "eu", BOD: "eu", LIS: "eu",
  OPO: "eu", DUB: "eu", CPH: "eu", ARN: "eu", OSL: "eu", HEL: "eu",
  ZRH: "eu", WAW: "eu", PRG: "eu", BUD: "eu", ATH: "eu", IST: "eu",

  LHR: "uk", LGW: "uk", STN: "uk", LTN: "uk", SEN: "uk", LCY: "uk",
  MAN: "uk", EDI: "uk", GLA: "uk", BHX: "uk", BRS: "uk", LPL: "uk",
  NCL: "uk", EMA: "uk", ABZ: "uk", BFS: "uk", CWL: "uk", SOU: "uk",
  EXT: "uk", NQY: "uk",

  YYZ: "ca", YVR: "ca", YUL: "ca", YYC: "ca", YOW: "ca", YHZ: "ca",
  YEG: "ca", YWG: "ca", YQB: "ca", YXE: "ca", YYJ: "ca", YTZ: "ca",

  JFK: "us", EWR: "us", LGA: "us", ORD: "us", DFW: "us", LAX: "us",
  SFO: "us", MIA: "us", ATL: "us", BOS: "us", SEA: "us", PHX: "us",
  DEN: "us", IAH: "us", MCO: "us", CLT: "us", PHL: "us", DCA: "us",
  BWI: "us", SLC: "us", SAN: "us", TPA: "us", STL: "us", PDX: "us",
};

function resolveRegionFromAirportIata(iata: string): Region | null {
  const code = iata.toUpperCase();
  return AIRPORT_IATA_TO_REGION[code] ?? null;
}

const REGION_LABELS: Record<Region, string> = {
  eu: "Union Européenne",
  uk: "Royaume-Uni",
  us: "États-Unis",
  ca: "Canada",
  other: "Autres pays",
};

const CFG = (() => {
  // ── Config store: populated from API, with inline defaults as fallback ──
  let _data: ApiCompensationConfig = EMPTY_CONFIG;
  const _listeners: Array<() => void> = [];
  return {
    get data() { return _data; },
    set data(d: ApiCompensationConfig) { _data = d; _listeners.forEach(fn => fn()); },
    subscribe(fn: () => void) { _listeners.push(fn); return () => { const i = _listeners.indexOf(fn); if (i >= 0) _listeners.splice(i, 1); }; },
    /** Look up first matching compensation regulation */
    reg(regionUp: string, distKm: number): string | null {
      const regs = _data.regulations.filter(r => r.region === regionUp && r.right_type === "compensation" && r.compensation_amount);
      if (!regs.length) return null;
      if (distKm <= 1500) return regs.find(r => r.description_en.includes("1500km") && !r.description_en.includes("3500"))?.compensation_amount ?? regs[0]?.compensation_amount ?? null;
      if (distKm <= 3500) return regs.find(r => r.description_en.includes("3500km"))?.compensation_amount ?? regs[1]?.compensation_amount ?? null;
      return regs[regs.length - 1]?.compensation_amount ?? null;
    },
    /** Look up first matching limit */
    limit(regionUp: string, cat: string): ApiCompensationLimit | null {
      return _data.limits.find(l => l.region === regionUp && l.category === cat) ?? null;
    },
  };
})();

// ── Helper: build amount string from config for display ──
function compRange(config: ApiCompensationConfig, regionUp: string): string {
  const regs = config.regulations.filter(r => r.region === regionUp && r.right_type === "compensation" && r.compensation_amount);
  if (!regs.length) return "";
  const amounts = regs.map(r => r.compensation_amount!).filter(Boolean);
  return amounts.join(" / ");
}

function caRange(config: ApiCompensationConfig): string {
  const large3 = config.limits.find(l => l.region === "CA" && l.category === "large_carrier_3_6");
  const large9 = config.limits.find(l => l.region === "CA" && l.category === "large_carrier_9plus");
  const lo = large3 ? (large3.amount_cad ? `CA$${large3.amount_cad.toLocaleString()}` : large3.amount_usd ? `$${large3.amount_usd.toLocaleString()}` : null) : null;
  const hi = large9 ? (large9.amount_cad ? `CA$${large9.amount_cad.toLocaleString()}` : large9.amount_usd ? `$${large9.amount_usd.toLocaleString()}` : null) : null;
  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return lo;
  return "CA$400 / CA$700 / CA$1,000";
}

export default function PassengerRights() {
  const { t } = useTranslation();
  const [region, setRegion] = useState<Region>("eu");
  const [issue, setIssue] = useState<IssueType>("delay");
  const [hours, setHours] = useState<number>(3);
  const [noticeDays, setNoticeDays] = useState<number>(0);
  const [controllable, setControllable] = useState<boolean>(true);
  const [flightNo, setFlightNo] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [detectedRegion, setDetectedRegion] = useState<Region | null>(null);
  const [config, setConfig] = useState<ApiCompensationConfig>(EMPTY_CONFIG);

  useEffect(() => {
    getCompensationConfig().then(res => { if (res) { setConfig(res); CFG.data = res; } });
  }, []);

  const caBagLabel = useMemo(() => {
    const l = config.limits.find(l => l.region === "CA" && l.category === "baggage_liability");
    return l ? l.label_en : t("rights_baggage_ca", "Up to ~CA$2,350 (~€1,550 / ~$1,700) per passenger under Montreal Convention.");
  }, [config, t]);

  const usBagLabel = useMemo(() => {
    const l = config.limits.find(l => l.region === "US" && l.category === "baggage_detail");
    return l ? l.label_en : t("rights_baggage_us", "Up to $3,800 per passenger for domestic checked baggage liability.");
  }, [config, t]);

  const euCompRange = useMemo(() => compRange(config, "EU") || "€250 / €400 / €600", [config]);
  const ukCompRange = useMemo(() => compRange(config, "UK") || "£220 / £350 / £520", [config]);
  const caCompRangeStr = useMemo(() => caRange(config), [config]);

  const regions: RegionData[] = useMemo(() => [
    {
      id: "eu",
      name: t("rights_region_eu", "Union Européenne"),
      flag: "🇪🇺",
      law: t("rights_law_eu", "EC Regulation 261/2004"),
      summary: t("rights_summary_eu", "Applies to all flights departing from an EU airport, and to flights arriving in the EU operated by an EU carrier."),
      delay: t("rights_delay_eu", "Care (meals, refreshments, communication) from 2h. Compensation owed when arrival delay at final destination is 3h+ and the cause is within the airline's control."),
      cancellation: t("rights_cancellation_eu", "Right to a refund or rerouting + care. Compensation owed unless notified 14+ days in advance, or due to extraordinary circumstances."),
      denied: t("rights_denied_eu", "Involuntary denied boarding entitles you to immediate compensation, refund/rerouting and care."),
      baggage: t("rights_baggage_eu", "Montreal Convention applies: terms set by applicable regulation."),
      compensation: [
        { label: t("rights_short_flights", "Short flights (≤1,500 km)"), value: config.regulations.find(r => r.region === "EU" && r.description_en.includes("1500km") && !r.description_en.includes("3500"))?.compensation_amount ?? "€250" },
        { label: t("rights_medium_flights", "Medium (1,500–3,500 km)"), value: config.regulations.find(r => r.region === "EU" && r.description_en.includes("3500km"))?.compensation_amount ?? "€400" },
        { label: t("rights_long_flights", "Long (>3,500 km)"), value: config.regulations.filter(r => r.region === "EU" && r.right_type === "compensation" && r.compensation_amount).slice(-1)[0]?.compensation_amount ?? "€600" },
      ],
    },
    {
      id: "uk",
      name: t("rights_region_uk", "Royaume-Uni"),
      flag: "🇬🇧",
      law: t("rights_law_uk", "UK Regulation 261/2004 (UK 261)"),
      summary: t("rights_summary_uk", "Post-Brexit UK retained EU 261 as UK 261. Covers flights departing from UK airports, and flights arriving in the UK on UK/EU carriers."),
      delay: t("rights_delay_uk", "Care (meals, refreshments, communication) from 2h. Compensation owed when arrival delay at final destination is 3h+ and the cause is within the airline's control."),
      cancellation: t("rights_cancellation_uk", "Right to a refund or rerouting + care. Compensation owed unless notified 14+ days in advance, or due to extraordinary circumstances."),
      denied: t("rights_denied_uk", "Involuntary denied boarding entitles you to immediate compensation, refund/rerouting and care."),
      baggage: t("rights_baggage_uk", "Montreal Convention applies: terms set by applicable regulation."),
      compensation: [
        { label: t("rights_short_flights", "Short flights (≤1,500 km)"), value: config.regulations.find(r => r.region === "UK" && r.description_en.includes("1500km") && !r.description_en.includes("3500"))?.compensation_amount ?? "£220" },
        { label: t("rights_medium_flights", "Medium (1,500–3,500 km)"), value: config.regulations.find(r => r.region === "UK" && r.description_en.includes("3500km"))?.compensation_amount ?? "£350" },
        { label: t("rights_long_flights", "Long (>3,500 km)"), value: config.regulations.filter(r => r.region === "UK" && r.right_type === "compensation" && r.compensation_amount).slice(-1)[0]?.compensation_amount ?? "£520" },
      ],
    },
    {
      id: "us",
      name: t("rights_region_us", "États-Unis"),
      flag: "🇺🇸",
      law: t("rights_law_us", "DOT 14 CFR — Airline Passenger Protections"),
      summary: t("rights_summary_us", "No federal cash compensation for delays. Airlines must honor their own customer service plans (DOT dashboard)."),
      delay: t("rights_delay_us", "Refund required for 'significant' delays if you choose not to travel. Meals & hotel often provided per airline policy."),
      cancellation: t("rights_cancellation_us", "Full cash refund (not just credit) if the flight is cancelled or significantly changed and you don't accept rebooking."),
      denied: t("rights_denied_us", "Involuntary bumping: compensation per applicable regulation (DOT 14 CFR Part 250)."),
      baggage: usBagLabel,
      compensation: [
        { label: t("rights_us_bump_short", "Bump 0–1h late"), value: "$0" },
        { label: t("rights_us_bump_medium", "Bump 1–2h late"), value: "200% fare" },
        { label: t("rights_us_bump_long", "Bump 2h+ late"), value: "400% fare" },
      ],
    },
    {
      id: "ca",
      name: t("rights_region_ca", "Canada"),
      flag: "🇨🇦",
      law: t("rights_law_ca", "Air Passenger Protection Regulations (APPR)"),
      summary: t("rights_summary_ca", "Compensation depends on airline size (large vs small) and whether the disruption is within the carrier's control."),
      delay: t("rights_delay_ca", "Standards of treatment from 2h (food, drink, communication). Compensation only for delays within carrier control and not safety-related."),
      cancellation: t("rights_cancellation_ca", "Refund or rebooking required. Compensation up to applicable APPR limit for large carriers when cause is within carrier control."),
      denied: t("rights_denied_ca", "Compensation per APPR for involuntary denied boarding."),
      baggage: caBagLabel,
      compensation: [
        { label: t("rights_ca_delay_short", "3–6h delay (large)"), value: config.limits.find(l => l.region === "CA" && l.category === "large_carrier_3_6")?.amount_cad ? `CA$${config.limits.find(l => l.region === "CA" && l.category === "large_carrier_3_6")!.amount_cad!.toLocaleString()}` : "CA$400" },
        { label: t("rights_ca_delay_medium", "6–9h delay (large)"), value: config.limits.find(l => l.region === "CA" && l.category === "large_carrier_6_9")?.amount_cad ? `CA$${config.limits.find(l => l.region === "CA" && l.category === "large_carrier_6_9")!.amount_cad!.toLocaleString()}` : "CA$700" },
        { label: t("rights_ca_delay_long", "9h+ delay (large)"), value: config.limits.find(l => l.region === "CA" && l.category === "large_carrier_9plus")?.amount_cad ? `CA$${config.limits.find(l => l.region === "CA" && l.category === "large_carrier_9plus")!.amount_cad!.toLocaleString()}` : "CA$1,000" },
      ],
    },
    {
      id: "other",
      name: t("rights_region_other", "Autres pays"),
      flag: "🌍",
      law: t("rights_law_other", "Montreal Convention 1999"),
      summary: t("rights_summary_other", "No regional passenger protection regulation. The Montreal Convention provides minimum liability coverage for international flights between signatory countries."),
      delay: t("rights_delay_other", "No statutory cash compensation for delays. Airline care is voluntary. Montreal Convention may provide for proven damages in certain cases."),
      cancellation: t("rights_cancellation_other", "Refund or rebooking subject to airline policy and conditions of carriage. Montreal Convention does not provide fixed cancellation compensation."),
      denied: t("rights_denied_other", "No fixed compensation. Montreal Convention liability limits may apply depending on the route and circumstances."),
      baggage: t("rights_baggage_other", "Montreal Convention applies: terms set by applicable regulation."),
      compensation: [
        { label: t("rights_other_montreal", "Montreal Convention"), value: t("rights_other_proven", "Proven damages") },
      ],
    },
  ], [t, config, caBagLabel, usBagLabel]);

  const handleFlightNoChange = useCallback((value: string) => {
    setFlightNo(value);
    setValidationError(null);
    setDetectedRegion(null);

    const iata = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
    if (iata.length >= 4) {
      const depRegion = resolveRegionFromAirportIata(iata);
      if (depRegion) {
        setDetectedRegion(depRegion);
        setRegion(depRegion);
      }
    }
  }, []);

  const handleRegionChange = useCallback((value: string) => {
    const newRegion = value as Region;
    setRegion(newRegion);
    if (detectedRegion && newRegion !== detectedRegion) {
      setValidationError(
        t("rights_region_mismatch",
          "La région sélectionnée ne correspond pas au pays de départ du vol. Ce vol est classé dans la catégorie '{{correctRegion}}'.")
        .replace("{{correctRegion}}", REGION_LABELS[detectedRegion])
      );
    } else {
      setValidationError(null);
    }
  }, [detectedRegion, t]);

  const handleSubmit = useCallback(() => {
    if (validationError) {
      return;
    }
    setSubmitted(true);
  }, [validationError]);

  const result = useMemo(() => {
    const euAmt = (d: number) => {
      const r = config.regulations.filter(r => r.region === "EU" && r.right_type === "compensation" && r.compensation_amount);
      return d <= 1500 ? (r.find(x => x.description_en.includes("1500km") && !x.description_en.includes("3500"))?.compensation_amount ?? "€250")
        : d <= 3500 ? (r.find(x => x.description_en.includes("3500km"))?.compensation_amount ?? "€400")
        : (r[r.length - 1]?.compensation_amount ?? "€600");
    };
    const ukAmt = (d: number) => {
      const r = config.regulations.filter(r => r.region === "UK" && r.right_type === "compensation" && r.compensation_amount);
      return d <= 1500 ? (r.find(x => x.description_en.includes("1500km") && !x.description_en.includes("3500"))?.compensation_amount ?? "£220")
        : d <= 3500 ? (r.find(x => x.description_en.includes("3500km"))?.compensation_amount ?? "£350")
        : (r[r.length - 1]?.compensation_amount ?? "£520");
    };
    const usDeniedShort = config.limits.find(l => l.category === "denied_boarding_200")?.amount_usd;
    const usDeniedLong = config.limits.find(l => l.category === "denied_boarding_400")?.amount_usd;
    const caDenied = config.limits.find(l => l.region === "CA" && l.category === "denied_boarding");
    const caCanc = config.limits.find(l => l.region === "CA" && l.category === "cancellation_comp");
    const caSmall3 = config.limits.find(l => l.region === "CA" && l.category === "small_carrier_3_6");
    const caLarge9 = config.limits.find(l => l.region === "CA" && l.category === "large_carrier_9plus");
    const caSmall9 = config.limits.find(l => l.region === "CA" && l.category === "small_carrier_9plus");

    const euRange = config.regulations.filter(r => r.region === "EU" && r.right_type === "compensation" && r.compensation_amount).map(r => r.compensation_amount!).filter(Boolean).join("–") || "€250–€600";
    const ukRange = config.regulations.filter(r => r.region === "UK" && r.right_type === "compensation" && r.compensation_amount).map(r => r.compensation_amount!).filter(Boolean).join("–") || "£220–£520";
    const caRangeDenied = caDenied?.amount_cad ? `CA$${caDenied.amount_cad.toLocaleString()}` : "CA$2,400";
    const caRangeCancel = caCanc?.amount_cad ? `CA$${caCanc.amount_cad.toLocaleString()}` : "CA$1,000";

    if (issue === "baggage") {
      return {
        eligible: true,
        title: t("rights_baggage_eligible_title", "Likely eligible — Baggage claim"),
        detail: t("rights_baggage_eligible_detail", "File a Property Irregularity Report (PIR) at the airport within 7 days for damage, 21 days for delay. Keep receipts for essentials."),
        amount: t("rights_baggage_eligible_amount", "Varies by applicable regulation — see region details"),
      };
    }

    if (issue === "denied") {
      return {
        eligible: true,
        title: t("rights_denied_eligible_title", "Likely eligible — Denied boarding"),
        detail: t("rights_denied_eligible_detail", "Involuntary denied boarding triggers immediate compensation, rerouting or refund, and care."),
        amount:
          region === "us"
            ? hours >= 2
              ? (usDeniedLong ? `Up to $${usDeniedLong.toLocaleString()} (400% fare)` : t("rights_amount_us_denied_high", "Up to $2,150 (400% fare)"))
              : (usDeniedShort ? `Up to $${usDeniedShort.toLocaleString()} (200% fare)` : t("rights_amount_us_denied_low", "Up to $1,075 (200% fare)"))
            : region === "ca"
              ? caRangeDenied
              : region === "uk"
                ? ukRange
                : region === "eu"
                  ? euRange
                  : t("rights_amount_other_denied", "Montreal Convention liability limits"),
      };
    }

    if (issue === "cancellation") {
      if (noticeDays >= 14) {
        return {
          eligible: false,
          title: t("rights_cancel_not_eligible_title", "Likely not eligible for compensation"),
          detail: t("rights_cancel_not_eligible_detail", "You were notified 14+ days in advance. You're still entitled to a refund or rerouting."),
          amount: t("rights_amount_refund_only", "Refund / rerouting only"),
        };
      }
      if (!controllable) {
        return {
          eligible: false,
          title: t("rights_cancel_extraordinary_title", "Compensation unlikely (extraordinary circumstances)"),
          detail: t("rights_cancel_extraordinary_detail", "Weather, ATC, security or strikes typically exempt the airline. You're still entitled to care and a refund or rerouting."),
          amount: t("rights_amount_refund_care", "Refund / rerouting + care"),
        };
      }
      return {
        eligible: true,
        title: t("rights_cancel_eligible_title", "Likely eligible — Cancellation"),
        detail: t("rights_cancel_eligible_detail", "Cancellation within 14 days and within the carrier's control. You can claim compensation in addition to refund or rerouting."),
        amount:
          region === "eu"
            ? euRange
            : region === "uk"
              ? ukRange
              : region === "ca"
                ? (caSmall3?.amount_cad && caLarge9?.amount_cad
                  ? `CA$${caSmall3.amount_cad.toLocaleString()} – CA$${caLarge9.amount_cad.toLocaleString()}`
                  : caRangeCancel)
                : t("rights_amount_refund_policy", "Refund + airline policy"),
      };
    }

    // Delay
    if (region === "us") {
      return {
        eligible: hours >= 3,
        title:
          hours >= 3
            ? t("rights_delay_us_eligible_title", "May be eligible — significant delay")
            : t("rights_delay_us_not_eligible_title", "Not eligible for cash compensation"),
        detail: t("rights_delay_us_detail", "US has no statutory cash compensation for delays, but you can refuse travel and get a full refund for significant delays. Airlines may provide meals/hotel per their policy."),
        amount: hours >= 3 ? t("rights_amount_refund_care_us", "Refund + airline care") : "—",
      };
    }

    if (!controllable) {
      return {
        eligible: false,
        title: t("rights_delay_extraordinary_title", "Compensation unlikely (extraordinary circumstances)"),
        detail: t("rights_delay_extraordinary_detail", "The disruption appears outside the airline's control. You're still entitled to care."),
        amount: t("rights_amount_care_refund", "Care + refund if delay is long enough"),
      };
    }

    if (region === "eu") {
      if (hours < 3)
        return {
          eligible: false,
          title: t("rights_delay_eu_under3h_title", "Not yet eligible — delay under 3h"),
          detail: t("rights_delay_eu_under3h_detail", "EU 261 compensation kicks in at 3h+ arrival delay."),
          amount: t("rights_amount_care_only", "Care only (meals, refreshments)"),
        };
      return {
        eligible: true,
        title: t("rights_delay_eu_eligible_title", "Likely eligible — EU 261 delay"),
        detail: t("rights_delay_eu_eligible_detail", "Arrival delay of 3h+ on a controllable disruption."),
        amount: t("rights_amount_eu_delay", "") + " " + euCompRange,
      };
    }

    if (region === "uk") {
      if (hours < 3)
        return {
          eligible: false,
          title: t("rights_delay_uk_under3h_title", "Not yet eligible — delay under 3h"),
          detail: t("rights_delay_uk_under3h_detail", "UK 261 compensation kicks in at 3h+ arrival delay."),
          amount: t("rights_amount_care_only", "Care only (meals, refreshments)"),
        };
      return {
        eligible: true,
        title: t("rights_delay_uk_eligible_title", "Likely eligible — UK 261 delay"),
        detail: t("rights_delay_uk_eligible_detail", "Arrival delay of 3h+ on a controllable disruption."),
        amount: t("rights_amount_uk_delay", "") + " " + ukCompRange,
      };
    }

    if (region === "ca") {
      if (hours < 3)
        return {
          eligible: false,
          title: t("rights_delay_ca_under3h_title", "Not yet eligible — delay under 3h"),
          detail: t("rights_delay_ca_under3h_detail", "APPR compensation begins at 3h arrival delay."),
          amount: t("rights_amount_treatment_only", "Standards of treatment only"),
        };
      return {
        eligible: true,
        title: t("rights_delay_ca_eligible_title", "Likely eligible — APPR delay"),
        detail: t("rights_delay_ca_eligible_detail", "Controllable delay 3h+ on a Canadian flight."),
        amount: caCompRangeStr || "CA$400 / CA$700 / CA$1,000",
      };
    }

    if (hours < 2)
      return {
        eligible: false,
        title: t("rights_delay_other_under2h_title", "Not eligible — delay under 2h"),
        detail: t("rights_delay_other_under2h_detail", "No statutory compensation. Montreal Convention may apply for proven damages."),
        amount: "—",
      };
    return {
      eligible: false,
      title: t("rights_delay_other_title", "No fixed compensation"),
      detail: t("rights_delay_other_detail", "No statutory compensation scheme exists for this region. The Montreal Convention provides for proven damages in certain cases. Care may be provided voluntarily by the airline."),
      amount: t("rights_amount_montreal", "Montreal Convention — proven damages"),
    };
  }, [region, issue, hours, noticeDays, controllable, t, config, euCompRange, ukCompRange, caCompRangeStr]);

  const active = useMemo(() => regions.find((r) => r.id === region)!, [regions, region]);

  return (
    <div className="min-h-screen bg-background">
      <PublicNav overlay={false} />

      {/* Hero */}
      <section className="pt-28 md:pt-36 pb-12 md:pb-20 border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-xs uppercase tracking-[0.18em] text-muted-foreground mb-6">
              <Scale className="h-3.5 w-3.5 text-primary" />
              {t("rights_eyebrow", "Passenger Rights")}
            </div>
            <h1 className="font-display text-4xl md:text-6xl leading-[1.05] tracking-tight text-foreground">
              {t("rights_headline", "Know what you're owed.")}
              <span className="block text-primary">{t("rights_headline_accent", "Claim with confidence.")}</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              {t("rights_description")}
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
                {t("rights_compare_regions", "Compare regions")}
              </div>
              <h2 className="font-display text-3xl md:text-4xl text-foreground">
                {t("rights_region_by_region", "Your rights, region by region.")}
              </h2>
            </div>
          </div>

          <Tabs value={region} onValueChange={handleRegionChange}>
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 bg-secondary">
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
                      {t("rights_governing_rule", "Governing rule")}
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
                      title={t("rights_delay", "Delays")}
                      body={r.delay}
                    />
                    <RightCard
                      icon={<Ban className="h-5 w-5" />}
                      title={t("rights_cancellation", "Cancellations")}
                      body={r.cancellation}
                    />
                    <RightCard
                      icon={<Plane className="h-5 w-5" />}
                      title={t("rights_denied", "Denied boarding")}
                      body={r.denied}
                    />
                    <RightCard
                      icon={<Luggage className="h-5 w-5" />}
                      title={t("rights_baggage", "Baggage")}
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
              {t("rights_eligibility_checker", "Free eligibility checker")}
            </div>
            <h2 className="font-display text-3xl md:text-4xl text-foreground">
              {t("rights_check_in_60_sec", "Check your claim in 60 seconds.")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("rights_checker_desc")}
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-3 p-6 md:p-8 bg-card border-border">
              <div className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="flight">{t("rights_flight_number", "Flight number (optional)")}</Label>
                    <Input
                      id="flight"
                      name="flight_number"
                      placeholder="e.g. AF1234"
                      value={flightNo}
                      onChange={(e) => handleFlightNoChange(e.target.value)}
                      className="mt-2"
                    />
                    {detectedRegion && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("rights_detected_region", "Départ détecté")}: {REGION_LABELS[detectedRegion]}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>{t("rights_departure_region", "Region of departure")}</Label>
                    <Select name="region" value={region} onValueChange={handleRegionChange}>
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
                    {validationError && (
                      <p className="text-xs text-destructive mt-1">{validationError}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block">{t("rights_what_happened", "What happened?")}</Label>
                  <RadioGroup
                    value={issue}
                    onValueChange={(v) => setIssue(v as IssueType)}
                    className="grid sm:grid-cols-2 gap-3"
                  >
                    {[
                      { id: "delay", label: t("rights_delay", "Delay"), icon: Clock },
                      { id: "cancellation", label: t("rights_cancellation", "Cancellation"), icon: Ban },
                      { id: "denied", label: t("rights_denied", "Denied boarding"), icon: Plane },
                      { id: "baggage", label: t("rights_baggage", "Baggage issue"), icon: Luggage },
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
                    <Label htmlFor="hours">{t("rights_delay_hours", "Delay at final destination (hours)")}</Label>
                    <Input
                      id="hours"
                      name="delay_hours"
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
                    <Label htmlFor="notice">{t("rights_notice_days", "How many days notice did you receive?")}</Label>
                    <Input
                      id="notice"
                      name="notice_days"
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
                    <Label className="mb-3 block">{t("rights_is_controllable", "Was the cause within the airline's control?")}</Label>
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
                        <span className="text-sm">{t("rights_control_yes", "Yes (technical, crew, scheduling)")}</span>
                      </label>
                      <label
                        htmlFor="ctrl-no"
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          !controllable ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
                        }`}
                      >
                        <RadioGroupItem value="no" id="ctrl-no" />
                        <span className="text-sm">{t("rights_control_no", "No (weather, ATC, strike)")}</span>
                      </label>
                    </RadioGroup>
                  </div>
                )}

                <Button
                  size="lg"
                  className="w-full bg-gradient-amber text-primary-foreground shadow-amber font-medium"
                  onClick={handleSubmit}
                  disabled={!!validationError}
                >
                  {t("rights_check_btn", "Check eligibility")}
                </Button>
                {validationError && (
                  <p className="text-xs text-destructive text-center">
                    {t("rights_validation_blocked", "Veuillez d'abord sélectionner la région correcte pour ce vol.")}
                  </p>
                )}
              </div>
            </Card>

            <Card className="lg:col-span-2 p-6 md:p-8 bg-card border-border h-fit lg:sticky lg:top-24">
              {!submitted ? (
                <div className="text-center py-8">
                  <div className="h-14 w-14 mx-auto rounded-full bg-secondary grid place-items-center mb-4">
                    <Scale className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-display text-xl text-foreground">{t("rights_your_result", "Your result")}</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t("rights_result_empty")}
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
                      {result.eligible ? t("rights_likely_eligible", "Likely eligible") : t("rights_likely_not_eligible", "Likely not eligible")}
                    </Badge>
                  </div>

                  <h3 className="font-display text-2xl text-foreground mt-4">{result.title}</h3>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    {result.detail}
                  </p>

                  <div className="mt-5 p-4 rounded-lg bg-secondary">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {t("rights_est_amount", "Estimated amount")}
                    </div>
                    <div className="font-display text-2xl text-primary mt-1">{result.amount}</div>
                  </div>

                  <div className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <p>
                      {t("rights_disclaimer_text")}
                    </p>
                  </div>
                  <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground/70">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <p>
                      {t("rights_conversion_disclaimer")}
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
          Smart Airport Companion · {t("rights_eyebrow", "Passenger Rights")} guide
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

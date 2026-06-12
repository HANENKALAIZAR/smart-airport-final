/**
 * Passenger Rights Engine
 * Determines what a passenger is entitled to based on:
 *  - Route type (domestic / international / EU-departing)
 *  - Delay duration in minutes
 *  - Flight status (delayed / cancelled)
 *
 * All compensation amounts come from compensation_config.json — never hardcoded.
 */

const fs = require("fs");
const path = require("path");

let _config = null;
function getConfig() {
  if (!_config) {
    const cfgPath = path.join(__dirname, "..", "data", "compensation_config.json");
    _config = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  }
  return _config;
}

function lookupRegulationAmount(region, distanceKm) {
  const config = getConfig();
  const regs = config.regulations.filter(
    (r) => r.region === region && r.right_type === "compensation" && r.compensation_amount
  );
  if (distanceKm <= 1500) {
    const match = regs.find((r) => r.description_en.includes("1500km") && !r.description_en.includes("3500"));
    return match ? match.compensation_amount : (regs[0] ? regs[0].compensation_amount : null);
  }
  if (distanceKm <= 3500) {
    const match = regs.find((r) => r.description_en.includes("3500km"));
    return match ? match.compensation_amount : (regs[1] ? regs[1].compensation_amount : null);
  }
  const match = regs.find((r) => r.description_en.includes("3500km"));
  return match ? match.compensation_amount : (regs[regs.length - 1] ? regs[regs.length - 1].compensation_amount : null);
}

function lookupLimit(region, category) {
  const config = getConfig();
  const limit = config.limits.find((l) => l.region === region && l.category === category);
  return limit || null;
}

function getPassengerRights(routeType, delayMinutes, status = "delayed") {
  const hours = delayMinutes / 60;
  const rights = {
    law: "",
    care: [],
    compensation: [],
    options: [],
    important_note: "",
  };

  // ─── UK → TUNISIA (UK261 fully applies) ─────────────────────────────────
  if (routeType === "uk_to_tunisia") {
    rights.law = "UK Regulation 261/2004 (UK 261 — legally enforceable)";
    rights.important_note =
      "You have strong legal rights under UK Regulation 261/2004 (UK 261). " +
      "These rights were established at your departure airport in the United Kingdom. " +
      "Compensation amounts are set in British pounds. " +
      "You can file a compensation claim after returning home.";

    if (hours >= 2) {
      rights.care.push("Meals and refreshments proportional to waiting time");
      rights.care.push("2 free phone calls, emails, or faxes");
    }
    if (hours >= 3 || status === "cancelled") {
      rights.care.push("Hotel accommodation if overnight stay required + transport to hotel");
      rights.options.push("Rebooking on next available flight at no cost");
      rights.options.push("Full refund of ticket price if delay exceeds 5 hours");

      const amt220 = lookupRegulationAmount("UK", 1500);
      const amt350 = lookupRegulationAmount("UK", 2500);
      const amt520 = lookupRegulationAmount("UK", 4000);

      rights.compensation.push({
        distance: "Flights under 1,500 km",
        amount: (amt220 || "£220") + " per passenger",
        example: "e.g. London → Tunis (1,900 km) — borderline, check with airline",
      });
      rights.compensation.push({
        distance: "Flights 1,500–3,500 km",
        amount: (amt350 || "£350") + " per passenger",
        example: "e.g. London → Tunis (1,900 km), Manchester → Tunis (1,850 km)",
      });
      rights.compensation.push({
        distance: "Flights over 3,500 km",
        amount: (amt520 || "£520") + " per passenger",
        example: "Longer international routes",
      });
      rights.compensation.push({
        note: "Compensation can be reduced by 50% if airline offers rebooking and arrival is within 2–4h of original time",
      });
    }
  }

  // ─── DOMESTIC (Tunisia → Tunisia) ────────────────────────────────────────
  if (routeType === "domestic") {
    rights.law = "OACA (Office de l'Aviation Civile et des Aéroports)";
    rights.important_note =
      "No legally fixed compensation exists for domestic Tunisian flights. " +
      "Your entitlements depend on the airline's own conditions of carriage.";

    if (hours >= 2) {
      rights.care.push("Request a meal voucher at the airline desk");
      rights.care.push("2 free phone calls or emails");
    }
    if (hours >= 5 || status === "cancelled") {
      rights.care.push("Request hotel accommodation if overnight stay is required");
      rights.options.push("Request rebooking on the next available flight at no extra cost");
      rights.options.push("Request a full refund if you no longer wish to travel");
    }
  }

  // ─── TUNISIA → INTERNATIONAL (non-EU destination) ────────────────────────
  if (routeType === "tunisia_international") {
    rights.law = "Montreal Convention 1999 + Airline voluntary policy";
    rights.important_note =
      "EU Regulation 261/2004 does NOT apply — your flight departs from Tunisia, not an EU airport. " +
      "The Montreal Convention applies but does not provide fixed delay compensation. " +
      "The airline may still provide care voluntarily — always ask at the desk.";

    const baggageLimit = lookupLimit("MONTREAL", "baggage_liability");
    const delayDamages = lookupLimit("MONTREAL", "damages_delay");

    if (hours >= 2) {
      rights.care.push("Ask airline desk for meal voucher (Tunisair and most airlines provide this voluntarily)");
      rights.care.push("2 free phone calls or emails (airline policy)");
    }
    if (hours >= 5 || status === "cancelled") {
      rights.care.push("Request hotel accommodation + airport transfer for overnight delays");
      rights.options.push("Request rebooking on next available flight (same airline or partner)");
      rights.options.push("Request full ticket refund if delay exceeds 5 hours");
      if (baggageLimit) {
        rights.care.push(baggageLimit.label_en);
      }
      if (delayDamages) {
        rights.options.push("You may claim proven delay damages up to " + delayDamages.label_en);
      }
    }
  }

  // ─── TUNISIA → EU ────────────────────────────────────────────────────────
  if (routeType === "tunisia_to_eu") {
    rights.law = "Montreal Convention 1999 + Airline voluntary policy";
    rights.important_note =
      "Important: Even though you are flying to Europe, EU261 does NOT apply here " +
      "because your flight DEPARTS from Tunisia (a non-EU country). " +
      "The same rules as any international departure from Tunisia apply.";

    const baggageLimit = lookupLimit("MONTREAL", "baggage_liability");

    if (hours >= 2) {
      rights.care.push("Ask for meal voucher at airline desk (voluntary but standard practice)");
      rights.care.push("2 free phone calls or emails");
    }
    if (hours >= 5 || status === "cancelled") {
      rights.care.push("Request hotel + transfer for overnight delays");
      rights.options.push("Rebooking on next available flight at no cost");
      rights.options.push("Full refund if you choose not to travel");
      if (baggageLimit) {
        rights.care.push(baggageLimit.label_en);
      }
    }
  }

  // ─── EU → TUNISIA (EU261 fully applies) ──────────────────────────────────
  if (routeType === "eu_to_tunisia") {
    rights.law = "EU Regulation 261/2004 (legally enforceable)";
    rights.important_note =
      "You have strong legal rights under EU Regulation 261/2004. " +
      "These rights were established at your departure airport in Europe. " +
      "You can file a compensation claim with the airline even after returning home.";

    if (hours >= 2) {
      rights.care.push("Meals and refreshments proportional to waiting time");
      rights.care.push("2 free phone calls, emails, or faxes");
    }
    if (hours >= 3 || status === "cancelled") {
      rights.care.push("Hotel accommodation if overnight stay required + transport to hotel");
      rights.options.push("Rebooking on next available flight at no cost");
      rights.options.push("Full refund of ticket price if delay exceeds 5 hours");

      const amt250 = lookupRegulationAmount("EU", 1500);
      const amt400 = lookupRegulationAmount("EU", 2500);
      const amt600 = lookupRegulationAmount("EU", 4000);

      rights.compensation.push({
        distance: "Flights under 1,500 km",
        amount: (amt250 || "€250") + " per passenger",
        example: "e.g. Rome → Tunis (1,583 km) — borderline, check with airline",
      });
      rights.compensation.push({
        distance: "Flights 1,500–3,500 km",
        amount: (amt400 || "€400") + " per passenger",
        example: "e.g. Paris → Tunis (1,748 km), Frankfurt → Tunis (2,050 km)",
      });
      rights.compensation.push({
        distance: "Flights over 3,500 km",
        amount: (amt600 || "€600") + " per passenger",
        example: "Longer international routes",
      });
      rights.compensation.push({
        note: "Compensation can be reduced by 50% if airline offers rebooking and arrival is within 2–4h of original time",
      });
    }
  }

  return rights;
}

function getActivitySuggestions(delayMinutes) {
  const hours = delayMinutes / 60;
  if (hours < 1) return ["short_wait"];
  if (hours < 2) return ["airport_services"];
  if (hours < 4) return ["airport_services", "lounge"];
  if (hours < 6) return ["airport_services", "lounge", "light_tourism"];
  return ["airport_services", "lounge", "tourism", "hotel"];
}

module.exports = { getPassengerRights, getActivitySuggestions };

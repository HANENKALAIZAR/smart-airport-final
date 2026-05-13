/**
 * Passenger Rights Engine
 * Determines what a passenger is entitled to based on:
 *  - Route type (domestic / international / EU-departing)
 *  - Delay duration in minutes
 *  - Flight status (delayed / cancelled)
 */

function getPassengerRights(routeType, delayMinutes, status = "delayed") {
  const hours = delayMinutes / 60;
  const rights = {
    law: "",
    care: [],           // What the airline MUST provide (or should provide)
    compensation: [],   // Financial compensation if applicable
    options: [],        // Rebooking / refund options
    important_note: "", // Key message for the passenger
  };

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

    if (hours >= 2) {
      rights.care.push("Ask airline desk for meal voucher (Tunisair and most airlines provide this voluntarily)");
      rights.care.push("2 free phone calls or emails (airline policy)");
    }
    if (hours >= 5 || status === "cancelled") {
      rights.care.push("Request hotel accommodation + airport transfer for overnight delays");
      rights.options.push("Request rebooking on next available flight (same airline or partner)");
      rights.options.push("Request full ticket refund if delay exceeds 5 hours");
    }
  }

  // ─── TUNISIA → EU ────────────────────────────────────────────────────────
  if (routeType === "tunisia_to_eu") {
    rights.law = "Montreal Convention 1999 + Airline voluntary policy";
    rights.important_note =
      "Important: Even though you are flying to Europe, EU261 does NOT apply here " +
      "because your flight DEPARTS from Tunisia (a non-EU country). " +
      "The same rules as any international departure from Tunisia apply.";

    if (hours >= 2) {
      rights.care.push("Ask for meal voucher at airline desk (voluntary but standard practice)");
      rights.care.push("2 free phone calls or emails");
    }
    if (hours >= 5 || status === "cancelled") {
      rights.care.push("Request hotel + transfer for overnight delays");
      rights.options.push("Rebooking on next available flight at no cost");
      rights.options.push("Full refund if you choose not to travel");
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

      // EU261 financial compensation
      rights.compensation.push({
        distance: "Flights under 1,500 km",
        amount: "€250 per passenger",
        example: "e.g. Rome → Tunis (1,583 km) — borderline, check with airline",
      });
      rights.compensation.push({
        distance: "Flights 1,500–3,500 km",
        amount: "€400 per passenger",
        example: "e.g. Paris → Tunis (1,748 km), Frankfurt → Tunis (2,050 km)",
      });
      rights.compensation.push({
        distance: "Flights over 3,500 km",
        amount: "€600 per passenger",
        example: "Longer international routes",
      });
      rights.compensation.push({
        note: "Compensation can be reduced by 50% if airline offers rebooking and arrival is within 2–4h of original time",
      });
    }
  }

  return rights;
}

// Suggest activities based on delay duration
function getActivitySuggestions(delayMinutes) {
  const hours = delayMinutes / 60;
  if (hours < 1) return ["short_wait"]; // Nothing special needed
  if (hours < 2) return ["airport_services"]; // Cafés, shops, Wi-Fi
  if (hours < 4) return ["airport_services", "lounge"]; // Lounge if available
  if (hours < 6) return ["airport_services", "lounge", "light_tourism"]; // Quick nearby trips
  return ["airport_services", "lounge", "tourism", "hotel"]; // Long delay — full suggestions
}

module.exports = { getPassengerRights, getActivitySuggestions };

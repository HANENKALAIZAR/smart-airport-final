const { getRouteType } = require("./data/airports");

// ─── MOCK FLIGHTS (for PFE demo without burning API quota) ───────────────────
const MOCK_FLIGHTS = {
  TU741: {
    flight_number: "TU741",
    airline: { name: "Tunisair", iata: "TU" },
    departure: { airport: "Tunis-Carthage International", iata: "TUN", scheduled: "14:30", delay: 180 },
    arrival:   { airport: "Paris Charles de Gaulle",      iata: "CDG", scheduled: "17:10" },
    status: "delayed",
  },
  TU7: {
    flight_number: "TU7",
    airline: { name: "Tunisair", iata: "TU" },
    departure: { airport: "Tunis-Carthage International", iata: "TUN", scheduled: "08:00", delay: 0 },
    arrival:   { airport: "Djerba–Zarzis International",  iata: "DJE", scheduled: "09:00" },
    status: "active",
  },
  EK740: {
    flight_number: "EK740",
    airline: { name: "Emirates", iata: "EK" },
    departure: { airport: "Dubai International", iata: "DXB", scheduled: "02:15", delay: 240 },
    arrival:   { airport: "Tunis-Carthage International", iata: "TUN", scheduled: "06:50" },
    status: "delayed",
  },
  TK742: {
    flight_number: "TK742",
    airline: { name: "Turkish Airlines", iata: "TK" },
    departure: { airport: "Tunis-Carthage International", iata: "TUN", scheduled: "11:00", delay: 90 },
    arrival:   { airport: "Istanbul Airport",              iata: "IST", scheduled: "14:30" },
    status: "delayed",
  },
  TO3561: {
    flight_number: "TO3561",
    airline: { name: "Transavia France", iata: "TO" },
    departure: { airport: "Paris Orly",                   iata: "ORY", scheduled: "07:20", delay: 195 },
    arrival:   { airport: "Djerba–Zarzis International",  iata: "DJE", scheduled: "10:45" },
    status: "delayed",
  },
  LH1354: {
    flight_number: "LH1354",
    airline: { name: "Lufthansa", iata: "LH" },
    departure: { airport: "Frankfurt Airport",             iata: "FRA", scheduled: "10:05", delay: 0 },
    arrival:   { airport: "Tunis-Carthage International", iata: "TUN", scheduled: "12:30" },
    status: "cancelled",
  },
  U21504: {
    flight_number: "U21504",
    airline: { name: "easyJet", iata: "U2" },
    departure: { airport: "Paris Charles de Gaulle",       iata: "CDG", scheduled: "15:40", delay: 310 },
    arrival:   { airport: "Monastir Habib Bourguiba",      iata: "MIR", scheduled: "18:55" },
    status: "delayed",
  },
};

/**
 * Fetch flight data from AviationStack API
 * Falls back to mock data if API key not set or flight not found
 */
async function getFlightData(flightNumber) {
  const clean = typeof flightNumber === 'string' ? flightNumber.toUpperCase().replace(/\s/g, "") : String(flightNumber).replace(/\s/g, "");

  // Try AviationStack if API key is configured
  const apiKey = process.env.AVIATIONSTACK_KEY;
  if (apiKey && apiKey !== "YOUR_KEY_HERE") {
    try {
      const url = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${clean}&limit=1`;
      const res = await fetch(url);
      const json = await res.json();
      
      // Log raw AviationStack API response for debugging
      console.log(`🔍 [AVIATIONSTACK] Raw API response for ${flightNumber}:`, JSON.stringify(json, null, 2));

      if (json.data && json.data.length > 0) {
        const f = json.data[0];
        console.log(`🔍 [AVIATIONSTACK] Route direction: ${f.departure.iata} → ${f.arrival.iata}`);
        return {
          found: true,
          source: "live",
          flight_number: clean,
          airline: { name: f.airline.name, iata: f.airline.iata },
          departure: {
            airport:   f.departure.airport,
            iata:      f.departure.iata,
            scheduled: f.departure.scheduled,
            delay:     f.departure.delay || 0,
            gate:      f.departure.gate || null,
            terminal:  f.departure.terminal || null,
          },
          arrival: {
            airport:   f.arrival.airport,
            iata:      f.arrival.iata,
            scheduled: f.arrival.scheduled,
            delay:     f.arrival.delay || 0,
            gate:      f.arrival.gate || null,
            terminal:  f.arrival.terminal || null,
          },
          status: f.flight_status,
          route_type: getRouteType(f.departure.iata, f.arrival.iata, f.airline.iata),
        };
      }
    } catch (err) {
      console.error("AviationStack API error:", err.message);
      // Fall through to mock
    }
  }

  // Fall back to mock data
  if (MOCK_FLIGHTS[clean]) {
    const f = MOCK_FLIGHTS[clean];
    return {
      found: true,
      source: "mock",
      ...f,
      route_type: getRouteType(f.departure.iata, f.arrival.iata, f.airline.iata),
    };
  }

  return { found: false, flight_number: clean };
}

/**
 * Fetch alternative flights from AviationStack API for a specific route
 */
async function getAlternativeFlights(origin, destination) {
  const apiKey = process.env.AVIATIONSTACK_KEY;
  if (!apiKey || apiKey === "YOUR_KEY_HERE") {
    console.log("❌ [AVIATIONSTACK] No API key configured");
    return [];
  }

  try {
    const url = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&dep_iata=${origin}&arr_iata=${destination}&limit=10`;
    console.log(`🔍 [AVIATIONSTACK] Searching alternatives ${origin} → ${destination}`);
    
    const res = await fetch(url);
    const json = await res.json();
    
    // Log raw AviationStack API response for debugging
    console.log("AviationStack response:", JSON.stringify(json, null, 2));

    if (json.data && json.data.length > 0) {
      const flights = json.data.map(f => ({
        flight_number: f.flight.iata,
        airline: { name: f.airline.name, iata: f.airline.iata },
        departure: {
          airport: f.departure.airport,
          iata: f.departure.iata,
          scheduled: f.departure.scheduled,
          delay: f.departure.delay || 0,
        },
        arrival: {
          airport: f.arrival.airport,
          iata: f.arrival.iata,
          scheduled: f.arrival.scheduled,
          delay: f.arrival.delay || 0,
        },
        status: f.flight_status,
      }));
      
      console.log(`✅ [AVIATIONSTACK] Found ${flights.length} alternative flights`);
      return flights;
    }
    
    console.log(`❌ [AVIATIONSTACK] No flights found for ${origin} → ${destination}`);
    return [];
    
  } catch (error) {
    console.error(`❌ [AVIATIONSTACK] API error:`, error.message);
    return [];
  }
}

module.exports = { getFlightData, getAlternativeFlights };

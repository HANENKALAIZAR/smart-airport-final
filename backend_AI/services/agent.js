/**
 * agent.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Airport AI assistant — real-time data only.
 * No mock flights. No hardcoded alternatives.
 * If the API returns nothing, the agent says so honestly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { getFlightData, getAlternativeFlights } = require('./flightService');
const { searchHotelsNearAirport } = require('./hotelsService');
const { AIRPORTS } = require('./airports');
const { chat } = require('./llm');

// ─────────────────────────────────────────────────────────────────────────────
// AIRPORT NAME → IATA  (natural-language detection)
// ─────────────────────────────────────────────────────────────────────────────
const AIRPORT_NAME_MAP = {
  // Tunis-Carthage
  'tun': 'TUN', 'tunis': 'TUN', 'carthage': 'TUN', 'tunis carthage': 'TUN',
  'tunis-carthage': 'TUN', 'tuniscarthage': 'TUN',

  // Djerba–Zarzis
  'dje': 'DJE', 'djerba': 'DJE', 'jerba': 'DJE', 'djerba airport': 'DJE',
  'zarzis': 'DJE', 'djerba zarzis': 'DJE', 'djerba-zarzis': 'DJE',
  'aéroport djerba': 'DJE', 'مطار جربة': 'DJE',

  // Monastir
  'mir': 'MIR', 'monastir': 'MIR', 'habib bourguiba': 'MIR',
  'monastir airport': 'MIR', 'aéroport monastir': 'MIR', 'مطار المنستير': 'MIR',

  // Enfidha–Hammamet
  'nbe': 'NBE', 'enfidha': 'NBE', 'hammamet': 'NBE', 'enfidha hammamet': 'NBE',
  'enfidha-hammamet': 'NBE', 'aéroport hammamet': 'NBE', 'مطار الحمامات': 'NBE',
};

function extractAirportFromMessage(message) {
  const msg = message.toLowerCase().trim();

  // Direct IATA code
  const iataMatch = msg.match(/\b(tun|dje|mir|nbe)\b/i);
  if (iataMatch) return iataMatch[1].toUpperCase();

  // Name map — longest match first to avoid partial collisions
  const keys = Object.keys(AIRPORT_NAME_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (msg.includes(key)) return AIRPORT_NAME_MAP[key];
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a professional airport assistant AI deployed at Tunisian airports (TUN, DJE, MIR, NBE). Help passengers with flight disruptions, rights, and airport services. Be brief, empathetic, and direct.

═══════════════════════════════════════
CORE RULES
═══════════════════════════════════════
- NEVER introduce yourself or say your name
- NEVER say "I'm here to help", "I'm happy to help", or any filler phrase
- Keep replies SHORT — max 2 sentences for general replies
- NEVER invent flights, times, prices, or compensation amounts
- If data is unavailable, say so honestly and tell the passenger where to verify
- ALWAYS reply in the EXACT language the passenger used
- For Arabic: mirror the passenger's style (Darija or MSA) exactly
- Off-topic questions: one sentence redirect only
- ALWAYS return valid JSON only — no markdown, no plain text, no code fences

═══════════════════════════════════════
MISSING CONTEXT
═══════════════════════════════════════
- Flight number missing and needed: ask ONCE, briefly
- Delay unknown: default to 180 min for rights calculation, do NOT invent a reason
- Airport unknown: default to TUN
- Airline unknown: NEVER assume any specific airline

═══════════════════════════════════════
LANGUAGE
═══════════════════════════════════════
- Reply in the same language and register as the passenger
- Mixed-language message: use the dominant language
- Never switch Arabic script/dialect from what the passenger used

═══════════════════════════════════════
JSON SHAPES
═══════════════════════════════════════

// GENERAL
{ "type": "general", "message": "1–2 sentences.", "actions": ["Flight Status", "Passenger Rights", "Airport Services"] }

// FLIGHT STATUS
{
  "type": "flight",
  "flight": {
    "number": "TU741", "airline": "Tunisair",
    "route": { "from": "Tunis (TUN)", "to": "Paris (CDG)" },
    "status": "delayed", "delay": "3h 00min",
    "scheduledDeparture": "14:30", "scheduledArrival": "17:10"
  },
  "message": null,
  "suggestion": "Go to the Tunisair desk in Terminal 1 for assistance.",
  "actions": ["Passenger Rights", "Alternative Flights", "Airport Services"],
  "isFollowUp": false
}

// PASSENGER RIGHTS
{
  "type": "rights", "message": "Your rights for this delay:",
  "rights": [
    { "title": "Meal voucher", "detail": "Free meal after 2h — request at airline desk" },
    { "title": "Hotel", "detail": "Free accommodation if overnight stay required" },
    { "title": "Refund", "detail": "Full refund if delay exceeds 5 hours" },
    { "title": "Compensation", "detail": "€250–€600 if departing from EU airport" }
  ],
  "suggestion": "Go to the airline desk now. Keep all receipts.",
  "actions": ["Alternative Flights", "Airport Services", "Flight Status"],
  "isFollowUp": false
}

// ALTERNATIVE FLIGHTS
{
  "type": "flights", "message": "Available flights on this route:",
  "flights": [
    { "flightNumber": "TU743", "departure": "18:30", "arrival": "21:10", "airline": "Tunisair", "status": "On time" }
  ],
  "suggestion": "Book at the airline desk.",
  "actions": ["Passenger Rights", "Airport Services", "Flight Status"],
  "isFollowUp": false
}

// AIRPORT SERVICES
{
  "type": "services", "message": "Available at your airport:",
  "services": [{ "name": "Café Express", "location": "Terminal 2", "detail": "Open 05:00–23:00" }],
  "suggestion": "Visit the information desk for live updates.",
  "actions": ["Alternative Flights", "Passenger Rights", "Flight Status"],
  "isFollowUp": false
}

═══════════════════════════════════════
STRICT JSON RULES
═══════════════════════════════════════
- Output ONLY the JSON object — starts with { ends with }
- Double quotes everywhere
- "actions" NEVER empty for delayed/cancelled flights
- "isFollowUp": true if not the first exchange
- NEVER add fields not listed above
- NEVER wrap in markdown or code fences`;

// ─────────────────────────────────────────────────────────────────────────────
// SESSION STORE
// ─────────────────────────────────────────────────────────────────────────────
const sessions = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// INTENT DETECTION  (EN / FR / AR keywords)
// ─────────────────────────────────────────────────────────────────────────────
function detectIntent(message) {
  const padMsg = ` ${message.toLowerCase().replace(/[.,!?:'"()\[\]{}]/g, ' ')} `;

  if (padMsg.match(/ (alternative|other flight|rebook|autre vol|vol alternatif|rebooker|طيران بديل|رحلة أخرى|vol de remplacement) /))
    return 'alternative_flights';

  if (padMsg.match(/ (right|rights|compensation|refund|indemnisation|remboursement|droit|droits|حق|حقوق|تعويض|استرداد) /))
    return 'passenger_rights';

  if (padMsg.match(/ (hotel|hotels|hôtel|hôtels|accommodation|hébergement|sleep|dormir|room|rooms|chambre|chambres|motel|hostel|stay|فندق|إقامة|نام|غرفة|نزل) /))
    return 'hotels';

  if (padMsg.match(/ (service|services|lounge|food|restaurant|wifi|shop|boutique|nourriture|salon|مطعم|خدمة|صالة|eat|manger) /))
    return 'airport_services';

  if (padMsg.match(/[a-z]{2,3}\s?\d{1,4}/i) ||
    padMsg.match(/ (flight|flights|vol|vols|delay|retard|status|statut|track|تأخير|وضع|delayed|cancelled|annulé|رحلة|رحلات) /))
    return 'flight_status';

  return 'general';
}

function extractFlightNumber(message) {
  // Matches e.g. TU741, TU 0400, AF 1083, TU0400
  const match = message.match(/\b([A-Z]{2,3})\s?(\d{1,4})\b/i);
  if (!match) return null;
  return (match[1] + match[2]).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLS
// ─────────────────────────────────────────────────────────────────────────────
const tools = {

  async getFlightStatus(flightNumber, session) {
    console.log(`🔧 [TOOL] getFlightStatus: ${flightNumber}`);
    const data = await getFlightData(flightNumber);

    if (!data.found) {
      return {
        type: 'general',
        message: `No live data found for flight ${flightNumber}. Please double-check the flight number.`,
        suggestion: 'Verify at the airline desk or on the airline\'s website.',
        actions: ['Alternative Flights', 'Airport Services', 'Passenger Rights'],
      };
    }

    console.log(`✅ [TOOL] Flight ${flightNumber} found (${data.source})`);

    // Update session with everything we know
    if (session) {
      session.flightNumber = data.flight_number;
      session.airline = data.airline.name;
      session.origin = data.departure.iata;
      session.destination = data.arrival.iata;
      session.delayMinutes = data.departure.delay || 0;
      session.status = data.status;
      session.route_type = data.route_type;
      if (!session.selectedAirport) session.selectedAirport = data.departure.iata;
    }

    return {
      flightNumber: data.flight_number,
      airline: data.airline.name,
      route: `${data.departure.iata} → ${data.arrival.iata}`,
      status: data.status,
      delay: data.departure.delay || 0,
      scheduledDeparture: data.departure.scheduled,
      scheduledArrival: data.arrival.scheduled,
      actualDeparture: data.departure.actual || null,
      gate: data.departure.gate || null,
      terminal: data.departure.terminal || null,
    };
  },

  async getPassengerRights(delayMinutes, routeType = 'tunisia_to_eu') {
    console.log(`🔧 [TOOL] getPassengerRights: ${delayMinutes}min, ${routeType}`);
    const { getPassengerRights: getRights } = require('./rights');
    const data = getRights(routeType, delayMinutes, 'delayed');
    const rights = [];

    if (data.compensation?.length > 0 && data.compensation[0].amount) {
      const c = data.compensation[0];
      rights.push({ title: 'Compensation', detail: `${c.amount} — ${c.example || c.distance}` });
    }

    data.care.forEach(item => {
      const l = item.toLowerCase();
      if (l.includes('meal') || l.includes('voucher') || l.includes('repas'))
        rights.push({ title: 'Meal voucher', detail: item });
      else if (l.includes('hotel') || l.includes('accommodation') || l.includes('hébergement'))
        rights.push({ title: 'Hotel', detail: item });
      else if (l.includes('phone') || l.includes('call') || l.includes('email'))
        rights.push({ title: 'Communication', detail: item });
      else
        rights.push({ title: 'Care', detail: item });
    });

    data.options.forEach(item => {
      const l = item.toLowerCase();
      if (l.includes('refund') || l.includes('remboursement'))
        rights.push({ title: 'Full refund', detail: item });
      else if (l.includes('rebook'))
        rights.push({ title: 'Rebooking', detail: item });
    });

    const lawNote = routeType === 'eu_to_tunisia'
      ? 'EU Regulation 261/2004 applies — file at ec.europa.eu/transport'
      : routeType === 'domestic'
        ? 'OACA rules apply — contact airline desk'
        : 'Montreal Convention applies — ask airline for voluntary compensation';

    return { delayMinutes, rights, lawNote };
  },

  async getAirportServices(airportCode) {
    console.log(`🔧 [TOOL] getAirportServices: ${airportCode}`);
    const { AIRPORTS } = require('./airports');
    const airport = AIRPORTS[airportCode];
    if (!airport) return null;

    const services = [];
    if (airport.wifi)
      services.push({ name: 'Free WiFi', location: 'All terminals', detail: airport.wifi });
    airport.restaurants?.forEach(r =>
      services.push({ name: r.name, location: r.terminal, detail: `${r.type} — Open ${r.open}` }));
    airport.lounges?.forEach(l =>
      services.push({ name: l.name, location: l.terminal, detail: `Access: ${l.access}` }));

    return { airport: airportCode, services };
  },

  async getAlternativeFlights(origin, destination) {
    console.log(`🔧 [TOOL] getAlternativeFlights: ${origin} → ${destination}`);
    const liveAlts = await getAlternativeFlights(origin, destination);

    if (liveAlts.length > 0) {
      const flights = liveAlts.slice(0, 4).map(f => ({
        flightNumber: f.flight_number,
        departure: f.departure.scheduled,
        arrival: f.arrival.scheduled,
        airline: f.airline.name,
        status: f.status === 'active' ? 'On time' :
          f.status === 'scheduled' ? 'Scheduled' :
            f.status === 'delayed' ? 'Delayed' : f.status,
      }));
      return { flights, origin, destination };
    }

    // Truly no alternatives found — honest response
    return {
      type: 'general',
      message: `No alternative flights found for ${origin} → ${destination} at this time.`,
      suggestion: 'Check at the airline desk or visit the airline\'s website for more options.',
      actions: ['Passenger Rights', 'Airport Services'],
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN AGENT
// ─────────────────────────────────────────────────────────────────────────────
async function runAgent(message, history = [], conversationId = 'default', selectedAirport = null) {
  try {
    console.log(`\n[Agent] "${message}" | conv: ${conversationId}`);

    // ── Session ──────────────────────────────────────────────────────────────
    let session = sessions.get(conversationId) || {
      flightNumber: null, status: null, origin: null,
      destination: null, delayMinutes: null, airline: null,
      selectedAirport: null, route_type: null,
    };
    let conversationHistory = sessions.get(conversationId + '_history') || [];

    // Priority 0: frontend-provided airport
    if (selectedAirport) session.selectedAirport = selectedAirport;

    // Priority 1: airport mentioned in message text
    const mentionedAirport = extractAirportFromMessage(message);
    if (mentionedAirport) session.selectedAirport = mentionedAirport;

    // Priority 2: delay in hours from message
    const delayMatch = message.match(/(\d+)\s*h(?:eure|ours?)?/i);
    if (delayMatch) session.delayMinutes = parseInt(delayMatch[1]) * 60;

    // Priority 3: flight number from message
    const flightMatch = message.match(/([A-Z]{2,3})\s?(\d{1,4})/i);
    if (flightMatch) session.flightNumber = (flightMatch[1] + flightMatch[2]).toUpperCase();

    sessions.set(conversationId, session);

    // Reset inactivity timer
    clearTimeout(sessions.get(conversationId + '_timer'));
    sessions.set(conversationId + '_timer', setTimeout(() => {
      sessions.delete(conversationId);
      sessions.delete(conversationId + '_history');
      sessions.delete(conversationId + '_timer');
      console.log(`🧹 [Session] Cleared ${conversationId}`);
    }, 30 * 60 * 1000));

    // ── Intent ────────────────────────────────────────────────────────────────
    let intent = detectIntent(message);

    if (session.pendingIntent && mentionedAirport) {
      intent = session.pendingIntent;
      session.pendingIntent = null;
      sessions.set(conversationId, session);
    }

    console.log(`🎯 [Intent] ${intent}`);

    const noFlightNeeded = ['hotels', 'airport_services', 'passenger_rights', 'general'];

    if (!flightMatch && !session.flightNumber && !noFlightNeeded.includes(intent)) {
      const ask = {
        type: 'general',
        message: 'Please provide your flight number (e.g. TU741, AF1083) so I can look it up.',
        actions: ['Airport Services', 'Passenger Rights'],
      };
      conversationHistory.push({ role: 'user', content: message });
      conversationHistory.push({ role: 'assistant', content: JSON.stringify(ask) });
      sessions.set(conversationId + '_history', conversationHistory);
      return {
        reply: JSON.stringify(ask),
        updatedHistory: [...history,
        { role: 'user', content: message },
        { role: 'assistant', content: JSON.stringify(ask) }],
      };
    }

    conversationHistory = [...conversationHistory.slice(-9), { role: 'user', content: message }];

    // ── Tool execution → directReply (skips LLM) ─────────────────────────────
    let toolData = null;
    let directReply = null;

    if (intent === 'flight_status') {
      const newFn = extractFlightNumber(message);
      if (newFn && newFn !== session.flightNumber) {
        console.log(`🆕 [Session] New flight: ${newFn} (was: ${session.flightNumber || 'none'})`);
        session.flightNumber = newFn;
        session.status = null;
        session.delayMinutes = 0;
        session.airline = null;
        session.origin = null;
        session.destination = null;
        sessions.set(conversationId, session);
      }
      const fn = session.flightNumber;
      if (fn) {
        toolData = await tools.getFlightStatus(fn, session);
        sessions.set(conversationId, session);
        if (toolData?.type === 'general') directReply = toolData;
      }

    } else if (intent === 'passenger_rights') {
      const { getRouteType } = require('./airports');
      const dep = session.origin || session.selectedAirport || 'TUN';
      const arr = session.destination || 'CDG';
      const airCode = session.airline ? session.airline.substring(0, 2) : 'TU';
      const routeType = session.route_type || getRouteType(dep, arr, airCode);
      const mins = session.delayMinutes || 180;

      const rd = await tools.getPassengerRights(mins, routeType);
      if (rd?.rights) {
        directReply = {
          type: 'rights',
          message: 'Your rights for this delay:',
          rights: rd.rights,
          suggestion: rd.lawNote || 'Contact your airline desk for assistance.',
          actions: ['Alternative Flights', 'Airport Services', 'Flight Status'],
          isFollowUp: history.length > 2,
        };
      }

    } else if (intent === 'airport_services') {
      const code = session.selectedAirport || session.origin;
      if (!code) {
        session.pendingIntent = 'airport_services';
        sessions.set(conversationId, session);
        directReply = {
          type: "general",
          message: "Which airport are you inquiring about?",
          actions: ["Tunis-Carthage", "Djerba", "Monastir", "Enfidha"],
          isFollowUp: history.length > 2
        };
      } else {
        session.pendingIntent = null;
        sessions.set(conversationId, session);
        const sd = await tools.getAirportServices(code);
        if (sd?.services) {
        const { AIRPORTS } = require('./airports');
        directReply = {
          type: 'services',
          message: `Available at ${AIRPORTS[code]?.name || code}:`,
          services: sd.services,
          suggestion: 'Visit the information desk for live updates.',
          actions: ['Alternative Flights', 'Passenger Rights', 'Flight Status'],
          isFollowUp: history.length > 2,
        }
      }
    }

    } else if (intent === 'hotels') {

      const code = session.selectedAirport || session.origin;

      if (!code) {
        session.pendingIntent = 'hotels';
        sessions.set(conversationId, session);
        directReply = {
          type: "general",
          message: "Which airport do you need a hotel near?",
          actions: ["Tunis-Carthage", "Djerba", "Monastir", "Enfidha"],
          isFollowUp: history.length > 2
        };
      } else {
        session.pendingIntent = null;
        sessions.set(conversationId, session);
        const { AIRPORTS } = require('./airports');
        const airport = AIRPORTS[code];

        if (!airport) {
          directReply = {
            type: "general",
            message: "Airport not found.",
            actions: ["Airport Services"]
          };
        } else {

        // Call hotels service (Google Places with static fallback)
        const hotels = await searchHotelsNearAirport(code);

        if (hotels && hotels.length > 0) {
          directReply = {
            type: "hotels",
            message: `Hotels near ${airport.name}:`,
            hotels: hotels.map(hotel => ({
              name: hotel.name,
              stars: Math.round(hotel.rating || 3),
              pricePerNight: hotel.pricePerNight || 150
            })),
            suggestion: hotels[0]?.source === 'google_places'
              ? 'Book directly via the hotel website or Google Maps.'
              : 'Live hotel data unavailable. Showing saved airport hotel list.',
            actions: ["Passenger Rights", "Alternative Flights", "Airport Services"],
            isFollowUp: history.length > 2
          };

        } else {

          // Final fallback: static airport hotels
          directReply = {
            type: "hotels",
            message: `Hotels near ${airport.name}:`,
            hotels: (airport.hotels_nearby || []).map(h => ({
              name: h.name,
              stars: h.stars || 3,
              pricePerNight: parseInt(h.approx_price) || 120
            })),
            suggestion: "Live hotel data unavailable. Showing saved airport hotel list.",
            actions: ["Passenger Rights", "Alternative Flights", "Airport Services"],
            isFollowUp: history.length > 2
          };
        }
      }
    }
    } else if (intent === 'alternative_flights') {
      if (session.origin && session.destination) {
        toolData = await tools.getAlternativeFlights(session.origin, session.destination);
        // toolData.type === 'general' means no alternatives found
        if (toolData?.type === 'general') directReply = toolData;
      } else {
        directReply = {
          type: 'general',
          message: 'Please share your flight number so I can find alternatives on your route.',
          actions: ['Flight Status'],
        };
      }
    }

    // ── Return direct reply ───────────────────────────────────────────────────
    if (directReply) {
      conversationHistory.push({ role: 'assistant', content: JSON.stringify(directReply) });
      sessions.set(conversationId + '_history', conversationHistory);
      return {
        reply: JSON.stringify(directReply),
        updatedHistory: [...history,
        { role: 'user', content: message },
        { role: 'assistant', content: JSON.stringify(directReply) }],
      };
    }

    // ── LLM call (general intent or flight_status/alternatives with data) ─────
    const SHAPES = {
      flight_status:
        `{"type":"flight","flight":{"number":"TU741","airline":"Tunisair","route":{"from":"Tunis (TUN)","to":"Paris (CDG)"},"status":"delayed","delay":"3h 0min","scheduledDeparture":"14:30","scheduledArrival":"17:10"},"message":null,"suggestion":"Go to the Tunisair desk.","actions":["Passenger Rights","Alternative Flights","Airport Services"],"isFollowUp":false}`,
      alternative_flights:
        `{"type":"flights","message":"Available flights on this route:","flights":[{"flightNumber":"TU743","departure":"18:30","arrival":"21:10","airline":"Tunisair","status":"On time"}],"suggestion":"Book at the airline desk.","actions":["Passenger Rights","Airport Services","Flight Status"],"isFollowUp":false}`,
    };

    const systemMessage = toolData
      ? `${SYSTEM_PROMPT}\n\n═══════════════════════════════════════\nCURRENT REQUEST CONTEXT\n═══════════════════════════════════════\nRespond ONLY with a valid JSON object matching the shape for intent "${intent}".\nREAL DATA TO USE (Do not invent anything else): ${JSON.stringify(toolData)}\nRequired shape: ${SHAPES[intent] || ''}`
      : SYSTEM_PROMPT;

    const llmMessages = [{ role: 'system', content: systemMessage }, ...conversationHistory];
    const llmResponse = await chat(llmMessages, []);

    // ── Parse LLM output ─────────────────────────────────────────────────────
    let parsed;
    try {
      const jsonMatch = llmResponse.reply.match(/\{[\s\S]*\}/);
      const cleaned = jsonMatch ? jsonMatch[0] : llmResponse.reply.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
      parsed.isFollowUp = history.length > 2;

      if (['delayed', 'cancelled'].includes(session.status) &&
        (!parsed.actions || parsed.actions.length === 0))
        parsed.actions = ['Passenger Rights', 'Alternative Flights', 'Airport Services'];

    } catch (_) {
      console.log(`❌ [LLM] JSON parse failed — building fallback`);

      if (toolData && intent === 'flight_status') {
        parsed = {
          type: 'flight',
          flight: {
            number: toolData.flightNumber,
            airline: toolData.airline,
            route: {
              from: toolData.route.split(' → ')[0],
              to: toolData.route.split(' → ')[1],
            },
            status: toolData.status,
            delay: toolData.delay > 0
              ? `${Math.floor(toolData.delay / 60)}h ${String(toolData.delay % 60).padStart(2, '0')}min`
              : null,
            scheduledDeparture: toolData.scheduledDeparture,
            scheduledArrival: toolData.scheduledArrival,
          },
          message: null,
          suggestion: null,
          actions: ['Passenger Rights', 'Alternative Flights', 'Airport Services'],
          isFollowUp: history.length > 2,
        };
      } else if (toolData && intent === 'alternative_flights' && toolData.flights) {
        parsed = {
          type: 'flights',
          message: 'Available flights on this route:',
          flights: toolData.flights,
          suggestion: 'Book at the airline desk.',
          actions: ['Passenger Rights', 'Airport Services', 'Flight Status'],
          isFollowUp: history.length > 2,
        };
      } else {
        parsed = {
          type: 'general',
          message: llmResponse.reply,
          actions: [],
          isFollowUp: history.length > 2,
        };
      }
    }

    conversationHistory.push({ role: 'assistant', content: JSON.stringify(parsed) });
    sessions.set(conversationId + '_history', conversationHistory);

    return {
      reply: JSON.stringify(parsed),
      updatedHistory: [...history,
      { role: 'user', content: message },
      { role: 'assistant', content: JSON.stringify(parsed) }],
    };

  } catch (error) {
    console.error('[Agent] Unhandled error:', error);
    const fallback = {
      type: 'general',
      message: 'A technical issue occurred. Please try again or visit the airline service desk.',
      actions: [],
    };

    const safeHistory = sessions.get(conversationId + '_history') || [];
    safeHistory.push({ role: 'assistant', content: JSON.stringify(fallback) });
    sessions.set(conversationId + '_history', safeHistory);

    return {
      reply: JSON.stringify(fallback),
      updatedHistory: [...history,
      { role: 'user', content: message },
      { role: 'assistant', content: JSON.stringify(fallback) }],
    };
  }
}

function getConversationHistory(conversationId = 'default') {
  return sessions.get(conversationId + '_history') || [];
}

function clearConversationHistory() {
  sessions.clear();
}

module.exports = { runAgent, getConversationHistory, clearConversationHistory };
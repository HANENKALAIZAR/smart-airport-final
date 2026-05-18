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
const { chat, getProvider } = require('./llm');

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
- If 'Rebooking' is listed in the rights data, explicitly mention: "Based on this delay/cancellation, you may be eligible for rerouting or an alternative flight at no extra cost."
- NEVER claim they have free rerouting or compensation unless the rights data explicitly includes it.
- If data is unavailable, say so honestly and tell the passenger where to verify
- If hotel data_source is 'static_offline_fallback', explicitly state that live data is unavailable and you are showing saved/offline recommendations.
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
// MULTI-INTENT DETECTION  (EN / FR / AR keywords)
// ─────────────────────────────────────────────────────────────────────────────
function detectIntents(message) {
  const padMsg = ` ${message.toLowerCase().replace(/[.,!?:'"()\[\]{}]/g, ' ')} `;
  const intents = new Set();

  if (padMsg.match(/ (alternative|other flight|another flight|rebook|autre vol|vol alternatif|rebooker|طيران بديل|رحلة أخرى|vol de remplacement) /))
    intents.add('alternative_flights');

  if (padMsg.match(/ (right|rights|compensation|refund|indemnisation|remboursement|droit|droits|حق|حقوق|تعويض|استرداد) /))
    intents.add('passenger_rights');

  if (padMsg.match(/ (hotel|hotels|hôtel|hôtels|accommodation|hébergement|sleep|dormir|room|rooms|chambre|chambres|motel|hostel|stay|فندق|إقامة|نام|غرفة|نزل) /))
    intents.add('hotels');

  if (padMsg.match(/ (service|services|lounge|food|restaurant|wifi|shop|boutique|nourriture|salon|مطعم|خدمة|صالة|eat|manger) /))
    intents.add('airport_services');

  if (padMsg.match(/[a-z]{2,3}\s?\d{1,4}/i) ||
    padMsg.match(/ (flight|flights|vol|vols|delay|retard|status|statut|track|تأخير|وضع|delayed|cancelled|annulé|رحلة|رحلات) /))
    intents.add('flight_status');

  if (intents.size === 0) intents.add('general');
  return Array.from(intents);
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

  async getPassengerRights(delayMinutes, routeType = 'tunisia_to_eu', status = 'delayed') {
    console.log(`🔧 [TOOL] getPassengerRights: ${delayMinutes}min, ${routeType}, ${status}`);
    const { getPassengerRights: getRights } = require('./rights');
    const data = getRights(routeType, delayMinutes, status);
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
      pendingIntents: null,
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
    if (flightMatch) {
        const newFn = (flightMatch[1] + flightMatch[2]).toUpperCase();
        if (newFn !== session.flightNumber) {
            console.log(`🆕 [Session] New flight: ${newFn} (was: ${session.flightNumber || 'none'})`);
            session.flightNumber = newFn;
            session.status = null;
            session.delayMinutes = 0;
            session.airline = null;
            session.origin = null;
            session.destination = null;
        }
    }

    sessions.set(conversationId, session);

    // Reset inactivity timer
    clearTimeout(sessions.get(conversationId + '_timer'));
    sessions.set(conversationId + '_timer', setTimeout(() => {
      sessions.delete(conversationId);
      sessions.delete(conversationId + '_history');
      sessions.delete(conversationId + '_timer');
      console.log(`🧹 [Session] Cleared ${conversationId}`);
    }, 30 * 60 * 1000));

    // ── Intents ────────────────────────────────────────────────────────────────
    let intents = detectIntents(message);

    if (intents.includes('alternative_flights') && !intents.includes('passenger_rights')) {
      intents.push('passenger_rights');
    }

    if (session.pendingIntents && mentionedAirport) {
      intents = [...new Set([...intents, ...session.pendingIntents])];
      session.pendingIntents = null;
      sessions.set(conversationId, session);
    }

    console.log(`🎯 [Intents] ${intents.join(', ')}`);

    // ── Missing Context Checks ─────────────────────────────────────────────────
    const needsFlight = intents.includes('alternative_flights') || 
                        (intents.includes('flight_status') && intents.length === 1);
    const needsAirportOnly = intents.some(i => ['hotels', 'airport_services'].includes(i)) && !needsFlight;

    if (needsFlight && !session.flightNumber) {
      let askMsg = 'Please provide your flight number (e.g. TU741, AF1083) so I can assist you with your flight details.';
      if (intents.includes('alternative_flights')) {
        askMsg = 'To find relevant alternative flights and check your rights, please provide your current or original flight number (e.g. TU741, AF1083).';
      }
      
      const ask = {
        type: 'general',
        message: askMsg,
        actions: ['Airport Services', 'Passenger Rights'],
      };
      conversationHistory.push({ role: 'user', content: message });
      conversationHistory.push({ role: 'assistant', content: JSON.stringify(ask) });
      sessions.set(conversationId + '_history', conversationHistory);
      return {
        reply: JSON.stringify(ask),
        updatedHistory: [...history, { role: 'user', content: message }, { role: 'assistant', content: JSON.stringify(ask) }],
      };
    }

    if (needsAirportOnly && !session.selectedAirport && !session.origin) {
      const ask = {
        type: "general",
        message: "Which airport are you inquiring about?",
        actions: ["Tunis-Carthage", "Djerba", "Monastir", "Enfidha"],
      };
      session.pendingIntents = intents;
      sessions.set(conversationId, session);
      conversationHistory.push({ role: 'user', content: message });
      conversationHistory.push({ role: 'assistant', content: JSON.stringify(ask) });
      sessions.set(conversationId + '_history', conversationHistory);
      return {
        reply: JSON.stringify(ask),
        updatedHistory: [...history, { role: 'user', content: message }, { role: 'assistant', content: JSON.stringify(ask) }],
      };
    }

    conversationHistory = [...conversationHistory.slice(-9), { role: 'user', content: message }];

    // ── Tool execution ─────────────────────────────────────────────────────────
    let toolData = {};
    let hasToolData = false;

    // Flight Status
    if (intents.includes('flight_status') && session.flightNumber) {
      const res = await tools.getFlightStatus(session.flightNumber, session);
      if (res.type === 'general') {
        toolData.flight_error = res.message;
      } else {
        toolData.flight = res;
      }
      hasToolData = true;
      sessions.set(conversationId, session);
    }

    // Alternative flights
    if (intents.includes('alternative_flights') && session.origin && session.destination) {
      const res = await tools.getAlternativeFlights(session.origin, session.destination);
      if (res.type === 'general') {
        toolData.flights_error = res.message;
      } else {
        toolData.flights = res.flights;
      }
      hasToolData = true;
    }

    // Hotels
    if (intents.includes('hotels')) {
      const code = session.selectedAirport || session.origin;
      if (code) {
        const { AIRPORTS } = require('./airports');
        const airport = AIRPORTS[code];
        if (airport) {
          const hotels = await searchHotelsNearAirport(code);
          if (hotels && hotels.length > 0) {
            toolData.hotels = hotels.map(h => ({ 
              name: h.name, 
              stars: Math.round(h.rating || 3), 
              pricePerNight: h.pricePerNight || 150,
              data_source: h.source === 'google_places' ? 'live_google_places' : 'static_offline_fallback'
            }));
          } else {
            toolData.hotels = (airport.hotels_nearby || []).map(h => ({ name: h.name, stars: h.stars || 3, pricePerNight: parseInt(h.approx_price) || 120 }));
          }
          hasToolData = true;
        }
      }
    }

    // Services
    if (intents.includes('airport_services')) {
      const code = session.selectedAirport || session.origin;
      if (code) {
        const sd = await tools.getAirportServices(code);
        if (sd?.services) toolData.services = sd.services;
        hasToolData = true;
      }
    }

    // Rights
    if (intents.includes('passenger_rights')) {
      const { getRouteType } = require('./airports');
      const dep = session.origin || session.selectedAirport || 'TUN';
      const arr = session.destination || 'CDG';
      const airCode = session.airline ? session.airline.substring(0, 2) : 'TU';
      const routeType = session.route_type || getRouteType(dep, arr, airCode);
      const mins = session.delayMinutes || 180;
      const status = session.status || 'delayed';
      const rd = await tools.getPassengerRights(mins, routeType, status);
      if (rd?.rights) toolData.rights = rd.rights;
      hasToolData = true;
    }

    // ── LLM call ─────────────────────────────────────────────────────────────
    const hasRebooking = toolData.rights && toolData.rights.some(r => r.title === 'Rebooking');
    const reroutingPrompt = hasRebooking 
      ? 'CRITICAL INSTRUCTION: You MUST explicitly mention: "Based on this delay/cancellation, you may be eligible for rerouting or an alternative flight at no extra cost."'
      : 'CRITICAL INSTRUCTION: Do NOT mention free rerouting, free alternative flights, or compensation, as the current flight status does not guarantee it.';

    const systemMessage = hasToolData
      ? `${SYSTEM_PROMPT}\n\n═══════════════════════════════════════\nCURRENT REQUEST CONTEXT\n═══════════════════════════════════════\n${reroutingPrompt}\n\nRespond ONLY with a valid JSON object. Combine the following data into your JSON response using the SAME top-level keys. Write a conversational response addressing all queries in the 'message' field.\nREAL DATA TO USE (Do not invent anything else):\n${JSON.stringify(toolData)}\n\nYour response format must EXACTLY match this shape (exclude blocks if you have no data for them):\n{\n  "type": "multi",\n  "message": "Conversational reply covering all intents",\n  "flight": {...},\n  "rights": [...],\n  "flights": [...],\n  "hotels": [...],\n  "services": [...],\n  "suggestion": "Helpful next step.",\n  "actions": ["Action 1", "Action 2"],\n  "isFollowUp": false\n}`
      : `${SYSTEM_PROMPT}\n\nYour response format must EXACTLY match this shape:\n{\n  "type": "general",\n  "message": "Conversational reply",\n  "actions": ["Flight Status", "Passenger Rights", "Airport Services"],\n  "isFollowUp": false\n}`;

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
      parsed = {
          type: 'multi',
          message: toolData.flight_error || toolData.flights_error || 'Here is the information I found:',
          flight: toolData.flight,
          rights: toolData.rights,
          flights: toolData.flights,
          hotels: toolData.hotels,
          services: toolData.services,
          suggestion: 'Check with the airline desk for more details.',
          actions: ['Passenger Rights', 'Alternative Flights', 'Airport Services'],
          isFollowUp: history.length > 2,
      };
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
const { getFlightData, getAlternativeFlights } = require('./flightService');
const { getPassengerRights } = require('./data/rights');
const { AIRPORTS } = require('./data/airports');
const { searchHotelsNearAirport } = require('./hotelsService');
const { searchPOIsNearAirport } = require('./poiService');
const { chat } = require('./llm');

// System prompt for the AI assistant
const SYSTEM_PROMPT = `You are a professional airport assistant AI. Be brief, clear, and direct.

RULES:
- NEVER introduce yourself or say your name
- NEVER say "I'm happy to help" or similar filler phrases
- Keep messages SHORT — max 2 sentences for general replies
- Passengers are stressed — get straight to the point
- Reply in the SAME language the passenger used
- Off-topic questions (recipes, personal questions, etc.): one sentence redirect only
- Always return valid JSON only. No markdown, no plain text.

For general questions:
{
  "message": "Short, direct answer. Max 2 sentences.",
  "type": "general",
  "actions": ["Flight Status", "Passenger Rights", "Airport Services"]
}

For passenger rights:
{
  "message": "Your rights for this delay:",
  "type": "rights",
  "rights": [
    { "title": "Meal voucher", "detail": "Free meal after 2h delay — request at airline desk" },
    { "title": "Hotel", "detail": "Free hotel if overnight stay required" },
    { "title": "Refund", "detail": "Full refund if delay exceeds 5 hours" },
    { "title": "Compensation", "detail": "€250–€600 if departing from EU airport" }
  ],
  "suggestion": "Go to the airline desk now. Keep all receipts.",
  "actions": ["Alternative Flights", "Airport Services", "Flight Status"]
}

For alternative flights:
{
  "message": "Available flights on this route:",
  "type": "flights",
  "flights": [
    { "flightNumber": "TU742", "departure": "23:00", "arrival": "02:00+1", "airline": "Tunisair", "status": "On time" }
  ],
  "suggestion": "Book at the airline desk or tunisair.com",
  "actions": ["Passenger Rights", "Airport Services", "Flight Status"]
}

For airport services:
{
  "message": "Available at your airport:",
  "type": "services",
  "services": [
    { "name": "Cafe Tunis", "location": "Gate 12", "detail": "Open until 02:00" }
  ],
  "suggestion": "Visit the information desk for live updates.",
  "actions": ["Alternative Flights", "Passenger Rights", "Flight Status"]
}

For flight status:
{
  "flight": { "name": "TU741", "airline": "Tunisair", "route": { "from": "Tunis", "to": "Paris" }, "status": "delayed" },
  "information": { "delay": 180, "reason": "unknown" },
  "isFollowUp": false
}

CRITICAL: JSON only. Double quotes. Actions never empty for delayed/cancelled flights. Never invent data.`;
// Tool definitions for the LLM
const TOOLS = [
  {
    name: 'getFlightStatus',
    description: 'Get real-time flight status information',
    parameters: {
      flightNumber: {
        type: 'string',
        description: 'Flight number (e.g., TU741, AF1083)'
      }
    },
    required: ['flightNumber']
  },
  {
    name: 'getAlternativeFlights',
    description: 'Find alternative flights for a route',
    parameters: {
      origin: {
        type: 'string',
        description: 'Origin airport code'
      },
      destination: {
        type: 'string',
        description: 'Destination airport code'
      }
    },
    required: ['origin', 'destination']
  },
  {
    name: 'getAirportServices',
    description: 'Get airport services and amenities',
    parameters: {
      airport: {
        type: 'string',
        description: 'Airport code'
      }
    },
    required: ['airport']
  },
  {
    name: 'getPassengerRights',
    description: 'Get passenger rights information',
    parameters: {
      delayTime: {
        type: 'number',
        description: 'Delay time in minutes'
      }
    },
    required: ['delayTime']
  }
];

// Conversation memory (store last 10 messages) - now per conversation

// Session state for context awareness - now per conversation
const sessions = new Map(); // Map<conversationId, sessionState>

// Intent detection function
function detectIntent(message) {
  const msg = message.toLowerCase();
  if (msg.includes('alternative') || msg.includes('other flight')
    || msg.includes('rebook')) return 'alternative_flights';
  if (msg.includes('right') || msg.includes('compensation')
    || msg.includes('refund')) return 'passenger_rights';
  if (msg.includes('hotel') || msg.includes('accommodation')
    || msg.includes('sleep')) return 'hotels';
  if (msg.includes('service') || msg.includes('lounge')
    || msg.includes('food')) return 'airport_services';
  if (msg.match(/[A-Z]{2}\d{3,4}/i) || msg.includes('flight')
    || msg.includes('delay') || msg.includes('status')) return 'flight_status';
  return 'general';
}

// Extract flight number from message
function extractFlightNumber(message) {
  const match = message.match(/([A-Z]{2}\d{3,4})/i);
  return match ? match[1].toUpperCase() : null;
}

// Tool execution functions
const tools = {
  async getFlightStatus(flightNumber, session) {
    console.log("TOOL CALLED: getFlightStatus");
    console.log(`🔧 [TOOL] getFlightStatus called with:`, flightNumber);

    const flightData = await getFlightData(flightNumber);
    if (flightData.found) {
      console.log(`✅ [TOOL] getFlightStatus success:`, flightData.flight_number);

      // Use mock data normally (demo mode)
      if (flightData.source === "mock") {
        console.log(`📦 [TOOL] Using mock data for ${flightData.flight_number}`);
      }

      // Update session state with route info and airline
      if (session) {
        session.flightNumber = flightData.flight_number;
        session.airline = flightData.airline.name;
        session.origin = flightData.departure.iata;
        session.destination = flightData.arrival.iata;
        session.delayMinutes = flightData.departure.delay || 0;
        session.status = flightData.status;
      }

      return {
        flightNumber: flightData.flight_number,
        airline: flightData.airline.name,
        route: `${flightData.departure.iata} → ${flightData.arrival.iata}`,
        status: flightData.status,
        delay: flightData.departure.delay || 0,
        scheduledDeparture: flightData.departure.scheduled,
        scheduledArrival: flightData.arrival.scheduled
      };
    }

    // If AviationStack returns empty data, return honest message immediately
    console.log(`❌ [TOOL] AviationStack returned empty for ${flightNumber}`);
    return {
      type: "general",
      message: "I couldn't find live data for this flight. Please check the flight number and try again, or verify at tunisair.com",
      suggestion: "Check live status at tunisair.com/en/vols-en-cours",
      actions: ["Alternative Flights", "Airport Services", "Passenger Rights"]
    };
  },

  async getPassengerRights(delayMinutes, routeType = 'tunisia_to_eu') {
    console.log("TOOL CALLED: getPassengerRights");
    console.log(`🔧 [TOOL] getPassengerRights called with delay: ${delayMinutes}min, route: ${routeType}`);

    const { getPassengerRights: getRights } = require('./data/rights');
    const rightsData = getRights(routeType, delayMinutes, 'delayed');

    // Convert to UI-friendly format
    const rights = [];

    if (rightsData.compensation && rightsData.compensation.length > 0) {
      const comp = rightsData.compensation[0];
      if (comp.amount) {
        rights.push({ title: 'Compensation', detail: `${comp.amount} — ${comp.example || comp.distance}` });
      }
    }

    rightsData.care.forEach(item => {
      if (item.toLowerCase().includes('meal') || item.toLowerCase().includes('voucher')) {
        rights.push({ title: 'Meal voucher', detail: item });
      } else if (item.toLowerCase().includes('hotel') || item.toLowerCase().includes('accommodation')) {
        rights.push({ title: 'Hotel', detail: item });
      } else if (item.toLowerCase().includes('phone') || item.toLowerCase().includes('call')) {
        rights.push({ title: 'Communication', detail: item });
      } else {
        rights.push({ title: 'Care', detail: item });
      }
    });

    rightsData.options.forEach(item => {
      if (item.toLowerCase().includes('refund')) {
        rights.push({ title: 'Full refund', detail: item });
      } else if (item.toLowerCase().includes('rebook')) {
        rights.push({ title: 'Rebooking', detail: item });
      }
    });

    const lawNote = routeType === 'eu_to_tunisia'
      ? 'EU Regulation 261/2004 applies — file at ec.europa.eu/transport'
      : routeType === 'domestic'
        ? 'OACA rules apply — contact airline desk'
        : 'Montreal Convention applies — ask airline for voluntary compensation';

    console.log(`✅ [TOOL] getPassengerRights: ${rights.length} rights for ${routeType}`);

    return { delayMinutes, rights, lawNote };
  },

  async getAirportServices(airportCode) {
    console.log("TOOL CALLED: getAirportServices");
    console.log(`🔧 [TOOL] getAirportServices called with airport:`, airportCode);

    const { AIRPORTS } = require('./data/airports');
    const airport = AIRPORTS[airportCode];

    if (!airport) {
      console.log(`❌ [TOOL] getAirportServices: Airport ${airportCode} not found`);
      return null;
    }

    const services = [];

    // WiFi
    if (airport.wifi) {
      services.push({ name: 'Free WiFi', location: 'All terminals', detail: airport.wifi });
    }

    // Restaurants
    if (airport.restaurants) {
      airport.restaurants.forEach(r => {
        services.push({ name: r.name, location: r.terminal, detail: `${r.type} — Open ${r.open}` });
      });
    }

    // Lounges
    if (airport.lounges) {
      airport.lounges.forEach(l => {
        services.push({ name: l.name, location: l.terminal, detail: `Access: ${l.access}` });
      });
    }

    console.log(`✅ [TOOL] getAirportServices success: ${airportCode} — ${services.length} services`);
    return { airport: airportCode, services };
  },

  async getAlternativeFlights(origin, destination) {
    console.log("TOOL CALLED: getAlternativeFlights");
    console.log(`🔧 [TOOL] getAlternativeFlights called with:`, origin, '→', destination);

    try {
      // Try AviationStack API first
      const liveAlternatives = await getAlternativeFlights(origin, destination);

      if (liveAlternatives && liveAlternatives.length > 0) {
        console.log(`✅ [TOOL] getAlternativeFlights live:`, liveAlternatives.length, 'flights');
        const formattedFlights = liveAlternatives.slice(0, 3).map(alt => ({
          flightNumber: alt.flight_number,
          departure: alt.departure.scheduled,
          arrival: alt.arrival.scheduled,
          airline: alt.airline.name,
          status: alt.status || 'On time'
        }));
        return { flights: formattedFlights, origin, destination };
      }
    } catch (error) {
      console.log(`⚠️ [TOOL] AviationStack failed:`, error.message);
    }

    // Fallback: use mock alternative flights service
    console.log(`📦 [TOOL] Using mock alternative flights for ${origin} → ${destination}`);
    try {
      const { getAlternativeFlights: getMockAlts } = require('./alternativeFlightsService');
      const mockAltsFull = await getMockAlts(`${origin}${destination}`, {});

      if (mockAltsFull && mockAltsFull.length > 0) {
        const formattedFlights = mockAltsFull.slice(0, 3).map(alt => ({
          flightNumber: alt.flight_number,
          departure: alt.departure.scheduled,
          arrival: alt.arrival.scheduled,
          airline: alt.airline.name,
          status: alt.status || 'On time'
        }));
        console.log(`✅ [TOOL] Mock alternatives found:`, formattedFlights.length);
        return { flights: formattedFlights, origin, destination };
      }
    } catch (e) {
      console.log(`⚠️ [TOOL] Mock alternatives failed:`, e.message);
    }

    // Last resort: hardcoded alternatives based on route
    const routeAlternatives = {
      'TUNCDG': [
        { flightNumber: 'AF1083', departure: '16:00', arrival: '18:45', airline: 'Air France', status: 'On time' },
        { flightNumber: 'TU743', departure: '18:30', arrival: '21:10', airline: 'Tunisair', status: 'On time' },
      ],
      'TUNIST': [
        { flightNumber: 'TK743', departure: '14:00', arrival: '17:30', airline: 'Turkish Airlines', status: 'On time' },
      ],
      'TUNLYS': [
        { flightNumber: 'TU442', departure: '14:00', arrival: '16:30', airline: 'Tunisair', status: 'On time' },
      ],
      'TUNMRS': [
        { flightNumber: 'BJ522', departure: '15:00', arrival: '17:20', airline: 'Nouvelair', status: 'On time' },
      ],
    };

    const key = origin + destination;
    const fallbackFlights = routeAlternatives[key] || [];

    if (fallbackFlights.length > 0) {
      console.log(`✅ [TOOL] Hardcoded alternatives for ${key}`);
      return { flights: fallbackFlights, origin, destination };
    }

    console.log(`❌ [TOOL] No alternatives found for ${origin} → ${destination}`);
    return {
      message: `No alternative flights found for ${origin} → ${destination} right now.`,
      type: 'general',
      suggestion: 'Check directly at tunisair.com or contact airline desk',
      actions: ['Passenger Rights', 'Airport Services']
    };
  }
};

/**
 * Main AI agent function - now powered by real LLM
 */
async function runAgent(message, history = [], conversationId = 'default', selectedAirport = null) {
  try {
    console.log(`[AI Agent] Processing message: "${message}" for conversation: ${conversationId}`);

    // Per-conversation history
    let conversationHistory = sessions.get(conversationId + '_history') || [];

    // Get or create session for this conversation
    let session = sessions.get(conversationId) || {
      flightNumber: null,
      status: null,
      origin: null,
      destination: null,
      delayMinutes: null,
      airline: null
    };

    // PRIORITY 0: Use selected airport from frontend if provided
    if (selectedAirport) {
      session.selectedAirport = selectedAirport;
      console.log(`🏢 [AIRPORT] Selected airport: ${selectedAirport}`);
    }

    // PRIORITY 1: Extract delay from current message if mentioned by user
    const delayMatch = message.match(/(\d+)\s*h/i);
    if (delayMatch) {
      session.delayMinutes = parseInt(delayMatch[1]) * 60; // Convert hours to minutes
      console.log(`🎯 [PRIORITY] User specified delay: ${session.delayMinutes} minutes`);
    }

    // PRIORITY 2: Extract flight number from current message if present
    const flightMatch = message.match(/([A-Z]{2}\d{3,4})/i);
    if (flightMatch) {
      session.flightNumber = flightMatch[1].toUpperCase();
      console.log(`🎯 [PRIORITY] User specified flight: ${session.flightNumber}`);
    }

    // Store updated session back
    sessions.set(conversationId, session);

    // Set timeout to clear session after 30 minutes
    setTimeout(() => {
      sessions.delete(conversationId);
      console.log(`🧹 [SESSION] Cleared conversation ${conversationId} after 30 minutes`);
    }, 30 * 60 * 1000);

    // Intents that don't need a flight number
    const intentNeedsNoFlight = ['hotels', 'airport_services', 'passenger_rights', 'general'];
    const currentIntent = detectIntent(message);

    // If no flight number in message and no stored flight number, ask for it
    // BUT skip this check for hotel/services/rights queries
    if (!flightMatch && !session.flightNumber && !intentNeedsNoFlight.includes(currentIntent)) {
      console.log(`🚫 [AI] No flight number found, asking user`);
      const askFlightResponse = { "message": "Could you please provide your flight number?", "type": "general", "actions": [] };

      conversationHistory.push({ role: 'user', content: message });
      conversationHistory.push({ role: 'assistant', content: JSON.stringify(askFlightResponse) });
      sessions.set(conversationId + '_history', conversationHistory);

      const result = {
        reply: JSON.stringify(askFlightResponse),
        updatedHistory: [...history, { role: "user", content: message }, { role: "assistant", content: JSON.stringify(askFlightResponse) }]
      };

      console.log("AGENT RESPONSE:", JSON.stringify(result, null, 2));
      return result;
    }

    // Update conversation history
    conversationHistory = [
      ...conversationHistory.slice(-9), // Keep last 9 messages
      { role: 'user', content: message }
    ];

    // DETECT INTENT AND EXECUTE TOOLS BEFORE LLM
    const intent = detectIntent(message);
    console.log(`🎯 [INTENT] Detected:`, intent);

    let toolData = null;
    let toolUsed = false;

    // Execute tools based on intent
    if (intent === 'flight_status') {
      const flightNumber = extractFlightNumber(message) || session.flightNumber;
      if (flightNumber) {
        toolData = await tools.getFlightStatus(flightNumber, session);
        toolUsed = true;

        // If tool returned direct response (no AviationStack data), return immediately
        if (toolData && toolData.type === 'general') {
          console.log(`🚫 [AI] Returning direct response for empty AviationStack data`);
          const result = {
            reply: JSON.stringify(toolData),
            updatedHistory: [...history, { role: "user", content: message }, { role: "assistant", content: JSON.stringify(toolData) }]
          };

          console.log("AGENT RESPONSE:", JSON.stringify(result, null, 2));
          return result;
        }
      }
    } else if (intent === 'passenger_rights') {
      const delayMinutes = session.delayMinutes || 180;
      // Use route_type from session flight, or determine from selected airport
      const { getRouteType } = require('./data/airports');
      const depIata = session.origin || session.selectedAirport || 'TUN';
      const arrIata = session.destination || 'CDG';
      const airlineIata = session.airline ? session.airline.substring(0, 2) : 'TU';
      const routeType = session.route_type || getRouteType(depIata, arrIata, airlineIata);
      const rightsData = await tools.getPassengerRights(delayMinutes, routeType);
      if (rightsData && rightsData.rights) {
        const rightsResponse = {
          type: 'rights',
          message: 'Your rights for this delay:',
          rights: rightsData.rights,
          suggestion: rightsData.lawNote || 'Contact your airline desk for assistance',
          actions: ['Alternative Flights', 'Airport Services', 'Flight Status'],
          isFollowUp: history.length > 2
        };
        const rHistory = sessions.get(conversationId + '_history') || [];
        rHistory.push({ role: 'user', content: message });
        rHistory.push({ role: 'assistant', content: JSON.stringify(rightsResponse) });
        sessions.set(conversationId + '_history', rHistory);
        return {
          reply: JSON.stringify(rightsResponse),
          updatedHistory: [...history, { role: 'user', content: message }, { role: 'assistant', content: JSON.stringify(rightsResponse) }]
        };
      }
      toolData = rightsData;
      toolUsed = true;
    } else if (intent === 'airport_services') {
      const airportCode = session.selectedAirport || session.origin || 'TUN';
      const servicesData = await tools.getAirportServices(airportCode);
      if (servicesData && servicesData.services) {
        const servicesResponse = {
          type: 'services',
          message: `Available at your airport (${airportCode}):`,
          services: servicesData.services,
          suggestion: 'Visit information desk for current hours',
          actions: ['Alternative Flights', 'Passenger Rights', 'Flight Status'],
          isFollowUp: history.length > 2
        };
        const svcHistory = sessions.get(conversationId + '_history') || [];
        svcHistory.push({ role: 'user', content: message });
        svcHistory.push({ role: 'assistant', content: JSON.stringify(servicesResponse) });
        sessions.set(conversationId + '_history', svcHistory);
        return {
          reply: JSON.stringify(servicesResponse),
          updatedHistory: [...history, { role: 'user', content: message }, { role: 'assistant', content: JSON.stringify(servicesResponse) }]
        };
      }
      toolData = servicesData;
      toolUsed = true;
    } else if (intent === 'alternative_flights') {
      const origin = session.origin;
      const destination = session.destination;
      const airline = session.airline; // Store airline from flight status

      if (origin && destination) {
        toolData = await tools.getAlternativeFlights(origin, destination);
        toolUsed = true;

        // Filter alternatives to only show same airline if available, otherwise any airline
        if (toolData.flights && airline) {
          const sameAirlineFlights = toolData.flights.filter(flight =>
            flight.airline.toLowerCase() === airline.toLowerCase()
          );

          if (sameAirlineFlights.length > 0) {
            toolData.flights = sameAirlineFlights;
            console.log(`🎯 [AIRLINE] Filtered to ${airline} flights only`);
          } else {
            console.log(`🎯 [AIRLINE] No ${airline} alternatives, showing all airlines`);
          }
        }
      }
    } else if (intent === 'hotels') {
      const airportCode = session.selectedAirport || session.origin || 'TUN';
      const { AIRPORTS } = require('./data/airports');
      const airport = AIRPORTS[airportCode];
      if (airport && airport.hotels_nearby) {
        // Return directly without going through LLM to avoid JSON shape issues
        const hotelResponse = {
          type: 'services',
          message: `Hotels near ${airport.name}:`,
          services: airport.hotels_nearby.map(h => ({
            name: h.name,
            location: h.distance,
            detail: `${h.stars}⭐ — ${h.approx_price}`
          })),
          suggestion: 'Book at booking.com or contact hotel directly',
          actions: ['Passenger Rights', 'Alternative Flights', 'Airport Services'],
          isFollowUp: history.length > 2
        };
        console.log(`✅ [HOTELS] Returning direct response for ${airportCode}`);
        const hotelHistory = sessions.get(conversationId + '_history') || [];
        hotelHistory.push({ role: 'user', content: message });
        hotelHistory.push({ role: 'assistant', content: JSON.stringify(hotelResponse) });
        sessions.set(conversationId + '_history', hotelHistory);
        return {
          reply: JSON.stringify(hotelResponse),
          updatedHistory: [...history, { role: 'user', content: message }, { role: 'assistant', content: JSON.stringify(hotelResponse) }]
        };
      } else {
        toolData = await tools.getAirportServices(airportCode);
      }
      toolUsed = true;
    }

    // Prepare messages for LLM with tool data as context
    let systemMessage = SYSTEM_PROMPT;
    if (toolData) {
      const intentShapes = {
        flight_status: `{"flight":"TU741","airline":"Tunisair","route":{"from":"Tunis","to":"Paris"},"status":"delayed","delay":"3h 0min","message":null,"suggestion":null,"actions":["Passenger Rights","Alternative Flights","Airport Services"],"type":"flight","isFollowUp":false}`,
        passenger_rights: `{"message":"Your rights for this delay:","type":"rights","rights":[{"title":"Compensation","detail":"€400 for delays over 3h on routes 1500-3500km"}],"suggestion":"File claim at ec.europa.eu","actions":["Alternative Flights","Airport Services","Flight Status"]}`,
        airport_services: `{"message":"Available at your airport:","type":"services","services":[{"name":"Cafe Tunis","location":"Gate 12","detail":"Open until 02:00"}],"suggestion":null,"actions":["Alternative Flights","Passenger Rights","Flight Status"]}`,
        alternative_flights: `{"message":"Available flights on this route:","type":"flights","flights":[{"flightNumber":"TU743","departure":"18:30","arrival":"21:10","airline":"Tunisair","status":"On time"}],"suggestion":"Book at tunisair.com","actions":["Passenger Rights","Airport Services","Flight Status"]}`,
      };
      const shape = intentShapes[intent] || intentShapes.flight_status;
      systemMessage = `You are an airport assistant API. Respond ONLY with a valid JSON object — no text, no markdown.
REAL DATA TO USE: ${JSON.stringify(toolData)}
Use ONLY this data. NEVER invent flights, times, or prices.
Required JSON shape for intent "${intent}": ${shape}
Output ONLY the JSON object starting with {`;
    }

    const messages = [
      { role: 'system', content: systemMessage },
      ...conversationHistory
    ];

    // Call LLM (without tools since we already executed them)
    const llmResponse = await chat(messages, []); // Empty tools array

    // Parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(llmResponse.reply);
      console.log(`✅ [AI] JSON parsed successfully:`, parsedResponse);
      // Add isFollowUp flag to successful LLM responses
      parsedResponse.isFollowUp = history.length > 2;

      // Ensure actions array is never empty for delayed flights
      if (session.status === 'Delayed' && (!parsedResponse.actions || parsedResponse.actions.length === 0)) {
        parsedResponse.actions = ["Passenger Rights", "Alternative Flights", "Airport Services"];
        console.log(`🔧 [FIX] Added required actions for delayed flight`);
      }

    } catch (parseError) {
      console.log(`❌ [AI] JSON parse failed, using fallback format`);

      // Create fallback response based on tool data
      if (toolData && intent === 'flight_status') {
        parsedResponse = {
          message: null,
          type: 'flight',
          flight: toolData.flightNumber,
          airline: toolData.airline,
          route: {
            from: `${toolData.route.split(' → ')[0]} (${toolData.route.split(' → ')[0].match(/[A-Z]{3}/)})`,
            to: `${toolData.route.split(' → ')[1]} (${toolData.route.split(' → ')[1].match(/[A-Z]{3}/)})`
          },
          status: toolData.status,
          delay: toolData.delay > 0 ? `${Math.floor(toolData.delay / 60)}h ${toolData.delay % 60}min` : undefined,
          suggestion: null,
          actions: ["Passenger Rights", "Alternative Flights", "Airport Services"],
          isFollowUp: history.length > 2
        };
      } else if (toolData && intent === 'passenger_rights') {
        parsedResponse = {
          message: 'Your rights for this delay:',
          type: 'rights',
          rights: toolData.rights,
          suggestion: 'File your claim at ec.europa.eu/transport',
          actions: ["Alternative Flights", "Airport Services", "Flight Status"],
          isFollowUp: history.length > 2
        };
      } else if (toolData && intent === 'airport_services') {
        parsedResponse = {
          message: 'Available at your airport:',
          type: 'services',
          services: toolData.services,
          suggestion: null,
          actions: ["Alternative Flights", "Passenger Rights", "Flight Status"],
          isFollowUp: history.length > 2
        };
      } else if (toolData && intent === 'alternative_flights') {
        if (toolData.flights) {
          parsedResponse = {
            message: 'Here are available flights on this route:',
            type: 'flights',
            flights: toolData.flights,
            suggestion: 'Book directly at tunisair.com',
            actions: ["Passenger Rights", "Airport Services", "Flight Status"],
            isFollowUp: history.length > 2
          };
        } else {
          parsedResponse = toolData; // Return "no flights found" response
        }
      } else {
        parsedResponse = { message: llmResponse.reply, type: 'general', actions: [], isFollowUp: history.length > 2 };
      }
    }

    // Special handling for "Alternative Flights" with no flight number
    if (intent === 'alternative_flights' && !session.flightNumber && !session.origin && !session.destination) {
      parsedResponse = {
        message: "Could you please provide your flight number?",
        type: "general",
        actions: [],
        isFollowUp: history.length > 2
      };
      console.log(`🚫 [AI] No flight number for alternatives, asking user`);
    }

    // Update conversation history with assistant response
    conversationHistory.push({ role: 'assistant', content: JSON.stringify(parsedResponse) });
    sessions.set(conversationId + '_history', conversationHistory);

    const result = {
      reply: JSON.stringify(parsedResponse),
      updatedHistory: [...history, { role: "user", content: message }, { role: "assistant", content: JSON.stringify(parsedResponse) }]
    };

    console.log("AGENT RESPONSE:", JSON.stringify(result, null, 2));
    return result;

  } catch (error) {
    console.error('AI Agent error:', error);

    const fallbackResponse = {
      message: "I'm sorry, I'm having trouble processing your request right now. Please try again or visit the airline service desk.",
      type: "general",
      actions: []
    };

    const safeHistory = sessions.get(conversationId + '_history') || [];
    safeHistory.push({ role: 'assistant', content: JSON.stringify(fallbackResponse) });
    sessions.set(conversationId + '_history', safeHistory);

    return {
      reply: JSON.stringify(fallbackResponse),
      updatedHistory: [...history, { role: "user", content: message }, { role: "assistant", content: JSON.stringify(fallbackResponse) }]
    };
  }
}

/**
 * Get conversation history for a specific session
 */
function getConversationHistory(conversationId = 'default') {
  return sessions.get(conversationId + '_history') || [];
}

/**
 * Clear all conversation history and session state
 */
function clearConversationHistory() {
  sessions.clear();
}

module.exports = {
  runAgent,
  getConversationHistory,
  clearConversationHistory
};
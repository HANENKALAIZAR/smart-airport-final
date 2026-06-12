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
// LOCALIZATION, AIRLINES, AND ELIGIBILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const AIRLINE_MAP = {
  'TU': 'Tunisair',
  'BJ': 'Nouvelair',
  'RJ': 'Royal Jordanian',
  'AF': 'Air France',
  'MS': 'EgyptAir',
  'AZ': 'ITA Airways',
  'LH': 'Lufthansa',
  'EK': 'Emirates',
  'QR': 'Qatar Airways',
  'TK': 'Turkish Airlines'
};

function getAirlineName(flightNumber, existingName) {
  if (existingName && existingName !== 'Unknown Airline') return existingName;
  if (!flightNumber) return 'the airline';
  const prefix = flightNumber.substring(0, 2).toUpperCase();
  return AIRLINE_MAP[prefix] || 'the airline';
}

function detectLanguage(message, fallbackLang = 'fr') {
  const msg = (message || '').trim().toLowerCase();
  
  if (/[\u0600-\u06FF]/.test(msg)) {
    return 'ar';
  }
  
  const frMarkers = /\b(bonjour|salut|vol|vols|retard|retards|retardé|retardée|annulé|annulée|annulés|remboursement|rembourser|droits|droit|passager|passagers|compagnie|compagnies|agent|alternative|alternatifs|alternatives|gratuit|gratuits|gratuité|option|options|voir|contacter|demander|est|sont|avec|pour|votre|vos|notre|nos|mon|mes|je|tu|il|elle|nous|vous|ils|elles|mon_vol|retard_de|retardé_de|hôtel|hôtels|aéroport|aéroports|près|proche|proximité|donner|moi|parle|parler|français|anglais|pas|non|quel|quelle|où|montrer|liste)\b/i;
  const enMarkers = /\b(hello|hi|flight|flights|delay|delays|delayed|cancel|canceled|cancelled|refund|rights|right|passenger|passengers|airline|airlines|agent|alternative|alternatives|free|option|options|view|contact|ask|is|are|with|for|your|our|my|i|you|he|she|we|they|my_flight|delay_of|delayed_by|hotel|hotels|airport|airports|near|nearby|give|me|speak|english|french|dont|don't|not|no|which|where|what|how|show|list)\b/i;

  if (frMarkers.test(msg) && !enMarkers.test(msg)) {
    return 'fr';
  }
  if (enMarkers.test(msg) && !frMarkers.test(msg)) {
    return 'en';
  }

  const frCount = (msg.match(new RegExp(frMarkers, 'gi')) || []).length;
  const enCount = (msg.match(new RegExp(enMarkers, 'gi')) || []).length;

  if (frCount > enCount) return 'fr';
  if (enCount > frCount) return 'en';

  return fallbackLang;
}

function getAlternativeFlightsEligibility(status, delayMinutes, delayMinutesKnown) {
  if (status === 'cancelled') {
    return 'eligible';
  }
  if (delayMinutesKnown) {
    if (delayMinutes >= 180) {
      return 'eligible';
    } else {
      return 'not_eligible';
    }
  }
  return 'unknown';
}

function generateAlternativeFlightsResponse(flightNumber, airlineName, delayMinutes, delayMinutesKnown, status, lang) {
  const eligibility = getAlternativeFlightsEligibility(status, delayMinutes, delayMinutesKnown);
  let message = '';
  let actions = [];
  
  if (lang === 'fr') {
    actions = ["Voir les vols alternatifs", "Demander à un agent"];
    if (eligibility === 'not_eligible') {
      message = `Votre vol ${flightNumber} affiche actuellement un retard de ${delayMinutes} minutes. Avec ce retard, vous n’êtes pas éligible à un vol alternatif gratuit. Vous pouvez toutefois contacter ${airlineName} pour connaître les options disponibles.`;
    } else if (eligibility === 'unknown') {
      message = `Nous ne pouvons pas encore confirmer votre éligibilité à un vol alternatif gratuit car le retard ou le statut de votre vol n'est pas encore confirmé. Veuillez vérifier plus tard ou contacter votre compagnie aérienne.`;
    } else {
      message = `Votre vol ${flightNumber} est éligible pour un vol alternatif gratuit en raison de son statut (retard important ou annulation). Voici les options de vols alternatifs disponibles pour vous.`;
    }
  } else if (lang === 'ar') {
    actions = ["عرض الرحلات البديلة", "الاستفسار من وكيل"];
    if (eligibility === 'not_eligible') {
      message = `رحلتك ${flightNumber} متأخرة حالياً لمدة ${delayMinutes} دقيقة. مع هذا التأخير، أنت غير مؤهل للحصول على رحلة بديلة مجانية. ومع ذلك، يمكنك الاتصال بـ ${airlineName} لمعرفة الخيارات المتاحة.`;
    } else if (eligibility === 'unknown') {
      message = `لا يمكننا تأكيد أهليتك للحصول على رحلة بديلة مجانية بعد لأن تأخير رحلتك أو حالتها غير مؤكدة بعد. يرجى التحقق لاحقًا أو الاتصال بشركة الطيران الخاصة بك.`;
    } else {
      message = `رحلتك ${flightNumber} مؤهلة للحصول على رحلة بديلة مجانية بسبب حالتها (تأخير كبير أو إلغاء). إليك الرحلات البديلة المتاحة لك.`;
    }
  } else {
    actions = ["View alternative flights", "Ask an agent"];
    if (eligibility === 'not_eligible') {
      message = `Your flight ${flightNumber} currently shows a ${delayMinutes}-minute delay. With this delay, you are not eligible for a free alternative flight. You can still contact ${airlineName} to check the available options.`;
    } else if (eligibility === 'unknown') {
      message = `We cannot confirm your eligibility for a free alternative flight yet because your flight's delay or status is not confirmed. Please check again later or contact your airline.`;
    } else {
      message = `Your flight ${flightNumber} is eligible for a free alternative flight due to its status (significant delay or cancellation). Here are the available alternative flights for you.`;
    }
  }
  
  return { message, actions };
}

function localizeActions(actions, lang) {
  if (!actions || !Array.isArray(actions)) return [];
  
  const map = {
    fr: {
      'Airport Services': 'Services aéroportuaires',
      'Passenger Rights': 'Droits des passagers',
      'Alternative Flights': 'Vols alternatifs',
      'Vérifier les écrans d\'affichage': null,
      'Check display screens': null,
    },
    en: {
      'Airport Services': 'Airport Services',
      'Passenger Rights': 'Passenger Rights',
      'Alternative Flights': 'Alternative Flights',
      'Vérifier les écrans d\'affichage': null,
      'Check display screens': null,
    },
    ar: {
      'Airport Services': 'خدمات المطار',
      'Passenger Rights': 'حقوق المسافرين',
      'Alternative Flights': 'رحلات بديلة',
      'Vérifier les écrans d\'affichage': null,
      'Check display screens': null,
    }
  };
  
  const langMap = map[lang] || map['en'];
  
  return actions
    .map(act => {
      if (langMap[act] !== undefined) return langMap[act];
      if (/écran/i.test(act) || /affichage/i.test(act) || /screen/i.test(act) || /rebook/i.test(act)) return null;
      return act;
    })
    .filter(Boolean);
}

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

  if (padMsg.match(/ (alternative[s]?|other flight[s]?|another flight|rebook|autre[s]? vol[s]?|vol[s]? alternatif[s]?|rebooker|طيران بديل|رحلة أخرى|vol de remplacement) /))
    intents.add('alternative_flights');

  if (padMsg.match(/ (right|rights|compensation|refund|indemnisation|remboursement|droit|droits|حق|حقوق|تعويض|استرداد) /))
    intents.add('passenger_rights');

  if (padMsg.match(/ (hotel|hotels|hôtel|hôtels|accommodation|hébergement|sleep|dormir|room|rooms|chambre|chambres|motel|hostel|stay|فندق|إقامة|نام|غرفة|نزل) /))
    intents.add('hotels');

  if (padMsg.match(/ (service|services|lounge|food|restaurant|wifi|shop|boutique|nourriture|salon|مطعم|خدمة|صالة|eat|manger) /))
    intents.add('airport_services');

  if (padMsg.match(/ (subscribe|subscription|abonner|abonnement|alerte|alertes|alert|alerts|اشترك|تنبيهات|تنبيه) /))
    intents.add('flight_alerts_subscribe');

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

function extractEmailFromMessage(message) {
  const match = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  return match ? match[0].toLowerCase() : null;
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
      if (typeof data.departure.delay === 'number') {
        session.delayMinutes = data.departure.delay;
        session.delayMinutesKnown = true;
      } else if (data.status === 'scheduled') {
        session.delayMinutes = 0;
        session.delayMinutesKnown = true;
      } else {
        session.delayMinutes = null;
        session.delayMinutesKnown = false;
      }
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

  async getPassengerRights(delayMinutes, routeType = 'tunisia_to_eu', status = 'delayed', lang = 'en') {
    console.log(`🔧 [TOOL] getPassengerRights: ${delayMinutes}min, ${routeType}, ${status}, lang: ${lang}`);
    const { getPassengerRights: getRights } = require('./rights');
    const data = getRights(routeType, delayMinutes, status);
    const rights = [];

    if (data.compensation?.length > 0) {
      data.compensation.forEach(c => {
        if (c.amount) {
          let title = lang === 'fr' ? 'Indemnisation' : lang === 'ar' ? 'تعويض' : 'Compensation';
          let detail = `${c.amount} — ${c.example || c.distance}`;
          if (lang === 'fr') {
            detail = `${c.amount} — pour les vols ${c.distance === 'Flights under 1,500 km' ? 'de moins de 1500 km' : c.distance === 'Flights 1,500–3,500 km' ? 'de 1500 à 3500 km' : 'de plus de 3500 km'}`;
          } else if (lang === 'ar') {
            detail = `${c.amount} — للرحلات ${c.distance === 'Flights under 1,500 km' ? 'الأقل من 1500 كم' : c.distance === 'Flights 1,500–3,500 km' ? 'بين 1500 و 3500 كم' : 'الأكثر من 3500 كم'}`;
          }
          rights.push({ title, detail });
        }
      });
      // Compensation reduction note
      const reductionNote = data.compensation.find(c => c.note);
      if (reductionNote) {
        let title = lang === 'fr' ? 'Note d\'indemnisation' : lang === 'ar' ? 'ملاحظة التعويض' : 'Compensation Note';
        let detail = reductionNote.note;
        if (lang === 'fr') {
          detail = 'L\'indemnisation peut être réduite de 50 % si la compagnie propose un vol alternatif avec une heure d\'arrivée proche de l\'heure initiale';
        } else if (lang === 'ar') {
          detail = 'يمكن تخفيض التعويض بنسبة 50٪ إذا عرضت شركة الطيران رحلة بديلة وكان وقت الوصول قريباً من الوقت الأصلي';
        }
        rights.push({ title, detail });
      }
    }

    data.care.forEach(item => {
      const l = item.toLowerCase();
      let title = 'Care';
      let detail = item;
      
      if (l.includes('meal') || l.includes('voucher') || l.includes('repas')) {
        title = lang === 'fr' ? 'Bon de repas' : lang === 'ar' ? 'قسيمة وجبة' : 'Meal voucher';
        if (lang === 'fr') {
          detail = 'Demander un bon de repas au comptoir de la compagnie aérienne';
        } else if (lang === 'ar') {
          detail = 'طلب قسيمة وجبة من مكتب شركة الطيران';
        }
      } else if (l.includes('hotel') || l.includes('accommodation') || l.includes('hébergement')) {
        title = lang === 'fr' ? 'Hôtel' : lang === 'ar' ? 'فندق' : 'Hotel';
        if (lang === 'fr') {
          detail = 'Hébergement à l’hôtel et transfert gratuit si un séjour d’une nuit est nécessaire';
        } else if (lang === 'ar') {
          detail = 'إقامة فندقية مجانية مع خدمة النقل إذا كان الانتظار يتطلب المبيت';
        }
      } else if (l.includes('phone') || l.includes('call') || l.includes('email')) {
        title = lang === 'fr' ? 'Communication' : lang === 'ar' ? 'الاتصالات' : 'Communication';
        if (lang === 'fr') {
          detail = '2 appels téléphoniques ou e-mails gratuits';
        } else if (lang === 'ar') {
          detail = 'اتصاليْن هاتفييْن أو رسالتي بريد إلكتروني مجاناً';
        }
      } else {
        title = lang === 'fr' ? 'Assistance' : lang === 'ar' ? 'رعاية' : 'Care';
        if (lang === 'fr') {
          detail = 'Assistance et rafraîchissements proportionnels au temps d’attente';
        } else if (lang === 'ar') {
          detail = 'تقديم المساعدة والمرطبات بما يتناسب مع وقت الانتظار';
        }
      }
      rights.push({ title, detail });
    });

    data.options.forEach(item => {
      const l = item.toLowerCase();
      if (l.includes('refund') || l.includes('remboursement')) {
        let refundTitle = 'Full refund';
        let detail = item;
        if (lang === 'fr') {
          refundTitle = 'Remboursement complet';
          detail = 'Remboursement complet du billet si le retard dépasse 5 heures ou si vous choisissez de ne pas voyager';
        } else if (lang === 'ar') {
          refundTitle = 'استرداد كامل';
          detail = 'استرداد كامل لقيمة التذكرة إذا تجاوز التأخير 5 ساعات أو إذا اخترت عدم السفر';
        }
        rights.push({ title: refundTitle, detail: detail });
      } else if (l.includes('rebook')) {
        let rebookTitle = 'Alternative flights';
        let detail = item;
        if (lang === 'fr') {
          rebookTitle = 'Vols alternatifs';
          detail = 'Demande de vols alternatifs sur le prochain vol disponible sans frais supplémentaires';
        } else if (lang === 'ar') {
          rebookTitle = 'رحلات بديلة';
          detail = 'طلب رحلات بديلة على أول رحلة متاحة دون أي تكلفة إضافية';
        } else {
          detail = 'Request alternative flights on the next available flight at no extra cost';
        }
        rights.push({ title: rebookTitle, detail: detail });
      }
    });

    let lawNote = '';
    if (lang === 'fr') {
      lawNote = routeType === 'eu_to_tunisia'
        ? 'Le règlement européen CE 261/2004 s’applique — réclamation à déposer auprès de la compagnie aérienne.'
        : routeType === 'domestic'
          ? 'Les règles de l’OACA s’appliquent — contactez le comptoir de la compagnie.'
          : 'La Convention de Montréal s’applique — demandez des informations sur l’indemnisation volontaire.';
    } else if (lang === 'ar') {
      lawNote = routeType === 'eu_to_tunisia'
        ? 'تنطبق اللائحة الأوروبية CE 261/2004 — قم بتقديم شكوى لدى شركة الطيران.'
        : routeType === 'domestic'
          ? 'تنطبق قواعد ديوان الطيران المدني والمطارات (OACA) — اتصل بمكتب شركة الطيران.'
          : 'تنطبق اتفاقية مونتريال — اسأل شركة الطيران عن التعويض التطوعي.';
    } else {
      lawNote = routeType === 'eu_to_tunisia'
        ? 'EU Regulation 261/2004 applies — file a claim with the airline.'
        : routeType === 'domestic'
          ? 'OACA rules apply — contact airline desk'
          : 'Montreal Convention applies — ask airline for voluntary compensation';
    }

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

  async subscribeToFlightAlerts(email, flightNumber, session) {
    console.log(`🔧 [TOOL] subscribeToFlightAlerts: ${email} for ${flightNumber}`);
    const baseUrl = process.env.SMART_AIRPORT_API || 'http://localhost:8000';
    try {
      let dep_iata = session.origin || "TUN";
      let arr_iata = session.destination || "";
      let airline = session.airline || "";
      
      if (!session.origin) {
        try {
          const status = await tools.getFlightStatus(flightNumber, session);
          if (status && status.type !== 'general') {
            dep_iata = status.route ? status.route.split(' → ')[0] : (session.origin || "TUN");
            arr_iata = status.route ? status.route.split(' → ')[1] : (session.destination || "");
            airline = status.airline || (session.airline || "");
          }
        } catch (e) {
          console.error("Flight details pre-fetch failed:", e);
        }
      }

      const url = `${baseUrl}/api/passenger/alerts/subscribe`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          flight_number: flightNumber,
          dep_iata: dep_iata,
          arr_iata: arr_iata,
          airline: airline,
          scheduled_departure: ""
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      return {
        ok: true,
        message: data.message || `Successfully subscribed ${email} to flight ${flightNumber} updates!`,
        subscription_id: data.subscription_id
      };
    } catch (err) {
      console.error("subscribeToFlightAlerts tool failed:", err);
      return {
        ok: false,
        message: err.message || "Failed to complete the alert subscription."
      };
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GROQ-COMPATIBLE TOOL DEFINITIONS  (OpenAI function-calling format)
// These are passed to the LLM so it can decide which tool to call.
// ─────────────────────────────────────────────────────────────────────────────
const TOOL_DEFINITIONS = [
  {
    name: 'getFlightStatus',
    description: 'Get real-time flight status, schedule, gate, terminal, delay minutes, and route for a specific flight number',
    parameters: {
      flightNumber: { type: 'string', description: 'Flight number (e.g. TU741, AF1083)' }
    },
    required: ['flightNumber']
  },
  {
    name: 'getPassengerRights',
    description: 'Get passenger rights information including cash compensation amounts, care entitlements (meals, hotel, communication), and rebooking/refund options based on delay duration and route type',
    parameters: {
      delayMinutes: { type: 'number', description: 'Delay in minutes (default 180 if unknown)' },
      routeType: {
        type: 'string',
        enum: ['tunisia_to_eu', 'eu_to_tunisia', 'domestic', 'tunisia_international', 'other'],
        description: 'Route type classification from getFlightStatus result'
      },
      status: {
        type: 'string',
        enum: ['delayed', 'cancelled', 'active', 'in_air', 'scheduled', 'landed', 'diverted', 'unknown', 'on_time'],
        description: 'Flight status — normalized internally for rights calculation'
      },
      lang: { type: 'string', enum: ['en', 'fr', 'ar'], description: 'Response language' }
    },
    required: ['delayMinutes', 'routeType', 'status']
  },
  {
    name: 'getAirportServices',
    description: 'Get available services at a specific airport including free WiFi, restaurants/cafes, lounges, and their locations/operating hours',
    parameters: {
      airportCode: { type: 'string', description: 'IATA airport code (e.g. TUN, DJE, MIR, NBE)' }
    },
    required: ['airportCode']
  },
  {
    name: 'getAlternativeFlights',
    description: 'Search for alternative flights on the same route (origin → destination) for passengers who have missed or been delayed on their original flight',
    parameters: {
      origin: { type: 'string', description: 'Origin IATA airport code (e.g. TUN)' },
      destination: { type: 'string', description: 'Destination IATA airport code (e.g. CDG)' }
    },
    required: ['origin', 'destination']
  },
  {
    name: 'searchHotelsNearAirport',
    description: 'Search for hotels near a specific airport. Returns hotel names, star ratings, estimated price per night, distance from airport, and whether the data is live or offline fallback',
    parameters: {
      airportCode: { type: 'string', description: 'IATA airport code (e.g. TUN, DJE, MIR, NBE, CDG)' },
      radiusMetres: { type: 'number', description: 'Search radius in metres, default 12000' }
    },
    required: ['airportCode']
  },
  {
    name: 'subscribeToFlightAlerts',
    description: 'Subscribe an email address to receive real-time alerts about flight status changes for a specific flight number',
    parameters: {
      email: { type: 'string', description: 'Passenger email address' },
      flightNumber: { type: 'string', description: 'Flight number to monitor (e.g. TU741)' }
    },
    required: ['email', 'flightNumber']
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// TOOL DISPATCHER — routes a Groq tool call to the correct service function
// ─────────────────────────────────────────────────────────────────────────────
async function executeToolCall(toolCall, session) {
  const { name, args } = toolCall;
  console.log(`🔧 [Groq Tool Call] ${name}(${JSON.stringify(args)})`);

  switch (name) {
    case 'getFlightStatus':
      return await tools.getFlightStatus(args.flightNumber, session);

    case 'getPassengerRights': {
      const { getRouteType } = require('./airports');
      const dep = session.origin || session.selectedAirport || 'TUN';
      const arr = session.destination || 'CDG';
      const airCode = session.airline ? session.airline.substring(0, 2) : 'TU';
      const routeType = session.route_type || getRouteType(dep, arr, airCode);

      // Normalize real flight statuses to the rights engine's expected values
      const rawStatus = (args.status || session.status || 'delayed').toLowerCase();
      const normalizeStatus = (s) => {
        if (['active', 'in_air', 'scheduled', 'on_time'].includes(s)) return 'on_time';
        if (s === 'landed') return 'cancelled';
        return s; // 'delayed', 'cancelled', 'diverted', 'unknown' pass through
      };
      const normalizedStatus = normalizeStatus(rawStatus);

      console.log(`  ⇢ normalized status: "${rawStatus}" → "${normalizedStatus}"`);
      return await tools.getPassengerRights(
        args.delayMinutes || session.delayMinutes || 180,
        args.routeType || routeType,
        normalizedStatus,
        args.lang || session.language || 'en'
      );
    }

    case 'getAirportServices':
      return await tools.getAirportServices(
        args.airportCode || session.selectedAirport || session.origin || 'TUN'
      );

    case 'getAlternativeFlights':
      return await tools.getAlternativeFlights(
        args.origin || session.origin,
        args.destination || session.destination
      );

    case 'searchHotelsNearAirport': {
      const { searchHotelsNearAirport: searchHotels } = require('./hotelsService');
      const hotels = await searchHotels(args.airportCode, { radiusMetres: args.radiusMetres || 12000 });
      return hotels.map(h => ({
        name: h.name,
        stars: Math.round(h.rating || 3),
        pricePerNight: h.pricePerNight || 150,
        distanceKm: h.distanceKm || null,
        data_source: h.source === 'google_places' ? 'live_google_places' : 'static_offline_fallback'
      }));
    }

    case 'subscribeToFlightAlerts':
      return await tools.subscribeToFlightAlerts(args.email, args.flightNumber, session);

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — updated with intent-reasoning rules for missed flights
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a professional airport assistant AI deployed at Tunisian airports (TUN, DJE, MIR, NBE). Help passengers with flight status, rights checking, airport services, alternative flights searching, and nearby hotels. Be extremely brief, concise, and direct.

═══════════════════════════════════════
CORE RULES
═══════════════════════════════════════
- NEVER introduce yourself or say your name
- NEVER say "I'm here to help", "I'm happy to help", or any filler phrase
- Keep all replies EXTREMELY SHORT — maximum 1 concise and direct sentence.
- NEVER invent flights, times, prices, or compensation amounts
- If 'Alternative flights' or 'Vols alternatifs' is listed in the rights data, explicitly mention: "Based on this delay/cancellation, you may be eligible for an alternative flight at no extra cost."
- NEVER claim they have free alternative flights or compensation unless the rights data explicitly includes it.
- NEVER suggest, mention, or link to actions like "Booking", "Requesting Meal Voucher", "Submitting Compensation Request", "Visit Airport Information Desk", or "Contact Airline". The assistant does not support booking, requests, desk visits, or contacting.
- For off-topic or unsupported topics (like bookings, requests, or visits), reply with exactly one short sentence redirecting to the whitelisted topics or human agents, and NEVER generate actions/buttons for them.
- If data is unavailable, say so honestly and tell the passenger where to verify
- If hotel data_source is 'static_offline_fallback', explicitly state that live data is unavailable and you are showing saved/offline recommendations.
- ALWAYS reply in the EXACT language the passenger used
- For Arabic: mirror the passenger's style (Darija or MSA) exactly
- ALWAYS return valid JSON only — no markdown, no plain text, no code fences

═══════════════════════════════════════
PASSENGER INTENT REASONING
═══════════════════════════════════════
- If a passenger asks for alternative flights and the original flight has already departed or landed, ALWAYS assume the passenger missed their flight unless they explicitly state otherwise. Treat this as a missed-flight scenario. Provide alternative flight options. NEVER refuse alternative flight queries solely because the original flight has already departed.
- If a passenger provides a flight code that has already landed, do NOT assume they were on board. Default to the missed-flight interpretation when they ask for alternatives.
- Use tool results to determine flight status. If the tool says the flight has already departed/landed and the passenger is asking about alternatives, call getAlternativeFlights with the origin and destination from the flight data.
- Distinguish these scenarios:
  · ONBOARD INQUIRY: passenger is currently traveling — provide real-time status
  · MISSED FLIGHT: passenger did not board a departed/landed flight — offer alternative flights
  · FUTURE PLANNING: asking about upcoming options — provide schedule info
  · GENERAL INQUIRY: airport services, hotels, rights — use appropriate tools
- When a flight has already landed/departed and the passenger asks for "alternatives" or "another flight", call the getAlternativeFlights tool for that route. Do not simply say the flight has already left — offer a solution.

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
- CRITICAL: Never mix multiple languages (e.g. French, Arabic, English) in a single response under any circumstances. If the conversation is in French, use 100% French and never include Arabic words. If it is in English, use 100% English.
- For French: Use natural and elegant phrasing. Avoid literal repetitions or direct translation cliches like "prévu comme prévu" (use "est actuellement à l'heure", "est programmé comme prévu", or "est à l'heure" instead).

═══════════════════════════════════════
TOOL USE
═══════════════════════════════════════
- You have access to the following tools: getFlightStatus, getPassengerRights, getAirportServices, getAlternativeFlights, searchHotelsNearAirport, subscribeToFlightAlerts
- Use these tools to fetch real data. NEVER invent flight data, hotel data, or rights information.
- For hotel queries: prefer calling searchHotelsNearAirport. Rely on its results.
- For flight alternatives: call getFlightStatus first to get route info, then call getAlternativeFlights with the origin and destination.
- After receiving tool results, incorporate them into your final JSON response.
- Do NOT call the same tool twice with identical arguments in a row. If the tool returned successfully, use the data.
- When a passenger asks about rights for a flight that is currently in-air or on-time, call getPassengerRights anyway and explain what rights WOULD apply if a delay or cancellation occurred. Do not refuse to answer.
- Once you have all the data you need from tool calls, produce your final JSON response. Do not keep calling tools.

═══════════════════════════════════════
RESPONSE SCOPE RULES
═══════════════════════════════════════

Rule 1 — FLIGHT STATUS queries only:
Return ONLY these fields: flight number, airline, current status (on time / delayed / cancelled / in air / landed / diverted), delay duration in minutes (if applicable), scheduled departure and arrival times, actual departure time (if available), gate and terminal (if known).
NEVER include: rights, compensation, meal vouchers, hotel entitlements, rebooking options, or any other information not explicitly asked. A status query must answer ONLY the flight status.

Rule 2 — PASSENGER RIGHTS logic:
Before listing any entitlements, examine the flight status and delay from the tool results. Apply these rules strictly:

  • If status is "in_air", "active", "scheduled", or "on_time" AND delay is 0, null, or less than 120 minutes:
    → State clearly: "Your flight is currently on time. No compensation or care entitlements currently apply."
    → THEN explain what WOULD apply if a delay or cancellation occurs (summary only — do not list as current rights):
      - If the flight arrives 3+ hours late: possible compensation (amount depends on route distance and applicable regulation — look up from compensation_config.json or backend API)
      - If cancelled: full refund or rerouting, plus compensation if less than 14 days' notice
      - If denied boarding: denied boarding compensation applies
    → NEVER present these as current entitlements. Frame them as hypothetical.

  • If delay is 120+ minutes (2 hours or more):
    → State care entitlements: meals/refreshments, two free phone calls or emails, hotel accommodation if overnight stay is needed.

  • If delay is 180+ minutes (3 hours or more) for applicable routes:
    → State compensation amounts by route distance. Look up exact amounts from compensation_config.json (EU/UK regulations) or the backend GET /api/passenger/compensation-config endpoint. Never hardcode the amounts.

  • If cancelled:
    → State: full refund of the ticket OR rerouting to the final destination at the earliest opportunity. Compensation applies if notified less than 14 days before departure.

  • If denied boarding:
    → State denied boarding compensation plus rerouting or refund.

  • For "diverted" status: treat similarly to "delayed" — care entitlements apply after 2+ hours of delay from original arrival.

  • For "landed" and passenger asks about rights for a missed connection:
    → Check the delay of the connecting flight. If the connection was delayed 3+ hours departing the origin, compensation may apply under EC 261. Otherwise, no automatic entitlement through the flight rights regulation (check airline policy for missed connections).

Rule 3 — NEVER MIX RESPONSE TYPES:
A flight status response must NEVER contain rights information. A passenger rights response must NEVER contain airport services or hotel information unless also separately asked about those topics. Each response answers EXACTLY what was asked, nothing more.

═══════════════════════════════════════
STRICT JSON RULES
═══════════════════════════════════════
- Output ONLY the JSON object — starts with { ends with }
- Double quotes everywhere
- "actions" NEVER empty for delayed/cancelled flights
- "isFollowUp": true if not the first exchange
- NEVER add fields not listed above
- NEVER wrap in markdown or code fences

═══════════════════════════════════════
OUTPUT FORMAT (WITH TOOL DATA)
═══════════════════════════════════════
{
  "type": "multi" or "general",
  "message": "Conversational reply — 1 sentence, direct, covers all intents, grounded in tool results",
  "flight": { "flightNumber": "...", "airline": "...", "route": "...", "status": "...", "delay": ..., "scheduledDeparture": "...", "scheduledArrival": "...", "gate": "...", "terminal": "..." },
  "rights": [{ "title": "...", "detail": "..." }],
  "flights": [{ "flightNumber": "...", "airline": "...", "departure": "...", "status": "..." }],
  "hotels": [{ "name": "...", "stars": ..., "pricePerNight": ..., "data_source": "live_google_places" }],
  "services": [{ "name": "...", "location": "...", "detail": "..." }],
  "suggestion": "Brief helpful next-step tip.",
  "actions": ["Action 1", "Action 2"],
  "isFollowUp": false
}
If no tool data is available for a key, omit that key entirely from the JSON.`;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN AGENT
// ─────────────────────────────────────────────────────────────────────────────
async function runAgent(message, history = [], conversationId = 'default', selectedAirport = null) {
  try {
    console.log(`\n[Agent] "${message}" | conv: ${conversationId}`);

    // ── Session ──────────────────────────────────────────────────────────────
    let session = sessions.get(conversationId) || {
      flightNumber: null, status: null, origin: null,
      destination: null, delayMinutes: null, delayMinutesKnown: false, airline: null,
      selectedAirport: null, route_type: null,
      pendingIntents: null, language: null,
    };
    let conversationHistory = sessions.get(conversationId + '_history') || [];

    // Detect language from message
    let detectedLang = detectLanguage(message, session.language);
    const isShortOrCode = message.trim().length < 8 || /^[A-Z]{2,3}\s?\d{1,4}$/i.test(message.trim());
    if (isShortOrCode && session.language) {
      detectedLang = session.language;
    } else {
      session.language = detectedLang;
    }

    // Priority 0: frontend-provided airport
    if (selectedAirport) session.selectedAirport = selectedAirport;

    // Priority 1: airport mentioned in message text
    const mentionedAirport = extractAirportFromMessage(message);
    if (mentionedAirport) session.selectedAirport = mentionedAirport;

    // Priority 2: delay in hours or minutes from message
    const delayMatch = message.match(/(\d+)\s*h(?:eure|ours?)?/i);
    const delayMinMatch = message.match(/(\d+)\s*(?:min|minute|minutes)/i);
    if (delayMinMatch) {
      session.delayMinutes = parseInt(delayMinMatch[1]);
      session.delayMinutesKnown = true;
    } else if (delayMatch) {
      session.delayMinutes = parseInt(delayMatch[1]) * 60;
      session.delayMinutesKnown = true;
    }

    // Priority 3: flight number from message
    const flightMatch = message.match(/([A-Z]{2,3})\s?(\d{1,4})/i);
    if (flightMatch) {
        const newFn = (flightMatch[1] + flightMatch[2]).toUpperCase();
        if (newFn !== session.flightNumber) {
            console.log(`🆕 [Session] New flight: ${newFn} (was: ${session.flightNumber || 'none'})`);
            session.flightNumber = newFn;
            session.status = null;
            session.delayMinutes = 0;
            session.delayMinutesKnown = false;
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

    if (session.pendingIntents) {
      intents = [...new Set([...intents, ...session.pendingIntents])];
      if (mentionedAirport || session.selectedAirport) {
        session.pendingIntents = null;
      }
      sessions.set(conversationId, session);
    }

    console.log(`🎯 [Intents] ${intents.join(', ')}`);

    const needsFlight = intents.includes('alternative_flights') || 
                        intents.includes('passenger_rights') ||
                        (intents.includes('flight_status') && intents.length === 1);
    const needsAirportOnly = intents.some(i => ['hotels', 'airport_services'].includes(i)) && !needsFlight;

    if (needsFlight && !session.flightNumber) {
      let askMsg = '';
      let actions = [];
      if (detectedLang === 'fr') {
        askMsg = (intents.includes('alternative_flights') || intents.includes('passenger_rights'))
          ? 'Pour vérifier vos droits et trouver des vols alternatifs, veuillez indiquer votre numéro de vol actuel ou initial (ex. TU741, AF1083).'
          : 'Veuillez indiquer votre numéro de vol (ex. TU741, AF1083) afin que je puisse vous aider avec les détails de votre vol.';
        actions = ['Services aéroportuaires', 'Droits des passagers'];
      } else if (detectedLang === 'ar') {
        askMsg = (intents.includes('alternative_flights') || intents.includes('passenger_rights'))
          ? 'للتحقق من حقوقك والعثور على رحلات بديلة، يرجى تقديم رقم رحلتك الحالية أو الأصلية (مثل TU741، AF1083).'
          : 'يرجى تقديم رقم رحلتك (مثل TU741، AF1083) لمساعدتك في تفاصيل رحلتك.';
        actions = ['خدمات المطار', 'حقوق المسافرين'];
      } else {
        askMsg = (intents.includes('alternative_flights') || intents.includes('passenger_rights'))
          ? 'To check your rights and find alternative flights, please provide your current or original flight number (e.g. TU741, AF1083).'
          : 'Please provide your flight number (e.g. TU741, AF1083) so I can assist you with your flight details.';
        actions = ['Airport Services', 'Passenger Rights'];
      }
      
      const ask = {
        type: 'general',
        message: askMsg,
        actions: actions,
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
      let askMsg = '';
      let actions = [];
      if (detectedLang === 'fr') {
        askMsg = "De quel aéroport s'agit-il ?";
        actions = ["Tunis-Carthage", "Djerba", "Monastir", "Enfidha"];
      } else if (detectedLang === 'ar') {
        askMsg = "ما هو المطار الذي تستفسر عنه؟";
        actions = ["تونس قرطاج", "جربة", "المنستير", "النفيضة"];
      } else {
        askMsg = "Which airport are you inquiring about?";
        actions = ["Tunis-Carthage", "Djerba", "Monastir", "Enfidha"];
      }
      const ask = {
        type: "general",
        message: askMsg,
        actions: actions,
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

    // ── LLM call WITH Groq function calling ──────────────────────────────────
    // The LLM decides which tools to call based on TOOL_DEFINITIONS.
    // We loop until the LLM returns a final response (no more toolCalls).
    //
    // REQUIRED message sequence for each tool round:
    //   system → user → assistant(tool_calls) → tool → [assistant(tool_calls) → tool] → assistant(text)
    //
    // The tool_calls `id` in the assistant message MUST match the `tool_call_id`
    // in the subsequent tool message. We preserve Groq's original id.

    const systemMessage = SYSTEM_PROMPT;
    let llmMessages = [{ role: 'system', content: systemMessage }, ...conversationHistory];
    let llmResponse = await chat(llmMessages, TOOL_DEFINITIONS);

    // ── Tool execution loop ─────────────────────────────────────────────────
    let toolCallCount = 0;
    const MAX_TOOL_CALLS = 6;

    while (llmResponse.toolCalls && llmResponse.toolCalls.length > 0 && toolCallCount < MAX_TOOL_CALLS) {
      toolCallCount++;

      // Build ONE assistant message containing ALL tool calls from this round
      const toolCallsEntry = llmResponse.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.args)
        }
      }));

      conversationHistory.push({
        role: 'assistant',
        content: null,
        tool_calls: toolCallsEntry
      });

      // Execute every tool call and append a tool result for each
      for (const tc of llmResponse.toolCalls) {
        const toolResult = await executeToolCall({ name: tc.name, args: tc.args }, session);
        sessions.set(conversationId, session);
        conversationHistory.push({
          role: 'tool',
          content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
          tool_call_id: tc.id
        });
      }

      // Next LLM call — tool results are now in history for the model to consume
      llmMessages = [{ role: 'system', content: systemMessage }, ...conversationHistory];
      llmResponse = await chat(llmMessages, TOOL_DEFINITIONS);
    }

    // If we hit the loop guard without a text response, gracefully fall back
    if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
      console.log(`⚠️ [Agent] Tool call limit (${MAX_TOOL_CALLS}) reached — forcing text response`);
      llmResponse = {
        reply: JSON.stringify({
          type: 'general',
          message: 'I found your flight information but had trouble formatting the response. Please try again.',
          actions: ['Passenger Rights', 'Alternative Flights', 'Airport Services'],
          isFollowUp: history.length > 2
        }),
        toolCalls: null
      };
    }

    // ── Parse LLM output ─────────────────────────────────────────────────────
    let parsed;
    try {
      const rawText = llmResponse.reply;
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const cleaned = jsonMatch ? jsonMatch[0] : rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
      parsed.isFollowUp = history.length > 2;

      // Ensure delayed/cancelled flights always have actions
      if (session.status && ['delayed', 'cancelled'].includes(session.status) &&
        (!parsed.actions || parsed.actions.length === 0))
        parsed.actions = ['Passenger Rights', 'Alternative Flights', 'Airport Services'];

    } catch (_) {
      console.log(`❌ [LLM] JSON parse failed — building fallback`);
      parsed = {
        type: 'general',
        message: 'Here is the information I found. Please check at the airline desk for more details.',
        actions: ['Passenger Rights', 'Alternative Flights', 'Airport Services'],
        isFollowUp: history.length > 2,
      };
    }

    // Post-process the parsed JSON object to translate actions and sanitize message/actions
    if (parsed) {
      // Sanitize flight object: remove it if it contains undefined/null/none values
      if (parsed.flight) {
        const num = parsed.flight.flightNumber || parsed.flight.number || '';
        const air = parsed.flight.airline || '';
        const numStr = num.toString().toLowerCase();
        const airStr = air.toString().toLowerCase();
        
        if (!num || 
            numStr.includes('undef') || numStr.includes('null') || numStr.includes('none') ||
            airStr.includes('undef') || airStr.includes('null') || airStr.includes('none')) {
          delete parsed.flight;
        }
      }

      // Sanitize message: replace "rebooking" or "Rebooking"
      if (parsed.message) {
        if (detectedLang === 'fr') {
          parsed.message = parsed.message
            .replace(/rebooking/gi, 'vols alternatifs')
            .replace(/rebook/gi, 'vols alternatifs')
            .replace(/réenregistrement/gi, 'vols alternatifs')
            .replace(/re-booking/gi, 'vols alternatifs');
        } else if (detectedLang === 'ar') {
          parsed.message = parsed.message
            .replace(/rebooking/gi, 'رحلات بديلة')
            .replace(/rebook/gi, 'رحلات بديلة')
            .replace(/re-booking/gi, 'رحلات بديلة');
        } else {
          parsed.message = parsed.message
            .replace(/rebooking/gi, 'alternative flights')
            .replace(/rebook/gi, 'alternative flights')
            .replace(/re-booking/gi, 'alternative flights');
        }
      }

      const replyLang = parsed.message ? detectLanguage(parsed.message, detectedLang) : detectedLang;

      // Clean and translate actions to whitelisted ones only
      if (parsed.actions && Array.isArray(parsed.actions)) {
        const cleanedActions = [];
        parsed.actions.forEach(act => {
          const actLower = act.toLowerCase();
          if (actLower.includes('alternative') || actLower.includes('rebook') || actLower.includes('autre vol') || actLower.includes('vol alternatif')) {
            cleanedActions.push(replyLang === 'fr' ? 'Voir les vols alternatifs' : replyLang === 'ar' ? 'عرض الرحلات البديلة' : 'View alternative flights');
          } else if (actLower.includes('rights') || actLower.includes('droit')) {
            cleanedActions.push(replyLang === 'fr' ? 'Droits des passagers' : replyLang === 'ar' ? 'حقوق المسافرين' : 'Passenger Rights');
          } else if (actLower.includes('services') || actLower.includes('aéroport') || actLower.includes('restaurant') || actLower.includes('lounge') || actLower.includes('wifi')) {
            cleanedActions.push(replyLang === 'fr' ? 'Services aéroportuaires' : replyLang === 'ar' ? 'خدمات المطار' : 'Airport Services');
          } else if (actLower.includes('hotel') || actLower.includes('hébergement')) {
            cleanedActions.push(replyLang === 'fr' ? 'Hôtels à proximité' : replyLang === 'ar' ? 'فنادق قريبة' : 'Nearby Hotels');
          } else if (actLower.includes('status') || actLower.includes('statut') || actLower.includes('track') || actLower.includes('suivre')) {
            cleanedActions.push(replyLang === 'fr' ? 'Statut du vol' : replyLang === 'ar' ? 'حالة الرحلة' : 'Flight Status');
          } else if (actLower.includes('agent')) {
            cleanedActions.push(replyLang === 'fr' ? 'Demander à un agent' : replyLang === 'ar' ? 'الاستفسار من وكيل' : 'Ask an agent');
          }
        });
        parsed.actions = [...new Set(cleanedActions)];
      }

      if (!parsed.actions || parsed.actions.length === 0) {
        parsed.actions = replyLang === 'fr'
          ? ['Voir les vols alternatifs', 'Services aéroportuaires', 'Droits des passagers']
          : replyLang === 'ar'
            ? ['عرض الرحلات البديلة', 'خدمات المطار', 'حقوق المسافرين']
            : ['View alternative flights', 'Airport Services', 'Passenger Rights'];
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
      message: 'Our assistant is temporarily unavailable. Please try again in a few moments.',
      actions: ['Flight Status', 'Airport Services', 'Passenger Rights'],
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

function clearSession(conversationId) {
  sessions.delete(conversationId);
  sessions.delete(conversationId + '_history');
  const timer = sessions.get(conversationId + '_timer');
  if (timer) {
    clearTimeout(timer);
    sessions.delete(conversationId + '_timer');
  }
  console.log(`🧹 [Session] Manually cleared ${conversationId}`);
}

module.exports = { runAgent, getConversationHistory, clearConversationHistory, clearSession };
/**
 * flightService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Real-time + scheduled flight data via Aviation Edge only.
 *
 * getFlightData() priority chain:
 *   1. Aviation Edge — Flight Tracker   (active/in-air flights today)
 *   2. Aviation Edge — Future Schedules (upcoming scheduled flights)
 *   3. { found: false }                 — agent tells passenger honestly
 *
 * getAlternativeFlights() priority chain:
 *   1. Aviation Edge — Real-time Timetable  (today's departures)
 *   2. Aviation Edge — Future Schedules     (next scheduled options)
 *   3. []                                   — agent shows "no results" message
 *
 * Required in your .env:
 *   AVIATION_EDGE_KEY=xxxxxxxxxxxxxxxxxxxx
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { getRouteType } = require('./airports');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function normaliseStatus(raw) {
  if (!raw) return 'unknown';
  const s = raw.toLowerCase();
  if (s.includes('delay'))                return 'delayed';
  if (s.includes('cancel'))              return 'cancelled';
  if (s === 'en-route' || s === 'active') return 'active';
  if (s.includes('land'))                return 'landed';
  if (s.includes('sched'))               return 'scheduled';
  if (s === 'diverted')                  return 'diverted';
  return 'unknown';
}

function formatTime(raw) {
  if (!raw) return null;
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  const m = raw.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : raw;
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 0 — SMART AIRPORT DB CACHE (fastest, zero external API cost)
// Queries our own PostgreSQL snapshot table via the backend REST API.
// Covers ALL flights: scheduled, boarding, in-air, landed, delayed, cancelled.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFromDbCache(flightNumber) {
  const baseUrl = process.env.SMART_AIRPORT_API || 'http://localhost:8000';
  const airports = ['TUN', 'MIR', 'DJE', 'NBE', 'SFA', 'GAF'];

  for (const iata of airports) {
    try {
      const url = `${baseUrl}/api/ae-dataset/snapshots?flight_number=${encodeURIComponent(flightNumber)}&airport_iata=${iata}&limit=1`;
      console.log(`🗄  [DB Cache] ${flightNumber} @ ${iata}`);

      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;

      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const f = rows[0];
      console.log(`✅ [DB Cache] ${flightNumber} found at ${iata} — status: ${f.status}`);

      const depDelayMin = f.dep_delay_min || 0;
      const arrDelayMin = f.arr_delay_min || 0;
      const delayMin = f.delay_minutes || Math.max(depDelayMin, arrDelayMin) || 0;

      // Map DB status to normalised status
      const statusMap = {
        in_air:    'active',
        landed:    'landed',
        delayed:   'delayed',
        cancelled: 'cancelled',
        boarding:  'boarding',
        scheduled: 'scheduled',
        on_time:   'scheduled',
      };

      return {
        found:         true,
        source:        'db_cache',
        flight_number: f.flight_number,
        airline: {
          name: f.airline_name || 'Unknown Airline',
          iata: f.airline_iata || '',
        },
        departure: {
          airport:   f.dep_iata || '',
          iata:      f.dep_iata || '',
          scheduled: formatTime(f.dep_scheduled),
          actual:    formatTime(f.dep_actual),
          delay:     depDelayMin,
          gate:      f.dep_gate || null,
          terminal:  f.dep_terminal || null,
        },
        arrival: {
          airport:   f.arr_iata || '',
          iata:      f.arr_iata || '',
          scheduled: formatTime(f.arr_scheduled),
          actual:    formatTime(f.arr_actual),
          delay:     arrDelayMin,
          gate:      f.arr_gate || null,
          terminal:  f.arr_terminal || null,
        },
        status:     statusMap[f.status] || 'scheduled',
        delay:      delayMin,
        route_type: getRouteType(f.dep_iata || '', f.arr_iata || '', f.airline_iata || ''),
      };
    } catch (err) {
      console.error(`❌ [DB Cache] ${err.message}`);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — AVIATION EDGE: Flight Tracker (active/in-air)
// GET /v2/public/flights?key=KEY&flightIata=TU741
// ─────────────────────────────────────────────────────────────────────────────
async function fetchTrackerFromAviationEdge(flightNumber) {
  const apiKey = process.env.AVIATION_EDGE_KEY;
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') return null;

  try {
    const url = `https://aviation-edge.com/v2/public/flights?key=${apiKey}&flightIata=${flightNumber}`;
    console.log(`🌐 [AE Tracker] ${flightNumber}`);

    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const json = await res.json();

    if (!Array.isArray(json) || json.length === 0) {
      console.log(`↩  [AE Tracker] No active flight for ${flightNumber}`);
      return null;
    }

    const f = json[0];
    console.log(`✅ [AE Tracker] ${flightNumber} — status: ${f.status}`);

    return {
      found:         true,
      source:        'ae_tracker',
      flight_number: flightNumber,
      airline: {
        name: f.airline?.name     || 'Unknown Airline',
        iata: f.airline?.iataCode || '',
      },
      departure: {
        airport:   f.departure?.iataCode || '',
        iata:      f.departure?.iataCode || '',
        scheduled: formatTime(f.departure?.scheduledTime),
        actual:    formatTime(f.departure?.actualTime),
        delay:     Number(f.departure?.delay) || 0,
        gate:      f.departure?.gate     || null,
        terminal:  f.departure?.terminal || null,
      },
      arrival: {
        airport:   f.arrival?.iataCode || '',
        iata:      f.arrival?.iataCode || '',
        scheduled: formatTime(f.arrival?.scheduledTime),
        actual:    formatTime(f.arrival?.actualTime),
        delay:     Number(f.arrival?.delay) || 0,
        gate:      f.arrival?.gate     || null,
        terminal:  f.arrival?.terminal || null,
      },
      status:     normaliseStatus(f.status),
      route_type: getRouteType(
        f.departure?.iataCode || '',
        f.arrival?.iataCode   || '',
        f.airline?.iataCode   || ''
      ),
    };
  } catch (err) {
    console.error(`❌ [AE Tracker] ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — AVIATION EDGE: Future Schedules (today & tomorrow)
// GET /v2/public/flightsHistory?key=KEY&flightIata=TU741&date=YYYY-MM-DD&type=departure
// ─────────────────────────────────────────────────────────────────────────────
async function fetchScheduledFromAviationEdge(flightNumber) {
  const apiKey = process.env.AVIATION_EDGE_KEY;
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') return null;

  const tnAirports = ['TUN', 'MIR', 'DJE', 'NBE'];

  for (const iataCode of tnAirports) {
    try {
      const url = `https://aviation-edge.com/v2/public/timetable?key=${apiKey}&iataCode=${iataCode}&type=departure&flightIata=${flightNumber}`;
      console.log(`🌐 [AE Timetable] ${flightNumber} from ${iataCode}`);

      const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const json = await res.json();

      if (!Array.isArray(json) || json.length === 0) {
        console.log(`↩  [AE Timetable] ${flightNumber} not departing ${iataCode}`);
        continue;
      }

      const f = json[0];
      console.log(`✅ [AE Timetable] ${flightNumber} found at ${iataCode}`);

      return {
        found:         true,
        source:        'ae_timetable',
        flight_number: flightNumber,
        airline: {
          name: f.airline?.name     || 'Unknown Airline',
          iata: f.airline?.iataCode || '',
        },
        departure: {
          airport:   iataCode,
          iata:      iataCode,
          scheduled: formatTime(f.departure?.scheduledTime),
          actual:    formatTime(f.departure?.actualTime) || null,
          delay:     Number(f.departure?.delay) || 0,
          gate:      f.departure?.gate     || null,
          terminal:  f.departure?.terminal || null,
        },
        arrival: {
          airport:   f.arrival?.iataCode || '',
          iata:      f.arrival?.iataCode || '',
          scheduled: formatTime(f.arrival?.scheduledTime),
          actual:    formatTime(f.arrival?.actualTime) || null,
          delay:     Number(f.arrival?.delay) || 0,
          gate:      f.arrival?.gate     || null,
          terminal:  f.arrival?.terminal || null,
        },
        status:     normaliseStatus(f.status) || 'scheduled',
        route_type: getRouteType(
          iataCode,
          f.arrival?.iataCode || '',
          f.airline?.iataCode || ''
        ),
      };
    } catch (err) {
      console.error(`❌ [AE Timetable] ${err.message}`);
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALTERNATIVES — AVIATION EDGE: Real-time Timetable (today)
// GET /v2/public/timetable?key=KEY&iataCode=TUN&type=departure
// ─────────────────────────────────────────────────────────────────────────────
async function fetchTimetableAltsFromAviationEdge(origin, destination) {
  const apiKey = process.env.AVIATION_EDGE_KEY;
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') return [];

  try {
    const url = `https://aviation-edge.com/v2/public/timetable?key=${apiKey}&iataCode=${origin}&type=departure`;
    console.log(`🌐 [AE Timetable] ${origin} → ${destination}`);

    const res  = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const json = await res.json();

    if (!Array.isArray(json) || json.length === 0) {
      console.log(`↩  [AE Timetable] No timetable for ${origin}`);
      return [];
    }

    const filtered = json
      .filter(f => f.arrival?.iataCode === destination && f.flight?.iataNumber)
      .map(f => ({
        flight_number: f.flight.iataNumber,
        airline: {
          name: f.airline?.name     || '',
          iata: f.airline?.iataCode || '',
        },
        departure: {
          iata:      origin,
          scheduled: formatTime(f.departure?.scheduledTime),
          delay:     Number(f.departure?.delay) || 0,
        },
        arrival: {
          iata:      destination,
          scheduled: formatTime(f.arrival?.scheduledTime),
          delay:     Number(f.arrival?.delay) || 0,
        },
        status: normaliseStatus(f.status),
      }));

    console.log(`✅ [AE Timetable] ${filtered.length} results for ${origin}→${destination}`);
    return filtered;
  } catch (err) {
    console.error(`❌ [AE Timetable] ${err.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ALTERNATIVES — AVIATION EDGE: Future Schedules (today + tomorrow)
// GET /v2/public/flightsHistory?key=KEY&iataCode=TUN&type=departure&date=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
async function fetchScheduledAltsFromAviationEdge(origin, destination) {
  const apiKey = process.env.AVIATION_EDGE_KEY;
  if (!apiKey || apiKey === 'YOUR_KEY_HERE') return [];

  const allFlights = [];

  for (const date of [todayUTC(), tomorrowUTC()]) {
    try {
      const url = `https://aviation-edge.com/v2/public/flightsHistory?key=${apiKey}&iataCode=${origin}&type=departure&date=${date}`;
      console.log(`🌐 [AE Future] ${origin} → ${destination} on ${date}`);

      const res  = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const json = await res.json();

      if (!Array.isArray(json) || json.length === 0) continue;

      const filtered = json
        .filter(f => f.arrival?.iataCode === destination && f.flight?.iataNumber)
        .map(f => ({
          flight_number: f.flight.iataNumber,
          airline: {
            name: f.airline?.name     || '',
            iata: f.airline?.iataCode || '',
          },
          departure: {
            iata:      origin,
            scheduled: formatTime(f.departure?.scheduledTime),
            delay:     Number(f.departure?.delay) || 0,
          },
          arrival: {
            iata:      destination,
            scheduled: formatTime(f.arrival?.scheduledTime),
            delay:     Number(f.arrival?.delay) || 0,
          },
          status: normaliseStatus(f.status) || 'scheduled',
        }));

      allFlights.push(...filtered);
    } catch (err) {
      console.error(`❌ [AE Future] ${err.message}`);
    }
  }

  // Deduplicate by flight number
  const seen = new Set();
  const unique = allFlights.filter(f => {
    if (seen.has(f.flight_number)) return false;
    seen.add(f.flight_number);
    return true;
  });

  console.log(`✅ [AE Future] ${unique.length} scheduled alternatives for ${origin}→${destination}`);
  return unique;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get flight data for a given IATA flight number.
 *   0. DB Cache      — our PostgreSQL snapshot table (instant, no API cost)
 *   1. AE Tracker    — flight is currently in the air (live GPS)
 *   2. AE Schedules  — flight is scheduled today or tomorrow
 *   3. { found:false } — unknown flight, agent responds honestly
 */
async function getFlightData(flightNumber) {
  const clean = String(flightNumber).toUpperCase().replace(/\s/g, '');

  // Layer 0: own DB cache — fastest, covers all statuses
  const cached = await fetchFromDbCache(clean);
  if (cached) return cached;

  // Layer 1: AE live tracker — in-air flights with GPS
  const tracker = await fetchTrackerFromAviationEdge(clean);
  if (tracker) return tracker;

  // Layer 2: AE timetable — scheduled flights
  const scheduled = await fetchScheduledFromAviationEdge(clean);
  if (scheduled) return scheduled;

  console.log(`❌ [getFlightData] ${clean} not found in any source`);
  return { found: false, flight_number: clean };
}

/**
 * Get alternative flights for a given route (IATA airport codes).
 *   1. AE Timetable    — today's live departures on the route
 *   2. AE Future Sched — upcoming scheduled flights (today + tomorrow)
 *   3. []              — agent shows honest "no alternatives" message
 */
async function getAlternativeFlights(origin, destination) {
  const timetable = await fetchTimetableAltsFromAviationEdge(origin, destination);
  if (timetable.length > 0) return timetable;

  const scheduled = await fetchScheduledAltsFromAviationEdge(origin, destination);
  if (scheduled.length > 0) return scheduled;

  console.log(`❌ [getAlternativeFlights] No results for ${origin}→${destination}`);
  return [];
}

module.exports = { getFlightData, getAlternativeFlights };

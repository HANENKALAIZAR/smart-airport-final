import { getAirportCoords as getCoords } from '@smart-airport/shared-core/constants/airports.js';

// Base URL is set via VITE_API_URL in .env — no hardcoded fallback allowed
const API_BASE = import.meta.env.VITE_API_URL as string;
if (!API_BASE && import.meta.env.VITE_APP_ENV !== 'test') {
  console.error('[API] VITE_API_URL is not set. Check your .env file.');
}


// ── Types Backend (format FastAPI) ────────────────────────────────────────

export interface ApiAirport {
  id: number;
  iata_code: string;
  name: string;
  city: string;
  country: string;
  region: string;
}

export interface ApiAirline {
  id: number;
  iata_code: string;
  name: string;
  reliability_score: number;
}

export interface ApiFlightList {
  id: number;
  flight_number: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  status: 'scheduled' | 'on_time' | 'delayed' | 'cancelled' | 'boarding' | 'landed' | 'departed';
  delay_minutes: number;
  distance_km: number;
  aircraft_type: string | null;
  airline: ApiAirline;
  origin_airport: ApiAirport;
  dest_airport: ApiAirport;
}

export interface ApiFlightDetail extends ApiFlightList {
  actual_departure: string | null;
  actual_arrival: string | null;
  prediction: ApiPrediction | null;
  passenger_rights: ApiPassengerRight[] | null;
  gate?: string | null;
  terminal?: string | null;
  delay_cause?: {
    icon: string;
    title: string;
    summary: string;
    passenger_tip: string;
  } | null;
}

export interface ApiPrediction {
  risk_score: number;
  predicted_delay_min: number;
  confidence: number;
  shap_explanation: Record<string, number | { shap: number; value: number | null }> | null;
  model_version: string | null;
  predicted_at: string | null;
}

export interface ApiPassengerRight {
  region: string;
  regulation_name: string;
  delay_threshold_min: number;
  right_type: string;
  description_en: string;
  description_fr?: string;
  compensation_amount: string | null;
}

// ── Types Nouveau UI (format attendu par les composants) ──────────────────

export interface Airport {
  code: string;
  city: string;
  name: string;
  country: string;
  x: number;
  y: number;
}

export type FlightStatus = 'scheduled' | 'boarding' | 'in_air' | 'landed' | 'delayed' | 'cancelled' | 'on_time' | 'taxiing';

export interface Flight {
  id: string;
  flightNumber: string;
  canonicalFlightNumber: string;
  airline: string;
  airlineCode: string;
  airlineIcao: string;
  airlineReliability: number;
  from: Airport;
  to: Airport;
  departureTime: string;
  arrivalTime: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  actualDeparture?: string | null;
  actualArrival?: string | null;
  status: FlightStatus;
  gate?: string;
  terminal?: string;
  aircraft: string;
  durationMin: number;
  distanceKm: number;
  progress: number;
  delayMin: number | null;
  onTimeHistory: number;
  prediction?: FlightPrediction | null;
  passengerRights?: PassengerRight[] | null;
  delayCause?: {
    icon: string;
    title: string;
    summary: string;
    passengerTip: string;
  } | null;
}

export interface FlightPrediction {
  riskScore: number;
  predictedDelayMin: number;
  confidence: number;
  shapExplanation: Record<string, number> | null;
  modelVersion: string | null;
  topFactors: { label: string; value: number }[];
}

export interface PassengerRight {
  region: string;
  regulation: string;
  delayThreshold: number;
  rightType: string;
  description: string;
  compensation: string | null;
}

// getCoords() is imported from @smart-airport/shared-core at the top of this file.

// ── Adaptateur: API → Nouveau UI ──────────────────────────────────────────

function adaptAirport(a: ApiAirport): Airport {
  const coords = getCoords(a.iata_code);
  return {
    code: a.iata_code,
    city: a.city,
    name: a.name,
    country: a.country,
    x: coords.x,
    y: coords.y,
  };
}

function adaptStatus(apiStatus: string, delayMin: number | null): FlightStatus {
  if (apiStatus === 'on_time') return (delayMin && delayMin > 0) ? 'delayed' : 'scheduled';
  if (apiStatus === 'delayed') return 'delayed';
  if (apiStatus === 'cancelled') return 'cancelled';
  if (apiStatus === 'boarding') return 'boarding';
  if (apiStatus === 'taxiing') return 'taxiing';
  if (apiStatus === 'landed') return 'landed';
  if (apiStatus === 'in_air' || apiStatus === 'departed') return 'in_air';
  return 'scheduled';
}

function extractShapValues(explanation: ApiPrediction['shap_explanation']): Record<string, number> {
  if (!explanation) return {};
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(explanation)) {
    if (typeof val === 'number') {
      result[key] = val;
    } else if (typeof val === 'object' && val !== null && 'shap' in val) {
      result[key] = val.shap;
    }
  }
  return result;
}

function adaptPrediction(p: ApiPrediction | null): FlightPrediction | null {
  if (!p) return null;
  const shap = extractShapValues(p.shap_explanation);
  const topFactors = Object.entries(shap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 5);

  return {
    riskScore: p.risk_score,
    predictedDelayMin: p.predicted_delay_min,
    confidence: p.confidence,
    shapExplanation: shap,
    modelVersion: p.model_version,
    topFactors,
  };
}

function adaptRights(rights: ApiPassengerRight[] | null): PassengerRight[] {
  if (!rights) return [];
  return rights.map(r => ({
    region: r.region,
    regulation: r.regulation_name,
    delayThreshold: r.delay_threshold_min,
    rightType: r.right_type,
    description: r.description_fr || r.description_en,
    compensation: r.compensation_amount,
  }));
}

function adaptFlight(f: ApiFlightList | ApiFlightDetail): Flight {
  const detail = f as ApiFlightDetail;
  const durationMin = Math.round(
    (new Date(f.scheduled_arrival).getTime() - new Date(f.scheduled_departure).getTime()) / 60000
  );

  // Temps réel ou schedulé
  const departureTime = detail.actual_departure ?? f.scheduled_departure;
  const arrivalTime = detail.actual_arrival ?? f.scheduled_arrival;

  // Progression pour vols en cours (on_time avec départ passé)
  const now = Date.now();
  const depTs = new Date(departureTime).getTime();
  const arrTs = new Date(arrivalTime).getTime();
  let progress = 0;
  if (depTs < now && arrTs > now) {
    progress = Math.min(1, (now - depTs) / (arrTs - depTs));
  } else if (arrTs < now) {
    progress = 1;
  }

  return {
    id: String(f.id),
    flightNumber: f.flight_number,
    airline: f.airline.name,
    airlineCode: f.airline.iata_code,
    airlineReliability: f.airline.reliability_score,
    from: adaptAirport(f.origin_airport),
    to: adaptAirport(f.dest_airport),
    departureTime,
    arrivalTime,
    scheduledDeparture: f.scheduled_departure,
    scheduledArrival: f.scheduled_arrival,
    actualDeparture: detail.actual_departure ?? null,
    actualArrival: detail.actual_arrival ?? null,
    status: adaptStatus(f.status, f.delay_minutes),
    gate: detail.gate ?? undefined,
    terminal: detail.terminal ?? undefined,
    aircraft: f.aircraft_type ?? 'Unknown',
    durationMin,
    distanceKm: f.distance_km,
    progress,
    delayMin: f.delay_minutes,
    onTimeHistory: Math.round(f.airline.reliability_score * 100),
    prediction: adaptPrediction(detail.prediction ?? null),
    passengerRights: adaptRights(detail.passenger_rights ?? null),
    delayCause: detail.delay_cause
      ? {
        icon: detail.delay_cause.icon,
        title: detail.delay_cause.title,
        summary: detail.delay_cause.summary,
        passengerTip: detail.delay_cause.passenger_tip,
      }
      : null,
  };
}

// ── Fetch helpers ─────────────────────────────────────────────────────────

const TIMEOUT_MS = 25_000;
const MAX_RETRIES = 2;

async function fetchWithTimeout(url: string, opts: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchApi<T>(endpoint: string, _retry = 0): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    // Retry on 5xx or 429
    if ((res.status >= 500 || res.status === 429) && _retry < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 500 * (_retry + 1)));
      return fetchApi<T>(endpoint, _retry + 1);
    }

    if (!res.ok) {
      console.warn(`[API] ${endpoint} → HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    const isTimeout = (err as { name?: string })?.name === 'AbortError';
    if (!isTimeout && _retry < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 500 * (_retry + 1)));
      return fetchApi<T>(endpoint, _retry + 1);
    }
    console.warn(`[API] ${endpoint} failed${isTimeout ? ' (timeout)' : ''}:`, err);
    return null;
  }
}

// ── Exports publics ───────────────────────────────────────────────────────

export interface FlightFilters {
  status?: string;
  airport?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}

/** Liste des vols avec filtres optionnels */
export async function getFlights(filters: FlightFilters = {}): Promise<Flight[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params.set(k, String(v)); });

  const data = await fetchApi<ApiFlightList[]>(`/flights?${params}`);
  if (data) return data.map(adaptFlight);

  // Backend unavailable — return empty list (honest)
  return [];
}

/** Détail d'un vol par ID */
export async function getFlight(id: string): Promise<Flight | null> {
  const data = await fetchApi<ApiFlightDetail>(`/flights/${id}`);
  if (data) return adaptFlight(data);

  // Backend unavailable — return null (honest)
  return null;
}

/** Prédiction ML pour un vol */
export async function getFlightPrediction(id: string): Promise<FlightPrediction | null> {
  const data = await fetchApi<ApiPrediction>(`/flights/${id}/prediction`);
  return adaptPrediction(data);
}


/** Get flights for a Tunisian airport — Aviation Edge, DB-first */
export async function getPassengerFlights(
  airport: string,
  direction: 'departure' | 'arrival' | 'both' = 'both',
): Promise<Flight[]> {
  const url = `/passenger/flights?airport=${airport}&direction=${direction}`;

  interface PassengerFlightListResponse {
    flights: AEFlight[];
  }

  const data = await fetchApi<PassengerFlightListResponse>(url);
  if (!data?.flights) return [];
  return data.flights
    .filter(f => f.flight_number && f.flight_number !== '—')
    .map(adaptAEFlight);
}

/** Get a single flight by flight number — DB-first, AE fallback */
export async function getPassengerFlight(flightNumber: string): Promise<Flight | null> {
  const data = await fetchApi<AEFlight>(`/passenger/flights/${flightNumber}`);
  if (!data) return null;
  return adaptAEFlight(data);
}

/** Get ML prediction for a flight (Aviation Edge-based, XGBoost + SHAP) */
export async function getPassengerPrediction(flightNumber: string): Promise<FlightPrediction | null> {
  interface PredResponse {
    prediction: ApiPrediction;
  }
  const data = await fetchApi<PredResponse>(`/passenger/flights/${flightNumber}/prediction`);
  if (!data?.prediction) return null;
  return adaptPrediction(data.prediction);
}

/** Get alternative flights on the same route */
export async function getPassengerAlternatives(flightNumber: string): Promise<Flight[]> {
  interface AltResponse {
    alternatives: AEFlight[];
  }
  const data = await fetchApi<AltResponse>(`/passenger/flights/${flightNumber}/alternatives`);
  if (!data?.alternatives) return [];
  return data.alternatives.map(adaptAEFlight);
}

// ── Aviation Edge response type (from /api/passenger/* and /api/aviation-edge/*) ────

interface AEFlight {
  id: string;
  flight_number: string;
  status: string;
  direction: 'departure' | 'arrival';
  airline_name: string;
  airline_iata: string;
  airline_icao: string;
  dep_iata: string;
  dep_airport: string;
  dep_terminal: string | null;
  dep_gate: string | null;
  dep_scheduled: string;
  dep_estimated: string | null;
  dep_actual: string | null;
  arr_iata: string;
  arr_airport: string;
  arr_terminal: string | null;
  arr_gate: string | null;
  arr_scheduled: string;
  arr_estimated: string | null;
  arr_actual: string | null;
  delay_minutes: number | null;
  aircraft_type: string | null;
}

// ── Real lat/lon for distance calculation ────────────────────────────────────
const AIRPORT_LATLON: Record<string, [number, number]> = {
  TUN: [36.851, 10.227], MIR: [35.758, 10.755], NBE: [36.076, 10.439], DJE: [33.875, 10.775],
  CDG: [49.009, 2.548],  ORY: [48.725, 2.360],  LHR: [51.477, -0.461], FRA: [50.033, 8.571],
  FCO: [41.800, 12.239], MXP: [45.630, 8.728],  MAD: [40.494, -3.567], BCN: [41.297, 2.078],
  IST: [40.977, 28.815], SAW: [40.898, 29.309], DOH: [25.273, 51.608], DXB: [25.253, 55.366],
  AMM: [31.723, 35.993], CAI: [30.122, 31.406], JED: [21.679, 39.157], CMN: [33.368, -7.590],
  ALG: [36.691, 3.215],  GVA: [46.238, 6.109],  BRU: [50.901, 4.484],  VIE: [48.110, 16.570],
  MUC: [48.354, 11.786], DUS: [51.289, 6.767],  LYS: [45.726, 5.091],  NCE: [43.658, 7.217],
  MRS: [43.436, 5.215],  MLA: [35.857, 14.477], DSS: [14.670, -17.073], YUL: [45.458, -73.749],
};

function haversineKm(iata1: string, iata2: string): number {
  const c1 = AIRPORT_LATLON[iata1];
  const c2 = AIRPORT_LATLON[iata2];
  if (!c1 || !c2) return 0;
  const R = 6371;
  const dLat = (c2[0] - c1[0]) * Math.PI / 180;
  const dLon = (c2[1] - c1[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(c1[0] * Math.PI / 180) * Math.cos(c2[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function buildCanonicalFlightNumber(flightNumber: string, airlineIata: string, airlineIcao: string): string {
  if (!flightNumber) return "";
  const numPart = flightNumber.replace(/^[A-Za-z]+/, "");
  if (!numPart) return flightNumber;
  
  const iata = airlineIata ? `${airlineIata.toUpperCase()}${numPart}` : "";
  const icao = airlineIcao ? `${airlineIcao.toUpperCase()}${numPart}` : "";
  
  if (iata && icao && iata !== icao) {
    return `${iata} / ${icao}`;
  }
  return flightNumber;
}

// ── Aviation Edge → Flight adapter ───────────────────────────────────────────

function adaptAEFlight(f: AEFlight): Flight {
  const depCoords = getCoords(f.dep_iata);
  const arrCoords = getCoords(f.arr_iata);
  const depTime = f.dep_actual ?? f.dep_estimated ?? f.dep_scheduled;
  const arrTime = f.arr_actual ?? f.arr_estimated ?? f.arr_scheduled;
  const durationMin = Math.round(
    (new Date(f.arr_scheduled).getTime() - new Date(f.dep_scheduled).getTime()) / 60000
  );
  const now = Date.now();
  const depTs = new Date(depTime).getTime();
  const arrTs = new Date(arrTime).getTime();
  let progress = 0;
  if (depTs < now && arrTs > now) progress = Math.min(1, (now - depTs) / (arrTs - depTs));
  else if (arrTs < now) progress = 1;

  const distanceKm = haversineKm(f.dep_iata, f.arr_iata);
  const depCity = f.dep_airport && f.dep_airport !== f.dep_iata ? f.dep_airport : f.dep_iata;
  const arrCity = f.arr_airport && f.arr_airport !== f.arr_iata ? f.arr_airport : f.arr_iata;

  let status: FlightStatus =
    f.status === 'in_air'    ? 'in_air'    :
    f.status === 'landed'    ? 'landed'    :
    f.status === 'cancelled' ? 'cancelled' :
    f.status === 'boarding'  ? 'boarding'  :
    f.status === 'taxiing'   ? 'taxiing'   :
    f.status === 'delayed'   ? 'delayed'   :
    f.status === 'on_time'   ? 'on_time'   : 'scheduled';

  // Auto-resolve landed if AE is lagging
  if (['scheduled', 'on_time', 'in_air', 'taxiing'].includes(status) && arrTs < now - 10 * 60_000) {
    status = 'landed';
  }

  const canonicalFlightNumber = buildCanonicalFlightNumber(f.flight_number, f.airline_iata, f.airline_icao);

  return {
    id: f.id || f.flight_number,
    flightNumber: f.flight_number,
    canonicalFlightNumber,
    airline: f.airline_name,
    airlineCode: f.airline_iata ?? '??',
    airlineIcao: f.airline_icao ?? '',
    airlineReliability: 0, // Not available from Aviation Edge — not displayed
    from: { code: f.dep_iata, city: depCity, name: depCity, country: '', x: depCoords.x, y: depCoords.y },
    to:   { code: f.arr_iata, city: arrCity, name: arrCity, country: '', x: arrCoords.x, y: arrCoords.y },
    departureTime: depTime,
    arrivalTime: arrTime,
    scheduledDeparture: f.dep_scheduled,
    scheduledArrival: f.arr_scheduled,
    actualDeparture: f.dep_actual ?? null,
    actualArrival: f.arr_actual ?? null,
    status,
    gate: (f.direction === 'arrival' ? f.arr_gate : f.dep_gate) ?? undefined,
    terminal: (f.direction === 'arrival' ? f.arr_terminal : f.dep_terminal) ?? undefined,
    aircraft: f.aircraft_type || '—',
    durationMin,
    distanceKm,
    progress,
    delayMin: f.delay_minutes ?? null,
    onTimeHistory: 0, // Not available from Aviation Edge
    prediction: null,
    passengerRights: null,
    delayCause: null,
  };
}

// ── Legacy: getAviationEdgeFlights kept for admin dashboard compatibility ─────
// Passenger pages must use getPassengerFlights() instead.
export async function getAviationEdgeFlights(
  iata: string,
  direction: 'departure' | 'arrival' | 'both' = 'both',
  forceRefresh = false,
): Promise<Flight[]> {
  const url = `/aviation-edge/flights/${iata}?direction=${direction}${forceRefresh ? '&refresh=true' : ''}`;
  interface AEResponse { flights: AEFlight[] }
  const data = await fetchApi<AEResponse>(url);
  if (!data) return [];
  return data.flights
    .filter(f => f.flight_number && f.flight_number !== '—')
    .map(adaptAEFlight);
}
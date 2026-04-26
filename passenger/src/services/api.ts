const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

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
  status: 'scheduled' | 'on_time' | 'delayed' | 'cancelled' | 'boarding';
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

export type FlightStatus = 'scheduled' | 'boarding' | 'in_air' | 'landed' | 'delayed' | 'cancelled' | 'on_time';

export interface Flight {
  id: string;
  flightNumber: string;
  airline: string;
  airlineCode: string;
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
  delayMin: number;
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

// ── Coordonnées géographiques approximatives des aéroports ───────────────

const AIRPORT_COORDS: Record<string, { x: number; y: number }> = {
  TUN: { x: 0.53, y: 0.42 }, CDG: { x: 0.50, y: 0.28 }, ORY: { x: 0.50, y: 0.29 },
  IST: { x: 0.57, y: 0.34 }, FCO: { x: 0.52, y: 0.36 }, FRA: { x: 0.52, y: 0.27 },
  LHR: { x: 0.47, y: 0.26 }, MRS: { x: 0.50, y: 0.32 }, LYS: { x: 0.51, y: 0.31 },
  DJE: { x: 0.54, y: 0.44 }, ALG: { x: 0.50, y: 0.42 }, JED: { x: 0.60, y: 0.48 },
  MXP: { x: 0.51, y: 0.33 }, BRU: { x: 0.50, y: 0.27 }, CAI: { x: 0.57, y: 0.44 },
  MIR: { x: 0.53, y: 0.43 }, DOH: { x: 0.62, y: 0.47 }, DXB: { x: 0.63, y: 0.47 },
  AMM: { x: 0.58, y: 0.42 }, CMN: { x: 0.46, y: 0.43 }, NBE: { x: 0.53, y: 0.42 },
  GVA: { x: 0.51, y: 0.30 }, MAD: { x: 0.46, y: 0.34 }, VIE: { x: 0.54, y: 0.28 },
  MUC: { x: 0.53, y: 0.28 }, DUS: { x: 0.51, y: 0.27 }, NCE: { x: 0.51, y: 0.31 },
  TLS: { x: 0.49, y: 0.31 }, MLA: { x: 0.53, y: 0.38 }, CTA: { x: 0.53, y: 0.37 },
  YUL: { x: 0.22, y: 0.28 }, ABJ: { x: 0.47, y: 0.53 }, DSS: { x: 0.43, y: 0.51 },
};

function getCoords(iata: string): { x: number; y: number } {
  return AIRPORT_COORDS[iata] ?? { x: 0.5, y: 0.4 };
}

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

function adaptStatus(apiStatus: string, delayMin: number): FlightStatus {
  if (apiStatus === 'on_time') return delayMin > 0 ? 'delayed' : 'scheduled';
  if (apiStatus === 'delayed') return 'delayed';
  if (apiStatus === 'cancelled') return 'cancelled';
  if (apiStatus === 'boarding') return 'boarding';
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

// ── Fetch helper ──────────────────────────────────────────────────────────

async function fetchApi<T>(endpoint: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[API] ${endpoint} failed:`, err);
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

  // Fallback: importer mock data
  const { flights } = await import('@/data/mockFlights');
  return flights as unknown as Flight[];
}

/** Détail d'un vol par ID */
export async function getFlight(id: string): Promise<Flight | null> {
  const data = await fetchApi<ApiFlightDetail>(`/flights/${id}`);
  if (data) return adaptFlight(data);

  // Fallback mock
  const { flights } = await import('@/data/mockFlights');
  const mock = flights.find(f => f.id === id);
  return mock ? (mock as unknown as Flight) : null;
}

/** Prédiction ML pour un vol */
export async function getFlightPrediction(id: string): Promise<FlightPrediction | null> {
  const data = await fetchApi<ApiPrediction>(`/flights/${id}/prediction`);
  return adaptPrediction(data);
}

/** Vols en temps réel OpenSky près d'un aéroport */
export async function getAirportLiveFlights(iata: string) {
  return fetchApi(`/opensky/airport-flights/${iata}`);
}

/** États aériens dans une bounding box */
export async function getOpenSkyStates(params?: {
  lat_min?: number; lat_max?: number;
  lon_min?: number; lon_max?: number;
}) {
  const query = params ? '?' + new URLSearchParams(params as unknown as Record<string, string>).toString() : '';
  return fetchApi(`/opensky/states${query}`);
}
// ── Types AviationStack ───────────────────────────────────────────────────

interface AvStackFlight {
  id: string;
  flight_number: string;
  status: string;
  direction: 'departure' | 'arrival';
  airline_name: string;
  airline_iata: string;
  dep_iata: string;
  dep_airport: string;
  dep_terminal: string | null;
  dep_gate: string | null;
  dep_scheduled: string;
  dep_estimated: string;
  dep_actual: string | null;
  arr_iata: string;
  arr_airport: string;
  arr_terminal: string | null;
  arr_scheduled: string;
  arr_estimated: string | null;
  arr_actual: string | null;
  delay_minutes: number;
  aircraft_type: string;
}

interface AvStackResponse {
  airport: string;
  total: number;
  flights: AvStackFlight[];
}

// ── Adaptateur AviationStack → Flight ────────────────────────────────────

function adaptAvStackFlight(f: AvStackFlight): Flight {
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

  const status: FlightStatus =
    f.status === 'landed' ? 'landed' :
      f.status === 'cancelled' ? 'cancelled' :
        f.status === 'boarding' ? 'boarding' :
          f.status === 'delayed' ? 'delayed' :
            f.status === 'on_time' ? 'on_time' : 'scheduled';

  return {
    id: f.id,
    flightNumber: f.flight_number,
    airline: f.airline_name,
    airlineCode: f.airline_iata ?? '??',
    airlineReliability: 0.85,
    from: {
      code: f.dep_iata,
      city: f.dep_airport,
      name: f.dep_airport,
      country: '',
      x: depCoords.x,
      y: depCoords.y,
    },
    to: {
      code: f.arr_iata,
      city: f.arr_airport,
      name: f.arr_airport,
      country: '',
      x: arrCoords.x,
      y: arrCoords.y,
    },
    departureTime: depTime,
    arrivalTime: arrTime,
    scheduledDeparture: f.dep_scheduled,
    scheduledArrival: f.arr_scheduled,
    actualDeparture: f.dep_actual,
    actualArrival: f.arr_actual,
    status,
    gate: f.dep_gate ?? undefined,
    terminal: f.dep_terminal ?? undefined,
    aircraft: f.aircraft_type || 'Unknown',
    durationMin,
    distanceKm: 0,
    progress,
    delayMin: f.delay_minutes ?? 0,
    onTimeHistory: 85,
    prediction: null,
    passengerRights: null,
    delayCause: null,
  };
}

/** Vols AviationStack en temps réel pour un aéroport tunisien */
export async function getAviationStackFlights(iata: string): Promise<Flight[]> {
  const data = await fetchApi<AvStackResponse>(`/aviationstack/flights/${iata}`);
  if (!data) return [];
  return data.flights
    .filter(f => f.flight_number && f.flight_number !== '—')
    .map(adaptAvStackFlight);
}
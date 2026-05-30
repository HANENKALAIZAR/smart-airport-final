import { TUNISIAN_AIRPORTS, TUNISIAN_AIRPORT_CODES } from '@smart-airport/shared-core/constants/airports.js';

export type FlightStatus = "scheduled" | "boarding" | "in_air" | "landed" | "delayed" | "cancelled" | "taxiing";

export interface Airport {
  code: string;
  city: string;
  name: string;
  country: string;
  // Approx lat/lng for the arc visualization (not real geography, just nice curves)
  x: number; // 0..1 across the map
  y: number; // 0..1 vertical
}

export interface Flight {
  id: string;
  flightNumber: string;
  airline: string;
  airlineCode: string;
  from: Airport;
  to: Airport;
  departureTime: string; // ISO
  arrivalTime: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  status: FlightStatus;
  gate?: string;
  terminal?: string;
  seat?: string;
  aircraft: string;
  durationMin: number;
  distanceKm: number;
  progress: number; // 0..1 for in-air flights
  delayMin?: number;
  onTimeHistory: number; // %
}

const A = (code: string, city: string, name: string, country: string, x: number, y: number): Airport =>
  ({ code, city, name, country, x, y });

export const airports = {
  CDG: A("CDG", "Paris", "Charles de Gaulle", "France", 0.50, 0.30),
  JFK: A("JFK", "New York", "John F. Kennedy Intl", "USA", 0.22, 0.36),
  DXB: A("DXB", "Dubai", "Dubai International", "UAE", 0.62, 0.45),
  HND: A("HND", "Tokyo", "Haneda", "Japan", 0.83, 0.40),
  LHR: A("LHR", "London", "Heathrow", "UK", 0.48, 0.27),
  CMN: A("CMN", "Casablanca", "Mohammed V Intl", "Morocco", 0.45, 0.46),
  SIN: A("SIN", "Singapore", "Changi", "Singapore", 0.76, 0.55),
  IST: A("IST", "Istanbul", "Istanbul Airport", "Turkey", 0.56, 0.34),
};

// Build a "now" anchor so countdowns feel live
const now = new Date();
const inMin = (m: number) => new Date(now.getTime() + m * 60_000).toISOString();
const agoMin = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

export const flights: Flight[] = [
  {
    id: "1",
    flightNumber: "AF 1681",
    airline: "Air France",
    airlineCode: "AF",
    from: airports.CDG,
    to: airports.JFK,
    scheduledDeparture: inMin(95),
    departureTime: inMin(95),
    scheduledArrival: inMin(95 + 485),
    arrivalTime: inMin(95 + 485),
    status: "boarding",
    gate: "K42",
    terminal: "2E",
    seat: "12A",
    aircraft: "Boeing 777-300ER",
    durationMin: 485,
    distanceKm: 5837,
    progress: 0,
    onTimeHistory: 87,
  },
  {
    id: "2",
    flightNumber: "EK 203",
    airline: "Emirates",
    airlineCode: "EK",
    from: airports.DXB,
    to: airports.JFK,
    scheduledDeparture: agoMin(180),
    departureTime: agoMin(165),
    scheduledArrival: inMin(440),
    arrivalTime: inMin(455),
    status: "in_air",
    aircraft: "Airbus A380-800",
    durationMin: 760,
    distanceKm: 11020,
    progress: 0.34,
    delayMin: 15,
    onTimeHistory: 79,
  },
  {
    id: "3",
    flightNumber: "BA 117",
    airline: "British Airways",
    airlineCode: "BA",
    from: airports.LHR,
    to: airports.JFK,
    scheduledDeparture: inMin(60 * 26),
    departureTime: inMin(60 * 26),
    scheduledArrival: inMin(60 * 34),
    arrivalTime: inMin(60 * 34),
    status: "scheduled",
    gate: "B38",
    terminal: "5",
    seat: "8F",
    aircraft: "Boeing 787-9",
    durationMin: 480,
    distanceKm: 5556,
    progress: 0,
    onTimeHistory: 91,
  },
  {
    id: "4",
    flightNumber: "TK 1822",
    airline: "Turkish Airlines",
    airlineCode: "TK",
    from: airports.IST,
    to: airports.CDG,
    scheduledDeparture: inMin(60 * 72),
    departureTime: inMin(60 * 72),
    scheduledArrival: inMin(60 * 72 + 235),
    arrivalTime: inMin(60 * 72 + 235),
    status: "scheduled",
    aircraft: "Airbus A321neo",
    durationMin: 235,
    distanceKm: 2253,
    progress: 0,
    onTimeHistory: 84,
  },
  {
    id: "5",
    flightNumber: "JL 045",
    airline: "Japan Airlines",
    airlineCode: "JL",
    from: airports.HND,
    to: airports.JFK,
    scheduledDeparture: agoMin(60 * 14),
    departureTime: agoMin(60 * 14),
    scheduledArrival: agoMin(60 * 1),
    arrivalTime: agoMin(60 * 1),
    status: "landed",
    aircraft: "Boeing 777-300ER",
    durationMin: 780,
    distanceKm: 10847,
    progress: 1,
    onTimeHistory: 93,
  },
  {
    id: "6",
    flightNumber: "AT 201",
    airline: "Royal Air Maroc",
    airlineCode: "AT",
    from: airports.CMN,
    to: airports.JFK,
    scheduledDeparture: agoMin(60 * 24 * 6),
    departureTime: agoMin(60 * 24 * 6),
    scheduledArrival: agoMin(60 * 24 * 6 - 510),
    arrivalTime: agoMin(60 * 24 * 6 - 510),
    status: "landed",
    aircraft: "Boeing 787-8",
    durationMin: 510,
    distanceKm: 5839,
    progress: 1,
    onTimeHistory: 76,
  },
];

export const nextFlight = flights[0];
export const liveFlight = flights[1];
export const upcomingFlights = flights.filter((f) => ["scheduled", "boarding", "in_air"].includes(f.status));
export const pastFlights = flights.filter((f) => f.status === "landed");

export interface AirportService {
  id: string;
  name: string;
  category: "lounges" | "dining" | "shopping" | "assistance" | "wellness";
  terminal: string;
  walkMin: number;
  rating: number;
  open: boolean;
  description: string;
  hours: string;
  airport?: TunisianAirportCode;
}

// ── Tunisian airports — single source of truth via shared-core (import at top) ──

/** Union type derived from the canonical airport code list */
export type TunisianAirportCode = typeof TUNISIAN_AIRPORT_CODES[number];

/** Re-export in the shape previously consumed by AirportService.airport */
export const tunisianAirports = TUNISIAN_AIRPORTS.map(a => ({
  code: a.code as TunisianAirportCode,
  name: a.name,
  city: a.city,
  region: a.region,
  terminals: a.code === 'TUN' ? 2 : 1,
  iata: a.iata,
}));


export const services: AirportService[] = [
  { id: "s1", name: "Air France Business Lounge", category: "lounges", terminal: "2E - K", walkMin: 4, rating: 4.7, open: true, description: "Premium quiet zone with showers, dining and runway views.", hours: "05:00 — 23:30" },
  { id: "s2", name: "La Maison Ladurée", category: "dining", terminal: "2E", walkMin: 6, rating: 4.5, open: true, description: "Signature macarons, pastries and Parisian café.", hours: "06:00 — 22:00" },
  { id: "s3", name: "Hermès Boutique", category: "shopping", terminal: "2E - K", walkMin: 3, rating: 4.8, open: true, description: "Travel essentials, silks and leather goods.", hours: "07:00 — 22:00" },
  { id: "s4", name: "Mobility Assistance Desk", category: "assistance", terminal: "All terminals", walkMin: 2, rating: 4.9, open: true, description: "Reduced mobility, family and unaccompanied minors.", hours: "24h" },
  { id: "s5", name: "Be Relax Spa", category: "wellness", terminal: "2E", walkMin: 8, rating: 4.4, open: true, description: "Massages, manicures and quick recovery treatments.", hours: "06:30 — 21:30" },
  { id: "s6", name: "Le Café Pierre Hermé", category: "dining", terminal: "2F", walkMin: 11, rating: 4.6, open: true, description: "Pastries, sandwiches and specialty coffee.", hours: "05:30 — 22:00" },
  { id: "s7", name: "Star Alliance Lounge", category: "lounges", terminal: "1", walkMin: 18, rating: 4.3, open: false, description: "Reopens at 06:00 — international business travellers.", hours: "06:00 — 23:00" },
  { id: "s8", name: "Duty Free Paris", category: "shopping", terminal: "2E", walkMin: 5, rating: 4.4, open: true, description: "Fragrances, fashion and tax-free essentials.", hours: "06:00 — 22:30" },
];

// Real-world inspired services for Tunisian airports
export const tunisianServices: AirportService[] = [
  // TUN — Tunis–Carthage
  { id: "tun-1", airport: "TUN", name: "Salon VIP Carthage", category: "lounges", terminal: "T1", walkMin: 5, rating: 4.6, open: true, description: "Premium lounge with Mediterranean buffet, showers and runway views.", hours: "05:00 — 23:30" },
  { id: "tun-2", airport: "TUN", name: "Café El Medina", category: "dining", terminal: "T1 — Departures", walkMin: 4, rating: 4.4, open: true, description: "Tunisian coffee, mint tea and traditional pastries.", hours: "05:00 — 22:30" },
  { id: "tun-3", airport: "TUN", name: "Tunisia Duty Free", category: "shopping", terminal: "T1 — Airside", walkMin: 3, rating: 4.5, open: true, description: "Olive oil, dates, perfumes and tax-free essentials.", hours: "06:00 — 23:00" },
  { id: "tun-4", airport: "TUN", name: "PRM Assistance Desk", category: "assistance", terminal: "All terminals", walkMin: 2, rating: 4.8, open: true, description: "Reduced mobility, families and unaccompanied minors.", hours: "24h" },
  { id: "tun-5", airport: "TUN", name: "Hammam Relax Lounge", category: "wellness", terminal: "T1", walkMin: 7, rating: 4.3, open: true, description: "Quick massages and quiet recovery space before long flights.", hours: "07:00 — 21:00" },
  { id: "tun-6", airport: "TUN", name: "Brioche Dorée", category: "dining", terminal: "T2", walkMin: 9, rating: 4.2, open: true, description: "French bakery with sandwiches, salads and pastries.", hours: "05:30 — 22:00" },

  // MIR — Monastir
  { id: "mir-1", airport: "MIR", name: "Bourguiba Lounge", category: "lounges", terminal: "Main", walkMin: 4, rating: 4.3, open: true, description: "Calm lounge with snacks, Wi-Fi and panoramic apron views.", hours: "06:00 — 22:00" },
  { id: "mir-2", airport: "MIR", name: "Sahel Café", category: "dining", terminal: "Departures", walkMin: 3, rating: 4.1, open: true, description: "Local coffee, fresh juice and quick Mediterranean bites.", hours: "05:30 — 21:30" },
  { id: "mir-3", airport: "MIR", name: "Monastir Duty Free", category: "shopping", terminal: "Airside", walkMin: 4, rating: 4.2, open: true, description: "Cosmetics, spirits, regional crafts and souvenirs.", hours: "06:00 — 22:30" },
  { id: "mir-4", airport: "MIR", name: "Family Assistance Point", category: "assistance", terminal: "Main", walkMin: 2, rating: 4.7, open: true, description: "Help for families, PRM and tour group coordination.", hours: "05:00 — 23:00" },
  { id: "mir-5", airport: "MIR", name: "Quiet Wellness Corner", category: "wellness", terminal: "Departures", walkMin: 6, rating: 4.0, open: false, description: "Reopens at 06:00 — meditation pods and chair massages.", hours: "06:00 — 21:00" },

  // NBE — Enfidha–Hammamet
  { id: "nbe-1", airport: "NBE", name: "Hammamet Premium Lounge", category: "lounges", terminal: "Main", walkMin: 6, rating: 4.5, open: true, description: "Spacious lounge with hot buffet, beverages and shower suites.", hours: "05:00 — 23:00" },
  { id: "nbe-2", airport: "NBE", name: "Bistro Enfidha", category: "dining", terminal: "Departures", walkMin: 4, rating: 4.3, open: true, description: "Tunisian and international menu with sea-view seating.", hours: "05:30 — 22:30" },
  { id: "nbe-3", airport: "NBE", name: "Enfidha Duty Free", category: "shopping", terminal: "Airside", walkMin: 5, rating: 4.4, open: true, description: "Large duty-free with fashion, fragrances and local artisanry.", hours: "06:00 — 23:00" },
  { id: "nbe-4", airport: "NBE", name: "Special Assistance Desk", category: "assistance", terminal: "All zones", walkMin: 3, rating: 4.6, open: true, description: "PRM, medical assistance and family lanes.", hours: "24h" },
  { id: "nbe-5", airport: "NBE", name: "Olive Spa", category: "wellness", terminal: "Departures", walkMin: 8, rating: 4.4, open: true, description: "Olive-oil based treatments and express massages.", hours: "07:00 — 21:30" },
  { id: "nbe-6", airport: "NBE", name: "Costa Coffee", category: "dining", terminal: "Main", walkMin: 5, rating: 4.2, open: true, description: "Specialty coffee, sandwiches and grab-and-go.", hours: "05:00 — 22:00" },

  // DJE — Djerba–Zarzis
  { id: "dje-1", airport: "DJE", name: "Djerba Island Lounge", category: "lounges", terminal: "Main", walkMin: 5, rating: 4.4, open: true, description: "Island-themed lounge with light meals, juices and Wi-Fi.", hours: "06:00 — 22:30" },
  { id: "dje-2", airport: "DJE", name: "Restaurant La Médina", category: "dining", terminal: "Departures", walkMin: 4, rating: 4.3, open: true, description: "Couscous, brik and seafood specialties from the south.", hours: "06:00 — 22:00" },
  { id: "dje-3", airport: "DJE", name: "Djerba Duty Free", category: "shopping", terminal: "Airside", walkMin: 3, rating: 4.2, open: true, description: "Local pottery, jewelry, dates and fragrances.", hours: "06:00 — 22:30" },
  { id: "dje-4", airport: "DJE", name: "PRM & Family Help", category: "assistance", terminal: "Main", walkMin: 2, rating: 4.7, open: true, description: "Reduced-mobility assistance and family services.", hours: "05:30 — 23:00" },
  { id: "dje-5", airport: "DJE", name: "Zen Wellness Pod", category: "wellness", terminal: "Departures", walkMin: 7, rating: 4.1, open: true, description: "Quiet recovery pods and quick neck/shoulder massages.", hours: "07:00 — 21:00" },
];

export type NotifKind = "boarding" | "delay" | "gate" | "service" | "info";
export interface AppNotification {
  id: string;
  kind: NotifKind;
  title: string;
  message: string;
  minutesAgo: number;
  unread: boolean;
  flight?: string;
}

export const notifications: AppNotification[] = [
  { id: "n1", kind: "boarding", title: "Boarding has started", message: "Flight AF 1681 is boarding at gate K42.", minutesAgo: 2, unread: true, flight: "AF 1681" },
  { id: "n2", kind: "gate", title: "Gate change", message: "EK 203 gate changed to A12.", minutesAgo: 14, unread: true, flight: "EK 203" },
  { id: "n3", kind: "delay", title: "Slight delay", message: "EK 203 arrival pushed by 15 minutes due to headwinds.", minutesAgo: 32, unread: true, flight: "EK 203" },
  { id: "n4", kind: "service", title: "Lounge access ready", message: "Your Air France Business Lounge pass is active.", minutesAgo: 65, unread: false },
  { id: "n5", kind: "info", title: "Weather update", message: "Light rain expected on arrival in New York.", minutesAgo: 120, unread: false },
  { id: "n6", kind: "boarding", title: "Boarding completed", message: "JL 045 has landed at JFK on time.", minutesAgo: 240, unread: false, flight: "JL 045" },
];

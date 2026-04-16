/**
 * API Service – connects to FastAPI backend.
 * Falls back to mock data when backend is unavailable.
 */

const API_BASE = '/api';

// ── Mock data for standalone frontend demo ───────────
// Tunis–Carthage International Airport (TUN) as hub
// Airport definitions – all 36+ origins that serve TUN on Feb 15, 2026
const TUN = { id: 1, iata_code: 'TUN', name: 'Tunis–Carthage Intl', city: 'Tunis', country: 'Tunisia', region: 'AF' };
const CDG = { id: 2, iata_code: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France', region: 'EU' };
const ORY = { id: 3, iata_code: 'ORY', name: 'Paris-Orly', city: 'Paris', country: 'France', region: 'EU' };
const IST = { id: 4, iata_code: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', region: 'EU' };
const FCO = { id: 5, iata_code: 'FCO', name: 'Fiumicino', city: 'Rome', country: 'Italy', region: 'EU' };
const FRA = { id: 6, iata_code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', region: 'EU' };
const LHR = { id: 7, iata_code: 'LHR', name: 'London Heathrow', city: 'London', country: 'United Kingdom', region: 'EU' };
const MRS = { id: 8, iata_code: 'MRS', name: 'Marseille Provence', city: 'Marseille', country: 'France', region: 'EU' };
const LYS = { id: 9, iata_code: 'LYS', name: 'Lyon-Saint Exupéry', city: 'Lyon', country: 'France', region: 'EU' };
const DJE = { id: 10, iata_code: 'DJE', name: 'Djerba–Zarzis Intl', city: 'Djerba', country: 'Tunisia', region: 'AF' };
const ALG = { id: 11, iata_code: 'ALG', name: 'Houari Boumediene', city: 'Algiers', country: 'Algeria', region: 'AF' };
const JED = { id: 12, iata_code: 'JED', name: 'King Abdulaziz Intl', city: 'Jeddah', country: 'Saudi Arabia', region: 'GCC' };
const MXP = { id: 13, iata_code: 'MXP', name: 'Milano Malpensa', city: 'Milan', country: 'Italy', region: 'EU' };
const BRU = { id: 14, iata_code: 'BRU', name: 'Brussels Airport', city: 'Brussels', country: 'Belgium', region: 'EU' };
const CAI = { id: 15, iata_code: 'CAI', name: 'Cairo Intl', city: 'Cairo', country: 'Egypt', region: 'AF' };
const MIR = { id: 16, iata_code: 'MIR', name: 'Monastir Habib Bourguiba', city: 'Monastir', country: 'Tunisia', region: 'AF' };
// New airports from real Feb 15, 2026 data
const DOH = { id: 17, iata_code: 'DOH', name: 'Hamad Intl', city: 'Doha', country: 'Qatar', region: 'GCC' };
const DXB = { id: 18, iata_code: 'DXB', name: 'Dubai Intl', city: 'Dubai', country: 'UAE', region: 'GCC' };
const AMM = { id: 19, iata_code: 'AMM', name: 'Queen Alia Intl', city: 'Amman', country: 'Jordan', region: 'ME' };
const CMN = { id: 20, iata_code: 'CMN', name: 'Mohammed V Intl', city: 'Casablanca', country: 'Morocco', region: 'AF' };
const RBA = { id: 21, iata_code: 'RBA', name: 'Rabat–Salé', city: 'Rabat', country: 'Morocco', region: 'AF' };
const MLA = { id: 22, iata_code: 'MLA', name: 'Malta Intl', city: 'Valletta', country: 'Malta', region: 'EU' };
const BEN = { id: 23, iata_code: 'BEN', name: 'Benina Intl', city: 'Benghazi', country: 'Libya', region: 'AF' };
const MJI = { id: 24, iata_code: 'MJI', name: 'Mitiga Intl', city: 'Tripoli', country: 'Libya', region: 'AF' };
const MRA = { id: 25, iata_code: 'MRA', name: 'Misrata Airport', city: 'Misrata', country: 'Libya', region: 'AF' };
const DUS = { id: 26, iata_code: 'DUS', name: 'Düsseldorf Airport', city: 'Düsseldorf', country: 'Germany', region: 'EU' };
const MUC = { id: 27, iata_code: 'MUC', name: 'Franz Josef Strauss', city: 'Munich', country: 'Germany', region: 'EU' };
const VIE = { id: 28, iata_code: 'VIE', name: 'Vienna Intl', city: 'Vienna', country: 'Austria', region: 'EU' };
const NCE = { id: 29, iata_code: 'NCE', name: 'Nice Côte d\'Azur', city: 'Nice', country: 'France', region: 'EU' };
const TLS = { id: 30, iata_code: 'TLS', name: 'Toulouse-Blagnac', city: 'Toulouse', country: 'France', region: 'EU' };
const GVA = { id: 31, iata_code: 'GVA', name: 'Geneva Airport', city: 'Geneva', country: 'Switzerland', region: 'EU' };
const MAD = { id: 32, iata_code: 'MAD', name: 'Adolfo Suárez Madrid-Barajas', city: 'Madrid', country: 'Spain', region: 'EU' };
const ABJ = { id: 33, iata_code: 'ABJ', name: 'Félix-Houphouët-Boigny', city: 'Abidjan', country: 'Côte d\'Ivoire', region: 'AF' };
const NIM = { id: 34, iata_code: 'NIM', name: 'Diori Hamani Intl', city: 'Niamey', country: 'Niger', region: 'AF' };
const CKY = { id: 35, iata_code: 'CKY', name: 'Conakry Intl', city: 'Conakry', country: 'Guinea', region: 'AF' };
const DSS = { id: 36, iata_code: 'DSS', name: 'Blaise Diagne Intl', city: 'Dakar (Diass)', country: 'Senegal', region: 'AF' };
const NBE = { id: 41, iata_code: 'NBE', name: 'Enfidha–Hammamet Intl', city: 'Enfidha', country: 'Tunisia', region: 'AF' };
const CTA = { id: 38, iata_code: 'CTA', name: 'Catania-Fontanarossa', city: 'Catania', country: 'Italy', region: 'EU' };
const YUL = { id: 39, iata_code: 'YUL', name: 'Montréal-Trudeau', city: 'Montreal', country: 'Canada', region: 'NA' };
const LIN = { id: 40, iata_code: 'LIN', name: 'Milano Linate', city: 'Milan', country: 'Italy', region: 'EU' };

const MOCK_FLIGHTS = [
  {
    id: 1, flight_number: 'TU720', status: 'on_time', delay_minutes: 0, distance_km: 1490,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T06:30:00', scheduled_arrival: '2026-02-15T09:00:00',
    actual_departure: '2026-02-15T06:28:00', actual_arrival: '2026-02-15T08:55:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: TUN, dest_airport: CDG,
  },
  {
    id: 2, flight_number: 'TU216', status: 'delayed', delay_minutes: 95, distance_km: 610,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T08:00:00', scheduled_arrival: '2026-02-15T09:40:00',
    actual_departure: '2026-02-15T09:35:00', actual_arrival: '2026-02-15T11:15:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: TUN, dest_airport: FCO,
    delay_cause: {
      icon: '🔧', title: 'Maintenance Check Extended',
      summary: 'A routine overnight maintenance check at Tunis–Carthage identified a hydraulic component requiring replacement. The engineering team completed the repair to ensure full compliance with safety standards before departure.',
      passenger_tip: 'Tunisair is providing complimentary refreshments at the gate. Visit the Tunisair desk for meal vouchers.'
    },
  },
  {
    id: 3, flight_number: 'AF1395', status: 'on_time', delay_minutes: 0, distance_km: 1490,
    aircraft_type: 'A321',
    scheduled_departure: '2026-02-15T10:15:00', scheduled_arrival: '2026-02-15T12:45:00',
    actual_departure: '2026-02-15T10:18:00', actual_arrival: '2026-02-15T12:50:00',
    airline: { id: 2, iata_code: 'AF', name: 'Air France', reliability_score: 0.78 },
    origin_airport: CDG, dest_airport: TUN,
  },
  {
    id: 4, flight_number: 'TK693', status: 'delayed', delay_minutes: 55, distance_km: 1580,
    aircraft_type: 'B737',
    scheduled_departure: '2026-02-15T14:30:00', scheduled_arrival: '2026-02-15T18:00:00',
    actual_departure: '2026-02-15T15:25:00', actual_arrival: '2026-02-15T18:55:00',
    airline: { id: 3, iata_code: 'TK', name: 'Turkish Airlines', reliability_score: 0.77 },
    origin_airport: IST, dest_airport: TUN,
    delay_cause: {
      icon: '🏢', title: 'High Traffic at Istanbul Airport',
      summary: 'Istanbul Airport is experiencing peak afternoon traffic with over 50 departures scheduled in the same window. Your flight was assigned a delayed departure slot by air traffic control.',
      passenger_tip: 'Turkish Airlines is providing light snacks at the gate. If you have a connecting flight, visit the transfer desk.'
    },
  },
  {
    id: 5, flight_number: 'TU724', status: 'delayed', delay_minutes: 120, distance_km: 1490,
    aircraft_type: 'A319',
    scheduled_departure: '2026-02-15T07:00:00', scheduled_arrival: '2026-02-15T09:30:00',
    actual_departure: '2026-02-15T09:00:00', actual_arrival: '2026-02-15T11:30:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: TUN, dest_airport: ORY,
    delay_cause: {
      icon: '🌫️', title: 'Morning Fog at Tunis–Carthage',
      summary: 'Dense morning fog reduced visibility at Tunis-Carthage airport to below safe operating limits. Air traffic control temporarily suspended departures until conditions cleared around 08:45.',
      passenger_tip: 'With a 2-hour delay, Tunisair must provide free refreshments under international regulations. Ask at gate desk.'
    },
  },
  {
    id: 6, flight_number: 'BJ502', status: 'on_time', delay_minutes: 0, distance_km: 720,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T09:30:00', scheduled_arrival: '2026-02-15T11:45:00',
    actual_departure: '2026-02-15T09:35:00', actual_arrival: '2026-02-15T11:50:00',
    airline: { id: 4, iata_code: 'BJ', name: 'Nouvelair', reliability_score: 0.73 },
    origin_airport: TUN, dest_airport: MRS,
  },
  {
    id: 7, flight_number: 'LH1334', status: 'delayed', delay_minutes: 40, distance_km: 1510,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T13:00:00', scheduled_arrival: '2026-02-15T15:40:00',
    actual_departure: '2026-02-15T13:40:00', actual_arrival: '2026-02-15T16:20:00',
    airline: { id: 5, iata_code: 'LH', name: 'Lufthansa', reliability_score: 0.80 },
    origin_airport: FRA, dest_airport: TUN,
    delay_cause: {
      icon: '✈️', title: 'Late Incoming Aircraft',
      summary: 'The aircraft assigned to this flight arrived late from its previous leg (Munich → Frankfurt) due to a runway inspection delay at Munich. Standard turnaround procedures had to be completed before boarding.',
      passenger_tip: 'Lufthansa is offering complimentary Wi-Fi and refreshments at the gate during the wait.'
    },
  },
  {
    id: 8, flight_number: 'TU250', status: 'on_time', delay_minutes: 0, distance_km: 290,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T16:00:00', scheduled_arrival: '2026-02-15T17:00:00',
    actual_departure: '2026-02-15T16:05:00', actual_arrival: '2026-02-15T17:05:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: TUN, dest_airport: DJE,
  },
  // ── Flights with 3+ hour delays ────────────────────
  {
    id: 9, flight_number: 'TU722', status: 'delayed', delay_minutes: 210, distance_km: 1490,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T11:00:00', scheduled_arrival: '2026-02-15T13:30:00',
    actual_departure: '2026-02-15T14:30:00', actual_arrival: '2026-02-15T17:00:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: TUN, dest_airport: CDG,
    delay_cause: {
      icon: '👨‍✈️', title: 'Crew Availability Issue',
      summary: 'The original flight crew exceeded their maximum legal duty hours due to a delayed inbound flight from Djerba. A replacement crew had to be called in, requiring additional time for travel to the airport and mandatory safety briefings.',
      passenger_tip: 'As this is an airline-caused delay over 3 hours, you are entitled to compensation. Tunisair must provide meals, refreshments, and 2 phone calls. Visit the Tunisair assistance desk at Gate 12.'
    },
  },
  {
    id: 10, flight_number: 'AF1397', status: 'delayed', delay_minutes: 245, distance_km: 1490,
    aircraft_type: 'A321',
    scheduled_departure: '2026-02-15T14:00:00', scheduled_arrival: '2026-02-15T16:30:00',
    actual_departure: '2026-02-15T18:05:00', actual_arrival: '2026-02-15T20:35:00',
    airline: { id: 2, iata_code: 'AF', name: 'Air France', reliability_score: 0.78 },
    origin_airport: CDG, dest_airport: TUN,
    delay_cause: {
      icon: '⛈️', title: 'Severe Thunderstorm Over France',
      summary: 'A large thunderstorm system with hail and lightning over southern France forced Eurocontrol to temporarily close the Mediterranean air corridor. All flights to North Africa were delayed until the storm system passed.',
      passenger_tip: 'This is a weather delay (extraordinary circumstance), so EC 261/2004 financial compensation may not apply. However, Air France must still provide meals, refreshments, and hotel accommodation if needed. Visit the AF desk in Terminal 2F.'
    },
  },
  {
    id: 11, flight_number: 'TU312', status: 'delayed', delay_minutes: 195, distance_km: 1210,
    aircraft_type: 'A319',
    scheduled_departure: '2026-02-15T08:30:00', scheduled_arrival: '2026-02-15T10:50:00',
    actual_departure: '2026-02-15T11:45:00', actual_arrival: '2026-02-15T14:05:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: TUN, dest_airport: LYS,
    delay_cause: {
      icon: '🛠️', title: 'Technical Issue — Aircraft Substitution',
      summary: 'An alert triggered during the pre-flight check required a thorough inspection of the landing gear system. For passenger safety, Tunisair decided to swap to a replacement aircraft which needed preparation, crew re-briefing, and passenger re-boarding.',
      passenger_tip: 'Since this is a technical (airline-caused) delay over 3 hours, you may be entitled to compensation. Tunisair must provide meals and refreshments. Ask at the Tunisair service counter.'
    },
  },
  {
    id: 12, flight_number: 'TK694', status: 'delayed', delay_minutes: 280, distance_km: 1580,
    aircraft_type: 'B737',
    scheduled_departure: '2026-02-15T19:00:00', scheduled_arrival: '2026-02-15T22:30:00',
    actual_departure: '2026-02-15T23:40:00', actual_arrival: '2026-02-16T03:10:00',
    airline: { id: 3, iata_code: 'TK', name: 'Turkish Airlines', reliability_score: 0.77 },
    origin_airport: TUN, dest_airport: IST,
    delay_cause: {
      icon: '🗼', title: 'Air Traffic Control Strike in Europe',
      summary: 'A partial ATC strike in several European countries created major disruptions to Mediterranean flight corridors. Air traffic controllers imposed severe flow restrictions, giving flights extended departure slots. The Tunis–Istanbul route was heavily impacted.',
      passenger_tip: 'Turkish Airlines will provide meal vouchers and, if delayed overnight, hotel accommodation and transport. If the delay causes you to miss a connection in Istanbul, Turkish Airlines must rebook you on the next available flight at no cost.'
    },
  },
  {
    id: 13, flight_number: 'SV554', status: 'delayed', delay_minutes: 200, distance_km: 3680,
    aircraft_type: 'A330',
    scheduled_departure: '2026-02-15T22:00:00', scheduled_arrival: '2026-02-16T04:20:00',
    actual_departure: '2026-02-16T01:20:00', actual_arrival: '2026-02-16T07:40:00',
    airline: { id: 6, iata_code: 'SV', name: 'Saudia', reliability_score: 0.75 },
    origin_airport: TUN, dest_airport: JED,
    delay_cause: {
      icon: '🏜️', title: 'Sandstorm Alert at Jeddah',
      summary: 'King Abdulaziz International Airport in Jeddah issued a sandstorm warning, temporarily suspending inbound arrivals. The Tunis departure was held until Jeddah controllers confirmed safe landing conditions had resumed.',
      passenger_tip: 'Saudia is providing complimentary lounge access and meal vouchers. As sandstorms are classified as extraordinary circumstances, financial compensation may not apply, but duty of care (meals, drinks, accommodation) is mandatory.'
    },
  },
  {
    id: 14, flight_number: 'BJ580', status: 'delayed', delay_minutes: 185, distance_km: 1860,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T10:30:00', scheduled_arrival: '2026-02-15T13:15:00',
    actual_departure: '2026-02-15T13:35:00', actual_arrival: '2026-02-15T16:20:00',
    airline: { id: 4, iata_code: 'BJ', name: 'Nouvelair', reliability_score: 0.73 },
    origin_airport: TUN, dest_airport: LHR,
    delay_cause: {
      icon: '🌧️', title: 'Heavy Rain & Wind at London Heathrow',
      summary: 'Strong crosswinds and persistent heavy rain at Heathrow reduced runway capacity. Air traffic control restricted inbound flights, and your departure from Tunis was held until a landing slot was confirmed at Heathrow.',
      passenger_tip: 'Nouvelair must provide meals and refreshments. With a delay over 3 hours, you may also be entitled to compensation. Contact the Nouvelair desk at Gate 8.'
    },
  },
  {
    id: 15, flight_number: 'TU470', status: 'on_time', delay_minutes: 0, distance_km: 630,
    aircraft_type: 'A319',
    scheduled_departure: '2026-02-15T17:30:00', scheduled_arrival: '2026-02-15T19:00:00',
    actual_departure: '2026-02-15T17:35:00', actual_arrival: '2026-02-15T19:05:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: TUN, dest_airport: ALG,
  },
  {
    id: 16, flight_number: 'TO3442', status: 'delayed', delay_minutes: 240, distance_km: 1430,
    aircraft_type: 'B737',
    scheduled_departure: '2026-02-15T12:00:00', scheduled_arrival: '2026-02-15T14:20:00',
    actual_departure: '2026-02-15T16:00:00', actual_arrival: '2026-02-15T18:20:00',
    airline: { id: 7, iata_code: 'TO', name: 'Transavia France', reliability_score: 0.72 },
    origin_airport: ORY, dest_airport: TUN,
    delay_cause: {
      icon: '⚡', title: 'Lightning Strike on Previous Flight',
      summary: 'The aircraft was hit by lightning during its previous approach to Paris-Orly. Although modern aircraft are designed to withstand lightning, regulations require a full post-strike inspection by certified engineers before the plane can fly again.',
      passenger_tip: 'Under EC 261/2004, you are entitled to €250 compensation, plus free meals and refreshments. Transavia must also offer hotel accommodation if this causes an overnight delay. Visit the Transavia desk at Orly Terminal 1.'
    },
  },
  // ── Additional flights – all 20 airlines operating Feb 15, 2026 ──
  {
    id: 17, flight_number: 'EK747', status: 'on_time', delay_minutes: 0, distance_km: 5750,
    aircraft_type: 'B777',
    scheduled_departure: '2026-02-15T03:00:00', scheduled_arrival: '2026-02-15T08:15:00',
    actual_departure: '2026-02-15T03:05:00', actual_arrival: '2026-02-15T08:10:00',
    airline: { id: 8, iata_code: 'EK', name: 'Emirates', reliability_score: 0.86 },
    origin_airport: DXB, dest_airport: TUN,
  },
  {
    id: 18, flight_number: 'QR1399', status: 'on_time', delay_minutes: 0, distance_km: 4380,
    aircraft_type: 'A350',
    scheduled_departure: '2026-02-15T01:30:00', scheduled_arrival: '2026-02-15T07:00:00',
    actual_departure: '2026-02-15T01:35:00', actual_arrival: '2026-02-15T07:05:00',
    airline: { id: 9, iata_code: 'QR', name: 'Qatar Airways', reliability_score: 0.88 },
    origin_airport: DOH, dest_airport: TUN,
  },
  {
    id: 19, flight_number: 'RJ140', status: 'delayed', delay_minutes: 45, distance_km: 2290,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T11:00:00', scheduled_arrival: '2026-02-15T14:00:00',
    actual_departure: '2026-02-15T11:45:00', actual_arrival: '2026-02-15T14:45:00',
    airline: { id: 10, iata_code: 'RJ', name: 'Royal Jordanian', reliability_score: 0.74 },
    origin_airport: AMM, dest_airport: TUN,
    delay_cause: {
      icon: '🏢', title: 'Congestion at Amman Airport',
      summary: 'Queen Alia International Airport experienced high traffic volume during the morning peak. The flight received a delayed departure slot from ATC.',
      passenger_tip: 'Royal Jordanian is offering refreshments at the gate during the wait.'
    },
  },
  {
    id: 20, flight_number: 'AT730', status: 'on_time', delay_minutes: 0, distance_km: 1570,
    aircraft_type: 'B737',
    scheduled_departure: '2026-02-15T09:00:00', scheduled_arrival: '2026-02-15T12:00:00',
    actual_departure: '2026-02-15T09:05:00', actual_arrival: '2026-02-15T12:05:00',
    airline: { id: 11, iata_code: 'AT', name: 'Royal Air Maroc', reliability_score: 0.74 },
    origin_airport: CMN, dest_airport: TUN,
  },
  {
    id: 21, flight_number: 'MS843', status: 'on_time', delay_minutes: 0, distance_km: 2140,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T06:00:00', scheduled_arrival: '2026-02-15T08:30:00',
    actual_departure: '2026-02-15T06:10:00', actual_arrival: '2026-02-15T08:35:00',
    airline: { id: 12, iata_code: 'MS', name: 'EgyptAir', reliability_score: 0.73 },
    origin_airport: CAI, dest_airport: TUN,
  },
  {
    id: 22, flight_number: 'AH2010', status: 'on_time', delay_minutes: 0, distance_km: 630,
    aircraft_type: 'A330',
    scheduled_departure: '2026-02-15T14:00:00', scheduled_arrival: '2026-02-15T15:30:00',
    actual_departure: '2026-02-15T14:10:00', actual_arrival: '2026-02-15T15:35:00',
    airline: { id: 13, iata_code: 'AH', name: 'Air Algérie', reliability_score: 0.70 },
    origin_airport: ALG, dest_airport: TUN,
  },
  {
    id: 23, flight_number: 'NB301', status: 'delayed', delay_minutes: 75, distance_km: 910,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T10:30:00', scheduled_arrival: '2026-02-15T12:30:00',
    actual_departure: '2026-02-15T11:45:00', actual_arrival: '2026-02-15T13:45:00',
    airline: { id: 14, iata_code: 'NB', name: 'Berniq Airways', reliability_score: 0.65 },
    origin_airport: BEN, dest_airport: TUN,
    delay_cause: {
      icon: '🛠️', title: 'Ground Equipment Delay at Benghazi',
      summary: 'Ground handling equipment at Benina International was temporarily unavailable, delaying aircraft pushback.',
      passenger_tip: 'Berniq Airways is providing light refreshments during the wait.'
    },
  },
  {
    id: 24, flight_number: 'UZ100', status: 'on_time', delay_minutes: 0, distance_km: 480,
    aircraft_type: 'CRJ900',
    scheduled_departure: '2026-02-15T15:00:00', scheduled_arrival: '2026-02-15T16:30:00',
    actual_departure: '2026-02-15T15:05:00', actual_arrival: '2026-02-15T16:35:00',
    airline: { id: 15, iata_code: 'UZ', name: 'BuraqAir', reliability_score: 0.66 },
    origin_airport: MJI, dest_airport: TUN,
  },
  {
    id: 25, flight_number: 'IZ204', status: 'on_time', delay_minutes: 0, distance_km: 620,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T08:00:00', scheduled_arrival: '2026-02-15T09:20:00',
    actual_departure: '2026-02-15T08:05:00', actual_arrival: '2026-02-15T09:25:00',
    airline: { id: 16, iata_code: 'IZ', name: 'Italia Trasporto Aereo', reliability_score: 0.73 },
    origin_airport: FCO, dest_airport: TUN,
  },
  {
    id: 26, flight_number: 'LW220', status: 'delayed', delay_minutes: 50, distance_km: 530,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T12:00:00', scheduled_arrival: '2026-02-15T13:15:00',
    actual_departure: '2026-02-15T12:50:00', actual_arrival: '2026-02-15T14:05:00',
    airline: { id: 17, iata_code: 'LW', name: 'Libyan Wings', reliability_score: 0.63 },
    origin_airport: MRA, dest_airport: TUN,
    delay_cause: {
      icon: '🔧', title: 'Minor Technical Inspection',
      summary: 'A precautionary check was performed following a cockpit indicator warning. Engineers confirmed no issues and cleared the aircraft for departure.',
      passenger_tip: 'Libyan Wings is offering refreshments at the departure gate.'
    },
  },
  {
    id: 27, flight_number: 'MK500', status: 'on_time', delay_minutes: 0, distance_km: 530,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T18:00:00', scheduled_arrival: '2026-02-15T19:15:00',
    actual_departure: '2026-02-15T18:05:00', actual_arrival: '2026-02-15T19:20:00',
    airline: { id: 18, iata_code: 'MK', name: 'Medysky Airways', reliability_score: 0.64 },
    origin_airport: MJI, dest_airport: TUN,
  },
  {
    id: 28, flight_number: 'UG150', status: 'on_time', delay_minutes: 0, distance_km: 290,
    aircraft_type: 'ATR72',
    scheduled_departure: '2026-02-15T07:30:00', scheduled_arrival: '2026-02-15T08:30:00',
    actual_departure: '2026-02-15T07:35:00', actual_arrival: '2026-02-15T08:30:00',
    airline: { id: 19, iata_code: 'UG', name: 'Tunisair Express', reliability_score: 0.69 },
    origin_airport: DJE, dest_airport: TUN,
  },
  {
    id: 30, flight_number: 'LH8374', status: 'on_time', delay_minutes: 0, distance_km: 1510,
    aircraft_type: 'B777F',
    scheduled_departure: '2026-02-15T04:30:00', scheduled_arrival: '2026-02-15T07:00:00',
    actual_departure: '2026-02-15T04:35:00', actual_arrival: '2026-02-15T07:05:00',
    airline: { id: 20, iata_code: 'LH', name: 'Lufthansa Cargo', reliability_score: 0.82 },
    origin_airport: FRA, dest_airport: TUN,
  },
  // ── More arrivals from European cities ──
  {
    id: 31, flight_number: 'TU814', status: 'on_time', delay_minutes: 0, distance_km: 1750,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T10:00:00', scheduled_arrival: '2026-02-15T13:15:00',
    actual_departure: '2026-02-15T10:05:00', actual_arrival: '2026-02-15T13:10:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: BRU, dest_airport: TUN,
  },
  {
    id: 32, flight_number: 'TU860', status: 'delayed', delay_minutes: 30, distance_km: 1980,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T09:30:00', scheduled_arrival: '2026-02-15T12:45:00',
    actual_departure: '2026-02-15T10:00:00', actual_arrival: '2026-02-15T13:15:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: GVA, dest_airport: TUN,
  },
  {
    id: 33, flight_number: 'TU664', status: 'on_time', delay_minutes: 0, distance_km: 850,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T14:30:00', scheduled_arrival: '2026-02-15T17:00:00',
    actual_departure: '2026-02-15T14:35:00', actual_arrival: '2026-02-15T17:05:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: MLA, dest_airport: TUN,
  },
  {
    id: 34, flight_number: 'TU900', status: 'on_time', delay_minutes: 0, distance_km: 7360,
    aircraft_type: 'A330',
    scheduled_departure: '2026-02-14T22:00:00', scheduled_arrival: '2026-02-15T09:30:00',
    actual_departure: '2026-02-14T22:15:00', actual_arrival: '2026-02-15T09:35:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: YUL, dest_airport: TUN,
  },
  {
    id: 35, flight_number: 'TU330', status: 'on_time', delay_minutes: 0, distance_km: 3560,
    aircraft_type: 'A330',
    scheduled_departure: '2026-02-15T00:30:00', scheduled_arrival: '2026-02-15T07:45:00',
    actual_departure: '2026-02-15T00:35:00', actual_arrival: '2026-02-15T07:50:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: ABJ, dest_airport: TUN,
  },
  {
    id: 36, flight_number: 'TU304', status: 'delayed', delay_minutes: 65, distance_km: 3150,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T05:00:00', scheduled_arrival: '2026-02-15T10:30:00',
    actual_departure: '2026-02-15T06:05:00', actual_arrival: '2026-02-15T11:35:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: DSS, dest_airport: TUN,
    delay_cause: {
      icon: '🌧️', title: 'Tropical Rain at Dakar',
      summary: 'Heavy seasonal rainfall at Blaise Diagne Airport reduced visibility below safe departure minimums. The flight waited for conditions to improve.',
      passenger_tip: 'Tunisair is providing complimentary refreshments and meal vouchers at the gate.'
    },
  },
  {
    id: 37, flight_number: 'TU772', status: 'on_time', delay_minutes: 0, distance_km: 1590,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T11:00:00', scheduled_arrival: '2026-02-15T14:50:00',
    actual_departure: '2026-02-15T11:05:00', actual_arrival: '2026-02-15T14:55:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: DUS, dest_airport: TUN,
  },
  {
    id: 38, flight_number: 'BJ670', status: 'on_time', delay_minutes: 0, distance_km: 1650,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T07:00:00', scheduled_arrival: '2026-02-15T09:30:00',
    actual_departure: '2026-02-15T07:05:00', actual_arrival: '2026-02-15T09:35:00',
    airline: { id: 4, iata_code: 'BJ', name: 'Nouvelair', reliability_score: 0.73 },
    origin_airport: NCE, dest_airport: TUN,
  },
  {
    id: 39, flight_number: 'TU780', status: 'on_time', delay_minutes: 0, distance_km: 1060,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T18:30:00', scheduled_arrival: '2026-02-15T21:00:00',
    actual_departure: '2026-02-15T18:35:00', actual_arrival: '2026-02-15T21:05:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: VIE, dest_airport: TUN,
  },
  {
    id: 40, flight_number: 'SV556', status: 'on_time', delay_minutes: 0, distance_km: 3680,
    aircraft_type: 'A330',
    scheduled_departure: '2026-02-15T02:30:00', scheduled_arrival: '2026-02-15T06:45:00',
    actual_departure: '2026-02-15T02:35:00', actual_arrival: '2026-02-15T06:50:00',
    airline: { id: 6, iata_code: 'SV', name: 'Saudia', reliability_score: 0.75 },
    origin_airport: JED, dest_airport: TUN,
  },
  {
    id: 41, flight_number: 'AT734', status: 'on_time', delay_minutes: 0, distance_km: 960,
    aircraft_type: 'B737',
    scheduled_departure: '2026-02-15T16:30:00', scheduled_arrival: '2026-02-15T19:00:00',
    actual_departure: '2026-02-15T16:35:00', actual_arrival: '2026-02-15T19:05:00',
    airline: { id: 11, iata_code: 'AT', name: 'Royal Air Maroc', reliability_score: 0.74 },
    origin_airport: RBA, dest_airport: TUN,
  },
  {
    id: 42, flight_number: 'TU754', status: 'on_time', delay_minutes: 0, distance_km: 1330,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T13:00:00', scheduled_arrival: '2026-02-15T15:15:00',
    actual_departure: '2026-02-15T13:05:00', actual_arrival: '2026-02-15T15:10:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: TLS, dest_airport: TUN,
  },
  {
    id: 43, flight_number: 'TU760', status: 'on_time', delay_minutes: 0, distance_km: 1770,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T15:00:00', scheduled_arrival: '2026-02-15T18:30:00',
    actual_departure: '2026-02-15T15:10:00', actual_arrival: '2026-02-15T18:35:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: MUC, dest_airport: TUN,
  },
  {
    id: 44, flight_number: 'TU792', status: 'on_time', delay_minutes: 0, distance_km: 1420,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T08:30:00', scheduled_arrival: '2026-02-15T11:30:00',
    actual_departure: '2026-02-15T08:35:00', actual_arrival: '2026-02-15T11:35:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: MAD, dest_airport: TUN,
  },
  {
    id: 45, flight_number: 'IZ208', status: 'on_time', delay_minutes: 0, distance_km: 710,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T19:30:00', scheduled_arrival: '2026-02-15T21:00:00',
    actual_departure: '2026-02-15T19:35:00', actual_arrival: '2026-02-15T21:05:00',
    airline: { id: 16, iata_code: 'IZ', name: 'Italia Trasporto Aereo', reliability_score: 0.73 },
    origin_airport: CTA, dest_airport: TUN,
  },
  // ── Cancelled flights ──────────────────────────────
  {
    id: 46, flight_number: 'TU726', status: 'cancelled', delay_minutes: 0, distance_km: 1490,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T15:00:00', scheduled_arrival: '2026-02-15T17:30:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: TUN, dest_airport: CDG,
    delay_cause: {
      icon: '🛠️', title: 'Aircraft Out of Service',
      summary: 'The aircraft scheduled for this flight has been taken out of service for an unplanned engine inspection. No replacement aircraft was available at TUN for this departure window.',
      passenger_tip: 'Under EC 261/2004, you are entitled to a full refund or rebooking on the next available flight, plus up to €400 compensation. Tunisair must also provide meals and phone calls. Visit the Tunisair desk at Gate 15.'
    },
  },
  {
    id: 47, flight_number: 'AF1399', status: 'cancelled', delay_minutes: 0, distance_km: 1490,
    aircraft_type: 'A321',
    scheduled_departure: '2026-02-15T18:30:00', scheduled_arrival: '2026-02-15T21:00:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 2, iata_code: 'AF', name: 'Air France', reliability_score: 0.78 },
    origin_airport: CDG, dest_airport: TUN,
    delay_cause: {
      icon: '⛈️', title: 'Severe Weather — Flight Cancelled',
      summary: 'A large winter storm system over the western Mediterranean with severe turbulence, hail, and heavy icing conditions made the Paris–Tunis corridor unsafe. Air France cancelled this evening departure.',
      passenger_tip: 'Air France must offer rebooking or full refund. As weather is an extraordinary circumstance, financial compensation may not apply, but duty of care (meals, hotel, transport) is mandatory. Visit AF desk in Terminal 2E.'
    },
  },
  {
    id: 48, flight_number: 'BJ504', status: 'cancelled', delay_minutes: 0, distance_km: 1290,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T14:00:00', scheduled_arrival: '2026-02-15T16:15:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 4, iata_code: 'BJ', name: 'Nouvelair', reliability_score: 0.73 },
    origin_airport: TUN, dest_airport: LYS,
    delay_cause: {
      icon: '👨‍✈️', title: 'Crew Shortage',
      summary: 'The operating crew for this flight called in sick and Nouvelair could not arrange a replacement crew within operational time limits. The flight was cancelled.',
      passenger_tip: 'This is an airline responsibility issue. You are entitled to rebooking or full refund plus €250 compensation for this short-haul route. Contact Nouvelair customer service.'
    },
  },
  {
    id: 49, flight_number: 'AH2012', status: 'cancelled', delay_minutes: 0, distance_km: 630,
    aircraft_type: 'A330',
    scheduled_departure: '2026-02-15T20:00:00', scheduled_arrival: '2026-02-15T21:30:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 13, iata_code: 'AH', name: 'Air Algérie', reliability_score: 0.70 },
    origin_airport: ALG, dest_airport: TUN,
    delay_cause: {
      icon: '🌫️', title: 'Fog at Algiers Airport',
      summary: 'Dense evening fog at Houari Boumediene Airport reduced visibility below Category IIIb minimums, forcing the cancellation of all late departures including this flight.',
      passenger_tip: 'Air Algérie must offer rebooking on the next available flight or a full refund. Contact the airline desk at ALG Terminal 1.'
    },
  },
  // ── Boarding flights (currently at gate) ───────────
  {
    id: 50, flight_number: 'TU728', status: 'boarding', delay_minutes: 0, distance_km: 1490,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T18:45:00', scheduled_arrival: '2026-02-15T21:15:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: TUN, dest_airport: ORY,
    gate: 'A12',
  },
  {
    id: 51, flight_number: 'EK748', status: 'boarding', delay_minutes: 0, distance_km: 5750,
    aircraft_type: 'B777',
    scheduled_departure: '2026-02-15T19:00:00', scheduled_arrival: '2026-02-16T03:15:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 8, iata_code: 'EK', name: 'Emirates', reliability_score: 0.86 },
    origin_airport: TUN, dest_airport: DXB,
    gate: 'B04',
  },
  {
    id: 52, flight_number: 'QR1400', status: 'boarding', delay_minutes: 0, distance_km: 4380,
    aircraft_type: 'A350',
    scheduled_departure: '2026-02-15T19:15:00', scheduled_arrival: '2026-02-16T02:30:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 9, iata_code: 'QR', name: 'Qatar Airways', reliability_score: 0.88 },
    origin_airport: TUN, dest_airport: DOH,
    gate: 'B07',
  },
  // ── Past flights (Feb 14) ─────────────────────────
  {
    id: 53, flight_number: 'TU718', status: 'on_time', delay_minutes: 0, distance_km: 1490,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-14T08:00:00', scheduled_arrival: '2026-02-14T10:30:00',
    actual_departure: '2026-02-14T08:05:00', actual_arrival: '2026-02-14T10:35:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: TUN, dest_airport: CDG,
  },
  {
    id: 54, flight_number: 'AF1393', status: 'delayed', delay_minutes: 55, distance_km: 1490,
    aircraft_type: 'A321',
    scheduled_departure: '2026-02-14T14:00:00', scheduled_arrival: '2026-02-14T16:30:00',
    actual_departure: '2026-02-14T14:55:00', actual_arrival: '2026-02-14T17:25:00',
    airline: { id: 2, iata_code: 'AF', name: 'Air France', reliability_score: 0.78 },
    origin_airport: CDG, dest_airport: TUN,
  },
  {
    id: 55, flight_number: 'TK691', status: 'on_time', delay_minutes: 0, distance_km: 1580,
    aircraft_type: 'B737',
    scheduled_departure: '2026-02-14T10:00:00', scheduled_arrival: '2026-02-14T13:30:00',
    actual_departure: '2026-02-14T10:05:00', actual_arrival: '2026-02-14T13:35:00',
    airline: { id: 3, iata_code: 'TK', name: 'Turkish Airlines', reliability_score: 0.77 },
    origin_airport: IST, dest_airport: TUN,
  },
  {
    id: 56, flight_number: 'EK745', status: 'on_time', delay_minutes: 0, distance_km: 5750,
    aircraft_type: 'B777',
    scheduled_departure: '2026-02-14T03:00:00', scheduled_arrival: '2026-02-14T08:15:00',
    actual_departure: '2026-02-14T03:10:00', actual_arrival: '2026-02-14T08:20:00',
    airline: { id: 8, iata_code: 'EK', name: 'Emirates', reliability_score: 0.86 },
    origin_airport: DXB, dest_airport: TUN,
  },
  // ── Future flights (Feb 16) ────────────────────────
  {
    id: 57, flight_number: 'TU730', status: 'scheduled', delay_minutes: 0, distance_km: 1490,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-16T06:30:00', scheduled_arrival: '2026-02-16T09:00:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: TUN, dest_airport: CDG,
  },
  {
    id: 58, flight_number: 'QR1401', status: 'scheduled', delay_minutes: 0, distance_km: 4380,
    aircraft_type: 'A350',
    scheduled_departure: '2026-02-16T01:30:00', scheduled_arrival: '2026-02-16T07:00:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 9, iata_code: 'QR', name: 'Qatar Airways', reliability_score: 0.88 },
    origin_airport: DOH, dest_airport: TUN,
  },
  {
    id: 59, flight_number: 'TK695', status: 'scheduled', delay_minutes: 0, distance_km: 1580,
    aircraft_type: 'B737',
    scheduled_departure: '2026-02-16T14:30:00', scheduled_arrival: '2026-02-16T18:00:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 3, iata_code: 'TK', name: 'Turkish Airlines', reliability_score: 0.77 },
    origin_airport: IST, dest_airport: TUN,
  },
  {
    id: 60, flight_number: 'EK749', status: 'scheduled', delay_minutes: 0, distance_km: 5750,
    aircraft_type: 'B777',
    scheduled_departure: '2026-02-16T03:00:00', scheduled_arrival: '2026-02-16T08:15:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 8, iata_code: 'EK', name: 'Emirates', reliability_score: 0.86 },
    origin_airport: DXB, dest_airport: TUN,
  },
  {
    id: 61, flight_number: 'AT732', status: 'scheduled', delay_minutes: 0, distance_km: 1570,
    aircraft_type: 'B737',
    scheduled_departure: '2026-02-16T09:00:00', scheduled_arrival: '2026-02-16T12:00:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 11, iata_code: 'AT', name: 'Royal Air Maroc', reliability_score: 0.74 },
    origin_airport: CMN, dest_airport: TUN,
  },
  // ═══════════════════════════════════════════════════
  // Flights for other Tunisian airports (Feb 15, 2026)
  // ═══════════════════════════════════════════════════

  // ── DJERBA (DJE) ──────────────────────────────────
  {
    id: 100, flight_number: 'TU152', status: 'on_time', delay_minutes: 0, distance_km: 1620,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T07:00:00', scheduled_arrival: '2026-02-15T09:40:00',
    actual_departure: '2026-02-15T07:05:00', actual_arrival: '2026-02-15T09:45:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: DJE, dest_airport: CDG,
  },
  {
    id: 101, flight_number: 'BJ610', status: 'delayed', delay_minutes: 65, distance_km: 890,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T09:30:00', scheduled_arrival: '2026-02-15T11:30:00',
    actual_departure: '2026-02-15T10:35:00', actual_arrival: '2026-02-15T12:35:00',
    airline: { id: 4, iata_code: 'BJ', name: 'Nouvelair', reliability_score: 0.73 },
    origin_airport: DJE, dest_airport: MRS,
    delay_cause: {
      icon: '🛠️', title: 'Ground Equipment Delay',
      summary: 'A baggage handling equipment malfunction at Djerba–Zarzis caused a delay in loading passenger luggage.',
      passenger_tip: 'Nouvelair is providing refreshments at the gate during the wait.'
    },
  },
  {
    id: 102, flight_number: 'TO3450', status: 'on_time', delay_minutes: 0, distance_km: 1540,
    aircraft_type: 'B737',
    scheduled_departure: '2026-02-15T11:00:00', scheduled_arrival: '2026-02-15T13:30:00',
    actual_departure: '2026-02-15T11:05:00', actual_arrival: '2026-02-15T13:35:00',
    airline: { id: 7, iata_code: 'TO', name: 'Transavia France', reliability_score: 0.72 },
    origin_airport: ORY, dest_airport: DJE,
  },
  {
    id: 103, flight_number: 'TU154', status: 'on_time', delay_minutes: 0, distance_km: 1620,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T15:00:00', scheduled_arrival: '2026-02-15T17:40:00',
    actual_departure: '2026-02-15T15:10:00', actual_arrival: '2026-02-15T17:50:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: DJE, dest_airport: ORY,
  },
  {
    id: 104, flight_number: 'UG152', status: 'on_time', delay_minutes: 0, distance_km: 290,
    aircraft_type: 'ATR72',
    scheduled_departure: '2026-02-15T18:00:00', scheduled_arrival: '2026-02-15T19:00:00',
    actual_departure: '2026-02-15T18:05:00', actual_arrival: '2026-02-15T19:05:00',
    airline: { id: 19, iata_code: 'UG', name: 'Tunisair Express', reliability_score: 0.69 },
    origin_airport: TUN, dest_airport: DJE,
  },
  {
    id: 105, flight_number: 'LH1340', status: 'on_time', delay_minutes: 0, distance_km: 1680,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T13:30:00', scheduled_arrival: '2026-02-15T16:00:00',
    actual_departure: '2026-02-15T13:35:00', actual_arrival: '2026-02-15T16:05:00',
    airline: { id: 5, iata_code: 'LH', name: 'Lufthansa', reliability_score: 0.80 },
    origin_airport: FRA, dest_airport: DJE,
  },
  {
    id: 106, flight_number: 'TU156', status: 'boarding', delay_minutes: 0, distance_km: 620,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T19:30:00', scheduled_arrival: '2026-02-15T21:00:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: DJE, dest_airport: FCO,
    gate: 'A3',
  },

  // ── ENFIDHA (NBE) ─────────────────────────────────
  {
    id: 110, flight_number: 'BJ620', status: 'on_time', delay_minutes: 0, distance_km: 1510,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T08:00:00', scheduled_arrival: '2026-02-15T10:30:00',
    actual_departure: '2026-02-15T08:05:00', actual_arrival: '2026-02-15T10:35:00',
    airline: { id: 4, iata_code: 'BJ', name: 'Nouvelair', reliability_score: 0.73 },
    origin_airport: NBE, dest_airport: CDG,
  },
  {
    id: 111, flight_number: 'TO3460', status: 'delayed', delay_minutes: 45, distance_km: 1450,
    aircraft_type: 'B737',
    scheduled_departure: '2026-02-15T12:00:00', scheduled_arrival: '2026-02-15T14:20:00',
    actual_departure: '2026-02-15T12:45:00', actual_arrival: '2026-02-15T15:05:00',
    airline: { id: 7, iata_code: 'TO', name: 'Transavia France', reliability_score: 0.72 },
    origin_airport: ORY, dest_airport: NBE,
    delay_cause: {
      icon: '✈️', title: 'Late Incoming Aircraft',
      summary: 'The aircraft arrived late from its previous rotation due to air traffic control delays over southern France.',
      passenger_tip: 'Transavia is providing snacks and refreshments at the gate.'
    },
  },
  {
    id: 112, flight_number: 'TK700', status: 'on_time', delay_minutes: 0, distance_km: 1520,
    aircraft_type: 'B737',
    scheduled_departure: '2026-02-15T10:00:00', scheduled_arrival: '2026-02-15T12:30:00',
    actual_departure: '2026-02-15T10:05:00', actual_arrival: '2026-02-15T12:35:00',
    airline: { id: 3, iata_code: 'TK', name: 'Turkish Airlines', reliability_score: 0.77 },
    origin_airport: IST, dest_airport: NBE,
  },
  {
    id: 113, flight_number: 'BJ622', status: 'on_time', delay_minutes: 0, distance_km: 720,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T14:30:00', scheduled_arrival: '2026-02-15T16:45:00',
    actual_departure: '2026-02-15T14:35:00', actual_arrival: '2026-02-15T16:55:00',
    airline: { id: 4, iata_code: 'BJ', name: 'Nouvelair', reliability_score: 0.73 },
    origin_airport: NBE, dest_airport: MRS,
  },
  {
    id: 114, flight_number: 'EK760', status: 'on_time', delay_minutes: 0, distance_km: 5800,
    aircraft_type: 'B777',
    scheduled_departure: '2026-02-15T03:00:00', scheduled_arrival: '2026-02-15T08:30:00',
    actual_departure: '2026-02-15T03:05:00', actual_arrival: '2026-02-15T08:35:00',
    airline: { id: 8, iata_code: 'EK', name: 'Emirates', reliability_score: 0.86 },
    origin_airport: DXB, dest_airport: NBE,
  },
  {
    id: 115, flight_number: 'BJ624', status: 'boarding', delay_minutes: 0, distance_km: 1510,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T19:00:00', scheduled_arrival: '2026-02-15T21:30:00',
    actual_departure: null, actual_arrival: null,
    airline: { id: 4, iata_code: 'BJ', name: 'Nouvelair', reliability_score: 0.73 },
    origin_airport: NBE, dest_airport: LYS,
    gate: 'B2',
  },

  // ── MONASTIR (MIR) ────────────────────────────────
  {
    id: 120, flight_number: 'TU202', status: 'on_time', delay_minutes: 0, distance_km: 1520,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T06:30:00', scheduled_arrival: '2026-02-15T09:00:00',
    actual_departure: '2026-02-15T06:35:00', actual_arrival: '2026-02-15T09:05:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: MIR, dest_airport: CDG,
  },
  {
    id: 121, flight_number: 'BJ640', status: 'delayed', delay_minutes: 55, distance_km: 750,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T10:00:00', scheduled_arrival: '2026-02-15T12:05:00',
    actual_departure: '2026-02-15T10:55:00', actual_arrival: '2026-02-15T13:00:00',
    airline: { id: 4, iata_code: 'BJ', name: 'Nouvelair', reliability_score: 0.73 },
    origin_airport: MIR, dest_airport: MRS,
    delay_cause: {
      icon: '🌫️', title: 'Morning Haze at Monastir',
      summary: 'Reduced visibility caused by coastal haze at Habib Bourguiba airport delayed departure clearance.',
      passenger_tip: 'Nouvelair is offering complimentary refreshments at the departure gate.'
    },
  },
  {
    id: 122, flight_number: 'TO3470', status: 'on_time', delay_minutes: 0, distance_km: 1480,
    aircraft_type: 'B737',
    scheduled_departure: '2026-02-15T14:00:00', scheduled_arrival: '2026-02-15T16:20:00',
    actual_departure: '2026-02-15T14:05:00', actual_arrival: '2026-02-15T16:25:00',
    airline: { id: 7, iata_code: 'TO', name: 'Transavia France', reliability_score: 0.72 },
    origin_airport: ORY, dest_airport: MIR,
  },
  {
    id: 123, flight_number: 'TU204', status: 'on_time', delay_minutes: 0, distance_km: 620,
    aircraft_type: 'A320',
    scheduled_departure: '2026-02-15T17:00:00', scheduled_arrival: '2026-02-15T18:30:00',
    actual_departure: '2026-02-15T17:05:00', actual_arrival: '2026-02-15T18:35:00',
    airline: { id: 1, iata_code: 'TU', name: 'Tunisair', reliability_score: 0.71 },
    origin_airport: MIR, dest_airport: FCO,
  },
  {
    id: 124, flight_number: 'SV560', status: 'on_time', delay_minutes: 0, distance_km: 3600,
    aircraft_type: 'A330',
    scheduled_departure: '2026-02-15T02:00:00', scheduled_arrival: '2026-02-15T06:30:00',
    actual_departure: '2026-02-15T02:10:00', actual_arrival: '2026-02-15T06:40:00',
    airline: { id: 6, iata_code: 'SV', name: 'Saudia', reliability_score: 0.75 },
    origin_airport: JED, dest_airport: MIR,
  },
];


const MOCK_PREDICTIONS = {
  1: {
    risk_score: 12.5, predicted_delay_min: 0, confidence: 0.125, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 1.2, 'Airport Congestion': 2.8, 'Airline Reliability': 3.5, 'Route History': 1.0, 'Time of Day': 0.8 }
  },
  2: {
    risk_score: 78.4, predicted_delay_min: 85, confidence: 0.784, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 18.5, 'Airport Congestion': 12.3, 'Airline Reliability': 4.2, 'Route History': 8.1, 'Time of Day': 6.7 }
  },
  3: {
    risk_score: 52.1, predicted_delay_min: 45, confidence: 0.521, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 8.9, 'Airport Congestion': 15.2, 'Airline Reliability': 2.1, 'Route History': 5.4, 'Time of Day': 3.6 }
  },
  4: {
    risk_score: 8.3, predicted_delay_min: 0, confidence: 0.083, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 0.8, 'Airport Congestion': 1.5, 'Airline Reliability': 2.0, 'Route History': 0.5, 'Time of Day': 1.2 }
  },
  5: {
    risk_score: 89.2, predicted_delay_min: 120, confidence: 0.892, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 22.4, 'Airport Congestion': 18.1, 'Airline Reliability': 9.8, 'Route History': 11.5, 'Time of Day': 7.2 }
  },
  6: {
    risk_score: 22.7, predicted_delay_min: 0, confidence: 0.227, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 3.1, 'Airport Congestion': 4.5, 'Airline Reliability': 5.2, 'Route History': 2.3, 'Time of Day': 1.8 }
  },
  7: {
    risk_score: 61.8, predicted_delay_min: 40, confidence: 0.618, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 14.2, 'Airport Congestion': 10.8, 'Airline Reliability': 3.6, 'Route History': 7.9, 'Time of Day': 5.1 }
  },
  8: {
    risk_score: 15.9, predicted_delay_min: 0, confidence: 0.159, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 2.1, 'Airport Congestion': 3.2, 'Airline Reliability': 4.1, 'Route History': 1.5, 'Time of Day': 2.0 }
  },
  9: {
    risk_score: 92.5, predicted_delay_min: 210, confidence: 0.925, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 28.1, 'Airport Congestion': 14.5, 'Airline Reliability': 5.8, 'Route History': 6.2, 'Time of Day': 9.4 }
  },
  10: {
    risk_score: 95.1, predicted_delay_min: 245, confidence: 0.951, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 4.2, 'Airport Congestion': 8.5, 'Airline Reliability': 15.8, 'Route History': 12.3, 'Time of Day': 5.1 }
  },
  11: {
    risk_score: 88.7, predicted_delay_min: 195, confidence: 0.887, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 3.1, 'Airport Congestion': 22.4, 'Airline Reliability': 6.2, 'Route History': 8.9, 'Time of Day': 7.8 }
  },
  12: {
    risk_score: 97.3, predicted_delay_min: 280, confidence: 0.973, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 32.5, 'Airport Congestion': 18.9, 'Airline Reliability': 8.1, 'Route History': 9.4, 'Time of Day': 6.3 }
  },
  13: {
    risk_score: 86.9, predicted_delay_min: 190, confidence: 0.869, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 12.4, 'Airport Congestion': 9.8, 'Airline Reliability': 7.5, 'Route History': 14.2, 'Time of Day': 8.6 }
  },
  14: {
    risk_score: 93.8, predicted_delay_min: 220, confidence: 0.938, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 2.5, 'Airport Congestion': 6.8, 'Airline Reliability': 8.9, 'Route History': 5.4, 'Time of Day': 3.2 }
  },
  15: {
    risk_score: 11.2, predicted_delay_min: 0, confidence: 0.112, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 1.5, 'Airport Congestion': 2.1, 'Airline Reliability': 3.2, 'Route History': 0.8, 'Time of Day': 1.1 }
  },
  16: {
    risk_score: 87.6, predicted_delay_min: 185, confidence: 0.876, model_version: 'xgboost-v1',
    shap_explanation: { 'Weather Severity': 25.3, 'Airport Congestion': 12.8, 'Airline Reliability': 3.2, 'Route History': 7.6, 'Time of Day': 8.9 }
  },
};

const MOCK_RIGHTS = {
  2: [
    { region: 'INTL', regulation_name: 'Montreal Convention', delay_threshold_min: 60, right_type: 'refreshment', description_en: 'Airline must provide refreshments during extended delays', compensation_amount: null },
  ],
  5: [
    { region: 'INTL', regulation_name: 'Montreal Convention', delay_threshold_min: 120, right_type: 'refreshment', description_en: 'Free refreshments and communication access', compensation_amount: null },
  ],
  9: [
    { region: 'INTL', regulation_name: 'Montreal Convention', delay_threshold_min: 120, right_type: 'refreshment', description_en: 'Free refreshments, meals, and communication access', compensation_amount: null },
    { region: 'INTL', regulation_name: 'Montreal Convention', delay_threshold_min: 180, right_type: 'compensation', description_en: 'Compensation up to ~€250 for delays over 3 hours on flights ≤1500 km', compensation_amount: '~€250' },
  ],
  10: [
    { region: 'EU', regulation_name: 'EC 261/2004', delay_threshold_min: 120, right_type: 'refreshment', description_en: 'Free refreshments, meals, and 2 phone calls or emails (EU-departing flight)', compensation_amount: null },
    { region: 'EU', regulation_name: 'EC 261/2004', delay_threshold_min: 180, right_type: 'compensation', description_en: '€250 compensation for EU-departing flights ≤1500 km arriving 3+ hours late', compensation_amount: '€250' },
  ],
  11: [
    { region: 'INTL', regulation_name: 'Montreal Convention', delay_threshold_min: 120, right_type: 'refreshment', description_en: 'Free refreshments, meals, and communication access', compensation_amount: null },
    { region: 'INTL', regulation_name: 'Montreal Convention', delay_threshold_min: 180, right_type: 'compensation', description_en: 'Compensation up to ~€250 for airline-caused delays over 3 hours', compensation_amount: '~€250' },
  ],
  12: [
    { region: 'INTL', regulation_name: 'Montreal Convention', delay_threshold_min: 120, right_type: 'refreshment', description_en: 'Free refreshments, meals, and communication access', compensation_amount: null },
    { region: 'INTL', regulation_name: 'Montreal Convention', delay_threshold_min: 240, right_type: 'hotel', description_en: 'Hotel accommodation and transport if overnight delay', compensation_amount: null },
  ],
  13: [
    { region: 'GCC', regulation_name: 'General Duty of Care', delay_threshold_min: 120, right_type: 'meal', description_en: 'Airline must provide meals, drinks and refreshments', compensation_amount: null },
    { region: 'GCC', regulation_name: 'General Duty of Care', delay_threshold_min: 240, right_type: 'hotel', description_en: 'Hotel accommodation if delay exceeds 4 hours', compensation_amount: null },
  ],
  14: [
    { region: 'INTL', regulation_name: 'Montreal Convention', delay_threshold_min: 120, right_type: 'refreshment', description_en: 'Free refreshments, meals, and communication access', compensation_amount: null },
    { region: 'INTL', regulation_name: 'Montreal Convention', delay_threshold_min: 180, right_type: 'compensation', description_en: 'Compensation for delays over 3 hours on flights to EU destinations', compensation_amount: '~€250' },
  ],
  16: [
    { region: 'EU', regulation_name: 'EC 261/2004', delay_threshold_min: 120, right_type: 'refreshment', description_en: 'Free refreshments, meals, and 2 phone calls (EU-departing flight)', compensation_amount: null },
    { region: 'EU', regulation_name: 'EC 261/2004', delay_threshold_min: 180, right_type: 'compensation', description_en: '€250 compensation for EU-departing flights ≤1500 km arriving 3+ hours late', compensation_amount: '€250' },
  ],
};

const MOCK_DASHBOARD = {
  total_flights: 5000, on_time_count: 3606, delayed_count: 1394,
  cancelled_count: 42, at_risk_count: 187, avg_delay_minutes: 68.3, delay_rate: 27.9,
};

const MOCK_DELAY_CAUSES = [
  { factor: 'Weather Conditions', impact: 35.8, description: 'Mediterranean fog, sirocco winds, and storms affecting TUN operations' },
  { factor: 'Airport Congestion', impact: 26.4, description: 'Peak-hour traffic at TUN and destination hubs (CDG, IST, FCO)' },
  { factor: 'Airline Operations', impact: 22.6, description: 'Crew scheduling, aircraft rotation delays, and maintenance at TUN' },
  { factor: 'ATC & Airspace', impact: 15.2, description: 'Eurocontrol restrictions and Mediterranean corridor flow management' },
];

const MOCK_HISTORY = [
  { date: '2026-W01', delay_rate: 25.3, avg_delay: 62, total_flights: 120 },
  { date: '2026-W02', delay_rate: 31.2, avg_delay: 71, total_flights: 135 },
  { date: '2026-W03', delay_rate: 22.8, avg_delay: 55, total_flights: 142 },
  { date: '2026-W04', delay_rate: 28.9, avg_delay: 68, total_flights: 128 },
  { date: '2026-W05', delay_rate: 35.1, avg_delay: 82, total_flights: 115 },
  { date: '2026-W06', delay_rate: 27.4, avg_delay: 64, total_flights: 138 },
];

const MOCK_AIRLINES_PERF = [
  { airline_iata: 'TU', airline_name: 'Tunisair', reliability_score: 0.71, total_flights: 680, delayed_flights: 231, delay_rate: 34.0, avg_delay_minutes: 72.5 },
  { airline_iata: 'BJ', airline_name: 'Nouvelair', reliability_score: 0.73, total_flights: 320, delayed_flights: 99, delay_rate: 30.9, avg_delay_minutes: 65.2 },
  { airline_iata: 'TO', airline_name: 'Transavia France', reliability_score: 0.72, total_flights: 280, delayed_flights: 89, delay_rate: 31.8, avg_delay_minutes: 68.1 },
  { airline_iata: 'SV', airline_name: 'Saudia', reliability_score: 0.75, total_flights: 140, delayed_flights: 39, delay_rate: 27.9, avg_delay_minutes: 58.4 },
  { airline_iata: 'TK', airline_name: 'Turkish Airlines', reliability_score: 0.77, total_flights: 350, delayed_flights: 91, delay_rate: 26.0, avg_delay_minutes: 52.8 },
  { airline_iata: 'AF', airline_name: 'Air France', reliability_score: 0.78, total_flights: 420, delayed_flights: 105, delay_rate: 25.0, avg_delay_minutes: 49.6 },
  { airline_iata: 'LH', airline_name: 'Lufthansa', reliability_score: 0.80, total_flights: 210, delayed_flights: 46, delay_rate: 21.9, avg_delay_minutes: 42.3 },
];

// ── Helper ────────────────────────────────────────────

function _getAuthHeader() {
  const token = localStorage.getItem('admin_token');
  if (token && token !== 'demo') return { Authorization: `Bearer ${token}` };
  return {};
}

async function fetchApi(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ..._getAuthHeader(),
        ...options.headers,
      },
      ...options,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`API unavailable (${endpoint}), using mock data:`, err.message);
    return null;
  }
}

// ── Exports ───────────────────────────────────────────

export async function getFlights(params = {}) {
  const query = new URLSearchParams(params).toString();
  const data = await fetchApi(`/flights?${query}`);
  return data || MOCK_FLIGHTS;
}

export async function getFlight(id) {
  const data = await fetchApi(`/flights/${id}`);
  if (data) return data;
  const flight = MOCK_FLIGHTS.find(f => f.id === Number(id));
  if (flight) {
    return { ...flight, prediction: MOCK_PREDICTIONS[id] || null, passenger_rights: MOCK_RIGHTS[id] || [] };
  }
  return null;
}

export async function getFlightPrediction(id) {
  const data = await fetchApi(`/flights/${id}/prediction`);
  return data || MOCK_PREDICTIONS[id] || null;
}

export async function getDashboardOverview() {
  const data = await fetchApi('/dashboard/overview');
  return data || MOCK_DASHBOARD;
}

export async function getDelayCauses() {
  const data = await fetchApi('/dashboard/delay-causes');
  return data || MOCK_DELAY_CAUSES;
}

export async function getDelayHistory() {
  const data = await fetchApi('/dashboard/history');
  return data || MOCK_HISTORY;
}

export async function getAirlinesPerformance() {
  const data = await fetchApi('/dashboard/airlines-performance');
  return data || MOCK_AIRLINES_PERF;
}

export async function login(email, password) {
  // Login must NOT send Authorization header — no token exists yet
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    throw new Error('Backend unavailable');
  }
}

export async function register(email, password, fullName) {
  const data = await fetchApi('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  if (!data) throw new Error('Backend unavailable');
  return data;
}

// ── Flight CRUD ────────────────────────────────────────

export async function createFlight(payload) {
  const data = await fetchApi('/flights', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!data) throw new Error('Failed to create flight');
  return data;
}

export async function updateFlight(id, payload) {
  const data = await fetchApi(`/flights/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!data) throw new Error('Failed to update flight');
  return data;
}

export async function deleteFlight(id) {
  try {
    const res = await fetch(`${API_BASE}/flights/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    return true;
  } catch (err) {
    console.warn('Delete flight error:', err.message);
    throw err;
  }
}

// ── Prediction ─────────────────────────────────────────

export async function predictCustom(features) {
  const data = await fetchApi('/predictions', {
    method: 'POST',
    body: JSON.stringify(features),
  });
  if (!data) {
    // Mock prediction fallback
    const score = Math.min(100, features.weather_severity * 40 + features.congestion_level * 30 + (1 - features.airline_reliability) * 20 + features.historical_delay_rate * 10);
    return {
      risk_score: score,
      predicted_delay_min: Math.round(score * 1.2),
      confidence: 0.85,
      shap_explanation: {
        weather_severity: features.weather_severity * 0.4,
        congestion_level: features.congestion_level * 0.3,
        airline_reliability: -(features.airline_reliability * 0.2),
        historical_delay_rate: features.historical_delay_rate * 0.1,
        hour_of_day: (features.hour_of_day > 16 ? 0.05 : -0.02),
        distance_km: features.distance_km > 3000 ? 0.04 : -0.01,
      },
    };
  }
  return data;
}

// ── Reference data ─────────────────────────────────────

export async function getAirports(params = {}) {
  const query = new URLSearchParams(params).toString();
  const data = await fetchApi(`/airports?${query}`);
  return data || [];
}

export async function getAirlines(params = {}) {
  const query = new URLSearchParams(params).toString();
  const data = await fetchApi(`/airlines?${query}`);
  return data || [];
}

// ── Dashboard convenience object ───────────────────────

export const fetchDashboard = {
  overview: () => getDashboardOverview(),
  causes: () => getDelayCauses(),
  history: () => getDelayHistory(),
  airlines: () => getAirlinesPerformance(),
};

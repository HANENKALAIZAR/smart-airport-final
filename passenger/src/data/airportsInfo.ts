import type { TunisianAirportCode } from "./mockFlights";

export interface AirlineServing {
  code: string;
  name: string;
  country: string;
  type: "national" | "international" | "low-cost" | "charter";
}

export interface AirportInfo {
  code: TunisianAirportCode;
  iata: string;
  icao: string;
  name: string;
  shortName: string;
  city: string;
  region: string;
  country: string;
  established: number;
  elevationM: number;
  coordinates: { lat: number; lng: number };
  terminals: number;
  runways: number;
  capacityMillions: number;
  passengers2023Millions: number;
  area: string;
  operator: string;
  website: string;
  phone: string;
  description: string;
  highlights: string[];
  destinationsCount: number;
  cargoTons: number;
  airlines: AirlineServing[];
  topDestinations: { city: string; country: string; flag: string }[];
  groundTransport: { mode: string; description: string }[];
}

export const airportsInfo: AirportInfo[] = [
  {
    code: "TUN",
    iata: "TUN",
    icao: "DTTA",
    name: "Tunis–Carthage International Airport",
    shortName: "Tunis–Carthage",
    city: "Tunis",
    region: "Greater Tunis",
    country: "Tunisia",
    established: 1940,
    elevationM: 22,
    coordinates: { lat: 36.851, lng: 10.2272 },
    terminals: 2,
    runways: 2,
    capacityMillions: 5.5,
    passengers2023Millions: 4.9,
    area: "Aouina, 8 km NE of Tunis",
    operator: "Office de l'Aviation Civile et des Aéroports (OACA)",
    website: "https://www.oaca.nat.tn",
    phone: "+216 71 754 000",
    description:
      "The largest and busiest airport in Tunisia, serving as the main international gateway to the country and the primary hub for Tunisair. It connects the capital with Europe, Africa and the Middle East.",
    highlights: [
      "Main hub of Tunisair and Nouvelair",
      "Two passenger terminals",
      "24/7 operations with full ILS approach",
      "Direct connections to 70+ destinations",
    ],
    destinationsCount: 72,
    cargoTons: 22000,
    airlines: [
      { code: "TU", name: "Tunisair", country: "Tunisia", type: "national" },
      { code: "BJ", name: "Nouvelair Tunisie", country: "Tunisia", type: "national" },
      { code: "UG", name: "Tunisair Express", country: "Tunisia", type: "national" },
      { code: "AF", name: "Air France", country: "France", type: "international" },
      { code: "LH", name: "Lufthansa", country: "Germany", type: "international" },
      { code: "TK", name: "Turkish Airlines", country: "Turkey", type: "international" },
      { code: "QR", name: "Qatar Airways", country: "Qatar", type: "international" },
      { code: "EK", name: "Emirates", country: "UAE", type: "international" },
      { code: "AZ", name: "ITA Airways", country: "Italy", type: "international" },
      { code: "AT", name: "Royal Air Maroc", country: "Morocco", type: "international" },
      { code: "SV", name: "Saudia", country: "Saudi Arabia", type: "international" },
      { code: "FR", name: "Ryanair", country: "Ireland", type: "low-cost" },
      { code: "TO", name: "Transavia France", country: "France", type: "low-cost" },
    ],
    topDestinations: [
      { city: "Paris", country: "France", flag: "🇫🇷" },
      { city: "Istanbul", country: "Turkey", flag: "🇹🇷" },
      { city: "Frankfurt", country: "Germany", flag: "🇩🇪" },
      { city: "Doha", country: "Qatar", flag: "🇶🇦" },
      { city: "Rome", country: "Italy", flag: "🇮🇹" },
      { city: "Casablanca", country: "Morocco", flag: "🇲🇦" },
      { city: "Dubai", country: "UAE", flag: "🇦🇪" },
      { city: "Brussels", country: "Belgium", flag: "🇧🇪" },
    ],
    groundTransport: [
      { mode: "Taxi", description: "Yellow taxis available 24/7 outside arrivals (~10 TND to city center)." },
      { mode: "Bus", description: "TUT line 35 connects the airport to Tunis Marine every 30 min." },
      { mode: "Car rental", description: "Avis, Hertz, Europcar, Sixt and local agencies in arrivals hall." },
      { mode: "Private transfer", description: "Pre-booked shuttles and VIP transfers available." },
    ],
  },
  {
    code: "MIR",
    iata: "MIR",
    icao: "DTMB",
    name: "Monastir Habib Bourguiba International Airport",
    shortName: "Monastir",
    city: "Monastir",
    region: "Sahel",
    country: "Tunisia",
    established: 1968,
    elevationM: 3,
    coordinates: { lat: 35.758, lng: 10.7547 },
    terminals: 1,
    runways: 1,
    capacityMillions: 3.5,
    passengers2023Millions: 1.2,
    area: "Skanes, 8 km W of Monastir",
    operator: "TAV Tunisie",
    website: "https://www.tavtunisie.com",
    phone: "+216 73 521 300",
    description:
      "A key tourist airport on the Sahel coast, serving the resort cities of Monastir, Sousse and Mahdia. Operated by TAV Tunisie under a long-term concession.",
    highlights: [
      "Operated by TAV Airports (Turkey)",
      "Major charter and seasonal traffic hub",
      "Serves Sahel tourism corridor",
      "Single modern terminal building",
    ],
    destinationsCount: 38,
    cargoTons: 3500,
    airlines: [
      { code: "TU", name: "Tunisair", country: "Tunisia", type: "national" },
      { code: "BJ", name: "Nouvelair Tunisie", country: "Tunisia", type: "national" },
      { code: "DE", name: "Condor", country: "Germany", type: "charter" },
      { code: "X3", name: "TUI fly Deutschland", country: "Germany", type: "charter" },
      { code: "OR", name: "TUI fly Netherlands", country: "Netherlands", type: "charter" },
      { code: "BY", name: "TUI Airways", country: "UK", type: "charter" },
      { code: "SK", name: "SAS", country: "Scandinavia", type: "international" },
      { code: "EW", name: "Eurowings", country: "Germany", type: "low-cost" },
      { code: "FR", name: "Ryanair", country: "Ireland", type: "low-cost" },
    ],
    topDestinations: [
      { city: "Frankfurt", country: "Germany", flag: "🇩🇪" },
      { city: "Paris", country: "France", flag: "🇫🇷" },
      { city: "Brussels", country: "Belgium", flag: "🇧🇪" },
      { city: "Amsterdam", country: "Netherlands", flag: "🇳🇱" },
      { city: "London", country: "UK", flag: "🇬🇧" },
      { city: "Stockholm", country: "Sweden", flag: "🇸🇪" },
    ],
    groundTransport: [
      { mode: "Taxi", description: "Taxis available outside terminal — ~15 TND to Monastir, ~25 TND to Sousse." },
      { mode: "Metro Sahel", description: "TGM light rail station in front of terminal connects to Sousse and Mahdia." },
      { mode: "Car rental", description: "Major rental brands available in arrivals." },
      { mode: "Hotel shuttle", description: "Many resort hotels offer free pre-booked transfers." },
    ],
  },
  {
    code: "NBE",
    iata: "NBE",
    icao: "DTNH",
    name: "Enfidha–Hammamet International Airport",
    shortName: "Enfidha–Hammamet",
    city: "Enfidha",
    region: "Hammamet",
    country: "Tunisia",
    established: 2009,
    elevationM: 21,
    coordinates: { lat: 36.0758, lng: 10.4386 },
    terminals: 1,
    runways: 1,
    capacityMillions: 7.0,
    passengers2023Millions: 2.1,
    area: "Enfidha, between Hammamet and Sousse",
    operator: "TAV Tunisie",
    website: "https://www.tavtunisie.com",
    phone: "+216 73 100 700",
    description:
      "The newest and most modern airport in Tunisia, designed to serve the Hammamet–Yasmine and Sousse tourist regions. Built to international standards with significant expansion capacity.",
    highlights: [
      "Newest airport in Tunisia (2009)",
      "Modern infrastructure with 7M pax capacity",
      "Strategic location for Hammamet & Sousse",
      "Expansive duty-free and lounges",
    ],
    destinationsCount: 45,
    cargoTons: 5800,
    airlines: [
      { code: "TU", name: "Tunisair", country: "Tunisia", type: "national" },
      { code: "BJ", name: "Nouvelair Tunisie", country: "Tunisia", type: "national" },
      { code: "FR", name: "Ryanair", country: "Ireland", type: "low-cost" },
      { code: "U2", name: "easyJet", country: "UK", type: "low-cost" },
      { code: "W6", name: "Wizz Air", country: "Hungary", type: "low-cost" },
      { code: "DE", name: "Condor", country: "Germany", type: "charter" },
      { code: "X3", name: "TUI fly Deutschland", country: "Germany", type: "charter" },
      { code: "BY", name: "TUI Airways", country: "UK", type: "charter" },
      { code: "SK", name: "SAS", country: "Scandinavia", type: "international" },
      { code: "EW", name: "Eurowings", country: "Germany", type: "low-cost" },
      { code: "TO", name: "Transavia France", country: "France", type: "low-cost" },
    ],
    topDestinations: [
      { city: "London", country: "UK", flag: "🇬🇧" },
      { city: "Paris", country: "France", flag: "🇫🇷" },
      { city: "Warsaw", country: "Poland", flag: "🇵🇱" },
      { city: "Berlin", country: "Germany", flag: "🇩🇪" },
      { city: "Moscow", country: "Russia", flag: "🇷🇺" },
      { city: "Prague", country: "Czechia", flag: "🇨🇿" },
      { city: "Manchester", country: "UK", flag: "🇬🇧" },
    ],
    groundTransport: [
      { mode: "Taxi", description: "Taxis to Hammamet ~30 min (~40 TND), Sousse ~40 min (~50 TND)." },
      { mode: "Coach", description: "Tour-operator coaches and intercity buses serve the terminal." },
      { mode: "Car rental", description: "Full lineup of rental companies in arrivals area." },
      { mode: "Hotel shuttle", description: "Pre-booked transfers from most coastal resorts." },
    ],
  },
  {
    code: "DJE",
    iata: "DJE",
    icao: "DTTJ",
    name: "Djerba–Zarzis International Airport",
    shortName: "Djerba–Zarzis",
    city: "Djerba",
    region: "South Tunisia",
    country: "Tunisia",
    established: 1970,
    elevationM: 19,
    coordinates: { lat: 33.875, lng: 10.7755 },
    terminals: 1,
    runways: 1,
    capacityMillions: 4.0,
    passengers2023Millions: 1.6,
    area: "Mellita, Djerba island",
    operator: "Office de l'Aviation Civile et des Aéroports (OACA)",
    website: "https://www.oaca.nat.tn",
    phone: "+216 75 650 233",
    description:
      "The main gateway to Djerba island and southern Tunisia, serving leisure travellers from across Europe. Known for its relaxed Mediterranean atmosphere.",
    highlights: [
      "Gateway to Djerba & Sahara tourism",
      "Significant European leisure traffic",
      "Single terminal with regional flair",
      "Connections to Libya & sub-Saharan Africa",
    ],
    destinationsCount: 32,
    cargoTons: 2900,
    airlines: [
      { code: "TU", name: "Tunisair", country: "Tunisia", type: "national" },
      { code: "BJ", name: "Nouvelair Tunisie", country: "Tunisia", type: "national" },
      { code: "UG", name: "Tunisair Express", country: "Tunisia", type: "national" },
      { code: "AF", name: "Air France", country: "France", type: "international" },
      { code: "LX", name: "Swiss International", country: "Switzerland", type: "international" },
      { code: "DE", name: "Condor", country: "Germany", type: "charter" },
      { code: "X3", name: "TUI fly Deutschland", country: "Germany", type: "charter" },
      { code: "BY", name: "TUI Airways", country: "UK", type: "charter" },
      { code: "TO", name: "Transavia France", country: "France", type: "low-cost" },
      { code: "EW", name: "Eurowings", country: "Germany", type: "low-cost" },
    ],
    topDestinations: [
      { city: "Paris", country: "France", flag: "🇫🇷" },
      { city: "Lyon", country: "France", flag: "🇫🇷" },
      { city: "Brussels", country: "Belgium", flag: "🇧🇪" },
      { city: "Frankfurt", country: "Germany", flag: "🇩🇪" },
      { city: "Geneva", country: "Switzerland", flag: "🇨🇭" },
      { city: "Tripoli", country: "Libya", flag: "🇱🇾" },
    ],
    groundTransport: [
      { mode: "Taxi", description: "Taxis to Houmt Souk ~15 min (~12 TND), Aghir resorts ~25 min (~25 TND)." },
      { mode: "Bus", description: "SRT Djerba lines serve the airport with regional connections." },
      { mode: "Car rental", description: "Hertz, Avis, Europcar and local rentals available." },
      { mode: "Hotel shuttle", description: "Most island resorts offer pre-arranged transfers." },
    ],
  },
];
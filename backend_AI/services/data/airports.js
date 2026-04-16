const AIRPORTS = {
  TUN: {
    name: "Tunis-Carthage International Airport",
    city: "Tunis",
    country: "Tunisia",
    coordinates: { lat: 36.8486, lon: 10.2306 },
    restaurants: [
      { name: "La Terrasse", terminal: "Terminal 1", type: "Restaurant", open: "06:00–22:00" },
      { name: "Café Express", terminal: "Terminal 2", type: "Café", open: "05:00–23:00" },
      { name: "Masmoudi Pâtisserie", terminal: "Terminal 1", type: "Pastry & Coffee", open: "06:00–21:00" },
      { name: "Quick Burger", terminal: "Terminal 2", type: "Fast Food", open: "07:00–22:00" },
    ],
    lounges: [
      { name: "Carthage Business Lounge", access: "Tunisair Gold/Silver, Business class", terminal: "Terminal 1" },
      { name: "Plaza Premium Lounge", access: "Paid access available (~35 TND)", terminal: "Terminal 2" },
    ],
    wifi: "Free Wi-Fi — network: TunisAirport_Free (no password)",
    hotels_nearby: [
      { name: "Novotel Tunis", distance: "5 min by taxi", stars: 4, approx_price: "180 TND/night" },
      { name: "Golden Tulip El Mechtel", distance: "10 min by taxi", stars: 4, approx_price: "220 TND/night" },
      { name: "Radisson Blu Tunis", distance: "15 min by taxi", stars: 5, approx_price: "350 TND/night" },
      { name: "Ibis Tunis", distance: "12 min by taxi", stars: 3, approx_price: "120 TND/night" },
    ],
    tourist_activities: [
      { name: "Sidi Bou Said village", distance: "25 min", description: "Iconic blue & white village, cafés, sea views" },
      { name: "Carthage ruins", distance: "20 min", description: "UNESCO World Heritage ancient ruins" },
      { name: "La Marsa beach", distance: "20 min", description: "Popular beach and seaside promenade" },
      { name: "Bardo National Museum", distance: "15 min", description: "World's largest mosaic collection" },
      { name: "Medina of Tunis", distance: "20 min", description: "Historic old city, souks, Zitouna mosque" },
    ],
  },
  DJE: {
    name: "Djerba–Zarzis International Airport",
    city: "Djerba",
    country: "Tunisia",
    restaurants: [
      { name: "Airport Café Central", terminal: "Main Terminal", type: "Café", open: "06:00–22:00" },
      { name: "Djerba Kitchen", terminal: "Departures", type: "Tunisian Food", open: "07:00–21:00" },
      { name: "Snack Corner", terminal: "Arrivals", type: "Snacks & Drinks", open: "06:00–23:00" },
    ],
    lounges: [
      { name: "VIP Lounge Djerba", access: "Business class passengers, paid access available", terminal: "Main Terminal" },
    ],
    wifi: "Free Wi-Fi — network: DJE_Airport_Wifi",
    hotels_nearby: [
      { name: "Radisson Blu Palace Resort Djerba", distance: "10 min by taxi", stars: 5, approx_price: "400 TND/night" },
      { name: "Hasdrubal Prestige Thalassa", distance: "15 min by taxi", stars: 5, approx_price: "380 TND/night" },
      { name: "Vincci Helios Beach", distance: "12 min by taxi", stars: 4, approx_price: "250 TND/night" },
      { name: "Hotel Dar Zitouna", distance: "20 min by taxi", stars: 3, approx_price: "110 TND/night" },
    ],
    tourist_activities: [
      { name: "Houmt Souk medina", distance: "15 min", description: "Traditional market, pottery, local crafts" },
      { name: "Guellala pottery village", distance: "20 min", description: "Famous for handmade Djerba pottery" },
      { name: "El Ghriba synagogue", distance: "25 min", description: "One of Africa's oldest synagogues" },
      { name: "Djerba Explore park", distance: "10 min", description: "Crocodile farm + heritage village museum" },
      { name: "Midoun market", distance: "20 min", description: "Lively Tuesday market with local produce" },
    ],
  },
  MIR: {
    name: "Monastir Habib Bourguiba International Airport",
    city: "Monastir",
    country: "Tunisia",
    restaurants: [
      { name: "Café Bourguiba", terminal: "Main Terminal", type: "Café & Snacks", open: "06:00–22:00" },
      { name: "Airport Brasserie", terminal: "Departures", type: "Restaurant", open: "07:00–21:00" },
    ],
    lounges: [
      { name: "Business Lounge Monastir", access: "Business class, Tunisair elite members", terminal: "Departures" },
    ],
    wifi: "Free Wi-Fi — network: MIR_FreeWifi",
    hotels_nearby: [
      { name: "Regency Hotel Monastir", distance: "8 min by taxi", stars: 4, approx_price: "200 TND/night" },
      { name: "Iberostar Selection Kuriat Palace", distance: "15 min by taxi", stars: 5, approx_price: "360 TND/night" },
      { name: "Hotel El Mouradi Monastir", distance: "10 min by taxi", stars: 4, approx_price: "170 TND/night" },
    ],
    tourist_activities: [
      { name: "Ribat of Monastir", distance: "10 min", description: "8th-century Islamic fortress, sea views" },
      { name: "Monastir marina & corniche", distance: "12 min", description: "Beautiful waterfront promenade" },
      { name: "Mausoleum of Habib Bourguiba", distance: "10 min", description: "Historic presidential mausoleum" },
      { name: "Sousse medina", distance: "25 min", description: "UNESCO-listed medina with great souks" },
    ],
  },
  NBE: {
    name: "Enfidha–Hammamet International Airport",
    city: "Enfidha",
    country: "Tunisia",
    restaurants: [
      { name: "Café Hammamet", terminal: "Main Terminal", type: "Café", open: "06:00–22:00" },
      { name: "Airport Grill", terminal: "Departures", type: "Grill & Sandwiches", open: "07:00–21:00" },
    ],
    lounges: [
      { name: "VIP Lounge Enfidha", access: "Business class passengers", terminal: "Main Terminal" },
    ],
    wifi: "Free Wi-Fi — network: NBE_Airport",
    hotels_nearby: [
      { name: "Movenpick Resort Gammarth", distance: "20 min by taxi", stars: 5, approx_price: "420 TND/night" },
      { name: "Laico Hammamet", distance: "15 min by taxi", stars: 4, approx_price: "230 TND/night" },
      { name: "Iberostar Averroes", distance: "18 min by taxi", stars: 4, approx_price: "210 TND/night" },
    ],
    tourist_activities: [
      { name: "Hammamet old medina", distance: "20 min", description: "Charming old town, kasbah, beach nearby" },
      { name: "Hammamet beach", distance: "18 min", description: "One of Tunisia's most popular beaches" },
      { name: "Yasmine Hammamet marina", distance: "25 min", description: "Modern resort area with restaurants & shops" },
      { name: "Pupput Roman site", distance: "22 min", description: "Ancient Roman archaeological site" },
    ],
};


// EU member state airport codes (partial list covering routes from Tunisia)
const EU_AIRPORTS = [
  "CDG","ORY","NCE","LYS","MRS","TLS","BOD", // France
  "FCO","MXP","LIN","VCE","NAP","BGY",        // Italy
  "MAD","BCN","AGP","PMI","ALC","VLC",         // Spain
  "FRA","MUC","TXL","BER","DUS","HAM","STR",  // Germany
  "AMS","RTM","EIN",                           // Netherlands
  "BRU","CRL","LGG",                           // Belgium
  "LHR","LGW","MAN","STN","LTN","BHX",        // UK (post-Brexit: no longer EU261 on UK-departing)
  "VIE","SZG","GRZ",                           // Austria
  "ZRH","GVA","BSL",                           // Switzerland (not EU but applies EC261 equivalent)
  "ATH","SKG",                                  // Greece
  "LIS","OPO","FAO",                           // Portugal
  "WAW","KRK",                                  // Poland
  "PRG",                                        // Czech Republic
  "BUD",                                        // Hungary
  "ARN","GOT","MMX",                           // Sweden
  "CPH","AAL","BLL",                           // Denmark
  "HEL","TMP",                                  // Finland
  "OSL","BGO",                                  // Norway (EEA — EC261 applies)
];

// Tunisian airport codes
const TN_AIRPORTS = ["TUN", "DJE", "MIR", "NBE"];

function getRouteType(depIata, arrIata, airlineIata) {
  const depIsEU = EU_AIRPORTS.includes(depIata);
  const depIsTN = TN_AIRPORTS.includes(depIata);
  const arrIsEU = EU_AIRPORTS.includes(arrIata);
  const arrIsTN = TN_AIRPORTS.includes(arrIata);

  if (depIsTN && arrIsTN) return "domestic";
  if (depIsTN && arrIsEU) return "tunisia_to_eu";       // EU261 does NOT apply
  if (depIsEU && arrIsTN) {
    // EU261 applies only if EU carrier OR any carrier departing EU
    return "eu_to_tunisia";                              // EU261 DOES apply
  }
  if (depIsTN) return "tunisia_international";          // Montreal Convention only
  return "other";
}

module.exports = { AIRPORTS, EU_AIRPORTS, TN_AIRPORTS, getRouteType };

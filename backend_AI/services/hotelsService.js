/**
 * Hotels Service
 * Real-time hotel search using Google Places API (New).
 * Falls back to static airport data if the API key is absent or the call fails.
 *
 * Required in your .env:
 *   GOOGLE_PLACES_KEY=xxxxxxxxxxxxxxxxxxxx
 *
 * Google Places API (New) endpoints used:
 *   POST https://places.googleapis.com/v1/places:searchNearby   (nearby search)
 *   GET  https://places.googleapis.com/v1/places/{id}           (place details — optional)
 */

const { getHotelsNearAirport } = require('./googlePlacesService');

// ─────────────────────────────────────────────────────────────────────────────
// AIRPORT COORDINATE TABLE
// Used to build the "locationRestriction" circle for the Google Places call.
// Coordinates are the approximate centre of each airport's terminal area.
// ─────────────────────────────────────────────────────────────────────────────
const AIRPORT_COORDS = {
  TUN: { lat: 36.8510, lng: 10.2272, city: 'Tunis' },
  DJE: { lat: 33.8750, lng: 10.7755, city: 'Djerba' },
  MIR: { lat: 35.7581, lng: 10.7547, city: 'Monastir' },
  NBE: { lat: 36.0758, lng: 10.4385, city: 'Enfidha' },
  // International airports frequently seen on Tunisian routes
  CDG: { lat: 49.0097, lng: 2.5479, city: 'Paris' },
  ORY: { lat: 48.7262, lng: 2.3652, city: 'Paris Orly' },
  FRA: { lat: 50.0379, lng: 8.5622, city: 'Frankfurt' },
  DXB: { lat: 25.2528, lng: 55.3644, city: 'Dubai' },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tiny HTTPS POST helper that returns parsed JSON.
 */
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) } },
      (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`JSON parse failed: ${data.slice(0, 120)}`)); }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Convert Google Places price level (0-4) to our internal labels.
 */
function mapPriceLevel(level) {
  const map = { 0: 'budget', 1: 'budget', 2: 'midrange', 3: 'luxury', 4: 'luxury' };
  return map[level] ?? 'midrange';
}

/**
 * Build amenity list from Google place types / features.
 */
function buildAmenities(place) {
  const amenities = ['WiFi', 'Air Conditioning'];
  const types = place.types || [];
  if (types.includes('spa')) amenities.push('Spa');
  if (place.goodForGroups) amenities.push('Group Friendly');
  if (place.servesMeal) amenities.push('Restaurant');
  return amenities;
}

/**
 * Haversine distance in metres.
 */
function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE PLACES API (NEW) — NEARBY SEARCH
// POST https://places.googleapis.com/v1/places:searchNearby
// Docs: https://developers.google.com/maps/documentation/places/web-service/nearby-search
// ─────────────────────────────────────────────────────────────────────────────
async function searchGooglePlacesNearby(lat, lng, radiusMetres, apiKey) {
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.rating',
    'places.userRatingCount',
    'places.priceLevel',
    'places.websiteUri',
    'places.nationalPhoneNumber',
    'places.regularOpeningHours',
    'places.types',
    'places.goodForGroups',
    'places.servesMeal',
  ].join(',');

  const body = {
    includedTypes: ['hotel', 'lodging'],
    maxResultCount: 10,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusMetres,
      },
    },
    rankPreference: 'DISTANCE',
  };

  const result = await httpsPost(
    'places.googleapis.com',
    '/v1/places:searchNearby',
    {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body
  );

  // Google returns { places: [...] } or { error: {...} }
  if (result.error) {
    throw new Error(`Google Places error ${result.error.code}: ${result.error.message}`);
  }

  return result.places || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// ENRICH: map a raw Google Place to our internal hotel shape
// ─────────────────────────────────────────────────────────────────────────────
function enrichGooglePlace(place, airportCoords, airportIata) {
  const placeLat = place.location?.latitude;
  const placeLng = place.location?.longitude;
  const distMetres = (placeLat && placeLng)
    ? haversineMetres(airportCoords.lat, airportCoords.lng, placeLat, placeLng)
    : null;

  const priceRange = mapPriceLevel(place.priceLevel);

  // Rough nightly price estimate (TND) from price level.
  // In production you'd call a hotel-rates API; this keeps the fallback honest.
  const priceEstimates = { budget: 65, midrange: 130, luxury: 280 };
  const pricePerNight = priceEstimates[priceRange];

  // Is the hotel open right now?
  const isOpenNow = place.regularOpeningHours?.openNow ?? true;

  return {
    name: place.displayName?.text || 'Hotel',
    type: 'hotel',
    address: place.formattedAddress || 'Near Airport',
    phone: place.nationalPhoneNumber || null,
    website: place.websiteUri || null,
    rating: place.rating || null,
    userRatings: place.userRatingCount || 0,
    priceRange,
    pricePerNight,
    currency: 'TND',
    available: true,
    isOpenNow,
    amenities: buildAmenities(place),
    shuttleService: distMetres !== null && distMetres < 5_000,
    distanceKm: distMetres !== null ? Math.round(distMetres / 100) / 10 : null,
    airportIata,
    source: 'google_places',
    bookingUrl: place.websiteUri
      || `https://www.google.com/travel/hotels/entity/${place.id}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK — static data from airports.js  (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────
function getMockHotels(airportIata) {
  try {
    const { AIRPORTS } = require('./airports');
    const airport = AIRPORTS[airportIata];
    if (!airport) return [];

    const mockHotels = airport.hotels_nearby || [
      { name: 'Airport Hotel', distance: '2 km by taxi', stars: 3, approx_price: '120 TND/night' },
      { name: 'City Center Hotel', distance: '15 min by taxi', stars: 4, approx_price: '200 TND/night' },
      { name: 'Budget Inn', distance: '10 min by taxi', stars: 2, approx_price: '60 TND/night' },
    ];

    return mockHotels.map(hotel => ({
      name: hotel.name,
      type: 'hotel',
      address: hotel.distance,
      stars: hotel.stars,
      pricePerNight: parseInt(hotel.approx_price) || 100,
      currency: 'TND',
      available: true,
      amenities: getStaticAmenities(hotel.stars),
      shuttleService: typeof hotel.distance === 'string' && hotel.distance.includes('km')
        && parseInt(hotel.distance) <= 5,
      airportIata,
      rating: 3.5 + Math.random() * 1.5,
      source: 'static_fallback',
      bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotel.name)}`,
    }));
  } catch (_) {
    return [];
  }
}

function getStaticAmenities(stars = 3) {
  const list = ['WiFi', 'Air Conditioning'];
  if (stars >= 3) list.push('Restaurant', 'Room Service');
  if (stars >= 4) list.push('Fitness Center', 'Business Center');
  if (stars >= 5) list.push('Spa', 'Concierge', 'Airport Shuttle');
  return list;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search hotels near a specific airport.
 *
 * Priority:
 *   1. Google Places API (New) — live results with ratings, pricing level, hours
 *   2. Static airport data    — always available, no external call needed
 *
 * @param {string} airportIata  - e.g. "TUN", "CDG"
 * @param {object} options
 * @param {number} [options.radiusMetres=12000]  - search radius (default 12 km)
 * @param {string} [options.priceRange]          - 'budget' | 'midrange' | 'luxury' | undefined (all)
 * @returns {Promise<Array>}
 */
async function searchHotelsNearAirport(airportIata, options = {}) {
  const { radiusMetres = 12_000, priceRange } = options;

  const apiKey = process.env.GOOGLE_PLACES_KEY;
  const coords = AIRPORT_COORDS[airportIata];

  // ── Layer 1: Google Places ────────────────────────────────────────────────
  if (apiKey && coords) {
    try {
      console.log(`🌐 [Google Places] Hotels near ${airportIata}`);
      const rawPlaces = await getHotelsNearAirport(coords.lat, coords.lng, radiusMetres);

      if (rawPlaces.length > 0) {
        let hotels = rawPlaces.map(p => enrichGooglePlace(p, coords, airportIata));

        // Optional price filter
        if (priceRange) {
          hotels = hotels.filter(h => h.priceRange === priceRange);
        }

        // Sort: highest rating first, then by distance
        hotels.sort((a, b) =>
          (b.rating || 0) - (a.rating || 0) ||
          (a.distanceKm || 99) - (b.distanceKm || 99)
        );

        console.log(`✅ [Google Places] ${hotels.length} hotels near ${airportIata}`);
        return hotels.slice(0, 8); // top 8
      }

      console.log(`↩  [Google Places] No results for ${airportIata} — using fallback`);
    } catch (err) {
      console.error(`❌ [Google Places] ${err.message} — using fallback`);
    }
  } else {
    if (!apiKey) console.warn('⚠️  [Hotels] GOOGLE_PLACES_KEY not set — using static fallback');
    if (!coords) console.warn(`⚠️  [Hotels] No coordinates for ${airportIata} — using static fallback`);
  }

  // ── Layer 2: Static fallback ──────────────────────────────────────────────
  console.log(`📋 [Hotels] Static fallback for ${airportIata}`);
  return getMockHotels(airportIata);
}

module.exports = { searchHotelsNearAirport };
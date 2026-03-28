/**
 * Hotels Service
 * Provides hotel search and pricing near airports
 * Uses OpenStreetMap/Nominatim for hotel discovery and mock pricing
 */

const https = require('https');

// Mock hotel pricing database (would use real hotel API in production)
const HOTEL_PRICING = {
  budget: { min: 30, max: 80, stars: [2, 3] },
  midrange: { min: 80, max: 180, stars: [3, 4] },
  luxury: { min: 180, max: 400, stars: [4, 5] }
};

/**
 * Search hotels near a specific airport
 * @param {string} airportIata - Airport IATA code (e.g., "TUN", "CDG")
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Array of hotel options
 */
async function searchHotelsNearAirport(airportIata, options = {}) {
  const { 
    checkIn = 'today', 
    checkOut = 'tomorrow', 
    guests = 1, 
    rooms = 1,
    priceRange = 'midrange',
    radius = 10000 // 10km radius
  } = options;

  try {
    // Get airport coordinates from our airports database
    const { AIRPORTS } = require('./data/airports');
    const airport = AIRPORTS[airportIata];
    
    if (!airport || !airport.coordinates) {
      // Fallback to mock hotels if no coordinates available
      return getMockHotels(airportIata, options);
    }

    // Search for hotels using OpenStreetMap Overpass API
    const hotels = await searchNearbyHotels(airport.coordinates.lat, airport.coordinates.lon, radius);
    
    // Enhance with pricing and availability
    const enrichedHotels = hotels.map(hotel => enrichHotelData(hotel, priceRange, airportIata));
    
    // Sort by rating and price
    return enrichedHotels
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.pricePerNight - b.pricePerNight)
      .slice(0, 10); // Return top 10 options

  } catch (error) {
    console.error('Hotel search error:', error.message);
    return getMockHotels(airportIata, options);
  }
}

/**
 * Search for hotels using OpenStreetMap Overpass API
 */
async function searchNearbyHotels(lat, lon, radius) {
  return new Promise((resolve, reject) => {
    const query = `
      [out:json][timeout:25];
      (
        node["tourism"="hotel"](around:${radius},${lat},${lon});
        way["tourism"="hotel"](around:${radius},${lat},${lon});
        relation["tourism"="hotel"](around:${radius},${lat},${lon});
      );
      out geom;
    `;
    
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const hotels = result.elements.map(element => ({
            name: element.tags?.name || 'Unknown Hotel',
            type: 'hotel',
            address: element.tags?.['addr:street'] || 'Near Airport',
            phone: element.tags?.phone || null,
            website: element.tags?.website || null,
            rating: parseFloat(element.tags?.rating) || null,
            stars: parseInt(element.tags?.stars) || null,
            coordinates: {
              lat: element.lat || element.center?.lat,
              lon: element.lon || element.center?.lon
            },
            distance: calculateDistance(lat, lon, element.lat || element.center?.lat, element.lon || element.center?.lon)
          })).filter(h => h.coordinates.lat && h.coordinates.lon);
          
          resolve(hotels);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Calculate distance between two points in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

/**
 * Enrich hotel data with pricing and availability
 */
function enrichHotelData(hotel, priceRange, airportIata) {
  const pricing = HOTEL_PRICING[priceRange] || HOTEL_PRICING.midrange;
  const basePrice = pricing.min + Math.random() * (pricing.max - pricing.min);
  
  return {
    ...hotel,
    pricePerNight: Math.round(basePrice),
    currency: 'TND', // Tunisian Dinar
    priceRange,
    available: true, // Would check real availability
    amenities: getHotelAmenities(hotel.stars || 3),
    shuttleService: hotel.distance < 5000, // Free shuttle if < 5km
    airportIata,
    bookingUrl: `https://booking.com/hotel/${airportIata}/${hotel.name.toLowerCase().replace(/\s+/g, '-')}`
  };
}

/**
 * Get hotel amenities based on star rating
 */
function getHotelAmenities(stars) {
  const baseAmenities = ['WiFi', 'Air Conditioning'];
  
  if (stars >= 3) baseAmenities.push('Restaurant', 'Room Service');
  if (stars >= 4) baseAmenities.push('Fitness Center', 'Business Center');
  if (stars >= 5) baseAmenities.push('Spa', 'Concierge', 'Airport Shuttle');
  
  return baseAmenities;
}

/**
 * Fallback mock hotels when API fails
 */
function getMockHotels(airportIata, options) {
  const { AIRPORTS } = require('./data/airports');
  const airport = AIRPORTS[airportIata];
  
  if (!airport) return [];
  
  // Use hotels from airport database or create mock ones
  const mockHotels = airport.hotels_nearby || [
    { name: 'Airport Hotel', distance: '2 km by taxi', stars: 3, approx_price: '120 TND/night' },
    { name: 'City Center Hotel', distance: '15 min by taxi', stars: 4, approx_price: '200 TND/night' },
    { name: 'Budget Inn', distance: '10 min by taxi', stars: 2, approx_price: '60 TND/night' }
  ];
  
  return mockHotels.map((hotel, index) => ({
    name: hotel.name,
    type: 'hotel',
    address: hotel.distance,
    distance: parseInt(hotel.distance) || 5000,
    stars: hotel.stars,
    pricePerNight: parseInt(hotel.approx_price) || 100,
    currency: 'TND',
    available: true,
    amenities: getHotelAmenities(hotel.stars),
    shuttleService: hotel.distance.includes('km') && parseInt(hotel.distance) <= 5,
    airportIata,
    rating: 3.5 + Math.random() * 1.5,
    bookingUrl: `https://booking.com/hotel/${airportIata}/${hotel.name.toLowerCase().replace(/\s+/g, '-')}`
  }));
}

module.exports = { searchHotelsNearAirport };

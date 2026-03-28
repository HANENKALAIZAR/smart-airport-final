/**
 * Points of Interest Service
 * Provides restaurant, lounge, and activity discovery using Maps APIs
 * Uses OpenStreetMap/Nominatim for POI discovery
 */

const https = require('https');

/**
 * Search restaurants and lounges near an airport
 * @param {string} airportIata - Airport IATA code
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Array of POI options
 */
async function searchPOIsNearAirport(airportIata, options = {}) {
  const { 
    type = 'all', // 'restaurants', 'lounges', 'all'
    radius = 5000, // 5km radius
    openNow = false,
    priceRange = 'all' // 'budget', 'mid', 'expensive', 'all'
  } = options;

  try {
    // Get airport coordinates
    const { AIRPORTS } = require('./data/airports');
    const airport = AIRPORTS[airportIata];
    
    if (!airport || !airport.coordinates) {
      return getMockPOIs(airportIata, options);
    }

    // Search for POIs using OpenStreetMap Overpass API
    const pois = await searchNearbyPOIs(airport.coordinates.lat, airport.coordinates.lon, radius, type);
    
    // Enhance with additional data
    const enrichedPOIs = pois.map(poi => enrichPOIData(poi, airportIata));
    
    // Filter and sort
    let filteredPOIs = enrichedPOIs;
    
    if (openNow) {
      filteredPOIs = filteredPOIs.filter(poi => poi.isOpen);
    }
    
    if (priceRange !== 'all') {
      filteredPOIs = filteredPOIs.filter(poi => poi.priceCategory === priceRange);
    }
    
    return filteredPOIs
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 15); // Return top 15 options

  } catch (error) {
    console.error('POI search error:', error.message);
    return getMockPOIs(airportIata, options);
  }
}

/**
 * Search for POIs using OpenStreetMap Overpass API
 */
async function searchNearbyPOIs(lat, lon, radius, type) {
  return new Promise((resolve, reject) => {
    let filters = [];
    
    if (type === 'restaurants' || type === 'all') {
      filters.push(`
        node["amenity"~"restaurant|cafe|fast_food|food_court"](around:${radius},${lat},${lon});
        way["amenity"~"restaurant|cafe|fast_food|food_court"](around:${radius},${lat},${lon});
      `);
    }
    
    if (type === 'lounges' || type === 'all') {
      filters.push(`
        node["amenity"~"lounge|bar"](around:${radius},${lat},${lon});
        way["amenity"~"lounge|bar"](around:${radius},${lat},${lon});
      `);
    }
    
    const query = `
      [out:json][timeout:25];
      (
        ${filters.join('\n        ')}
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
          const pois = result.elements.map(element => ({
            name: element.tags?.name || 'Unknown Place',
            type: determinePOIType(element.tags),
            address: element.tags?.['addr:street'] || 'Near Airport',
            phone: element.tags?.phone || null,
            website: element.tags?.website || null,
            rating: parseFloat(element.tags?.rating) || null,
            priceCategory: determinePriceCategory(element.tags),
            cuisine: element.tags?.cuisine || null,
            openingHours: element.tags?.['opening_hours'] || null,
            coordinates: {
              lat: element.lat || element.center?.lat,
              lon: element.lon || element.center?.lon
            },
            distance: calculateDistance(lat, lon, element.lat || element.center?.lat, element.lon || element.center?.lon)
          })).filter(poi => poi.coordinates.lat && poi.coordinates.lon);
          
          resolve(pois);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Determine POI type from tags
 */
function determinePOIType(tags) {
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (tags.amenity === 'cafe') return 'cafe';
  if (tags.amenity === 'fast_food') return 'fast_food';
  if (tags.amenity === 'lounge') return 'lounge';
  if (tags.amenity === 'bar') return 'bar';
  return 'other';
}

/**
 * Determine price category from tags
 */
function determinePriceCategory(tags) {
  if (tags?.['price_range']) {
    const range = tags['price_range'].toLowerCase();
    if (range.includes('$') || range.includes('budget')) return 'budget';
    if (range.includes('$$$') || range.includes('expensive')) return 'expensive';
    return 'mid';
  }
  return 'mid'; // Default
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
 * Enrich POI data with additional information
 */
function enrichPOIData(poi, airportIata) {
  const currentHour = new Date().getHours();
  const isOpen = parseOpeningHours(poi.openingHours, currentHour);
  
  return {
    ...poi,
    isOpen,
    distanceKm: Math.round(poi.distance / 100) / 10,
    travelTime: `${Math.round(poi.distance / 100)} min by car`,
    airportIata,
    recommendations: getRecommendations(poi.type, poi.cuisine),
    ratingDescription: getRatingDescription(poi.rating),
    priceRange: getPriceRangeDescription(poi.priceCategory)
  };
}

/**
 * Parse opening hours to determine if currently open
 */
function parseOpeningHours(openingHours, currentHour) {
  if (!openingHours) return true; // Assume open if no hours specified
  
  // Simple parsing - would need more sophisticated logic for real implementation
  if (openingHours.includes('24/7')) return true;
  if (openingHours.includes('Mo-Su')) return true;
  
  // Check if current hour is within typical business hours
  return currentHour >= 8 && currentHour <= 22;
}

/**
 * Get recommendations based on POI type
 */
function getRecommendations(type, cuisine) {
  const recommendations = {
    restaurant: ['Good for dinner', 'Make reservation recommended'],
    cafe: ['Great for coffee', 'Light meals available'],
    fast_food: ['Quick service', 'Budget-friendly'],
    lounge: ['Comfortable seating', 'Drinks and snacks'],
    bar: ['Evening atmosphere', 'Cocktails available']
  };
  
  return recommendations[type] || ['Popular choice'];
}

/**
 * Get rating description
 */
function getRatingDescription(rating) {
  if (!rating) return 'No reviews yet';
  if (rating >= 4.5) return 'Excellent';
  if (rating >= 4.0) return 'Very Good';
  if (rating >= 3.5) return 'Good';
  if (rating >= 3.0) return 'Average';
  return 'Below Average';
}

/**
 * Get price range description
 */
function getPriceRangeDescription(category) {
  const descriptions = {
    budget: 'Budget-friendly ($)',
    mid: 'Moderate ($$)',
    expensive: 'Upscale ($$$)'
  };
  return descriptions[category] || 'Moderate ($$)';
}

/**
 * Fallback mock POIs when API fails
 */
function getMockPOIs(airportIata, options) {
  const { AIRPORTS } = require('./data/airports');
  const airport = AIRPORTS[airportIata];
  
  if (!airport) return [];
  
  const mockPOIs = [];
  
  // Add restaurants from airport database
  if (airport.restaurants) {
    airport.restaurants.forEach(restaurant => {
      mockPOIs.push({
        name: restaurant.name,
        type: restaurant.type.toLowerCase(),
        address: `${restaurant.terminal}, ${airport.name}`,
        rating: 3.5 + Math.random() * 1.5,
        priceCategory: 'mid',
        cuisine: 'International',
        openingHours: restaurant.open,
        isOpen: true,
        distanceKm: 0.1,
        travelTime: 'Walking distance',
        airportIata,
        recommendations: ['Located in airport', 'Convenient for travelers'],
        ratingDescription: 'Good',
        priceRange: 'Moderate ($$)'
      });
    });
  }
  
  // Add lounges from airport database
  if (airport.lounges) {
    airport.lounges.forEach(lounge => {
      mockPOIs.push({
        name: lounge.name,
        type: 'lounge',
        address: `${lounge.terminal}, ${airport.name}`,
        rating: 4.0 + Math.random(),
        priceCategory: 'expensive',
        openingHours: '06:00-22:00',
        isOpen: true,
        distanceKm: 0.1,
        travelTime: 'Walking distance',
        airportIata,
        access: lounge.access,
        recommendations: ['Comfortable', 'Quiet atmosphere'],
        ratingDescription: 'Very Good',
        priceRange: 'Upscale ($$$)'
      });
    });
  }
  
  return mockPOIs;
}

module.exports = { searchPOIsNearAirport };

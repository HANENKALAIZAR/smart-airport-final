/**
 * Alternative Flights Service
 * Provides rebooking suggestions and alternative flight options
 * Uses mock data for demonstration, would integrate with airline APIs in production
 */

const { getFlightData } = require('./flightService');

/**
 * Get alternative flight options for a disrupted flight
 * @param {string} flightNumber - Original flight number
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Array of alternative flight options
 */
async function getAlternativeFlights(flightNumber, options = {}) {
  const { 
    passengers = 1,
    cabinClass = 'economy',
    maxWaitHours = 24,
    includeAirlines = 'all'
  } = options;

  try {
    // Get original flight details
    const originalFlight = await getFlightData(flightNumber);
    
    if (!originalFlight.found) {
      throw new Error(`Flight ${flightNumber} not found`);
    }

    // Generate alternative flights based on route and timing
    const alternatives = await generateAlternatives(originalFlight, {
      passengers,
      cabinClass,
      maxWaitHours,
      includeAirlines
    });

    return alternatives;

  } catch (error) {
    console.error('Alternative flights error:', error.message);
    return [];
  }
}

/**
 * Generate alternative flight options
 */
async function generateAlternatives(originalFlight, options) {
  const { maxWaitHours, cabinClass } = options;
  const alternatives = [];
  
  // Mock alternative flights database
  const mockAlternatives = getMockAlternativeFlights(originalFlight);
  
  // Filter and enrich alternatives
  mockAlternatives.forEach(alt => {
    const waitTime = calculateWaitTime(originalFlight.departure.scheduled, alt.departure.scheduled);
    
    if (waitTime <= maxWaitHours) {
      alternatives.push({
        ...alt,
        waitTimeHours: waitTime,
        rebookingType: determineRebookingType(waitTime, alt.status),
        seatsAvailable: Math.floor(Math.random() * 50) + 1,
        priceImpact: calculatePriceImpact(originalFlight, alt, cabinClass),
        recommendation: getRecommendation(waitTime, alt.airline.name, alt.status),
        bookingAction: getBookingAction(alt.status, waitTime)
      });
    }
  });

  // Sort by wait time and recommendation score
  return alternatives
    .sort((a, b) => a.waitTimeHours - b.waitTimeHours)
    .slice(0, 5); // Return top 5 alternatives
}

/**
 * Mock alternative flights database
 */
function getMockAlternativeFlights(originalFlight) {
  const { departure, arrival, airline } = originalFlight;
  const routeKey = `${departure.iata}-${arrival.iata}`;
  
  const alternatives = {
    'TUN-CDG': [
      {
        flight_number: 'AF1083',
        airline: { name: 'Air France', iata: 'AF' },
        departure: { airport: departure.airport, iata: departure.iata, scheduled: '16:00', delay: 0 },
        arrival: { airport: arrival.airport, iata: arrival.iata, scheduled: '18:45' },
        status: 'on_time'
      },
      {
        flight_number: 'TU743',
        airline: { name: 'Tunisair', iata: 'TU' },
        departure: { airport: departure.airport, iata: departure.iata, scheduled: '18:30', delay: 0 },
        arrival: { airport: arrival.airport, iata: arrival.iata, scheduled: '21:10' },
        status: 'on_time'
      },
      {
        flight_number: 'LH1325',
        airline: { name: 'Lufthansa', iata: 'LH' },
        departure: { airport: departure.airport, iata: departure.iata, scheduled: '20:15', delay: 0 },
        arrival: { airport: arrival.airport, iata: arrival.iata, scheduled: '23:55' },
        status: 'on_time'
      }
    ],
    'DXB-TUN': [
      {
        flight_number: 'EK747',
        airline: { name: 'Emirates', iata: 'EK' },
        departure: { airport: departure.airport, iata: departure.iata, scheduled: '08:30', delay: 0 },
        arrival: { airport: arrival.airport, iata: arrival.iata, scheduled: '13:05' },
        status: 'on_time'
      },
      {
        flight_number: 'TU205',
        airline: { name: 'Tunisair', iata: 'TU' },
        departure: { airport: departure.airport, iata: departure.iata, scheduled: '14:00', delay: 0 },
        arrival: { airport: arrival.airport, iata: arrival.iata, scheduled: '16:45' },
        status: 'on_time'
      }
    ],
    'ORY-DJE': [
      {
        flight_number: 'TO3563',
        airline: { name: 'Transavia France', iata: 'TO' },
        departure: { airport: departure.airport, iata: departure.iata, scheduled: '11:00', delay: 0 },
        arrival: { airport: arrival.airport, iata: arrival.iata, scheduled: '14:25' },
        status: 'on_time'
      },
      {
        flight_number: 'TU776',
        airline: { name: 'Tunisair', iata: 'TU' },
        departure: { airport: departure.airport, iata: departure.iata, scheduled: '15:30', delay: 0 },
        arrival: { airport: arrival.airport, iata: arrival.iata, scheduled: '19:05' },
        status: 'on_time'
      }
    ],
    'FRA-TUN': [
      {
        flight_number: 'TU571',
        airline: { name: 'Tunisair', iata: 'TU' },
        departure: { airport: departure.airport, iata: departure.iata, scheduled: '16:45', delay: 0 },
        arrival: { airport: arrival.airport, iata: arrival.iata, scheduled: '20:20' },
        status: 'on_time'
      }
    ],
    'CDG-MIR': [
      {
        flight_number: 'TU842',
        airline: { name: 'Tunisair', iata: 'TU' },
        departure: { airport: departure.airport, iata: departure.iata, scheduled: '18:00', delay: 0 },
        arrival: { airport: arrival.airport, iata: arrival.iata, scheduled: '21:15' },
        status: 'on_time'
      },
      {
        flight_number: 'AF1256',
        airline: { name: 'Air France', iata: 'AF' },
        departure: { airport: departure.airport, iata: departure.iata, scheduled: '20:30', delay: 0 },
        arrival: { airport: arrival.airport, iata: arrival.iata, scheduled: '23:45' },
        status: 'on_time'
      }
    ]
  };

  return alternatives[routeKey] || [];
}

/**
 * Calculate wait time between flights in hours
 */
function calculateWaitTime(originalTime, newTime) {
  const original = parseTime(originalTime);
  const newFlight = parseTime(newTime);
  
  let waitHours = newFlight - original;
  if (waitHours < 0) waitHours += 24; // Next day
  
  return waitHours;
}

/**
 * Parse time string to hours since midnight
 */
function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + minutes / 60;
}

/**
 * Determine rebooking type based on wait time and status
 */
function determineRebookingType(waitTime, status) {
  if (status === 'cancelled') return 'mandatory_rebooking';
  if (waitTime <= 2) return 'quick_rebooking';
  if (waitTime <= 6) return 'standard_rebooking';
  return 'delayed_rebooking';
}

/**
 * Calculate price impact for rebooking
 */
function calculatePriceImpact(originalFlight, alternativeFlight, cabinClass) {
  // Mock pricing logic
  const basePrice = {
    economy: 500,
    premium_economy: 800,
    business: 1500,
    first: 3000
  };
  
  const originalPrice = basePrice[cabinClass] || basePrice.economy;
  const alternativePrice = originalPrice * (0.8 + Math.random() * 0.4); // ±20% variation
  
  return {
    originalPrice,
    alternativePrice,
    difference: Math.round(alternativePrice - originalPrice),
    refundEligible: originalFlight.status === 'cancelled' || originalFlight.departure.delay > 180
  };
}

/**
 * Get recommendation for alternative flight
 */
function getRecommendation(waitTime, airline, status) {
  if (waitTime <= 2) return `Excellent option - ${airline} flight departing soon`;
  if (waitTime <= 4) return `Good alternative - ${airline} with reasonable wait time`;
  if (waitTime <= 8) return `Acceptable option - ${airline} flight available`;
  return `Last resort - ${airline} if no other options available`;
}

/**
 * Get booking action recommendation
 */
function getBookingAction(status, waitTime) {
  if (status === 'cancelled') {
    return 'Contact airline immediately for rebooking';
  }
  if (waitTime <= 2) {
    return 'Proceed to gate - boarding soon';
  }
  if (waitTime <= 6) {
    return 'Confirm rebooking at service desk';
  }
  return 'Consider rebooking or refund options';
}

/**
 * Get rebooking options summary
 */
async function getRebookingSummary(flightNumber) {
  const alternatives = await getAlternativeFlights(flightNumber);
  
  if (alternatives.length === 0) {
    return {
      available: false,
      message: 'No alternative flights available within 24 hours',
      recommendation: 'Contact airline for special arrangements'
    };
  }

  const bestOption = alternatives[0];
  const totalOptions = alternatives.length;
  
  return {
    available: true,
    totalOptions,
    bestOption: {
      flightNumber: bestOption.flight_number,
      airline: bestOption.airline.name,
      departure: bestOption.departure.scheduled,
      waitTime: bestOption.waitTimeHours,
      seatsAvailable: bestOption.seatsAvailable
    },
    recommendation: totalOptions === 1 
      ? 'Only one alternative available - book quickly'
      : `${totalOptions} options available - choose based on wait time and airline preference`,
    nextSteps: [
      'Visit airline service desk',
      'Have booking reference ready',
      'Check if rebooking is complimentary'
    ]
  };
}

module.exports = { 
  getAlternativeFlights, 
  getRebookingSummary 
};

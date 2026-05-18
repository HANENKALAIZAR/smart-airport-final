const axios = require("axios");

async function getHotelsNearAirport(lat, lng, radiusMetres = 12000) {
    try {
        const response = await axios.post(
            "https://places.googleapis.com/v1/places:searchNearby",
            {
                includedTypes: ["hotel", "lodging"],
                maxResultCount: 10,
                locationRestriction: {
                    circle: {
                        center: {
                            latitude: lat,
                            longitude: lng
                        },
                        radius: radiusMetres
                    }
                }
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": process.env.GOOGLE_PLACES_KEY,
                    "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.websiteUri,places.nationalPhoneNumber,places.regularOpeningHours,places.types",
                    "Referer": "http://localhost:8082"
                }
            }
        );

        return response.data.places || [];

    } catch (error) {
        const errorDetails = error.response?.data?.error;
        if (errorDetails) {
            console.error(`❌ Google Places API Error: [${errorDetails.status}] ${errorDetails.message}`);
            throw new Error(`Google Places API Error: ${errorDetails.message}`);
        } else {
            console.error("❌ Google Places API Error:", error.message);
            throw error;
        }
    }
}

module.exports = { getHotelsNearAirport };
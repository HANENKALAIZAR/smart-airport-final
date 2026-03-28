import { Message, Suggestion } from "./ChatMessage";

// Real AI Assistant that connects to our backend API
export class AIAssistant {
  private sessionId: string;
  private baseUrl: string;
  private lastStructuredData: any = null;

  private airportCode: string;

  constructor(conversationId?: string, airportCode?: string) {
    this.sessionId = conversationId || `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.baseUrl = 'http://localhost:3001';
    this.airportCode = airportCode || 'TUN';
  }

  setAirport(airportCode: string) {
    this.airportCode = airportCode;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(7);
  }

  // Convert backend structured response to phased conversational messages
  private convertToPhasedMessages(structuredData: any): Message[] {
    const messages: Message[] = [];
    const { flightInfo, cards } = structuredData;

    // Message 1: Flight Status (Short and Clear)
    const delayHours = Math.floor(flightInfo.delay / 60);
    const delayMinutes = flightInfo.delay % 60;
    const delayText = delayHours > 0 ? 
      `Estimated delay: ${delayHours}h ${delayMinutes}min` : 
      'On time';

    messages.push({
      id: this.generateId(),
      type: "assistant",
      content: `Flight ${flightInfo.flightNumber} — ${flightInfo.airline}\n${flightInfo.route}\n\nStatus: ${flightInfo.status}\n${delayText}\n\nWould you like assistance with your journey?\n\nAvailable services:\n• Check passenger rights\n• Find alternative flights\n• Look for nearby hotels\n• Airport services (Wi-Fi, restaurants, lounges)`,
      timestamp: new Date()
    });

    return messages;
  }

  // Convert our backend structured response to Figma UI suggestions
  private convertStructuredToSuggestions(structuredData: any): Suggestion[] {
    const suggestions: Suggestion[] = [];

    structuredData.cards.forEach((card: any) => {
      switch (card.type) {
        case 'rights_advice':
          suggestions.push({
            id: this.generateId(),
            category: "rights",
            title: card.title,
            description: card.content.important_note,
            details: [
              ...card.content.care,
              ...card.content.options
            ],
            link: "https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_en.htm"
          });
          break;

        case 'hotel_options':
          suggestions.push({
            id: this.generateId(),
            category: "hotel",
            title: card.title,
            description: card.content.coveredByAirline ? 
              "Covered by airline - No cost to you" : 
              "Self-arranged accommodation",
            details: card.content.hotels.map((hotel: any) => 
              `${hotel.name} - ${hotel.pricePerNight} TND/night, ${hotel.distanceKm}km away${hotel.shuttleService ? ' (shuttle available)' : ''}`
            ),
            link: "https://www.booking.com"
          });
          break;

        case 'alternative_flights':
          suggestions.push({
            id: this.generateId(),
            category: "flight",
            title: card.title,
            description: card.content.rebookingSummary.recommendation,
            details: card.content.alternatives.map((alt: any) => 
              `${alt.flight_number} (${alt.airline.name}) - Departs: ${alt.departure.scheduled}, Wait: ${alt.waitTimeHours}h, ${alt.seatsAvailable} seats available`
            ),
            link: "#"
          });
          break;

        case 'things_to_do':
          suggestions.push({
            id: this.generateId(),
            category: "service",
            title: card.title,
            description: "Airport facilities and services",
            details: [
              `WiFi: ${card.content.wifi}`,
              ...card.content.restaurants.map((rest: any) => `${rest.name} (${rest.distanceKm}km)`),
              ...card.content.lounges.map((lounge: any) => `${lounge.name} (${lounge.distanceKm}km)`)
            ],
            link: "#"
          });
          break;
      }
    });

    return suggestions;
  }

  // Handle follow-up queries for conversational flow
  handleFollowUp(query: string): Message | null {
    if (!this.lastStructuredData) return null;

    const lowerQuery = query.toLowerCase();
    
    // Check for service requests
    if (lowerQuery.includes('rights') || lowerQuery.includes('passenger rights')) {
      const rightsCard = this.lastStructuredData.cards.find((card: any) => card.type === 'rights_advice');
      if (rightsCard) {
        return {
          id: this.generateId(),
          type: "assistant",
          content: `Passenger Rights Information\n\nYour flight is delayed by ${Math.floor(this.lastStructuredData.flightInfo.delay / 60)} hours.\n\nYou may be eligible for:\n\n${rightsCard.content.care.map((care: string) => `• ${care}`).join('\n')}\n\nIf you need help requesting these services, I can guide you.\n\nWould you like help?`,
          timestamp: new Date()
        };
      }
    }

    if (lowerQuery.includes('airport') || lowerQuery.includes('services') || lowerQuery.includes('wifi') || lowerQuery.includes('restaurants')) {
      const servicesCard = this.lastStructuredData.cards.find((card: any) => card.type === 'things_to_do');
      if (servicesCard) {
        return {
          id: this.generateId(),
          type: "assistant",
          content: `Airport Services at ${this.lastStructuredData.flightInfo.route.split(' → ')[0]}\n\nWi-Fi\nNetwork: ${servicesCard.content.wifi}\nPassword: Not required\n\nRestaurants nearby:\n${servicesCard.content.restaurants.map((rest: any) => `• ${rest.name}`).join('\n')}\n\nWould you like directions or more services?`,
          timestamp: new Date()
        };
      }
    }

    if (lowerQuery.includes('alternative') || lowerQuery.includes('flight') || lowerQuery.includes('earlier')) {
      const flightsCard = this.lastStructuredData.cards.find((card: any) => card.type === 'alternative_flights');
      if (flightsCard) {
        const alternatives = flightsCard.content.alternatives.slice(0, 2);
        return {
          id: this.generateId(),
          type: "assistant",
          content: `I found these alternative flights to ${this.lastStructuredData.flightInfo.route.split(' → ')[1]}:\n\n${alternatives.map((alt: any) => `${alt.flight_number} — ${alt.airline.name}\nDeparture: ${alt.departure.scheduled}\nAvailable seats: ${alt.seatsAvailable}\nEstimated wait: ${alt.waitTimeHours}h\n`).join('\n')}\n\nWould you like help contacting the airline or booking one of these flights?`,
          timestamp: new Date()
        };
      }
    }

    if (lowerQuery.includes('hotel') || lowerQuery.includes('accommodation')) {
      const hotelCard = this.lastStructuredData.cards.find((card: any) => card.type === 'hotel_options');
      if (hotelCard) {
        return {
          id: this.generateId(),
          type: "assistant",
          content: `Hotel Accommodation\n\n${hotelCard.content.coveredByAirline ? '✅ Covered by airline - No cost to you' : '💳 Self-arranged - You will need to pay'}\n\nNearby hotels:\n${hotelCard.content.hotels.slice(0, 2).map((hotel: any) => `• ${hotel.name} - ${hotel.pricePerNight} TND/night, ${hotel.distanceKm}km away${hotel.shuttleService ? ' (shuttle available)' : ''}`).join('\n')}\n\nWould you like me to help with booking?`,
          timestamp: new Date()
        };
      }
    }

    return null;
  }

  async analyzeQuery(query: string): Promise<Message> {
    try {
      // First check if this is a follow-up query
      const followUpResponse = this.handleFollowUp(query);
      if (followUpResponse) {
        return followUpResponse;
      }

      // If not a follow-up, call backend API
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          history: [],
          conversationId: this.sessionId,
          airportCode: this.airportCode  // Send selected airport to backend
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();

      // Convert backend response to phased messages
      if (data.structuredData) {
        this.lastStructuredData = data.structuredData;
        const phasedMessages = this.convertToPhasedMessages(data.structuredData);
        
        // Return first message immediately
        return phasedMessages[0];
      }

      // Fallback for non-structured responses
      return {
        id: this.generateId(),
        type: "assistant",
        content: data.reply || "I'm processing your request...",
        suggestions: [],
        timestamp: new Date()
      };

    } catch (error: any) {
      console.error('AI Assistant Error:', error);
      
      // Fallback to basic response
      return {
        id: this.generateId(),
        type: "assistant",
        content: "I'm having trouble connecting to the flight system. Please try again in a moment. For immediate assistance, please visit your airline service desk.",
        suggestions: [],
        timestamp: new Date()
      };
    }
  }

  getWelcomeMessage(): Message {
    return {
      id: this.generateId(),
      type: "assistant",
      content: "مرحبا! Welcome! I'm ATLAS - your AI Passenger Assistant for Tunisian airports. I can help with flight delays, passenger rights, hotels, airport services, and alternative flights. How can I assist you today?",
      timestamp: new Date()
    };
  }

  getQuickSuggestions(): string[] {
    return [
      "TU741 delayed 3 hours",
      "LH1354 cancelled",
      "U21504 easyJet 5 hours",
      "What are my passenger rights?",
      "I need a hotel for tonight"
    ];
  }
}
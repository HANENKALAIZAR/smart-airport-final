import type { Message } from "../components/ChatMessage";

export class AIAssistant {
  private conversationId: string;
  private airportCode: string;

  constructor(conversationId: string, airportCode: string) {
    this.conversationId = conversationId;
    this.airportCode = airportCode;
  }

  setAirport(airportCode: string) {
    this.airportCode = airportCode;
  }

  async analyzeQuery(message: string): Promise<Message> {
    const response = await fetch("http://localhost:3001/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        conversationId: this.conversationId,
        airportCode: this.airportCode,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const data = await response.json();
    return {
      id: Math.random().toString(36).slice(2),
      type: "assistant",
      content: data.reply ?? "I could not generate a response.",
      suggestions: [],
      timestamp: new Date(),
    };
  }
}

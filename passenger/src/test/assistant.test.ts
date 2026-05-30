import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";

const requireMock = createRequire(import.meta.url);
const flightService = requireMock("../../../backend_AI/services/flightService");
const llmService = requireMock("../../../backend_AI/services/llm");

// Monkeypatch mock functions BEFORE requiring the agent to ensure destructuring picks up the mocks!
flightService.getFlightData = vi.fn();
flightService.getAlternativeFlights = vi.fn();
llmService.chat = vi.fn();

const agentModule = requireMock("../../../backend_AI/services/agent");
const runAgent = agentModule.runAgent;
const clearConversationHistory = agentModule.clearConversationHistory;

describe("Passenger AI Assistant - Alternative Flights Eligibility & Localization", () => {
  beforeEach(() => {
    clearConversationHistory();
    vi.mocked(flightService.getFlightData).mockReset();
    vi.mocked(flightService.getAlternativeFlights).mockReset().mockResolvedValue([]);
    vi.mocked(llmService.chat).mockReset();
  });

  it("should handle language detection and dynamic switching with correct actions", async () => {
    vi.mocked(flightService.getFlightData).mockResolvedValue({
      found: true,
      flight_number: "RJ552",
      airline: { name: "Royal Jordanian" },
      departure: { iata: "TUN", delay: 40 },
      arrival: { iata: "AMM" },
      status: "delayed",
      route_type: "tunisia_international"
    });

    // User asks in French
    const responseFr = await runAgent("Quels sont mes vols alternatifs pour mon vol RJ552?", [], "test-conv-lang");
    const replyFr = JSON.parse(responseFr.reply);
    
    expect(replyFr.message).toContain("Votre vol RJ552");
    expect(replyFr.message).toContain("retard");
    expect(replyFr.message).toContain("Royal Jordanian");
    expect(replyFr.actions).toEqual(["Voir les vols alternatifs", "Demander à un agent"]);

    // User switches to English
    const responseEn = await runAgent("Can you check alternative flights for me in English?", [], "test-conv-lang");
    const replyEn = JSON.parse(responseEn.reply);

    expect(replyEn.message).toContain("Your flight RJ552");
    expect(replyEn.message).toContain("delay");
    expect(replyEn.message).toContain("Royal Jordanian");
    expect(replyEn.actions).toEqual(["View alternative flights", "Ask an agent"]);
  });

  it("should return correct eligibility and exact wording for 40-minute delay (RJ552)", async () => {
    vi.mocked(flightService.getFlightData).mockResolvedValue({
      found: true,
      flight_number: "RJ552",
      airline: { name: "Royal Jordanian" },
      departure: { iata: "TUN", delay: 40 },
      arrival: { iata: "AMM" },
      status: "delayed",
      route_type: "tunisia_international"
    });

    // French query
    const resFr = await runAgent("vols alternatifs pour RJ552 avec 40 minutes de retard", [], "conv-40m");
    const parsedFr = JSON.parse(resFr.reply);
    expect(parsedFr.message).toBe(
      "Votre vol RJ552 affiche actuellement un retard de 40 minutes. Avec ce retard, vous n’êtes pas éligible à un vol alternatif gratuit. Vous pouvez toutefois contacter Royal Jordanian pour connaître les options disponibles."
    );
    expect(parsedFr.actions).toEqual(["Voir les vols alternatifs", "Demander à un agent"]);

    // English query
    const resEn = await runAgent("alternative flights for RJ552 with 40 minutes delay", [], "conv-40m");
    const parsedEn = JSON.parse(resEn.reply);
    expect(parsedEn.message).toBe(
      "Your flight RJ552 currently shows a 40-minute delay. With this delay, you are not eligible for a free alternative flight. You can still contact Royal Jordanian to check the available options."
    );
    expect(parsedEn.actions).toEqual(["View alternative flights", "Ask an agent"]);
  });

  it("should not be eligible for 179-minute delay", async () => {
    vi.mocked(flightService.getFlightData).mockResolvedValue({
      found: true,
      flight_number: "TU741",
      airline: { name: "Tunisair" },
      departure: { iata: "TUN", delay: 179 },
      arrival: { iata: "ORY" },
      status: "delayed",
      route_type: "tunisia_to_eu"
    });

    const res = await runAgent("alternative flights for TU741 with 179 minutes delay", [], "conv-179");
    const parsed = JSON.parse(res.reply);
    expect(parsed.message).toContain("not eligible");
    expect(parsed.message).toContain("179");
    expect(parsed.message).toContain("Tunisair");
    expect(parsed.actions).toEqual(["View alternative flights", "Ask an agent"]);
  });

  it("should be eligible for 180-minute delay", async () => {
    vi.mocked(flightService.getFlightData).mockResolvedValue({
      found: true,
      flight_number: "TU741",
      airline: { name: "Tunisair" },
      departure: { iata: "TUN", delay: 180 },
      arrival: { iata: "ORY" },
      status: "delayed",
      route_type: "tunisia_to_eu"
    });

    const res = await runAgent("alternative flights for TU741 with 180 minutes delay", [], "conv-180");
    const parsed = JSON.parse(res.reply);
    expect(parsed.message).toContain("eligible");
    expect(parsed.message).toContain("TU741");
    expect(parsed.actions).toEqual(["View alternative flights", "Ask an agent"]);
  });

  it("should be eligible if the flight is cancelled", async () => {
    vi.mocked(flightService.getFlightData).mockResolvedValue({
      found: true,
      flight_number: "TU741",
      airline: { name: "Tunisair" },
      departure: { iata: "TUN" },
      arrival: { iata: "ORY" },
      status: "cancelled",
      route_type: "tunisia_to_eu"
    });

    const res = await runAgent("alternative flights for TU741", [], "conv-cancelled");
    const parsed = JSON.parse(res.reply);
    expect(parsed.message).toContain("eligible");
    expect(parsed.message).toContain("TU741");
    expect(parsed.actions).toEqual(["View alternative flights", "Ask an agent"]);
  });

  it("should say unknown eligibility if delay is unknown", async () => {
    vi.mocked(flightService.getFlightData).mockResolvedValue({
      found: true,
      flight_number: "TU741",
      airline: { name: "Tunisair" },
      departure: { iata: "TUN" },
      arrival: { iata: "ORY" },
      status: "custom_unknown_status",
      route_type: "tunisia_to_eu"
    });

    const res = await runAgent("alternative flights for TU741", [], "conv-unknown");
    const parsed = JSON.parse(res.reply);
    expect(parsed.message).toContain("cannot confirm");
    expect(parsed.actions).toEqual(["View alternative flights", "Ask an agent"]);
  });

  it("should accurately detect English in Hotels near the airport and maintain airport buttons", async () => {
    // 1st Turn: Hotels near the airport
    const turn1 = await runAgent("Hotels near the airport", [], "conv-hotels-lang");
    const parsed1 = JSON.parse(turn1.reply);
    expect(parsed1.message).toBe("Which airport are you inquiring about?");
    expect(parsed1.actions).toEqual(["Tunis-Carthage", "Djerba", "Monastir", "Enfidha"]);

    // 2nd Turn: I DONT SPEAK FRENCH
    const turn2 = await runAgent("I DONT SPEAK FRENCH", [], "conv-hotels-lang");
    const parsed2 = JSON.parse(turn2.reply);
    expect(parsed2.message).toBe("Which airport are you inquiring about?");
    expect(parsed2.actions).toEqual(["Tunis-Carthage", "Djerba", "Monastir", "Enfidha"]);

    // 3rd Turn: GIVE ME OPTIONS
    const turn3 = await runAgent("GIVE ME OPTIONS", [], "conv-hotels-lang");
    const parsed3 = JSON.parse(turn3.reply);
    expect(parsed3.message).toBe("Which airport are you inquiring about?");
    expect(parsed3.actions).toEqual(["Tunis-Carthage", "Djerba", "Monastir", "Enfidha"]);
  });
});

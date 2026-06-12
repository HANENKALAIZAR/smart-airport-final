require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { runAgent, clearSession } = require("./services/agent");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory session store (replace with Redis for production)
// Sessions are managed exclusively inside agent.js' Map.
// server.js does NOT maintain a separate session store.

// Rate limiter for /api/chat: 30 requests per 15 minutes per IP
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      reply: JSON.stringify({
        type: "general",
        message: "You have sent too many requests. Please wait a few minutes before trying again.",
        actions: []
      }),
      sessionId: req.body.sessionId || req.body.conversationId || "rate-limited"
    });
  }
});

/**
 * POST /api/chat
 * Body: { sessionId: string, message: string }
 * Returns: { reply: string, sessionId: string }
 */
app.post("/api/chat", chatLimiter, async (req, res) => {
  const { sessionId, message, conversationId, airportCode } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  // Generate session ID if not provided
  const sid = sessionId || conversationId || `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  try {
    // agent.js manages conversation history in its own Map.
    // The history parameter is unused by runAgent — it reads/writes its own store.
    const { reply } = await runAgent(message, [], sid, airportCode);

    res.json({ reply, sessionId: sid });
  } catch (err) {
    console.error("Agent error:", err);
    res.json({
      reply: JSON.stringify({
        type: "general",
        message: "Our assistant is temporarily unavailable. Please try again in a few moments.",
        actions: ["Flight Status", "Airport Services", "Passenger Rights"]
      }),
      sessionId: sid
    });
  }
});

/**
 * DELETE /api/chat/:sessionId
 * Clear conversation history for a session
 */
app.delete("/api/chat/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  // Single point of clearance — agent.js owns all session state
  clearSession(sessionId);
  res.json({ cleared: true, sessionId });
});

/**
 * GET /api/health
 */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Airport AI Agent running on http://localhost:${PORT}`);
  console.log(`Groq key: ${process.env.GROQ_API_KEY ? "✓ set" : "✗ missing"}`);
  console.log(`Aviation Edge key: ${process.env.AVIATION_EDGE_KEY ? "✓ set (live data)" : "— not set"}`);
  console.log(`Google Places key: ${process.env.GOOGLE_PLACES_KEY ? "✓ set" : "✗ missing"}`);
});
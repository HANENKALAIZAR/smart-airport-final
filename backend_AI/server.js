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
const sessions = {};

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

  // Load or init conversation history for this session
  const history = sessions[sid] || [];

  try {
    // Pass sid as conversationId so agent maintains per-session state
    const { reply, updatedHistory } = await runAgent(message, history, sid, airportCode);

    // Persist updated history (cap at last 20 messages to save memory)
    sessions[sid] = updatedHistory.slice(-20);

    res.json({ reply, sessionId: sid });
  } catch (err) {
    console.error("Agent error:", err);
    res.status(500).json({ error: "Agent encountered an error. Please try again." });
  }
});

/**
 * DELETE /api/chat/:sessionId
 * Clear conversation history for a session
 */
app.delete("/api/chat/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  delete sessions[sessionId];
  try {
    clearSession(sessionId);
  } catch (err) {
    console.error("Error clearing agent session:", err);
  }
  res.json({ cleared: true });
});

/**
 * GET /api/health
 */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", sessions: Object.keys(sessions).length });
});

app.listen(PORT, () => {
  console.log(`Airport AI Agent running on http://localhost:${PORT}`);
  console.log(`Groq key: ${process.env.GROQ_API_KEY ? "✓ set" : "✗ missing"}`);
  console.log(`Aviation Edge key: ${process.env.AVIATION_EDGE_KEY ? "✓ set (live data)" : "— not set"}`);
});
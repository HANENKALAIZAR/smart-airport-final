require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { runAgent } = require("./services/agent");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory session store (replace with Redis for production)
const sessions = {};

/**
 * POST /api/chat
 * Body: { sessionId: string, message: string }
 * Returns: { reply: string, sessionId: string }
 */
app.post("/api/chat", async (req, res) => {
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
  delete sessions[req.params.sessionId];
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
  console.log(`Anthropic key: ${process.env.ANTHROPIC_API_KEY ? "✓ set" : "✗ missing"}`);
  console.log(`AviationStack key: ${process.env.AVIATIONSTACK_KEY ? "✓ set (live data)" : "— not set (using mock data)"}`);
});
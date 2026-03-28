import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Paperclip, Mic, Send, LogIn, Plus, Trash2, ChevronDown, Plane } from "lucide-react";
import { AIAssistant } from "../services/AIAssistant";
import { ChatMessage, Message } from "../components/ChatMessage";
import { PassengerAirportProvider, useAirport, TUNISIAN_AIRPORTS } from "../context/AirportContext";

/* ── Glowing Icon — w-28 h-28 (112px), cyan tile, Plane icon, blur glow ── */
function GlowingIcon() {
  return (
    <div style={{ position: "relative", width: 112, height: 112, margin: "0 auto 24px", flexShrink: 0 }}>
      {/* pin on top */}
      <div style={{
        position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
        width: 2, height: 14, background: "rgba(200,230,255,0.6)", borderRadius: 2, zIndex: 2,
      }} />
      <div style={{
        position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)",
        width: 7, height: 7, borderRadius: "50%", background: "rgba(200,230,255,0.85)", zIndex: 2,
      }} />

      {/* outer blur glow */}
      <div style={{
        position: "absolute", inset: -20,
        borderRadius: 28,
        background: "radial-gradient(ellipse at center, rgba(0,220,255,0.35) 0%, transparent 70%)",
        filter: "blur(12px)",
        zIndex: 0,
      }} />

      {/* cyan gradient tile */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: 22,
        background: "linear-gradient(145deg, #22d4f5 0%, #0ab8e0 55%, #059dc2 100%)",
        boxShadow: "0 0 28px rgba(0,210,255,0.5), 0 6px 20px rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1,
      }}>
        <Plane size={50} color="#0a1a2a" strokeWidth={2} />
      </div>
    </div>
  );
}

/* ── Airport selector ─────────────────────────────── */
function AirportSelector() {
  const { selectedAirport, setSelectedAirport } = useAirport() as any;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* same bg-gray-800 border-gray-700 as buttons */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "#1f2937", border: "1px solid #374151",
          borderRadius: 8, color: "#e2e8f0",
          fontSize: 13, fontWeight: 600,
          padding: "5px 12px", cursor: "pointer",
        }}
      >
        <span>{selectedAirport?.iata || "TUN"}</span>
        <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 50,
          /* same bg-gray-900 border-gray-700 */
          background: "#111827", border: "1px solid #374151",
          borderRadius: 12, minWidth: 220, overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "#6b7280", padding: "10px 14px 6px",
          }}>
            Select Airport
          </p>
          {(TUNISIAN_AIRPORTS as any[]).map((a) => (
            <button
              key={a.id}
              onClick={() => { setSelectedAirport(a); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "9px 14px",
                background: a.id === selectedAirport?.id ? "rgba(0,210,255,0.08)" : "none",
                border: "none", cursor: "pointer", textAlign: "left",
                color: a.id === selectedAirport?.id ? "#22d4f5" : "#e2e8f0",
                fontSize: 13,
                fontWeight: a.id === selectedAirport?.id ? 600 : 400,
              }}
            >
              <span style={{ fontWeight: 700, width: 32, color: "#22d4f5" }}>{a.iata}</span>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>{a.city}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Quick actions ────────────────────────────────── */
const QUICK_ACTIONS = [
  { icon: "✦", label: "What are my rights?" },
  { icon: "🏨", label: "Hotels Near Airport" },
  { icon: "✈️", label: "Alternative flights" },
];

/* ── Main component ───────────────────────────────── */
function AIAssistantContent() {
  const { selectedAirport } = useAirport() as any;
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId] = useState(() => `session_${Date.now()}`);

  const assistantRef = useRef<AIAssistant | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    assistantRef.current = new AIAssistant(conversationId, selectedAirport?.iata || "TUN");
  }, [conversationId]);

  useEffect(() => {
    if (assistantRef.current && selectedAirport) assistantRef.current.setAirport(selectedAirport.iata);
  }, [selectedAirport]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || !assistantRef.current) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      type: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await assistantRef.current.analyzeQuery(trimmed);
      setMessages((prev) => [...prev, response]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          type: "assistant",
          content: "I'm having trouble connecting right now. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearChat = () => {
    setMessages([]);
    assistantRef.current = new AIAssistant(`session_${Date.now()}`, selectedAirport?.iata || "TUN");
  };

  const hasMessages = messages.length > 0;
  const airportName = selectedAirport?.name || "Tunis-Carthage International Airport";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", background: "#000", color: "#fff",
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: "hidden",
    }}>

      {/* ── Header ──────────────────────────────── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: 52,
        borderBottom: "1px solid #1f2937", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
            {airportName} - AI Assistant
          </span>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#374151", display: "inline-block" }} />
          <AirportSelector />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* Login — cyan tint */}
          <button
            onClick={() => navigate("/login")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              color: "#38bdf8", fontSize: 13, fontWeight: 500,
              padding: "6px 14px", borderRadius: 8,
              border: "none", background: "none", cursor: "pointer",
            }}
          >
            <LogIn size={15} />
            Login
          </button>
          {[
            { icon: <Plus size={15} />, label: "New chat", onClick: clearChat },
            { icon: <Trash2 size={15} />, label: "Clear chat", onClick: clearChat },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.onClick}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                color: "#9ca3af", fontSize: 13, fontWeight: 500,
                padding: "6px 14px", borderRadius: 8,
                border: "none", background: "none", cursor: "pointer",
              }}
            >
              {btn.icon}
              {btn.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Chat / Hero ──────────────────────────── */}
      <main ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "0 24px" }}>
        {!hasMessages ? (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            textAlign: "center",
            minHeight: "calc(100vh - 52px - 80px)",
            padding: "0 16px",
          }}>
            {/* Icon: 112px, cyan, Plane, glow */}
            <GlowingIcon />

            {/* Title: text-3xl/4xl font-bold */}
            <h1 style={{
              fontSize: "clamp(1.875rem, 4vw, 2.25rem)",
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.2,
              margin: "0 0 12px",
              maxWidth: 700,
            }}>
              {airportName}
              <br />- AI Assistant
            </h1>

            {/* "Your 24/7..." — text-base font-semibold */}
            <p style={{ fontSize: 16, fontWeight: 600, color: "#fff", margin: "0 0 8px" }}>
              Your 24/7 Flight Support System
            </p>

            <p style={{ fontSize: 14, color: "#9ca3af", margin: "0 0 4px" }}>
              How Can We Help You?
            </p>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 32px" }}>
              Select a quick action below or type your question in chat
            </p>

            {/* Buttons: bg-gray-900 (#111827) border-gray-700 (#374151) */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.label)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "#111827",
                    border: "1px solid #374151",
                    color: "#e2e8f0",
                    fontSize: 14, fontWeight: 500,
                    padding: "10px 20px",
                    borderRadius: 12,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#1f2937";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#4b5563";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#111827";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#374151";
                  }}
                >
                  <span style={{ fontSize: 16 }}>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 0" }}>
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onActionClick={(action) => sendMessage(action)}
              />
            ))}
            {isLoading && (
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: "linear-gradient(135deg, #22d4f5, #0ab8e0)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: "#0a1a2a", fontWeight: 700, fontSize: 12,
                }}>AI</div>
                <div style={{
                  background: "#111827", border: "1px solid #374151",
                  padding: "14px 20px", borderRadius: "18px 18px 18px 4px",
                }}>
                  <div style={{ display: "flex", gap: 5, alignItems: "center", height: 20 }}>
                    {[0, 150, 300].map((delay, i) => (
                      <span key={i} style={{
                        width: 8, height: 8, borderRadius: "50%", background: "#22d4f5",
                        display: "inline-block",
                        animation: "bounce 1s infinite",
                        animationDelay: `${delay}ms`,
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Input bar — bg-gray-900 border-gray-700, send = cyan-500 ── */}
      <div style={{ flexShrink: 0, padding: "12px 24px 20px", background: "#000" }}>
        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: 760, margin: "0 auto",
            display: "flex", alignItems: "center", gap: 12,
            background: "#111827",
            border: "1px solid #374151",
            borderRadius: 20, padding: "10px 14px",
          }}
        >
          <button type="button" style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", display: "flex", padding: 4 }}>
            <Paperclip size={20} />
          </button>
          <button type="button" style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", display: "flex", padding: 4 }}>
            <Mic size={20} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question here... (e.g., 'My flight is delayed 5 hours, what can I do?')"
            disabled={isLoading}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "#e2e8f0", fontSize: 14, fontFamily: "inherit",
            }}
          />
          {/* Send — bg-cyan-500 (#06b6d4), glow matches icon */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: input.trim() && !isLoading ? "#06b6d4" : "#1f2937",
              border: "none",
              color: input.trim() && !isLoading ? "#000" : "#4b5563",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: input.trim() && !isLoading ? "pointer" : "default",
              flexShrink: 0, transition: "all 0.2s",
              boxShadow: input.trim() && !isLoading ? "0 0 12px rgba(6,182,212,0.4)" : "none",
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Page wrapper ─────────────────────────────────── */
export default function AIAssistantPage() {
  return (
    <PassengerAirportProvider>
      <AIAssistantContent />
    </PassengerAirportProvider>
  );
}
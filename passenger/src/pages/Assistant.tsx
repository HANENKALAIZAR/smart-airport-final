import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sparkles, Send, Plane, Luggage, Clock, MapPin, Bot, User, Scale, Hotel, PlaneTakeoff, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
const AI_URL = import.meta.env.VITE_AI_URL || "http://localhost:3001";
type Msg = { role: "user" | "assistant"; content: string; actions?: string[] };

function detectMsgLanguage(msg: string, fallback: string) {
  if (!msg) return fallback;
  if (/[\u0600-\u06FF]/.test(msg)) return 'ar';
  if (/\b(vol|vols|retard|retardé|annulé|billet|aéroport|bonjour|merci|oui|non|s'il vous plaît|salut|français|bagage|bagages|près)\b/i.test(msg)) return 'fr';
  if (/\b(flight|flights|delay|delayed|cancel|cancelled|ticket|airport|hello|thanks|yes|no|please|hi|english|baggage|luggage|near)\b/i.test(msg)) return 'en';
  return fallback;
}

export default function Assistant() {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const suggLang = detectMsgLanguage(lastUserMsg, i18n.language);
  const tSugg = i18n.getFixedT(suggLang);

  const SUGGESTIONS = [
    { icon: Clock, label: tSugg("assistant.sugg_delay") },
    { icon: Scale, label: tSugg("assistant.sugg_rights") },
    { icon: Hotel, label: tSugg("assistant.sugg_hotels") },
    { icon: PlaneTakeoff, label: tSugg("assistant.sugg_alt") },
  ];

  const clearChat = async () => {
    setMessages([]);
    try {
      await fetch(`${AI_URL}/api/chat/passenger-session`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to clear backend session:", err);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    setShouldAutoScroll(isNearBottom);
  };

  useEffect(() => {
    if (shouldAutoScroll) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isTyping, shouldAutoScroll]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setShouldAutoScroll(true);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);

    const currentLang = detectMsgLanguage(trimmed, i18n.language);
    const tSugg = i18n.getFixedT(currentLang);

    try {
      const res = await fetch(`${AI_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationId: "passenger-session",
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const parsed = typeof data.reply === "string" ? JSON.parse(data.reply) : data.reply;

      // Build a readable reply from the structured JSON your backend returns
      let reply = parsed.message || "";

      if (parsed.flight) {
        const f = parsed.flight;
        const flightNum = f.flightNumber || f.number || '';
        const rawStatus = f.status || '';
        const statusKey = rawStatus.toLowerCase() === 'active' ? 'in_air' : rawStatus.toLowerCase();
        const translatedStatus = rawStatus ? (tSugg(`common.${statusKey}`) || rawStatus.toUpperCase()) : "";
        const statusStr = translatedStatus ? ` — **${translatedStatus.toUpperCase()}**` : "";
        const delayStr = f.delay && f.delay !== "0min" ? ` (${f.delay} ${tSugg("common.delayed") || "delay"})` : "";
        
        if (reply) reply += "\n\n";
        reply += `${tSugg("common.flightNumber") || 'Flight'} **${flightNum}** (${f.airline})${statusStr}${delayStr}\n`;
        if (f.route) {
          if (typeof f.route === 'object' && f.route.from) {
            reply += `Route: ${f.route.from} → ${f.route.to || ''}\n`;
          } else {
            reply += `Route: ${f.route}\n`;
          }
        }
        if (f.scheduledDeparture) reply += `${tSugg("common.departure")}: ${f.scheduledDeparture}\n`;
        if (f.scheduledArrival) reply += `${tSugg("common.arrival")}: ${f.scheduledArrival}\n`;
        if (f.gate) reply += `${tSugg("common.gate")}: ${f.gate}\n`;
      }

      if (!reply && !parsed.rights && !parsed.flights && !parsed.hotels && !parsed.services && !parsed.suggestion) {
        reply = tSugg("assistant.title");
      }

      if (parsed.rights?.length) {
        reply += "\n\n" + parsed.rights.map((r: { title: string; detail: string }) => `• **${r.title}**: ${r.detail}`).join("\n");
      }
      if (parsed.flights?.length) {
        reply += "\n\n" + parsed.flights.map((f: { flightNumber: string; airline: string; departure: string; status: string }) =>
          `• **${f.flightNumber}** (${f.airline}) — ${tSugg("common.departure") || "departs"} ${f.departure} — ${f.status}`
        ).join("\n");
      }
      if (parsed.hotels?.length) {
        reply += "\n\n" + parsed.hotels.slice(0, 3).map((h: { name: string; stars: number; pricePerNight: number }) =>
          `• **${h.name}** ${"★".repeat(h.stars || 3)} — ${h.pricePerNight || 0} TND/night`
        ).join("\n");
      }
      if (parsed.services?.length) {
        reply += "\n\n" + parsed.services.map((s: { name: string; location?: string; detail?: string }) => {
          let str = `• **${s.name}**`;
          if (s.location) str += ` — ${s.location}`;
          if (s.detail) str += ` (${s.detail})`;
          return str;
        }).join("\n");
      }
      if (parsed.suggestion) {
        reply += `\n\n${parsed.suggestion}`;
      }

      setIsTyping(false);

      // Animate the reply token by token
      setMessages((prev) => [...prev, { role: "assistant", content: "", actions: parsed.actions }]);
      const tokens = reply.split(/(\s+)/);
      for (let i = 0; i < tokens.length; i++) {
        await new Promise((r) => setTimeout(r, 25));
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: last.content + tokens[i] };
          }
          return copy;
        });
      }

    } catch (err) {
      console.error("AI error:", err);
      setIsTyping(false);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: tSugg("assistant.error_connect"),
      }]);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicNav overlay={false} />

      <main className="flex-1 pt-20 md:pt-24 pb-6">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-[calc(100vh-6rem)] flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 py-4 border-b border-border">
            <div className="relative h-10 w-10 rounded-xl bg-gradient-amber grid place-items-center shadow-amber shrink-0">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl text-foreground leading-tight truncate">
                AI Assistant
              </h1>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{t("assistant.new_chat")}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                disabled={messages.length === 0}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">{t("assistant.clear")}</span>
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-6 space-y-6">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-6">
                <div className="h-16 w-16 rounded-2xl bg-gradient-amber grid place-items-center shadow-amber">
                  <Bot className="h-7 w-7 text-primary-foreground" />
                </div>
                <div className="max-w-md">
                  <div className="text-xs uppercase tracking-[0.18em] text-primary mb-2">
                    {t("assistant.subtitle")}
                  </div>
                  <h2 className="font-display text-2xl text-foreground">
                    {t("assistant.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t("assistant.description")}
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 w-full max-w-xl">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => sendMessage(s.label)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-secondary transition-colors text-start"
                    >
                      <s.icon className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm text-foreground">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} onActionClick={sendMessage} />
            ))}

            {isTyping && (
              <div className="flex gap-3">
                <Avatar role="assistant" />
                <div className="flex items-center gap-1 px-4 py-3 rounded-2xl bg-secondary">
                  <Dot delay={0} />
                  <Dot delay={150} />
                  <Dot delay={300} />
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <Card className="p-2 bg-card border-border shadow-lg">
            <form onSubmit={onSubmit} className="flex items-end gap-2 relative">
              <Textarea
                id="chat-input"
                name="message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("assistant.placeholder")}
                rows={1}
                className="min-h-[44px] max-h-32 resize-none border-0 bg-transparent py-3 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isTyping}
                className="rounded-full bg-gradient-amber text-primary-foreground shadow-amber shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}

function MessageBubble({ message, onActionClick }: { message: Msg; onActionClick?: (text: string) => void }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar role={message.role} />
      <div className="flex flex-col gap-2 max-w-[78%]">
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "bg-gradient-amber text-primary-foreground shadow-amber rounded-tr-sm"
              : "bg-secondary text-foreground rounded-tl-sm"
          )}
        >
          {renderInline(message.content)}
        </div>
        {!isUser && message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {message.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => onActionClick?.(action)}
                className="text-xs px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  return (
    <div
      className={cn(
        "h-9 w-9 rounded-xl grid place-items-center shrink-0",
        role === "assistant"
          ? "bg-gradient-amber shadow-amber"
          : "bg-secondary border border-border"
      )}
    >
      {role === "assistant" ? (
        <Bot className="h-4 w-4 text-primary-foreground" />
      ) : (
        <User className="h-4 w-4 text-foreground" />
      )}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

// Tiny inline **bold** renderer to avoid pulling in a markdown lib for the demo.
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

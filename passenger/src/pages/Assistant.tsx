import { useEffect, useRef, useState } from "react";
import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Sparkles, Send, Plane, Luggage, Clock, MapPin, Bot, User, Scale, Hotel, PlaneTakeoff, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  { icon: Plane, label: "Track flight AF1234" },
  { icon: Clock, label: "Will my flight be delayed?" },
  { icon: MapPin, label: "Best lounge in Terminal 2" },
  { icon: Luggage, label: "Lost baggage — what do I do?" },
  { icon: Scale, label: "What are my rights?" },
  { icon: Hotel, label: "Hotels near the airport" },
  { icon: PlaneTakeoff, label: "Find an alternative flight" },
];

const MOCK_REPLIES: Record<string, string> = {
  default:
    "I'm your Smart Airport AI assistant (demo mode). I can help with flight tracking, gate updates, lounges, dining and passenger rights.\n\nConnect Lovable Cloud to enable live AI responses.",
  flight:
    "Flight **AF1234** is currently **on time**, departing from **Gate B12** at **18:45**. Boarding starts at 18:10. I'll alert you the moment anything changes.",
  delay:
    "Based on weather, ATC and historical patterns, your flight has a **12% probability of delay**. Conditions look favorable — no action needed.",
  lounge:
    "The top-rated lounge in Terminal 2 is the **Skyview Premium Lounge** (Level 3, near Gate B14): hot food, showers, runway view. ~6 min walk from your gate.",
  baggage:
    "If your bag is missing: 1) File a **PIR** at the airline desk before leaving the airport. 2) Keep your tag & boarding pass. 3) Save receipts for essentials — you may be reimbursed up to ~€1,800 under the Montreal Convention.",
  rights:
    "Under **EU 261/2004**, you may be entitled to **€250–€600** for delays of 3h+, cancellations with less than 14 days notice, or denied boarding — when the cause is within the airline's control. Visit **/passenger-rights** to run our free eligibility checker.",
  hotels:
    "Top-rated hotels near the airport:\n• **Sheraton Skyline** — 4★, 5 min shuttle, from €145\n• **Hilton Terminal 4** — 4★, connected walkway, from €189\n• **Premier Inn Airport** — 3★, 8 min shuttle, from €89\n\nIf your delay is the airline's fault and exceeds 6h overnight, the carrier must cover your stay.",
  alternative:
    "I found 3 alternative options for you:\n• **AF2210** — departs 20:15, same destination, 2 seats left\n• **KL5587** (codeshare) — departs 21:40, 1 stop via AMS\n• **BA8842** — tomorrow 06:30, direct\n\nWant me to request a rebooking with your airline?",
};

function pickMockReply(input: string): string {
  const q = input.toLowerCase();
  if (/right|compensat|eu\s?261|entitled/.test(q)) return MOCK_REPLIES.rights;
  if (/hotel|stay|overnight|accommodation/.test(q)) return MOCK_REPLIES.hotels;
  if (/alternative|rebook|another flight|other flight|reroute/.test(q)) return MOCK_REPLIES.alternative;
  if (/bag|luggage|lost|missing|suitcase/.test(q)) return MOCK_REPLIES.baggage;
  if (/lounge|relax|shower|food|eat|dining/.test(q)) return MOCK_REPLIES.lounge;
  if (/delay|late|on.?time|weather/.test(q)) return MOCK_REPLIES.delay;
  if (/flight|af\d|track|gate/.test(q)) return MOCK_REPLIES.flight;
  return MOCK_REPLIES.default;
}

export default function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate token-by-token streaming
    const reply = pickMockReply(trimmed);
    await new Promise((r) => setTimeout(r, 400));
    setIsTyping(false);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
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
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicNav overlay={false} />

      <main className="flex-1 pt-20 md:pt-24 pb-6">
        <div className="max-w-4xl mx-auto px-4 md:px-8 h-[calc(100vh-6rem)] flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 py-4 border-b border-border">
            <div className="relative h-10 w-10 rounded-xl bg-gradient-amber grid place-items-center shadow-amber shrink-0">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl text-foreground leading-tight truncate">
                AI Assistant
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                Demo mode · Flights, lounges, baggage & passenger rights
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMessages([])}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New chat</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMessages([])}
                disabled={messages.length === 0}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto py-6 space-y-6">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-6">
                <div className="h-16 w-16 rounded-2xl bg-gradient-amber grid place-items-center shadow-amber">
                  <Sparkles className="h-7 w-7 text-primary-foreground" />
                </div>
                <div className="max-w-md">
                  <div className="text-xs uppercase tracking-[0.18em] text-primary mb-2">
                    Your 24/7 Flight Support System
                  </div>
                  <h2 className="font-display text-2xl text-foreground">
                    How Can We Help You?
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    Select a quick action below or type your question in chat.
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
              <MessageBubble key={i} message={m} />
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
            <form onSubmit={onSubmit} className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the assistant anything…"
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
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
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Demo responses. Enable Lovable Cloud to power live AI replies.
          </p>
        </div>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: Msg }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar role={message.role} />
      <div
        className={cn(
          "max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-gradient-amber text-primary-foreground shadow-amber rounded-tr-sm"
            : "bg-secondary text-foreground rounded-tl-sm"
        )}
      >
        {renderInline(message.content)}
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

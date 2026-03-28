import React from "react";
import { Bot, User } from "lucide-react";
import QuickActions from './QuickActions';

export interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  suggestions?: Suggestion[];
  timestamp?: Date;
}

export interface Suggestion {
  id: string;
  category: "hotel" | "rights" | "service" | "activity" | "flight";
  title: string;
  description: string;
  details?: string[];
  link?: string;
}

export interface FlightInfo {
  flight?: string;
  airline?: string;
  route?: {
    from: string;
    to: string;
  };
  status?: string;
  delay?: string;
  message?: string;
  actions: string[];
  isFollowUp?: boolean;
  type?: 'flight' | 'rights' | 'services' | 'flights' | 'general';
  flights?: Array<{
    flightNumber: string;
    departure: string;
    arrival: string;
    airline: string;
    status: string;
  }>;
  rights?: Array<{
    title: string;
    detail: string;
  }>;
  services?: Array<{
    name: string;
    location: string;
    detail: string;
  }>;
  suggestion?: string;
}

interface ChatMessageProps {
  message: Message;
  onActionClick?: (action: string) => void;
}

export function ChatMessage({ message, onActionClick }: ChatMessageProps) {
  const formatTime = (date?: Date) => {
    if (!date) return "";
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  // Parse JSON content from assistant messages
  let parsedResponse: FlightInfo | null = null;
  let isJsonError = false;

  if (message.type === "assistant") {
    try {
      parsedResponse = JSON.parse(message.content);
      console.log(" [FRONTEND] Parsed JSON response:", parsedResponse);
      if (parsedResponse) {
        console.log("PARSED TYPE:", parsedResponse.type);
        console.log("PARSED CONTENT:", JSON.stringify(parsedResponse));
      }
    } catch (parseError) {
      isJsonError = true;
      console.log(" [FRONTEND] JSON parse error:", parseError);
    }
  }

  const renderFlightCard = (flight: FlightInfo) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Flight {flight.flight} — {flight.airline}
          </h3>
          {flight.delay && (
            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium border border-gray-200">
              {flight.delay}
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-gray-500 block mb-1">Route</span>
            <span className="text-sm text-gray-900">{flight.route?.from} → {flight.route?.to}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500 block mb-1">Status</span>
            <span className="text-sm text-gray-900">{flight.status}</span>
          </div>
        </div>
        
        {flight.message && <div className="text-sm text-gray-600">{flight.message}</div>}
      </div>
    </div>
  );

  const renderFlightsList = (data: FlightInfo) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
      <div className="space-y-3">
        {data.message && <div className="text-sm text-gray-600 mb-4">{data.message}</div>}
        
        <div className="space-y-2">
          {data.flights?.map((flight, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <span className="text-sm font-medium text-gray-900">{flight.flightNumber}</span>
              <span className="text-sm text-gray-600">{flight.departure} → {flight.arrival}</span>
              <span className="text-sm text-gray-600">{flight.airline}</span>
              <span className="text-sm text-gray-600">{flight.status}</span>
            </div>
          ))}
        </div>
        
        {data.suggestion && (
          <div className="mt-4 text-sm text-gray-500">
            → {data.suggestion}
          </div>
        )}
      </div>
    </div>
  );

  const renderRightsList = (data: FlightInfo) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
      <div className="space-y-3">
        {data.message && <div className="text-sm text-gray-600 mb-4">{data.message}</div>}
        
        <div className="space-y-2">
          {data.rights?.map((right, index) => (
            <div key={index} className="flex items-start gap-3 py-2">
              <span className="text-green-500 text-sm">✓</span>
              <div>
                <span className="text-sm font-medium text-gray-900">{right.title}</span>
                <span className="text-sm text-gray-600 ml-2">{right.detail}</span>
              </div>
            </div>
          ))}
        </div>
        
        {data.suggestion && (
          <div className="mt-4 text-sm text-gray-500">
            → {data.suggestion}
          </div>
        )}
      </div>
    </div>
  );

  const renderServicesList = (data: FlightInfo) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
      <div className="space-y-3">
        {data.message && <div className="text-sm text-gray-600 mb-4">{data.message}</div>}
        
        <div className="space-y-2">
          {data.services?.map((service, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <span className="text-sm font-medium text-gray-900">{service.name}</span>
              <span className="text-sm text-gray-600">{service.location}</span>
              <span className="text-sm text-gray-500">{service.detail}</span>
            </div>
          ))}
        </div>
        
        {data.suggestion && (
          <div className="mt-4 text-sm text-gray-500">
            → {data.suggestion}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`flex gap-3 mb-6 ${message.type === "user" ? "justify-end" : ""}`}>
      {message.type === "assistant" && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/20">
          <Bot className="w-6 h-6 text-gray-900" />
        </div>
      )}
      <div className={`flex flex-col gap-3 max-w-[75%] md:max-w-[65%] ${message.type === "user" ? "items-end" : ""}`}>
        <div
          className={`rounded-2xl px-5 py-3 ${
            message.type === "user"
              ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-tr-sm shadow-lg shadow-cyan-500/20"
              : "bg-gray-800/80 backdrop-blur-sm text-gray-100 border border-gray-700/50 rounded-tl-sm"
          }`}
        >
          {/* User messages — always show plain text */}
          {message.type === "user" && (
            <p className="text-base leading-relaxed text-white">{message.content}</p>
          )}

          {/* Assistant messages */}
          {message.type === "assistant" && !isJsonError && parsedResponse && (() => {
            if (parsedResponse.type === 'general') {
              return <p className="text-base leading-relaxed text-gray-200">{parsedResponse.message}</p>;
            }
            if (parsedResponse.type === 'flight') {
              return <p className="text-sm text-gray-300">Flight information loaded.</p>;
            }
            if (parsedResponse.type === 'rights' || parsedResponse.type === 'services' || parsedResponse.type === 'flights') {
              return null;
            }
            return parsedResponse.message
              ? <p className="text-sm text-gray-400">{parsedResponse.message}</p>
              : null;
          })()}
          {message.type === "assistant" && isJsonError && (
            <p className="text-base leading-relaxed text-gray-300">
              {message.content}
            </p>
          )}
        </div>
        
        {/* Structured renderers outside and below the bubble */}
        {!isJsonError && parsedResponse && parsedResponse.type === 'flight'
          && renderFlightCard(parsedResponse)}
        {!isJsonError && parsedResponse && parsedResponse.type === 'flights'
          && renderFlightsList(parsedResponse)}
        {!isJsonError && parsedResponse && parsedResponse.type === 'rights'
          && renderRightsList(parsedResponse)}
        {!isJsonError && parsedResponse && parsedResponse.type === 'services'
          && renderServicesList(parsedResponse)}
        
        {/* Quick Actions rendered outside and below the bubble */}
        {parsedResponse && parsedResponse.actions && parsedResponse.actions.length > 0 && onActionClick && (
          <div className="ml-5">
            <div className="text-xs text-gray-500 mb-2">Quick actions</div>
            <QuickActions 
              actions={parsedResponse.actions} 
              flightNumber={parsedResponse.flight || parsedResponse.flights?.[0]?.flightNumber}
              onActionClick={onActionClick}
            />
          </div>
        )}
        
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-col gap-3 w-full">
            {message.suggestions.map((suggestion) => (
              <SuggestionCard key={suggestion.id} suggestion={suggestion} />
            ))}
          </div>
        )}
      </div>
      {message.type === "user" && (
        <div className="w-10 h-10 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center flex-shrink-0">
          <User className="w-6 h-6 text-gray-300" />
        </div>
      )}
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: Suggestion;
}

function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const categoryColors = {
    hotel: "bg-purple-900/20 border-purple-500/30 backdrop-blur-sm",
    rights: "bg-emerald-900/20 border-emerald-500/30 backdrop-blur-sm",
    service: "bg-blue-900/20 border-blue-500/30 backdrop-blur-sm",
    activity: "bg-orange-900/20 border-orange-500/30 backdrop-blur-sm",
    flight: "bg-red-900/20 border-red-500/30 backdrop-blur-sm",
  };

  const categoryTextColors = {
    hotel: "text-purple-300",
    rights: "text-emerald-300",
    service: "text-blue-300",
    activity: "text-orange-300",
    flight: "text-red-300",
  };

  const categoryIcons = {
    hotel: "🏨",
    rights: "⚖️",
    service: "🛎️",
    activity: "🎯",
    flight: "✈️",
  };

  return (
    <div
      className={`border rounded-xl p-4 ${categoryColors[suggestion.category]} hover:border-gray-600 transition-all`}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{categoryIcons[suggestion.category]}</span>
        <div className="flex-1">
          <h4 className={`font-semibold text-base mb-2 ${categoryTextColors[suggestion.category]}`}>
            {suggestion.title}
          </h4>
          <p className="text-sm text-gray-300 mb-3">{suggestion.description}</p>
          {suggestion.details && suggestion.details.length > 0 && (
            <ul className="text-sm text-gray-400 space-y-1.5 mb-3">
              {suggestion.details.map((detail, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          )}
          {suggestion.link && (
            <a
              href={suggestion.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-1"
            >
              Learn more →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
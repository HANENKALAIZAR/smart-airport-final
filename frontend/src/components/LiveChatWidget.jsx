import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, MinusCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import robotAvatar from '../assets/chatbot_robot.png';

const QUICK_REPLIES = [
    'Track my flight',
    'Baggage allowance',
    'Check-in desk',
    'Lost & found',
    'Alternative flights',
];

const INITIAL_MESSAGES = [
    {
        id: 1,
        from: 'bot',
        text: '👋 Hello! I\'m your Smart Airport assistant. How can I help you today?',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
];

export default function LiveChatWidget() {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const listRef = useRef(null);

    // Auto-scroll
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages, typing, open]);

    function sendMessage(text) {
        if (!text.trim()) return;
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages(m => [...m, { id: Date.now(), from: 'user', text, time: now }]);
        setInput('');
        setTyping(true);
        setTimeout(() => {
            setTyping(false);
            setMessages(m => [
                ...m,
                {
                    id: Date.now() + 1,
                    from: 'bot',
                    text: getBotReply(text),
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
            ]);
        }, 1200);
    }

    function getBotReply(text) {
        const lc = text.toLowerCase();
        if (lc.includes('alternative') || lc.includes('rebook') || lc.includes('other flight')) {
            return '✈️ Looking for alternative flights? Here are available options:\n\n🔹 TU722 — TUN → CDG — 18:30 (2h 30m)\n🔹 AF1195 — TUN → CDG — 20:15 (2h 25m)\n🔹 LH4500 — TUN → MUC — 19:00 (2h 45m)\n\nVisit the Flights page or contact your airline desk for rebooking assistance.';
        }
        if (lc.includes('delay') || lc.includes('compensation') || lc.includes('rights')) {
            return '⚖️ If your flight is delayed 3+ hours, you may be entitled to compensation under EC 261/2004:\n\n• ≤1,500 km → €250\n• 1,500–3,500 km → €400\n• >3,500 km → €600\n\nVisit our Rights page for full details, or check your flight detail page for automatic calculation.';
        }
        if (lc.includes('flight') || lc.includes('track')) return '✈️ Please visit the Flights page for real-time tracking. You can also search by flight number at the top. Use the ⭐ Track button on any flight detail page for personalized updates.';
        if (lc.includes('baggage') || lc.includes('luggage')) return '🧳 Standard baggage allowance varies by airline. Check your booking confirmation or visit the airline desk in Terminal 1.';
        if (lc.includes('check-in') || lc.includes('checkin')) return '🏷️ Check-in desks open 3 hours before departure. Online check-in is available 24 hours before for most airlines.';
        if (lc.includes('lost') || lc.includes('found')) return '🔍 Please go to the Lost & Found office on Level 0, near the baggage claim area. Open 24/7.';
        if (lc.includes('wifi') || lc.includes('internet')) return '📶 Free Wi-Fi is available throughout the terminal. Connect to "Airport_FREE_WIFI" — no password required.';
        if (lc.includes('taxi') || lc.includes('transport')) return '🚕 Taxis are at Exit B, Level 0. Buses and shuttles depart from Level -1.';
        return '💬 Thank you for your message! A live agent will assist you shortly. Meanwhile, browse our FAQ section for instant answers.';
    }

    return (
        <>
            {/* Floating bubble */}
            {!open && (
                <button className="chat-bubble" onClick={() => navigate('/ai-assistant')} aria-label="Open AI assistant">
                    <img src={robotAvatar} alt="Chat bot" className="chat-bubble__robot" />
                    <span className="chat-bubble__dot" />
                </button>
            )}

            {/* Chat window */}
            {open && (
                <div className={`chat-window ${minimized ? 'chat-window--minimized' : ''}`}>
                    {/* Header */}
                    <div className="chat-window__header">
                        <div className="chat-window__header-left">
                            <div className="chat-window__avatar">
                                <img src={robotAvatar} alt="Assistant" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            </div>
                            <div>
                                <div className="chat-window__title">{t('chat_title')}</div>
                                <div className="chat-window__online">
                                    <span className="chat-window__online-dot" /> {t('chat_online')}
                                </div>
                            </div>
                        </div>
                        <div className="chat-window__controls">
                            <button onClick={() => setMinimized(m => !m)} className="chat-window__ctrl-btn" title="Minimize">
                                <MinusCircle size={18} />
                            </button>
                            <button onClick={() => setOpen(false)} className="chat-window__ctrl-btn" title="Close">
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {!minimized && (
                        <>
                            {/* Messages */}
                            <div className="chat-window__body" ref={listRef}>
                                {messages.map(msg => (
                                    <div key={msg.id} className={`chat-msg chat-msg--${msg.from}`}>
                                        {msg.from === 'bot' && (
                                            <div className="chat-msg__avatar">
                                                <img src={robotAvatar} alt="bot" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                            </div>
                                        )}
                                        <div className="chat-msg__bubble">
                                            <p>{msg.text}</p>
                                            <span className="chat-msg__time">{msg.time}</span>
                                        </div>
                                    </div>
                                ))}
                                {typing && (
                                    <div className="chat-msg chat-msg--bot">
                                        <div className="chat-msg__avatar">
                                            <img src={robotAvatar} alt="bot" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                        </div>
                                        <div className="chat-msg__bubble chat-msg__bubble--typing">
                                            <span /><span /><span />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Quick replies */}
                            <div className="chat-window__quick">
                                {QUICK_REPLIES.map(r => (
                                    <button key={r} className="chat-quick-btn" onClick={() => sendMessage(r)}>
                                        {r}
                                    </button>
                                ))}
                            </div>

                            {/* Input */}
                            <form
                                className="chat-window__input-row"
                                onSubmit={e => { e.preventDefault(); sendMessage(input); }}
                            >
                                <input
                                    className="chat-window__input"
                                    placeholder={t('chat_placeholder')}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                />
                                <button type="submit" className="chat-window__send" disabled={!input.trim()}>
                                    <Send size={16} />
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}
        </>
    );
}

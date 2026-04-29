/**
 * LiveClock — Isolated clock component
 * =====================================
 * Extracted from AdminDashboard to prevent full dashboard
 * re-renders on every 1-second tick.
 *
 * Only this component re-renders every second — nothing else.
 */
import { useState, useEffect } from 'react';

export default function LiveClock() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <span style={{
            marginLeft: 12,
            fontVariantNumeric: 'tabular-nums',
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.55)',
            background: 'rgba(255,255,255,0.06)',
            padding: '2px 10px',
            borderRadius: 20,
        }}>
            🕐 {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            &nbsp;·&nbsp;
            {now.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
    );
}

import { createContext, useContext, useState } from 'react';

// ── Airport data: single source of truth via shared-core package ──────────
export { TUNISIAN_AIRPORTS, DEFAULT_AIRPORT } from '@smart-airport/shared-core/constants/airports.js';


/* ── Context ────────────────────────────────────────── */
const AirportContext = createContext(null);

export function useAirport() {
    const ctx = useContext(AirportContext);
    if (!ctx) throw new Error('useAirport must be inside an AirportProvider');
    return ctx;
}

/* ── Passenger Provider (any airport, no role) ──────── */
export function PassengerAirportProvider({ children }) {
    const [selectedAirport, setSelectedAirport] = useState(DEFAULT_AIRPORT);

    return (
        <AirportContext.Provider value={{ selectedAirport, setSelectedAirport, role: 'passenger' }}>
            {children}
        </AirportContext.Provider>
    );
}

/* ── Admin Provider (role-aware) ────────────────────── */
export function AdminAirportProvider({ airport, setAirport, role, children }) {
    return (
        <AirportContext.Provider value={{ selectedAirport: airport, setSelectedAirport: setAirport, role }}>
            {children}
        </AirportContext.Provider>
    );
}

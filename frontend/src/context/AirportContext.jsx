/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';


// ── Airport data: single source of truth via shared-core package ──────────
export { TUNISIAN_AIRPORTS, DEFAULT_AIRPORT } from '@smart-airport/shared-core/constants/airports.js';


/* ── Context ────────────────────────────────────────── */
const AirportContext = createContext(null);

export function useAirport() {
    const ctx = useContext(AirportContext);
    if (!ctx) throw new Error('useAirport must be inside an AirportProvider');
    return ctx;
}


/* ── Admin Provider (role-aware) ────────────────────── */
export function AdminAirportProvider({ airport, setAirport, role, children }) {
    return (
        <AirportContext.Provider value={{ selectedAirport: airport, setSelectedAirport: setAirport, role }}>
            {children}
        </AirportContext.Provider>
    );
}

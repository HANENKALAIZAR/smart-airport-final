import { createContext, useContext, useState } from 'react';

/* ── All Tunisian airports ──────────────────────────── */
export const TUNISIAN_AIRPORTS = [
    { id: 'TUN', iata: 'TUN', name: 'Tunis–Carthage International', city: 'Tunis', region: 'Grand Tunis' },
    { id: 'DJE', iata: 'DJE', name: 'Djerba–Zarzis International', city: 'Djerba', region: 'South-Est' },
    { id: 'NBE', iata: 'NBE', name: 'Enfidha–Hammamet International', city: 'Enfidha', region: 'Sahel' },
    { id: 'MIR', iata: 'MIR', name: 'Monastir Habib Bourguiba', city: 'Monastir', region: 'Sahel' },
    { id: 'SFA', iata: 'SFA', name: 'Sfax–Thyna International', city: 'Sfax', region: 'South' },
    { id: 'TOE', iata: 'TOE', name: 'Tozeur–Nefta International', city: 'Tozeur', region: 'South-West' },
    { id: 'TBJ', iata: 'TBJ', name: 'Tabarka–Aïn Draham', city: 'Tabarka', region: 'North-West' },
    { id: 'GAF', iata: 'GAF', name: 'Gafsa–Ksar International', city: 'Gafsa', region: 'South-West' },
];

export const DEFAULT_AIRPORT = TUNISIAN_AIRPORTS[0]; // TUN

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

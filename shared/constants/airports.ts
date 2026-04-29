/**
 * Shared Airport Constants
 * ========================
 * Single source of truth for Tunisian airport metadata.
 * Used by both the Admin (/frontend) and Passenger (/passenger) apps.
 *
 * Previously duplicated in:
 * - frontend/src/context/AirportContext.jsx
 * - passenger/src/pages/Flights.tsx
 * - passenger/src/services/api.ts (coordinates)
 */

export interface AirportRecord {
    id: string;
    iata: string;
    name: string;
    city: string;
    region: string;
    /** Relative map x-coordinate (0–1) */
    x: number;
    /** Relative map y-coordinate (0–1) */
    y: number;
}

export const TUNISIAN_AIRPORTS: AirportRecord[] = [
    { id: 'TUN', iata: 'TUN', name: 'Tunis–Carthage International', city: 'Tunis',   region: 'Grand Tunis', x: 0.53, y: 0.42 },
    { id: 'DJE', iata: 'DJE', name: 'Djerba–Zarzis International',  city: 'Djerba',  region: 'South-East',  x: 0.54, y: 0.44 },
    { id: 'NBE', iata: 'NBE', name: 'Enfidha–Hammamet International',city: 'Enfidha', region: 'Sahel',       x: 0.53, y: 0.42 },
    { id: 'MIR', iata: 'MIR', name: 'Monastir Habib Bourguiba',      city: 'Monastir',region: 'Sahel',       x: 0.53, y: 0.43 },
];

export const DEFAULT_AIRPORT = TUNISIAN_AIRPORTS[0]; // TUN

/**
 * Airport coordinate lookup map for quick O(1) access.
 * Falls back to { x: 0.5, y: 0.4 } for unknown codes.
 */
export const AIRPORT_COORDS: Record<string, { x: number; y: number }> = {
    TUN: { x: 0.53, y: 0.42 }, CDG: { x: 0.50, y: 0.28 }, ORY: { x: 0.50, y: 0.29 },
    IST: { x: 0.57, y: 0.34 }, FCO: { x: 0.52, y: 0.36 }, FRA: { x: 0.52, y: 0.27 },
    LHR: { x: 0.47, y: 0.26 }, MRS: { x: 0.50, y: 0.32 }, LYS: { x: 0.51, y: 0.31 },
    DJE: { x: 0.54, y: 0.44 }, ALG: { x: 0.50, y: 0.42 }, JED: { x: 0.60, y: 0.48 },
    MXP: { x: 0.51, y: 0.33 }, BRU: { x: 0.50, y: 0.27 }, CAI: { x: 0.57, y: 0.44 },
    MIR: { x: 0.53, y: 0.43 }, DOH: { x: 0.62, y: 0.47 }, DXB: { x: 0.63, y: 0.47 },
    AMM: { x: 0.58, y: 0.42 }, CMN: { x: 0.46, y: 0.43 }, NBE: { x: 0.53, y: 0.42 },
    GVA: { x: 0.51, y: 0.30 }, MAD: { x: 0.46, y: 0.34 }, VIE: { x: 0.54, y: 0.28 },
    MUC: { x: 0.53, y: 0.28 }, DUS: { x: 0.51, y: 0.27 }, NCE: { x: 0.51, y: 0.31 },
    TLS: { x: 0.49, y: 0.31 }, MLA: { x: 0.53, y: 0.38 }, CTA: { x: 0.53, y: 0.37 },
    YUL: { x: 0.22, y: 0.28 }, ABJ: { x: 0.47, y: 0.53 }, DSS: { x: 0.43, y: 0.51 },
};

export function getAirportCoords(iata: string): { x: number; y: number } {
    return AIRPORT_COORDS[iata] ?? { x: 0.5, y: 0.4 };
}

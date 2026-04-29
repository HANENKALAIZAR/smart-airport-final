/**
 * @smart-airport/shared-core — constants/airports.js
 * ====================================================
 * Canonical source of truth for all Tunisian airport metadata
 * and global airport coordinate map used across admin and passenger apps.
 *
 * Migration history:
 *   - v1: shared/constants/airports.js  (relative path imports, fragile)
 *   - v2: shared-core/constants/airports.js  (npm workspace package, proper)
 *
 * Consumers:
 *   Admin  → import { TUNISIAN_AIRPORTS } from '@smart-airport/shared-core/constants/airports'
 *   Passengr→ import { AIRPORT_COORDS }   from '@smart-airport/shared-core/constants/airports'
 *
 * DO NOT duplicate these values anywhere else in the monorepo.
 */

/**
 * Canonical list of Tunisian airports served by the system.
 * @type {{ id: string, iata: string, code: string, name: string, city: string, region: string }[]}
 */
export const TUNISIAN_AIRPORTS = [
    { id: 'TUN', iata: 'TUN', code: 'TUN', name: 'Tunis–Carthage International',  city: 'Tunis',    region: 'Grand Tunis' },
    { id: 'DJE', iata: 'DJE', code: 'DJE', name: 'Djerba–Zarzis International',   city: 'Djerba',   region: 'South-East'  },
    { id: 'NBE', iata: 'NBE', code: 'NBE', name: 'Enfidha–Hammamet International', city: 'Enfidha',  region: 'Sahel'       },
    { id: 'MIR', iata: 'MIR', code: 'MIR', name: 'Monastir Habib Bourguiba',       city: 'Monastir', region: 'Sahel'       },
];

/** The default airport for both apps when none is selected. */
export const DEFAULT_AIRPORT = TUNISIAN_AIRPORTS[0]; // TUN

/** Union type of valid Tunisian airport IATA codes — consumed by passenger TypeScript. */
export const TUNISIAN_AIRPORT_CODES = /** @type {const} */ (['TUN', 'DJE', 'NBE', 'MIR']);

/**
 * Global airport coordinate map for flight route visualization.
 * Values are relative positions (0–1) for placing dots on a map image.
 *
 * @type {Record<string, { x: number, y: number }>}
 */
export const AIRPORT_COORDS = {
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

/**
 * Safe coordinate lookup. Falls back to geographic center if unknown.
 * @param {string} iata
 * @returns {{ x: number, y: number }}
 */
export function getAirportCoords(iata) {
    return AIRPORT_COORDS[iata] ?? { x: 0.5, y: 0.4 };
}

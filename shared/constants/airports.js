/**
 * DEPRECATED — legacy re-export shim
 * ====================================
 * This file previously contained the canonical airport data.
 * It is now a thin re-export shim pointing to the real source:
 *   @smart-airport/shared-core/constants/airports.js
 *
 * DO NOT add new imports from this path.
 * Update any remaining consumers to use:
 *   import { X } from '@smart-airport/shared-core/constants/airports.js'
 *
 * This shim is kept to avoid breaking any external tooling or scripts
 * that haven't been migrated yet.
 */

// Re-export everything from the canonical source
export { TUNISIAN_AIRPORTS, DEFAULT_AIRPORT, TUNISIAN_AIRPORT_CODES, AIRPORT_COORDS, getAirportCoords } from '../shared-core/constants/airports.js';

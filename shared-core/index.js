/**
 * @smart-airport/shared-core
 * ==========================
 * Main entry point — re-exports all public shared modules.
 *
 * Consumers can either import the root:
 *   import { TUNISIAN_AIRPORTS } from '@smart-airport/shared-core'
 *
 * Or import specific sub-paths (preferred for tree-shaking):
 *   import { AIRPORT_COORDS } from '@smart-airport/shared-core/constants/airports'
 */

export * from './constants/airports.js';

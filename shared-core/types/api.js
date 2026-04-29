/**
 * @smart-airport/shared-core — types/api.js
 * ==========================================
 * JSDoc type declarations for the FastAPI response contracts.
 *
 * These are the shapes returned by the backend and consumed by both
 * the admin (JS) and passenger (TS) frontends.
 *
 * TypeScript consumers: import types from this file via JSDoc or
 * declare module augmentation — do NOT create parallel .d.ts files.
 *
 * Usage (JS):
 *   @typedef {import('@smart-airport/shared-core/types/api').ApiFlightList} ApiFlightList
 *
 * Usage (TS):
 *   // passenger/src/services/api.ts already defines these inline.
 *   // This file is the authoritative reference for alignment checks.
 */

// ── Airport ──────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ApiAirport
 * @property {number} id
 * @property {string} iata_code
 * @property {string} name
 * @property {string} city
 * @property {string} country
 * @property {string} region
 */

// ── Airline ───────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ApiAirline
 * @property {number} id
 * @property {string} iata_code
 * @property {string} name
 * @property {number} reliability_score
 */

// ── Flight ────────────────────────────────────────────────────────────────────

/**
 * Status values returned by the backend:
 *  - DB flights:         'scheduled' | 'on_time' | 'delayed' | 'cancelled'
 *  - AviationStack live: adds 'landed' | 'boarding' | 'departed'
 * @typedef {'scheduled'|'on_time'|'delayed'|'cancelled'|'boarding'|'landed'|'departed'} ApiFlightStatus
 */

/**
 * @typedef {Object} ApiFlightList
 * @property {number} id
 * @property {string} flight_number
 * @property {string} scheduled_departure   - ISO 8601
 * @property {string} scheduled_arrival     - ISO 8601
 * @property {ApiFlightStatus} status
 * @property {number} delay_minutes
 * @property {number} distance_km
 * @property {string|null} aircraft_type
 * @property {ApiAirline} airline
 * @property {ApiAirport} origin_airport
 * @property {ApiAirport} dest_airport
 */

/**
 * @typedef {Object} ApiDelayCause
 * @property {string} icon
 * @property {string} title
 * @property {string} summary
 * @property {string} passenger_tip
 */

/**
 * @typedef {ApiFlightList & {
 *   actual_departure: string|null,
 *   actual_arrival: string|null,
 *   prediction: ApiPrediction|null,
 *   passenger_rights: ApiPassengerRight[]|null,
 *   gate?: string|null,
 *   terminal?: string|null,
 *   delay_cause?: ApiDelayCause|null
 * }} ApiFlightDetail
 */

// ── Prediction ────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ApiPrediction
 * @property {number} risk_score             - 0–100 (percentage)
 * @property {number} predicted_delay_min
 * @property {number} confidence             - 0–1
 * @property {Record<string, number|{shap:number,value:number|null}>|null} shap_explanation
 * @property {string|null} model_version
 * @property {string|null} predicted_at     - ISO 8601
 */

// ── Passenger Rights ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} ApiPassengerRight
 * @property {string} region
 * @property {string} regulation_name
 * @property {number} delay_threshold_min
 * @property {string} right_type
 * @property {string} description_en
 * @property {string} [description_fr]
 * @property {string|null} compensation_amount
 */

// ── Weather ───────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ApiWeather
 * @property {string} airport_iata
 * @property {number} temperature_c
 * @property {number} wind_speed_kmh
 * @property {number} visibility_km
 * @property {number} humidity_pct
 * @property {string} condition          - e.g. "Clear", "Rain"
 * @property {string} updated_at         - ISO 8601
 */

// ── Analytics ─────────────────────────────────────────────────────────────────

/**
 * Matches backend DashboardOverview Pydantic schema.
 * @typedef {Object} ApiAnalyticsSummary
 * @property {number} total_flights
 * @property {number} on_time_count
 * @property {number} delayed_count
 * @property {number} cancelled_count
 * @property {number} at_risk_count
 * @property {number} avg_delay_minutes
 * @property {number} delay_rate          - 0–100
 */

export {}; // Makes this a proper ES module

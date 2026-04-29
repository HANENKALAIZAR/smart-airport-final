/**
 * adminAuth.js — Minimal auth side-effects module
 * =================================================
 * This module exists to be lazy-imported by adminApi.js on 401 responses
 * to avoid a circular dependency between adminApi ↔ useAdminAuth.
 *
 * It has no React imports — pure DOM/storage manipulation.
 */

const ADMIN_KEYS = [
    'admin_token',
    'admin_role',
    'admin_user',
    'admin_airport_iata',
    'admin_must_change',
    'admin_profile_complete',
];

/**
 * Clears all admin localStorage keys and redirects to login.
 * Called automatically by adminApi.js on any 401 response.
 */
export function clearAuthAndRedirect() {
    try {
        ADMIN_KEYS.forEach(k => localStorage.removeItem(k));
    } catch {
        // Storage unavailable — proceed to redirect anyway
    }
    // Use replace() so the login page can't be back-buttoned into
    window.location.replace('/admin/login');
}

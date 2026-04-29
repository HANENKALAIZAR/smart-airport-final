/**
 * useAdminAuth — Token-keyed, production-safe auth hook
 * ======================================================
 * Caches /api/auth/me result per token value.
 * Automatically invalidates cache when the token changes.
 * Provides a global logout utility that clears all auth state.
 *
 * Features:
 * - Single request per token (deduped across all consumers)
 * - Cache is invalidated on logout or token change
 * - Exposes: { user, loading, error, refresh, logout }
 *
 * Usage:
 *   const { user, loading, refresh, logout } = useAdminAuth();
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGetMe } from '../services/adminApi';

// ── Module-level singleton store ──────────────────────────────────────────
// Keyed by token so stale cache is never served after logout/re-login.
let _cache = {
    token: null,    // the token this cache is for
    user: null,     // the resolved user object
    promise: null,  // in-flight fetch promise
    listeners: [],  // setState callbacks from active hook instances
};

function _broadcast(user) {
    _cache.user = user;
    _cache.listeners.forEach(fn => {
        try { fn(user); } catch { /* ignore unmounted */ }
    });
}

function _getToken() {
    try { return localStorage.getItem('admin_token') || null; } catch { return null; }
}

function _invalidate() {
    _cache.token = null;
    _cache.user = null;
    _cache.promise = null;
}

// ── Global logout — call this from anywhere ────────────────────────────────
export function logoutAdmin(navigate) {
    // 1. Clear storage
    try {
        ['admin_token', 'admin_role', 'admin_user',
            'admin_airport_iata', 'admin_must_change',
            'admin_profile_complete'].forEach(k => localStorage.removeItem(k));
    } catch { /* quota error — ignore */ }

    // 2. Invalidate auth cache so next mount doesn't serve stale data
    _invalidate();
    _broadcast(null);

    // 3. Redirect
    if (navigate) {
        navigate('/admin/login', { replace: true });
    } else {
        window.location.replace('/admin/login');
    }
}

// ── Hook ───────────────────────────────────────────────────────────────────
export default function useAdminAuth() {
    const token = _getToken();
    const isValidToken = !!(token && token !== 'demo');

    // Detect if the cached data belongs to a *different* token → stale
    const isCacheValid = _cache.token === token && _cache.user !== null;

    const [user, setUser] = useState(isCacheValid ? _cache.user : null);
    const [loading, setLoading] = useState(isValidToken && !isCacheValid);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);

    // Register this instance as a listener so _broadcast() updates it
    useEffect(() => {
        _cache.listeners.push(setUser);
        return () => {
            mountedRef.current = false;
            _cache.listeners = _cache.listeners.filter(fn => fn !== setUser);
        };
    }, []);

    useEffect(() => {
        if (!isValidToken) {
            if (mountedRef.current) { setLoading(false); setUser(null); }
            return;
        }

        // Cache hit — serve immediately, no fetch needed
        if (isCacheValid) {
            if (mountedRef.current) { setUser(_cache.user); setLoading(false); }
            return;
        }

        // Deduplicate: if a fetch is already in-flight, attach to it
        if (_cache.promise) {
            if (mountedRef.current) setLoading(true);
            _cache.promise
                .then(() => { if (mountedRef.current) { setUser(_cache.user); setLoading(false); } })
                .catch(err => { if (mountedRef.current) { setError(err?.message || 'Auth failed'); setLoading(false); } });
            return;
        }

        // Start a new fetch
        if (mountedRef.current) { setLoading(true); setError(null); }

        _cache.promise = apiGetMe()
            .then(({ data, error: err }) => {
                _cache.promise = null;
                if (err || !data) {
                    if (mountedRef.current) setError(err || 'Session invalid');
                    _broadcast(null);
                    return null;
                }
                _cache.token = token;   // Bind cache to this token
                _broadcast(data);
                return data;
            })
            .catch(err => {
                _cache.promise = null;
                if (mountedRef.current) setError(err?.message || 'Auth check failed');
                _broadcast(null);
                return null;
            })
            .finally(() => {
                if (mountedRef.current) setLoading(false);
            });

        return () => { /* cleanup: the promise resolves naturally */ };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]); // Re-run only when the token changes

    /** Force a fresh /auth/me call and update all subscribers */
    const refresh = useCallback(() => {
        if (!isValidToken) return;
        _invalidate();
        if (mountedRef.current) { setLoading(true); setError(null); }

        _cache.promise = apiGetMe()
            .then(({ data, error: err }) => {
                _cache.promise = null;
                if (err || !data) {
                    if (mountedRef.current) setError(err || 'Refresh failed');
                    _broadcast(null);
                    return null;
                }
                _cache.token = _getToken();
                _broadcast(data);
                return data;
            })
            .catch(err => {
                _cache.promise = null;
                if (mountedRef.current) setError(err?.message || 'Refresh failed');
                return null;
            })
            .finally(() => {
                if (mountedRef.current) setLoading(false);
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    /** Bound logout — clears cache + redirects */
    const logout = useCallback((navigate) => {
        logoutAdmin(navigate);
    }, []);

    return { user, loading, error, refresh, logout };
}

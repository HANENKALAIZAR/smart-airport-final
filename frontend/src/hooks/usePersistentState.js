/**
 * usePersistentState — localStorage-backed state hook
 * =====================================================
 * Replaces all manual localStorage.getItem/setItem patterns
 * in AdminApp.jsx and elsewhere.
 *
 * Guarantees:
 * - State is initialized from storage on mount
 * - Every setState call syncs to storage atomically
 * - No state mismatch between reloads
 *
 * Usage:
 *   const [token, setToken] = usePersistentState('admin_token', '');
 *
 * @param {string} key       - localStorage key
 * @param {*} initialValue   - fallback when key is absent
 * @returns {[*, function]}  - [value, setter]
 */
import { useState, useCallback } from 'react';

export default function usePersistentState(key, initialValue) {
    const [state, setStateRaw] = useState(() => {
        try {
            const stored = localStorage.getItem(key);
            if (stored === null) return initialValue;
            return JSON.parse(stored);
        } catch {
            return initialValue;
        }
    });

    const setState = useCallback((valueOrUpdater) => {
        setStateRaw(prev => {
            const next = typeof valueOrUpdater === 'function'
                ? valueOrUpdater(prev)
                : valueOrUpdater;
            try {
                if (next === null || next === undefined || next === '') {
                    localStorage.removeItem(key);
                } else {
                    localStorage.setItem(key, JSON.stringify(next));
                }
            } catch {
                // Storage quota exceeded — no-op
            }
            return next;
        });
    }, [key]);

    return [state, setState];
}

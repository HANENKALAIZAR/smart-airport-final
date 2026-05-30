import { useState, useCallback } from 'react';

export default function usePersistentState(key, initialValue) {
    const [state, setStateRaw] = useState(() => {
        try {
            const stored = localStorage.getItem(key);
            if (stored === null) return initialValue;
            try {
                return JSON.parse(stored);
            } catch {
                return stored;
            }
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

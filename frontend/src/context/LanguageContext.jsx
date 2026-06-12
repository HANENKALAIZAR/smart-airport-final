/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en from '../i18n/en';
import fr from '../i18n/fr';
import ar from '../i18n/ar';

const TRANSLATIONS = { en, fr, ar };
const STORAGE_KEY = 'smart-airport-lang';

const LanguageContext = createContext(null);

export const LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇬🇧', dir: 'ltr' },
    { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦', dir: 'rtl' },
];

function humanizeKey(key) {
    if (!key || typeof key !== 'string') return '';
    
    const ignoreWords = new Set([
        'admin', 'super', 'profile', 'dash', 'settings', 'users', 'nav', 'field'
    ]);
    
    const wordMappings = {
        pw: 'Password',
        pass: 'Password',
        rel: 'Relationship',
        dob: 'Date of Birth',
        cin: 'National ID (CIN)',
        ops: 'Operations',
        otp: 'On-Time Performance',
        mae: 'Mean Absolute Error',
        kpi: 'KPI',
        avg: 'Average',
        min: 'Minutes',
        hr: 'Hour',
        verif: 'Verification',
        info: 'Information',
        config: 'Configuration',
        add: 'Add',
        del: 'Delete',
        edit: 'Edit',
        save: 'Save',
        saving: 'Saving',
        cancel: 'Cancel',
        discard: 'Discard'
    };
    
    const parts = key.split(/[-_]/);
    const filteredParts = parts.filter(p => p && !ignoreWords.has(p.toLowerCase()));
    const partsToUse = filteredParts.length > 0 ? filteredParts : parts.filter(p => p);
    
    const words = partsToUse.map(p => {
        const lower = p.toLowerCase();
        if (wordMappings[lower]) {
            return wordMappings[lower];
        }
        return p.charAt(0).toUpperCase() + p.slice(1);
    });
    
    return words.join(' ');
}

export function LanguageProvider({ children }) {
    const [language, setLanguageState] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'en';
        } catch {
            return 'en';
        }
    });

    const setLanguage = useCallback((lang) => {
        setLanguageState(lang);
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch { /* noop */ }
    }, []);

    // Translate function — returns the translation, fallback string, or the key itself.
    // Supports {placeholder} interpolation via optional third parameter.
    const t = useCallback((key, fallback, vars) => {
        const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
        let val = dict[key] || TRANSLATIONS.en[key] || fallback || humanizeKey(key);
        if (vars && typeof val === 'string') {
            for (const [k, v] of Object.entries(vars)) {
                val = val.replace(new RegExp(`\\{${k}\\}`, 'g'), v ?? '');
            }
        }
        return val;
    }, [language]);

    // Current language meta
    const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];
    const dir = currentLang.dir;

    // Set dir on <html>
    useEffect(() => {
        document.documentElement.setAttribute('dir', dir);
        document.documentElement.setAttribute('lang', language);
    }, [dir, language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, dir, currentLang }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be inside a LanguageProvider');
    return ctx;
}

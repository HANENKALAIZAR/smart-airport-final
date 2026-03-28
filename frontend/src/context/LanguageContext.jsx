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

    // Translate function — returns the translation or the key itself
    const t = useCallback((key) => {
        const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
        return dict[key] || TRANSLATIONS.en[key] || key;
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

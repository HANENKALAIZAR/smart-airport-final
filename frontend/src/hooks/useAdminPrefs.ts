/**
 * useAdminPrefs.ts
 * ================
 * Ported from the aviation-admin-login-main UI.
 * Provides theme (dark/light) and language (en/fr) state
 * persisted in localStorage. Used by the new admin auth pages.
 */
import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

export type AdminTheme = 'dark' | 'light';
export type AdminLang  = 'en' | 'fr';

export function useAdminTheme(): [AdminTheme, (t: AdminTheme) => void] {
  const [theme, setTheme] = useState<AdminTheme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem('admin_theme') as AdminTheme) || 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('admin_theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail && e.detail !== theme) setTheme(e.detail);
    };
    window.addEventListener('admin-theme-changed', handleThemeChange);
    return () => window.removeEventListener('admin-theme-changed', handleThemeChange);
  }, [theme]);

  const updateTheme = (newTheme: AdminTheme) => {
    setTheme(newTheme);
    window.dispatchEvent(new CustomEvent('admin-theme-changed', { detail: newTheme }));
  };

  return [theme, updateTheme];
}

export function useAdminLang(): [AdminLang, (l: AdminLang) => void] {
  const { language, setLanguage } = useLanguage();
  // Safe cast: if global is Arabic ('ar'), fallback to French ('fr') for admin onboarding panels
  const adminLang = (language === 'ar' ? 'fr' : language) as AdminLang;
  
  const updateLang = (newLang: AdminLang) => {
    setLanguage(newLang);
    localStorage.setItem('admin_lang', newLang);
  };

  return [adminLang, updateLang];
}

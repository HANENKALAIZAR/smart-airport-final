import { useLanguage } from '../../context/LanguageContext';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher({ variant = 'light' }) {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'fr' : 'en');
  };

  const isDark = variant === 'dark';

  return (
    <button
      onClick={toggleLanguage}
      className={`admin-lang-switcher ${isDark ? 'admin-lang-switcher--dark' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: '600',
        transition: 'all 0.2s ease',
      }}
      title="Switch Language"
    >
      <Globe size={16} />
      <span>{language === 'en' ? 'FR' : 'EN'}</span>
    </button>
  );
}

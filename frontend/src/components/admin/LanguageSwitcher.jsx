import { useLanguage } from '../../context/LanguageContext';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'fr' : 'en');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="admin-header__btn"
      title="Switch Language"
    >
      <Globe size={18} className="admin-header__btn-icon" />
      <span>{language === 'en' ? 'FR' : 'EN'}</span>
    </button>
  );
}

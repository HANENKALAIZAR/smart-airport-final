import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage, LANGUAGES } from '../context/LanguageContext';

/**
 * LanguageSwitcher — compact dropdown for EN/FR/AR
 * Pass variant="dark" for admin dark theme, default is "light" for passenger
 */
export default function LanguageSwitcher({ variant = 'light' }) {
    const { language, setLanguage, currentLang } = useLanguage();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const cls = variant === 'dark' ? 'lang-switcher lang-switcher--dark' : 'lang-switcher';

    return (
        <div className={cls} ref={ref}>
            <button className="lang-switcher__btn" onClick={() => setOpen(!open)}>
                <Globe size={16} className="lang-switcher__icon" />
                <span className="lang-switcher__code">{currentLang.code.toUpperCase()}</span>
            </button>
            {open && (
                <div className="lang-switcher__dropdown">
                    {LANGUAGES.map(lang => (
                        <button
                            key={lang.code}
                            className={`lang-switcher__option${lang.code === language ? ' active' : ''}`}
                            onClick={() => { setLanguage(lang.code); setOpen(false); }}
                        >
                            <span className="lang-switcher__flag">{lang.flag}</span>
                            <span className="lang-switcher__label">{lang.label}</span>
                            {lang.code === language && <span className="lang-switcher__check">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

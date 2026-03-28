import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function PassengerFooter() {
    const { t } = useLanguage();

    const leftLinks = [
        { label: t('alerts'), to: '/alerts' },
        { label: t('footer_privacy'), to: '#' },
    ];

    const rightLinks = [
        { label: t('footer_contact_info'), to: '/contact' },
        { label: t('footer_feedback'), to: '#' },
        { label: t('services'), to: '/services' },
        { label: 'FAQs', to: '/faq' },
    ];

    return (
        <footer className="pax-footer">
            <div className="pax-footer__inner">
                <div className="pax-footer__links">
                    {/* Other links */}
                    <div className="pax-footer__col">
                        <h3 className="pax-footer__col-title">{t('footer_other_links')}</h3>
                        <ul className="pax-footer__col-list">
                            {leftLinks.map(({ label, to }) => (
                                <li key={label}>
                                    <Link to={to} className="pax-footer__link">
                                        {label}
                                        <ArrowRight size={13} />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact us */}
                    <div className="pax-footer__col">
                        <h3 className="pax-footer__col-title">{t('footer_contact_us')}</h3>
                        <ul className="pax-footer__col-list">
                            {rightLinks.map(({ label, to }) => (
                                <li key={label}>
                                    <Link to={to} className="pax-footer__link">
                                        {label}
                                        <ArrowRight size={13} />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="pax-footer__bottom">
                    <span className="pax-footer__copy">
                        © {new Date().getFullYear()} Smart Airport Operations. {t('footer_rights')}
                    </span>
                </div>
            </div>
        </footer>
    );
}

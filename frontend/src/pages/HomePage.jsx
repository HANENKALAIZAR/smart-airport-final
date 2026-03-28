import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAirport } from '../context/AirportContext';
import { useLanguage } from '../context/LanguageContext';
import airportHero from '../assets/airport_hero_bg.png';
import cityParis from '../assets/city_paris.png';
import cityIstanbul from '../assets/city_istanbul.png';
import cityDubai from '../assets/city_dubai.png';
import cityLondon from '../assets/city_london.png';
import cityRome from '../assets/city_rome.png';
import cityDoha from '../assets/city_doha.png';
import cityFrankfurt from '../assets/city_frankfurt.png';
import cityMadrid from '../assets/city_madrid.png';

export default function HomePage() {
    const { selectedAirport } = useAirport();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [mode, setMode] = useState('departures'); // 'departures' | 'arrivals'
    const [query, setQuery] = useState('');

    function handleSearch(e) {
        e.preventDefault();
        const params = query.trim() ? `?q=${encodeURIComponent(query)}&mode=${mode}` : `?mode=${mode}`;
        navigate(`/flights${params}`);
    }

    const quickLinks = [
        { label: t('rights'), icon: '🛡️', to: '/rights' },
        { label: t('liveConditions'), icon: '🌤️', to: '/conditions' },
        { label: t('alerts'), icon: '🔔', to: '/alerts' },
        { label: t('services'), icon: '🏙️', to: '/services' },
        { label: t('contact'), icon: '📞', to: '/contact' },
        { label: t('faq'), icon: '❓', to: '/faq' },
    ];

    const DESTINATIONS = [
        { city: 'Paris', country: 'France', tagline: 'City of Light', img: cityParis, iata: 'CDG' },
        { city: 'Istanbul', country: 'Turkey', tagline: 'East meets West', img: cityIstanbul, iata: 'IST' },
        { city: 'Dubai', country: 'UAE', tagline: 'Future city', img: cityDubai, iata: 'DXB' },
        { city: 'London', country: 'UK', tagline: 'Timeless capital', img: cityLondon, iata: 'LHR' },
        { city: 'Rome', country: 'Italy', tagline: 'Eternal city', img: cityRome, iata: 'FCO' },
        { city: 'Doha', country: 'Qatar', tagline: 'Pearl of the Gulf', img: cityDoha, iata: 'DOH' },
        { city: 'Frankfurt', country: 'Germany', tagline: 'Gateway to Europe', img: cityFrankfurt, iata: 'FRA' },
        { city: 'Madrid', country: 'Spain', tagline: 'Heart of Iberia', img: cityMadrid, iata: 'MAD' },
    ];

    return (
        <div className="home-page">

            {/* ── Hero Banner ─────────────────────────────────── */}
            <div className="home-hero">
                <img src={airportHero} alt="Airport" className="home-hero__bg" />
                <div className="home-hero__overlay" />

                <div className="home-hero__content">
                    {/* Left side: Tagline */}
                    <div className="home-hero__welcome">
                        <div className="home-hero__welcome-title">{t('home_find_flight')}</div>
                    </div>

                    {/* Right side: Flight Status Search */}
                    <div className="home-hero__search-card">
                        <div className="home-hero__search-header">
                            <span className="home-hero__search-label">{t('home_flight_status')}</span>
                            <div className="home-hero__toggle">
                                <button
                                    className={`home-hero__toggle-btn${mode === 'departures' ? ' active' : ''}`}
                                    onClick={() => setMode('departures')}
                                >
                                    {t('home_departures')}
                                </button>
                                <label className="home-hero__switch" title="Toggle arrivals/departures">
                                    <input
                                        type="checkbox"
                                        checked={mode === 'arrivals'}
                                        onChange={() => setMode(mode === 'departures' ? 'arrivals' : 'departures')}
                                    />
                                    <span className="home-hero__switch-slider" />
                                </label>
                                <button
                                    className={`home-hero__toggle-btn${mode === 'arrivals' ? ' active' : ''}`}
                                    onClick={() => setMode('arrivals')}
                                >
                                    {t('home_arrivals')}
                                </button>
                            </div>
                        </div>

                        <form className="home-hero__search-form" onSubmit={handleSearch}>
                            <span className="home-hero__search-icon">✈</span>
                            <input
                                className="home-hero__search-input"
                                type="text"
                                placeholder={t('home_search_placeholder')}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                            <button type="submit" className="home-hero__search-btn" aria-label="Search">
                                →
                            </button>
                        </form>

                        <div className="home-hero__search-footer">
                            <button className="home-hero__link" onClick={() => navigate('/flights')}>
                                {t('home_flight_tracker')} &rsaquo;
                            </button>
                            <button className="home-hero__link" onClick={() => navigate('/flights')}>
                                {t('home_all_flights')} &rsaquo;
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Quick Links ──────────────────────────────────── */}
            <div className="home-quicklinks">
                <div className="home-quicklinks__inner">
                    {quickLinks.map(link => (
                        <button
                            key={link.to}
                            className="home-quicklinks__item"
                            onClick={() => navigate(link.to)}
                        >
                            <span className="home-quicklinks__icon">{link.icon}</span>
                            <span className="home-quicklinks__label">{link.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Explore Cities ──────────────────────────── */}
            <div className="home-cities">
                <div className="home-cities__inner">
                    <div className="home-cities__header">
                        <h2 className="home-cities__title">
                            {t('home_explore_prefix')}
                            <span className="home-cities__title-highlight"> {t('home_explore_mid')} </span>
                            {t('home_explore_suffix')}
                        </h2>
                        <button className="home-cities__view-all" onClick={() => navigate('/flights')}>
                            {t('home_view_all')}
                        </button>
                    </div>
                    <div className="home-cities__grid">
                        {DESTINATIONS.map(dest => (
                            <button
                                key={dest.iata}
                                className="home-cities__card"
                                onClick={() => navigate(`/flights?q=${dest.iata}&mode=departures`)}
                            >
                                <img src={dest.img} alt={dest.city} className="home-cities__card-img" />
                                <div className="home-cities__card-overlay" />
                                <div className="home-cities__card-info">
                                    <div className="home-cities__card-city">{dest.city}</div>
                                    <div className="home-cities__card-tagline">{dest.tagline}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}

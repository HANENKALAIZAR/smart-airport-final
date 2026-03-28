import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function FAQPage() {
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const [openItems, setOpenItems] = useState({});

    const FAQ_CATEGORIES = [
        {
            nameKey: 'faq_cat_delays', icon: '⏱️',
            questions: [
                { q: t('faq_delays_q1'), a: t('faq_delays_a1') },
                { q: t('faq_delays_q2'), a: t('faq_delays_a2') },
                { q: t('faq_delays_q3'), a: t('faq_delays_a3') },
                { q: t('faq_delays_q4'), a: t('faq_delays_a4') },
                { q: t('faq_delays_q5'), a: t('faq_delays_a5') },
                { q: t('faq_delays_q6'), a: t('faq_delays_a6') },
            ],
        },
        {
            nameKey: 'faq_cat_baggage', icon: '🧳',
            questions: [
                { q: t('faq_baggage_q1'), a: t('faq_baggage_a1') },
                { q: t('faq_baggage_q2'), a: t('faq_baggage_a2') },
                { q: t('faq_baggage_q3'), a: t('faq_baggage_a3') },
                { q: t('faq_baggage_q4'), a: t('faq_baggage_a4') },
            ],
        },
        {
            nameKey: 'faq_cat_airport', icon: '🏢',
            questions: [
                { q: t('faq_airport_q1'), a: t('faq_airport_a1') },
                { q: t('faq_airport_q2'), a: t('faq_airport_a2') },
                { q: t('faq_airport_q3'), a: t('faq_airport_a3') },
                { q: t('faq_airport_q4'), a: t('faq_airport_a4') },
                { q: t('faq_airport_q5'), a: t('faq_airport_a5') },
            ],
        },
        {
            nameKey: 'faq_cat_ai', icon: '🤖',
            questions: [
                { q: t('faq_ai_q1'), a: t('faq_ai_a1') },
                { q: t('faq_ai_q2'), a: t('faq_ai_a2') },
                { q: t('faq_ai_q3'), a: t('faq_ai_a3') },
                { q: t('faq_ai_q4'), a: t('faq_ai_a4') },
            ],
        },
        {
            nameKey: 'faq_cat_general', icon: 'ℹ️',
            questions: [
                { q: t('faq_general_q1'), a: t('faq_general_a1') },
                { q: t('faq_general_q2'), a: t('faq_general_a2') },
                { q: t('faq_general_q3'), a: t('faq_general_a3') },
            ],
        },
    ];

    function toggle(catIdx, qIdx) {
        const key = `${catIdx}-${qIdx}`;
        setOpenItems(p => ({ ...p, [key]: !p[key] }));
    }

    const hasSearch = search.trim().length > 0;

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {/* Header */}
            <div className="card" style={{ padding: '24px', marginBottom: 16, background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <HelpCircle size={24} style={{ color: '#7C3AED' }} /> {t('faq_title')}
                </h1>
                <p style={{ color: '#5B21B6', fontSize: '0.85rem' }}>{t('faq_subtitle')}</p>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 20 }}>
                <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                    type="text"
                    placeholder={t('faq_search_placeholder')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: 12, border: '1px solid #E2E8F0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
            </div>

            {/* Categories */}
            {FAQ_CATEGORIES.map((cat, ci) => {
                const filteredQs = cat.questions.filter(q =>
                    !hasSearch || q.q.toLowerCase().includes(search.toLowerCase()) || q.a.toLowerCase().includes(search.toLowerCase())
                );
                if (filteredQs.length === 0) return null;
                return (
                    <div key={ci} style={{ marginBottom: 20 }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{cat.icon}</span> {t(cat.nameKey)}
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {filteredQs.map((item, qi) => {
                                const realIdx = cat.questions.indexOf(item);
                                const isOpen = openItems[`${ci}-${realIdx}`];
                                return (
                                    <div key={qi} className="card" style={{ overflow: 'hidden' }}>
                                        <button
                                            onClick={() => toggle(ci, realIdx)}
                                            style={{ width: '100%', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 }}
                                        >
                                            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#1E293B' }}>{item.q}</span>
                                            {isOpen ? <ChevronUp size={18} style={{ flexShrink: 0, color: '#94A3B8' }} /> : <ChevronDown size={18} style={{ flexShrink: 0, color: '#94A3B8' }} />}
                                        </button>
                                        {isOpen && (
                                            <div style={{ padding: '0 20px 16px', fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-secondary)', borderTop: '1px solid #F1F5F9' }}>
                                                <p style={{ marginTop: 12 }}>{item.a}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

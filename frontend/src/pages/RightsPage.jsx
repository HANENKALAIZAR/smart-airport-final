import { Shield, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function RightsPage() {
    const { t } = useLanguage();

    const REGIONS = [
        {
            id: 'eu', flag: '🇪🇺', nameKey: 'rights_region_eu', regulation: 'EC 261/2004',
            descKey: 'rights_eu_desc',
            rights: [
                { delay: t('rights_2h'), type: t('rights_refreshments'), details: t('rights_eu_refreshments_detail') },
                { delay: t('rights_3h'), type: t('rights_compensation'), details: t('rights_eu_comp_detail') },
                { delay: t('rights_5h'), type: t('rights_full_refund'), details: t('rights_eu_refund_detail') },
                { delay: t('rights_overnight'), type: t('rights_hotel_transport'), details: t('rights_eu_hotel_detail') },
            ],
            color: '#3B82F6',
        },
        {
            id: 'uk', flag: '🇬🇧', nameKey: 'rights_region_uk', regulation: 'UK261 (UK Retained EU Law)',
            descKey: 'rights_uk_desc',
            rights: [
                { delay: t('rights_2h'), type: t('rights_refreshments'), details: t('rights_uk_refreshments_detail') },
                { delay: t('rights_3h'), type: t('rights_compensation'), details: t('rights_uk_comp_detail') },
                { delay: t('rights_5h'), type: t('rights_full_refund'), details: t('rights_uk_refund_detail') },
                { delay: t('rights_overnight'), type: t('rights_hotel_transport'), details: t('rights_uk_hotel_detail') },
            ],
            color: '#9333EA',
        },
        {
            id: 'us', flag: '🇺🇸', nameKey: 'rights_region_us', regulation: 'DOT Regulations',
            descKey: 'rights_us_desc',
            rights: [
                { delay: t('rights_3h_domestic'), type: t('rights_tarmac_rule'), details: t('rights_us_tarmac3_detail') },
                { delay: t('rights_4h_intl'), type: t('rights_tarmac_rule'), details: t('rights_us_tarmac4_detail') },
                { delay: t('rights_significant'), type: t('rights_cash_refund'), details: t('rights_us_cash_detail') },
                { delay: t('rights_bumped'), type: t('rights_compensation'), details: t('rights_us_bumped_detail') },
            ],
            color: '#EF4444',
        },
        {
            id: 'ca', flag: '🇨🇦', nameKey: 'rights_region_ca', regulation: 'APPR',
            descKey: 'rights_ca_desc',
            rights: [
                { delay: t('rights_2h'), type: t('rights_communication'), details: t('rights_ca_comm_detail') },
                { delay: t('rights_3h'), type: t('rights_compensation_large'), details: t('rights_ca_large_detail') },
                { delay: t('rights_3h'), type: t('rights_compensation_small'), details: t('rights_ca_small_detail') },
                { delay: t('rights_overnight'), type: t('rights_hotel_meals'), details: t('rights_ca_hotel_detail') },
            ],
            color: '#EAB308',
        },
        {
            id: 'tr', flag: '🇹🇷', nameKey: 'rights_region_tr', regulation: 'SHY Passenger Rights',
            descKey: 'rights_tr_desc',
            rights: [
                { delay: t('rights_2h'), type: t('rights_refreshments'), details: t('rights_tr_refreshments_detail') },
                { delay: t('rights_3h'), type: t('rights_compensation'), details: t('rights_tr_comp_detail') },
                { delay: t('rights_5h'), type: t('rights_refund_rebooking'), details: t('rights_tr_refund_detail') },
                { delay: t('rights_overnight'), type: t('rights_hotel'), details: t('rights_tr_hotel_detail') },
            ],
            color: '#F97316',
        },
        {
            id: 'br', flag: '🇧🇷', nameKey: 'rights_region_br', regulation: 'ANAC Resolution 400',
            descKey: 'rights_br_desc',
            rights: [
                { delay: t('rights_1h'), type: t('rights_communication'), details: t('rights_br_comm_detail') },
                { delay: t('rights_2h'), type: t('rights_meals'), details: t('rights_br_meals_detail') },
                { delay: t('rights_4h'), type: t('rights_refund_rebooking'), details: t('rights_br_refund_detail') },
                { delay: t('rights_overnight'), type: t('rights_accommodation'), details: t('rights_br_hotel_detail') },
            ],
            color: '#16A34A',
        },
        {
            id: 'gcc', flag: '🌍', nameKey: 'rights_region_gcc', regulation: 'General Duty of Care',
            descKey: 'rights_gcc_desc',
            rights: [
                { delay: t('rights_2h'), type: t('rights_refreshments'), details: t('rights_gcc_refreshments_detail') },
                { delay: t('rights_4h'), type: t('rights_meals'), details: t('rights_gcc_meals_detail') },
                { delay: t('rights_overnight'), type: t('rights_hotel'), details: t('rights_gcc_hotel_detail') },
                { delay: t('status_cancelled'), type: t('rights_rebooking'), details: t('rights_gcc_rebooking_detail') },
            ],
            color: '#22C55E',
        },
        {
            id: 'montreal', flag: '🌐', nameKey: 'rights_region_montreal', regulation: 'Montreal Convention 1999',
            descKey: 'rights_montreal_desc',
            rights: [
                { delay: t('rights_any_delay'), type: t('rights_damages_claim'), details: t('rights_mtl_damages_detail') },
                { delay: t('rights_baggage_delay'), type: t('rights_baggage_compensation'), details: t('rights_mtl_baggage_detail') },
                { delay: t('rights_injury_death'), type: t('rights_liability_coverage'), details: t('rights_mtl_liability_detail') },
                { delay: t('rights_extraordinary'), type: t('rights_defense'), details: t('rights_mtl_defense_detail') },
            ],
            color: '#6366F1',
        },
    ];

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1 className="page-title">{t('rights_title')}</h1>
                <p className="page-subtitle">{t('rights_subtitle')}</p>
            </div>

            {/* Quick info */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(59,130,246,0.05))' }}>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start' }}>
                    <Info size={20} style={{ color: 'var(--info)', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}
                        dangerouslySetInnerHTML={{ __html: t('rights_info_text') }} />
                </div>
            </div>

            {/* Regions */}
            {REGIONS.map(region => (
                <div key={region.id} className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div className="card__header">
                        <div>
                            <div className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '1.5rem' }}>{region.flag}</span>
                                {t(region.nameKey)}
                            </div>
                            <div className="card__subtitle" style={{ color: region.color, fontWeight: 600 }}>
                                {region.regulation}
                            </div>
                        </div>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)', lineHeight: 1.5 }}>
                        {t(region.descKey)}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {region.rights.map((right, i) => (
                            <div
                                key={i}
                                style={{
                                    background: 'var(--bg-input)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '12px 16px',
                                    borderLeft: `3px solid ${region.color}`,
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: region.color }}>
                                        {right.type}
                                    </span>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        padding: '2px 8px',
                                        borderRadius: 'var(--radius-full)',
                                        background: 'rgba(99,102,241,0.1)',
                                        color: 'var(--text-muted)',
                                    }}>
                                        {right.delay}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                                    {right.details}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Disclaimer */}
            <div style={{
                textAlign: 'center',
                padding: 'var(--space-lg)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
            }}>
                <AlertTriangle size={14} style={{ verticalAlign: 'middle' }} /> {t('rights_disclaimer')}
            </div>
        </div>
    );
}

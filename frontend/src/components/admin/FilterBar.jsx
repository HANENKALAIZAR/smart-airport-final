import { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import CustomSelect from '../ui/CustomSelect';

export default function FilterBar({ onFilterChange }) {
    const { t } = useLanguage();
    const [filters, setFilters] = useState({ timeRange: [], riskLevels: [], statuses: [] });

    const timeRanges = [
        { id: 'morning', label: t('filter_morning') },
        { id: 'afternoon', label: t('filter_afternoon') },
        { id: 'evening', label: t('filter_evening') },
    ];

    const riskLevels = [
        { id: 'Low', label: t('filter_low_risk'), cls: 'admin-filter-pill--low' },
        { id: 'Medium', label: t('filter_medium_risk'), cls: 'admin-filter-pill--medium' },
        { id: 'High', label: t('filter_high_risk'), cls: 'admin-filter-pill--high' },
    ];

    const statuses = [
        { id: 'Scheduled', label: 'Scheduled' },
        { id: 'On-Time', label: 'On-Time' },
        { id: 'Delayed', label: 'Delayed' },
        { id: 'Boarding', label: 'Boarding' },
        { id: 'Departed', label: 'Departed' },
        { id: 'Cancelled', label: 'Cancelled' },
        { id: 'Landed', label: 'Landed' },
    ];

    function toggle(category, value) {
        setFilters(prev => {
            const arr = prev[category];
            const updated = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
            return { ...prev, [category]: updated };
        });
    }

    function apply() { onFilterChange(filters); }

    function reset() {
        const empty = { timeRange: [], riskLevels: [], statuses: [] };
        setFilters(empty);
        onFilterChange(empty);
    }

    function remove(category, value) {
        const updated = { ...filters, [category]: filters[category].filter(v => v !== value) };
        setFilters(updated);
        onFilterChange(updated);
    }

    const hasActive = filters.timeRange.length > 0 || filters.riskLevels.length > 0 || filters.statuses.length > 0;

    return (
        <div className="admin-space-y-3">
            <div className="admin-filter-bar" role="toolbar" aria-label="Dashboard filters">
                {/* Time Range (custom dropdown) */}
                <div style={{ width: 180, flexShrink: 0 }}>
                    <CustomSelect
                        options={timeRanges.map(tr => ({ value: tr.id, label: tr.label }))}
                        value={null}
                        placeholder={t('filter_select_time')}
                        onChange={(val) => { if (val) toggle('timeRange', val); }}
                    />
                </div>

                {/* Risk Level (compact toggles) */}
                <div className="admin-filter-toolbar__group">
                    {riskLevels.map(r => (
                        <button
                            key={r.id}
                            type="button"
                            className={`admin-filter-pill ${r.cls} admin-filter-pill--compact ${filters.riskLevels.includes(r.id) ? 'active' : ''}`}
                            onClick={() => toggle('riskLevels', r.id)}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                {/* Status (compact toggles) */}
                <div className="admin-filter-toolbar__group">
                    {statuses.map(s => (
                        <button
                            key={s.id}
                            type="button"
                            className={`admin-filter-pill admin-filter-pill--compact ${filters.statuses.includes(s.id) ? 'active' : ''}`}
                            onClick={() => toggle('statuses', s.id)}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Actions (right-aligned, always on the line) */}
                <div className="admin-filter-toolbar__actions">
                    <button type="button" className="admin-btn admin-btn--primary" onClick={apply}>
                        {t('filter_apply')}
                    </button>
                    <button type="button" className="admin-btn admin-btn--outline" onClick={reset}>
                        {t('filter_reset')}
                    </button>
                </div>
            </div>

            {/* Active chips */}
            {hasActive && (
                <div className="admin-filter-chips">
                    {filters.timeRange.map(tr => {
                        const found = timeRanges.find(x => x.id === tr);
                        return (
                            <div key={tr} className="admin-filter-chip admin-filter-chip--time">
                                {found?.label}
                                <button className="admin-filter-chip__close" onClick={() => remove('timeRange', tr)}>
                                    <X size={12} />
                                </button>
                            </div>
                        );
                    })}
                    {filters.riskLevels.map(r => (
                        <div key={r} className={`admin-filter-chip aviation-badge--${r.toLowerCase()}`} style={{ border: '1px solid' }}>
                            {r} {t('filter_risk_suffix')}
                            <button className="admin-filter-chip__close" onClick={() => remove('riskLevels', r)}>
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    {filters.statuses.map(s => (
                        <div key={s} className="admin-filter-chip admin-filter-chip--status">
                            {s}
                            <button className="admin-filter-chip__close" onClick={() => remove('statuses', s)}>
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

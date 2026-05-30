import re

file_path = r"c:\Users\gzhan\Downloads\smart-airport-postgres-feature-cleaned-up-the-chaos\frontend\src\styles\admin.css"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Define replacement block
new_css = """
/* ═══════════════════════════════════════════════════
   LIGHT THEME OVERRIDES (Unified and Variable-Driven)
   ═══════════════════════════════════════════════════ */
.admin-layout[data-theme="light"] .admin-sidebar {
    box-shadow: 1px 0 0 rgba(15, 31, 61, 0.04);
    border-right: 1px solid var(--adm-sb-border);
}
.admin-layout[data-theme="light"] .admin-sidebar__item:hover {
    background: rgba(15, 31, 61, 0.04);
    color: var(--adm-sb-text-hi);
}
.admin-layout[data-theme="light"] .admin-header {
    border-bottom: 1px solid var(--adm-border);
    box-shadow: 0 1px 0 rgba(15, 31, 61, 0.03);
}
.admin-layout[data-theme="light"] .admin-header__search-input {
    background: var(--adm-card);
    border-color: var(--adm-border);
    box-shadow: none;
    color: var(--adm-text);
}
.admin-layout[data-theme="light"] .admin-header__search-input::placeholder {
    color: var(--adm-text-muted);
}
.admin-layout[data-theme="light"] .admin-notif__btn {
    background: var(--adm-card);
    border-color: var(--adm-border);
    color: var(--adm-text-sub);
}
.admin-layout[data-theme="light"] .admin-notif__btn:hover {
    background: var(--adm-accent-light);
    color: var(--adm-accent);
}
.admin-layout[data-theme="light"] .admin-notif__dropdown {
    background: var(--adm-card);
    border-color: var(--adm-border);
    box-shadow: 0 20px 60px rgba(15, 31, 61, 0.12);
}
.admin-layout[data-theme="light"] .admin-notif__title,
.admin-layout[data-theme="light"] .admin-notif__item-title {
    color: var(--adm-text);
}
.admin-layout[data-theme="light"] .admin-notif__item-msg {
    color: var(--adm-text-sub);
}
.admin-layout[data-theme="light"] .admin-notif__item-time {
    color: var(--adm-text-muted);
}
.admin-layout[data-theme="light"] .admin-notif__item:hover {
    background: rgba(15, 31, 61, 0.04);
}
.admin-layout[data-theme="light"] .admin-notif__header { border-bottom-color: var(--adm-border); }
.admin-layout[data-theme="light"] .admin-notif__footer { border-top-color: var(--adm-border); }
.admin-layout[data-theme="light"] .admin-notif__item { border-bottom-color: var(--adm-border); }
.admin-layout[data-theme="light"] .admin-notif__item.unread { background: var(--adm-accent-light); }
.admin-layout[data-theme="light"] .admin-notif__mark-read,
.admin-layout[data-theme="light"] .admin-notif__view-all { color: var(--adm-accent); }

.admin-layout[data-theme="light"] .admin-sidebar__logout:hover {
    background: rgba(239, 68, 68, 0.08);
    color: #B91C1C;
}

/* Light theme text enforcement */
.admin-layout[data-theme="light"] .admin-page__title,
.admin-layout[data-theme="light"] .admin-page-header h1 {
    color: var(--adm-text);
}
.admin-layout[data-theme="light"] .admin-page__subtitle,
.admin-layout[data-theme="light"] .admin-page-header p {
    color: var(--adm-text-sub);
}
.admin-layout[data-theme="light"] .admin-page,
.admin-layout[data-theme="light"] .admin-card,
.admin-layout[data-theme="light"] .kpi-card,
.admin-layout[data-theme="light"] .glass-card {
    color: var(--adm-text);
}
.admin-layout[data-theme="light"] .glass-card {
    background: var(--adm-card);
    border-color: var(--adm-card-border);
}

.admin-layout[data-theme="light"] {
    color-scheme: light;
    background: var(--adm-bg);
}

.admin-layout[data-theme="light"] h1,
.admin-layout[data-theme="light"] h2,
.admin-layout[data-theme="light"] h3,
.admin-layout[data-theme="light"] h4 {
    color: var(--adm-text);
}
.admin-layout[data-theme="light"] p { color: var(--adm-text-sub); }

.admin-layout[data-theme="light"] .admin-sidebar__item svg { color: currentColor; opacity: 0.85; }
.admin-layout[data-theme="light"] .admin-sidebar__item.active svg { color: var(--adm-sb-accent); opacity: 1; }

.admin-layout[data-theme="light"] .admin-header__user div[style*="linear-gradient"] { color: var(--adm-text) !important; }
.admin-layout[data-theme="light"] .admin-header__date svg,
.admin-layout[data-theme="light"] .admin-header__airport-btn svg { color: var(--adm-accent); }

/* Buttons */
.admin-layout[data-theme="light"] .admin-header__date,
.admin-layout[data-theme="light"] .admin-header__airport-btn,
.admin-layout[data-theme="light"] .admin-header__user {
    background: var(--adm-card);
    border-color: var(--adm-border);
    color: var(--adm-text);
}
.admin-layout[data-theme="light"] .admin-header__date:hover,
.admin-layout[data-theme="light"] .admin-header__airport-btn:hover {
    background: var(--adm-accent-light);
    border-color: var(--adm-accent);
}

/* Tables */
.admin-layout[data-theme="light"] .admin-table-wrap {
    background: var(--adm-card);
    border-color: var(--adm-border);
}
.admin-layout[data-theme="light"] .admin-table thead {
    background: var(--adm-bg);
    border-bottom-color: var(--adm-border);
}
.admin-layout[data-theme="light"] .admin-table th { color: var(--adm-text-sub); }
.admin-layout[data-theme="light"] .admin-table td { color: var(--adm-text); }
.admin-layout[data-theme="light"] .admin-table tbody tr { border-bottom-color: rgba(15,31,61,0.04); }
.admin-layout[data-theme="light"] .admin-table tbody tr:hover { background: var(--adm-card-hover); }
.admin-layout[data-theme="light"] .admin-table__muted { color: var(--adm-text-muted); }

/* KPI Cards */
.admin-layout[data-theme="light"] .kpi-card__title { color: var(--adm-text-muted); }
.admin-layout[data-theme="light"] .kpi-card__value { color: var(--adm-text); }
.admin-layout[data-theme="light"] .kpi-card__suffix { color: var(--adm-text-sub); }

/* Filter Pills */
.admin-layout[data-theme="light"] .admin-filter-pill {
    background: var(--adm-card);
    border-color: var(--adm-border);
    color: var(--adm-text-sub);
}
.admin-layout[data-theme="light"] .admin-filter-pill:hover { color: var(--adm-text); border-color: var(--adm-accent); }
.admin-layout[data-theme="light"] .admin-filter-bar__label { color: var(--adm-text-muted); }

/* Stats */
.admin-layout[data-theme="light"] .admin-stat-card { background: var(--adm-card); border-color: var(--adm-border); }
.admin-layout[data-theme="light"] .admin-stat-card__label { color: var(--adm-text-muted); }
.admin-layout[data-theme="light"] .admin-stat-card__value--default { color: var(--adm-text); }

/* AI Alerts */
.admin-layout[data-theme="light"] .ai-alerts-panel { background: var(--adm-card); border-color: var(--adm-border); }
.admin-layout[data-theme="light"] .ai-alert-card {
    background: var(--adm-bg);
    border-color: var(--adm-border);
}
.admin-layout[data-theme="light"] .ai-alert-card__title { color: var(--adm-text); }
.admin-layout[data-theme="light"] .ai-alert-card__issue,
.admin-layout[data-theme="light"] .ai-alert-card__rec { color: var(--adm-text-sub); }

/* Direction Toggle */
.admin-layout[data-theme="light"] .dash-dir-toggle {
    background: var(--adm-input-bg);
    border-color: var(--adm-border);
}
.admin-layout[data-theme="light"] .dash-dir-btn { color: var(--adm-text-sub); }
.admin-layout[data-theme="light"] .dash-dir-btn:hover { color: var(--adm-text); background: rgba(15,31,61,0.04); }
.admin-layout[data-theme="light"] .dash-dir-btn--active { background: var(--adm-card); color: var(--adm-text); box-shadow: 0 1px 2px rgba(0,0,0,0.04); }

/* Pagination */
.admin-layout[data-theme="light"] .admin-pagination .pagination__info { color: var(--adm-text-muted); }
.admin-layout[data-theme="light"] .admin-pagination .pagination__btn {
    background: var(--adm-card);
    border-color: var(--adm-border);
    color: var(--adm-text-sub);
}

/* Status Colors */
.admin-layout[data-theme="light"] .admin-table__status--departed { color: var(--adm-text-muted); }
.admin-layout[data-theme="light"] .admin-table__status--on-time { color: #047857; }
.admin-layout[data-theme="light"] .admin-table__status--delayed { color: #B91C1C; }
.admin-layout[data-theme="light"] .admin-table__status--cancelled { color: #BE123C; }
.admin-layout[data-theme="light"] .admin-table__status--boarding { color: var(--adm-accent); }

/* Aviation Badges */
.admin-layout[data-theme="light"] .aviation-badge--low {
    background: rgba(16,185,129,0.12); color: #047857; border-color: rgba(16,185,129,0.3);
}
.admin-layout[data-theme="light"] .aviation-badge--medium {
    background: var(--adm-accent-light); color: var(--adm-accent); border-color: rgba(234,88,12,0.3);
}
.admin-layout[data-theme="light"] .aviation-badge--high {
    background: rgba(239,68,68,0.12); color: #B91C1C; border-color: rgba(239,68,68,0.3);
}

/* Primary buttons */
.admin-layout[data-theme="light"] .admin-btn--primary { color: #FFFFFF; box-shadow: 0 4px 14px var(--adm-accent-glow); }
.admin-layout[data-theme="light"] .admin-btn--outline {
    background: var(--adm-card); border-color: var(--adm-border); color: var(--adm-text);
}
.admin-layout[data-theme="light"] .admin-btn--outline:hover {
    background: var(--adm-accent-light); border-color: var(--adm-accent); color: var(--adm-accent);
}
.admin-layout[data-theme="light"] .admin-btn--danger { background: rgba(239,68,68,0.1); color: #B91C1C; border-color: rgba(239,68,68,0.25); }
.admin-layout[data-theme="light"] .admin-btn--danger:hover { background: rgba(239,68,68,0.15); }
.admin-layout[data-theme="light"] .admin-btn:disabled,
.admin-layout[data-theme="light"] .admin-btn[disabled] { color: var(--adm-text-muted); opacity: 0.6; }

/* Generic Inputs */
.admin-layout[data-theme="light"] .admin-card input[type="text"],
.admin-layout[data-theme="light"] .admin-card input[type="email"],
.admin-layout[data-theme="light"] .admin-card input[type="password"],
.admin-layout[data-theme="light"] .admin-card input[type="search"],
.admin-layout[data-theme="light"] .admin-card textarea,
.admin-layout[data-theme="light"] input,
.admin-layout[data-theme="light"] select,
.admin-layout[data-theme="light"] textarea {
    background: var(--adm-card) !important;
    border-color: var(--adm-border) !important;
    color: var(--adm-text) !important;
}
.admin-layout[data-theme="light"] input::placeholder,
.admin-layout[data-theme="light"] textarea::placeholder {
    color: var(--adm-text-muted);
}

/* Modals */
.admin-layout[data-theme="light"] .admin-modal {
    background: var(--adm-card); color: var(--adm-text); border-color: var(--adm-border);
}
.admin-layout[data-theme="light"] .admin-modal__header {
    background: var(--adm-bg); border-bottom-color: var(--adm-border); color: var(--adm-text);
}
.admin-layout[data-theme="light"] .admin-modal__header h2,
.admin-layout[data-theme="light"] .admin-modal__section-title,
.admin-layout[data-theme="light"] .admin-modal__field-value,
.admin-layout[data-theme="light"] .admin-modal__history-value,
.admin-layout[data-theme="light"] .admin-modal__prediction-header h3 { color: var(--adm-text); }
.admin-layout[data-theme="light"] .admin-modal__header p,
.admin-layout[data-theme="light"] .admin-modal__field-label,
.admin-layout[data-theme="light"] .admin-modal__history-label { color: var(--adm-text-sub); }
.admin-layout[data-theme="light"] .admin-modal__prediction,
.admin-layout[data-theme="light"] .admin-modal__history-card {
    background: var(--adm-bg); border-color: var(--adm-border);
}
.admin-layout[data-theme="light"] .admin-modal__footer { border-color: var(--adm-border); }
.admin-layout[data-theme="light"] .admin-modal__close { color: var(--adm-text-sub); }
.admin-layout[data-theme="light"] .admin-modal__close:hover { color: var(--adm-text); }
.admin-layout[data-theme="light"] .admin-modal__explanation {
    background: var(--adm-accent-light); border-color: rgba(234,88,12,0.15);
}
.admin-layout[data-theme="light"] .admin-modal__explanation p { color: var(--adm-text); }
.admin-layout[data-theme="light"] .admin-modal__explanation strong { color: var(--adm-accent); }

/* CustomSelect */
.admin-layout[data-theme="light"] .csel__btn {
    background: var(--adm-card) !important;
    border-color: var(--adm-border) !important;
    color: var(--adm-text) !important;
    box-shadow: 0 1px 2px rgba(15,31,61,0.03) !important;
}
.admin-layout[data-theme="light"] .csel__btn:hover { border-color: var(--adm-accent) !important; }
.admin-layout[data-theme="light"] .csel__menu {
    background: var(--adm-card) !important; border-color: var(--adm-border) !important;
    box-shadow: 0 8px 24px rgba(15,31,61,0.1) !important;
}
.admin-layout[data-theme="light"] .csel__opt { color: var(--adm-text) !important; }
.admin-layout[data-theme="light"] .csel__opt:hover { background: var(--adm-bg) !important; color: var(--adm-text-hi) !important; }

/* Overrides for inline RGBA */
.admin-layout[data-theme="light"] .admin-page > div[style*="rgba(255,255,255,0.02)"] {
    background: var(--adm-card) !important;
    border-color: var(--adm-border) !important;
    box-shadow: 0 1px 2px rgba(15,31,61,0.03);
}
.admin-layout[data-theme="light"] .admin-page div[style*="rgba(255,255,255,0.03)"][style*="border"] {
    background: var(--adm-bg) !important;
}
.admin-layout[data-theme="light"] .admin-page input[style*="background: transparent"]::placeholder { color: var(--adm-text-muted); }
.admin-layout[data-theme="light"] .admin-profile-readfield { background: var(--adm-bg); border-color: var(--adm-border); color: var(--adm-text); }
.admin-layout[data-theme="light"] .admin-profile-readfield svg { color: var(--adm-text-muted); }

/* Scrollbars */
.admin-layout[data-theme="light"] .admin-sidebar__nav::-webkit-scrollbar-thumb { background: rgba(15,31,61,0.15); }
.admin-layout[data-theme="light"] .admin-content::-webkit-scrollbar-thumb { background: rgba(15,31,61,0.15); }
.admin-layout[data-theme="light"] .admin-table tbody tr td svg { color: var(--adm-text-muted); }
.admin-layout[data-theme="light"] .admin-card span[style*="rgba(255,255,255"],
.admin-layout[data-theme="light"] .admin-card div[style*="rgba(255,255,255,0.6)"],
.admin-layout[data-theme="light"] .admin-card div[style*="rgba(255,255,255,0.45)"] {
    color: var(--adm-text-sub) !important;
}

/* Users page */
.admin-layout[data-theme="light"] .users-stat-card { background: var(--adm-card); border-color: var(--adm-border); }
.admin-layout[data-theme="light"] .users-stat-value { color: var(--adm-text); }
.admin-layout[data-theme="light"] .users-stat-label { color: var(--adm-text-muted); }
.admin-layout[data-theme="light"] .users-filters__search-input {
    background: var(--adm-card); border-color: var(--adm-border); color: var(--adm-text);
}
"""

start_idx = content.find('.admin-layout[data-theme="light"] .admin-sidebar {')
end_idx = content.find('.admin-layout .border-primary {')

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx - 171] + new_css + content[end_idx:]
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully updated the CSS file.")
else:
    print(f"Could not find indices: {start_idx}, {end_idx}")

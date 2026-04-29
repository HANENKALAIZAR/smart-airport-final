import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable pagination component.
 * Shows page numbers + Précédent / Suivant buttons.
 * Only renders when totalItems > pageSize.
 */
export default function Pagination({ currentPage, totalItems, pageSize = 10, onPageChange, className = '' }) {
    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) return null;

    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);

    // Build visible page numbers with ellipsis
    function getPages() {
        const pages = [];
        const delta = 1; // pages around current
        const left = Math.max(2, currentPage - delta);
        const right = Math.min(totalPages - 1, currentPage + delta);

        pages.push(1);
        if (left > 2) pages.push('...');
        for (let i = left; i <= right; i++) pages.push(i);
        if (right < totalPages - 1) pages.push('...');
        if (totalPages > 1) pages.push(totalPages);
        return pages;
    }

    return (
        <div className={`pagination ${className}`}>
            <span className="pagination__info">
                {start}–{end} sur {totalItems}
            </span>
            <div className="pagination__controls">
                <button
                    className="pagination__btn pagination__btn--nav"
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(currentPage - 1)}
                >
                    <ChevronLeft size={16} />
                    Précédent
                </button>
                {getPages().map((p, i) =>
                    p === '...' ? (
                        <span key={`e${i}`} className="pagination__ellipsis">…</span>
                    ) : (
                        <button
                            key={p}
                            className={`pagination__btn pagination__btn--page${p === currentPage ? ' pagination__btn--active' : ''}`}
                            onClick={() => onPageChange(p)}
                        >
                            {p}
                        </button>
                    )
                )}
                <button
                    className="pagination__btn pagination__btn--nav"
                    disabled={currentPage === totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                >
                    Suivant
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}

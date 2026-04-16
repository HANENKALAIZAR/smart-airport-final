/**
 * CustomSelect — Reusable styled dropdown component
 * ====================================================
 * Replaces all native <select> elements across the application.
 * Fully keyboard-accessible, click-outside-to-close, dark-mode-first design.
 *
 * Props:
 *   options    — array of { value, label }
 *   value      — current selected value (string | number | null)
 *   onChange   — (value) => void
 *   placeholder — string (shown when no value selected)
 *   disabled   — boolean
 *   className  — extra wrapper class
 *   id         — id for the trigger button (a11y)
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CustomSelect({
  options = [],
  value = null,
  onChange,
  placeholder = '— Select —',
  disabled = false,
  className = '',
  id,
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  /* Close when clicking outside */
  const handleClickOutside = useCallback((e) => {
    if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, handleClickOutside]);

  /* Keyboard navigation */
  function handleKeyDown(e) {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((v) => !v);
    }
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = options.findIndex((o) => String(o.value) === String(value));
      const next = options[(idx + 1) % options.length];
      if (next) onChange?.(next.value);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = options.findIndex((o) => String(o.value) === String(value));
      const prev = options[(idx - 1 + options.length) % options.length];
      if (prev) onChange?.(prev.value);
    }
  }

  const selected = options.find((o) => String(o.value) === String(value));
  const displayLabel = selected ? selected.label : placeholder;
  const isPlaceholder = !selected;

  return (
    <div
      ref={wrapperRef}
      className={`custom-select-wrapper ${className}`}
      style={{ position: 'relative', display: 'block' }}
    >
      {/* Trigger */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '9px 12px',
          background: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(30,41,59,0.9)',
          border: `1px solid ${open ? 'rgba(99,102,241,0.55)' : 'rgba(100,116,139,0.4)'}`,
          borderRadius: 8,
          color: isPlaceholder ? 'rgba(255,255,255,0.35)' : '#E2E8F0',
          fontSize: '0.88rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxShadow: open ? '0 0 0 2px rgba(99,102,241,0.2)' : 'none',
          opacity: disabled ? 0.6 : 1,
          textAlign: 'left',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayLabel}
        </span>
        <ChevronDown
          size={15}
          style={{
            flexShrink: 0,
            color: 'rgba(255,255,255,0.4)',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#1E293B',
            border: '1px solid rgba(100,116,139,0.5)',
            borderRadius: 8,
            margin: 0,
            padding: '4px 0',
            listStyle: 'none',
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            maxHeight: 260,
            overflowY: 'auto',
            animation: 'customSelectFadeIn 0.1s ease',
          }}
        >
          {options.length === 0 ? (
            <li
              style={{
                padding: '9px 14px',
                fontSize: '0.82rem',
                color: 'rgba(255,255,255,0.3)',
                textAlign: 'center',
              }}
            >
              No options
            </li>
          ) : (
            options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange?.(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    padding: '9px 14px',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    color: isSelected ? '#A5B4FC' : '#CBD5E1',
                    background: isSelected
                      ? 'rgba(99,102,241,0.18)'
                      : 'transparent',
                    fontWeight: isSelected ? 600 : 400,
                    transition: 'background 0.1s',
                    borderLeft: isSelected
                      ? '2px solid #6366F1'
                      : '2px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background =
                        'rgba(255,255,255,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {isSelected && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366F1', flexShrink: 0 }} />
                  )}
                  {opt.label}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

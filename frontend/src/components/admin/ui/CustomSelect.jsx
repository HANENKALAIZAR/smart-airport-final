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
  name,
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
      {/* Hidden input for form submission/autofill compatibility */}
      <input type="hidden" name={name} value={value || ''} />
      {/* Trigger */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        className={`custom-select-btn ${open ? 'open' : ''} ${isPlaceholder ? 'placeholder' : ''}`}
      >
        <span className="custom-select-btn-text">
          {displayLabel}
        </span>
        <ChevronDown
          size={15}
          className="custom-select-chevron"
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <ul
          role="listbox"
          className="custom-select-menu"
        >
          {options.length === 0 ? (
            <li className="custom-select-empty">
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
                  className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                >
                  {isSelected && (
                    <span className="custom-select-option-dot" />
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

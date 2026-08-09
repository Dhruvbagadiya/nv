import { useEffect, useId, useMemo, useRef, useState } from 'react';

// The collapsible searchable field the reference "Give us your choice of study"
// screen uses: a closed row showing the label and the current choice, which opens
// into a filter box over a scrolling option list.
//
// A plain <select> was not enough here — the country and nationality lists run to
// dozens of entries and the reference lets you type to narrow them. This keeps the
// same .field styling the form card already had, so the closed state is identical
// to what was there before.
//
// `allowCustom` exists because nationality is free text in the API (max 80 chars):
// a list of common nationalities covers nearly everyone, but nobody should be
// unable to submit an inquiry because their own is missing.
export default function ChoiceField({
  label,
  hint,
  value,
  options,
  onChange,
  placeholder = 'Search…',
  allowCustom = false,
  disabled = false,
  loading = false,
  emptyMessage = 'No matches',
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  // With allowCustom the stored value is the label itself, so a typed nationality
  // still reads back correctly after it is chosen.
  const selectedLabel = selected?.label ?? (allowCustom && value ? value : '');

  const matches = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, term]);

  // Offer the typed text only when it is not already an option, so "Indian"
  // doesn't appear twice.
  const custom =
    allowCustom && term.trim() && !matches.some((o) => o.label.toLowerCase() === term.trim().toLowerCase())
      ? term.trim()
      : null;

  const rows = custom ? [...matches, { value: custom, label: custom, isCustom: true }] : matches;

  const toggle = (next) => {
    setOpen(next);
    // Reopening should start from the full list, not from whatever was typed
    // last time.
    setTerm('');
    setActive(0);
  };

  useEffect(() => {
    if (!open) return undefined;
    // Clicking another field should close this one rather than leaving two panels
    // stacked over each other.
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) toggle(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Only the focus belongs in an effect — it drives the DOM. Clearing the search
  // term is state, and doing it here would cascade an extra render on every open.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const choose = (option) => {
    onChange(option.value);
    toggle(false);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      toggle(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!rows.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + rows.length) % rows.length);
      return;
    }
    if (event.key === 'Enter') {
      // Enter inside the search box must pick the highlighted option, not submit
      // the surrounding form — that used to post a half-filled inquiry.
      event.preventDefault();
      if (rows[active]) choose(rows[active]);
    }
  };

  return (
    <div className={`choice-field${open ? ' open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="field choice-head"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => toggle(!open)}
      >
        <span className="choice-text">
          <span className="flabel">{label}</span>
          <span className={selectedLabel ? 'choice-value' : 'hint'}>
            {loading ? 'Loading…' : selectedLabel || hint}
          </span>
        </span>
        <span className="chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="choice-panel" id={listId}>
          <input
            ref={searchRef}
            type="text"
            className="choice-search"
            placeholder={placeholder}
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <ul className="choice-list" role="listbox" aria-label={label}>
            {rows.length === 0 && <li className="choice-empty">{emptyMessage}</li>}
            {rows.map((option, index) => (
              <li key={`${option.value}-${index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`choice-option${index === active ? ' active' : ''}${
                    option.value === value ? ' selected' : ''
                  }`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  {option.icon && <span className="choice-icon">{option.icon}</span>}
                  <span>{option.isCustom ? `Use “${option.label}”` : option.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

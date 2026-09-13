import { useEffect, useId, useRef, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Icon from './Icon.jsx';

/**
 * Type to find one row out of thousands.
 *
 * Seven admin screens rendered `<select>` with every institution in it — 1,255
 * options, some screens twice. That is a large DOM on every open, no way to
 * search beyond the browser's first-letter jump, and unusable on a phone. The
 * list endpoints already accept `?search=`; nothing was using it.
 *
 * The search runs on the server, so the picker never holds the full list. When a
 * value is already set, `selectedLabel` is what gets displayed — the chosen row
 * is usually not in the current page of results, and re-fetching it by id just
 * to render a name it already has would be a request per edit.
 */
export default function EntityPicker({
  id,
  label,
  value,
  selectedLabel,
  onChange,
  queryKey,
  fetchOptions,
  placeholder = 'Search…',
  hint,
  required,
  emptyMessage = 'Nothing matches that.',
  allowClear = true,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();

  // Typing is not a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 220);
    return () => clearTimeout(t);
  }, [search]);

  const { data: options = [], isFetching, isError } = useQuery({
    queryKey: [...queryKey, debounced],
    queryFn: () => fetchOptions(debounced),
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

  // Close on an outside click. Without this the list stays over the rest of the
  // form and swallows the next click.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (option) => {
    onChange(option.value, option);
    setOpen(false);
    setSearch('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => Math.min(Math.max(i + delta, 0), Math.max(options.length - 1, 0)));
      return;
    }
    if (e.key === 'Enter' && open && options[active]) {
      e.preventDefault();
      choose(options[active]);
      return;
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="form-field entity-picker" ref={rootRef}>
      <label className="flabel" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      {/* A chosen value reads as a settled choice, not as text in a search box. */}
      {value && !open ? (
        <div className="entity-picker__chosen">
          <span className="entity-picker__chosen-name">{selectedLabel || value}</span>
          <button
            type="button"
            // Carries the id in THIS branch, because the input that normally
            // holds it is not rendered here — so the label above pointed at
            // nothing whenever a value was set, which is most of the time on
            // most of the admin forms. A screen reader announced a label with no
            // control, and clicking the label did nothing.
            id={id}
            // Names the control it reopens, so "Change" is not the whole of what
            // gets announced.
            aria-label={`${label}: ${selectedLabel || value}. Change`}
            className="btn btn-ghost entity-picker__change"
            onClick={() => { setOpen(true); setSearch(''); setTimeout(() => inputRef.current?.focus(), 0); }}
          >
            Change
          </button>
          {allowClear && (
            <button type="button" className="btn btn-ghost" onClick={() => onChange('', null)}>
              Clear
            </button>
          )}
        </div>
      ) : (
        <div className="entity-picker__control">
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
            value={search}
            placeholder={placeholder}
            onChange={(e) => { setSearch(e.target.value); setActive(0); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          <span className="entity-picker__icon" aria-hidden="true">
            <Icon name="search" size={14} />
          </span>
        </div>
      )}

      {open && (
        <ul className="entity-picker__list picker-list" id={listId} role="listbox" aria-label={label}>
          {options.map((o, i) => (
            <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={`picker-row${i === active ? ' selected' : ''}`}
                // Mouse-down rather than click: the input's blur would otherwise
                // close the list before the click landed.
                onMouseDown={(e) => { e.preventDefault(); choose(o); }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="picker-main">
                  <span>{o.label}</span>
                  {o.hint && <span className="picker-sub">{o.hint}</span>}
                </span>
              </button>
            </li>
          ))}
          {!options.length && (
            <li className="picker-empty" role="presentation">
              {/* "Not found" and "the search failed" are different answers, and
                  reading the second as the first is how an admin creates a
                  duplicate institution. */}
              {isFetching ? 'Searching…' : isError ? 'Search failed — try again.' : emptyMessage}
            </li>
          )}
        </ul>
      )}

      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

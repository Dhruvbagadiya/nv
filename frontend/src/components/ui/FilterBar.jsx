// The filter card appears on 10 of the 11 screens in the reference screenshots —
// Commission, UG/PG Requirements, Important Updates, all five Document Bank
// pages, MOI Accepted, Application History — always the same shape: a responsive
// grid of fields above an "Apply Filter" / "Clear Filter" pair.
//
// Config-driven so a screen declares its fields instead of restating the markup.
// Uses the .filter-card / .filter-grid / .filter-field / .filter-actions classes
// that already exist in index.css, so it inherits the approved styling.
//
//   const FIELDS = [
//     { name: 'country',  label: 'Country', type: 'select', placeholder: 'Select country',
//       options: countries.map((c) => ({ value: c.code, label: c.name })) },
//     { name: 'search',   label: 'Search by name', type: 'text',
//       placeholder: 'Enter keywords to search institute' },
//     { name: 'dateFrom', label: 'Publish date from', type: 'date' },
//   ];
//
import InstitutionPicker from './InstitutionPicker.jsx';

export default function FilterBar({
  fields,
  values,
  onChange,
  onApply,
  onClear,
  applyLabel = 'Apply Filter',
  clearLabel = 'Clear Filter',
  busy = false,
}) {
  // Enter should submit, which requires a real <form>. The reference screens are
  // click-to-apply, but keyboard users shouldn't have to reach for the mouse.
  const handleSubmit = (event) => {
    event.preventDefault();
    onApply();
  };

  return (
    <form className="filter-card" onSubmit={handleSubmit}>
      <div className="filter-grid">
        {fields.map((field) => {
          const id = `filter-${field.name}`;
          const value = values[field.name] ?? '';

          // Searched on the server rather than listed: the institution filter
          // used to render every one of ~1,255 rows as an <option>.
          if (field.type === 'institution') {
            return (
              <div className="filter-field" key={field.name}>
                <InstitutionPicker
                  id={id}
                  label={field.label}
                  value={value}
                  selectedLabel={field.selectedLabel}
                  countryCode={field.countryCode}
                  onChange={(next) => onChange(field.name, next)}
                />
              </div>
            );
          }

          return (
            <div className="filter-field" key={field.name}>
              {/* Wired via htmlFor: the original screens used bare <label>s with
                  no association, so clicking the label did nothing and screen
                  readers announced the control unlabelled. */}
              <label htmlFor={id}>{field.label}</label>

              {field.type === 'select' ? (
                <select
                  id={id}
                  value={value}
                  disabled={field.disabled}
                  onChange={(e) => onChange(field.name, e.target.value)}
                >
                  <option value="">{field.placeholder ?? `All ${field.label.toLowerCase()}`}</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  type={field.type === 'date' ? 'date' : 'text'}
                  value={value}
                  placeholder={field.placeholder}
                  disabled={field.disabled}
                  onChange={(e) => onChange(field.name, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="filter-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Applying…' : applyLabel}
        </button>
        <button type="button" className="btn btn-outline" onClick={onClear} disabled={busy}>
          {clearLabel}
        </button>
      </div>
    </form>
  );
}

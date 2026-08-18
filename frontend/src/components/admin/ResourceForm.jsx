import { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Icon from '../ui/Icon.jsx';

// Config-driven form used by every admin editor. Same reasoning as FilterBar: six
// reference resources need create/edit forms that differ only in their fields, so
// the markup, the dirty tracking and the error handling are written once.
//
// Field shapes: text | textarea | number | date | select | checkbox | tiers
// (`tiers` is the commission-rate editor — an array of {label, rate} pairs.)

function TierEditor({ value, onChange }) {
  const tiers = value?.length ? value : [{ label: '', rate: '' }];

  const update = (index, key, next) =>
    onChange(tiers.map((t, i) => (i === index ? { ...t, [key]: next } : t)));

  return (
    <div className="tier-editor">
      {tiers.map((tier, index) => (
        // Index keys are safe here: rows are only appended or removed at the end,
        // never reordered.
        <div className="tier-row" key={index}>
          <input
            type="text"
            placeholder="e.g. 1 - 5 Students, or All students"
            value={tier.label}
            onChange={(e) => update(index, 'label', e.target.value)}
            aria-label={`Tier ${index + 1} label`}
          />
          <input
            type="text"
            placeholder="15%"
            value={tier.rate}
            onChange={(e) => update(index, 'rate', e.target.value)}
            aria-label={`Tier ${index + 1} rate`}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onChange(tiers.filter((_, i) => i !== index))}
            disabled={tiers.length === 1}
            aria-label={`Remove tier ${index + 1}`}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => onChange([...tiers, { label: '', rate: '' }])}
      >
        + Add tier
      </button>
    </div>
  );
}

function Field({ field, value, onChange }) {
  const id = `form-${field.name}`;
  const common = {
    id,
    required: field.required,
    disabled: field.disabled,
    onChange: (e) => onChange(field.name, e.target.value),
  };

  if (field.type === 'tiers') {
    return (
      <>
        <label htmlFor={id} className="flabel">
          {field.label}
        </label>
        <TierEditor value={value} onChange={(next) => onChange(field.name, next)} />
      </>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="checkbox-row" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          disabled={field.disabled}
          onChange={(e) => onChange(field.name, e.target.checked)}
        />
        <span>{field.label}</span>
      </label>
    );
  }

  return (
    <>
      <label htmlFor={id} className="flabel">
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea {...common} value={value ?? ''} rows={field.rows ?? 4} placeholder={field.placeholder} />
      ) : field.type === 'select' ? (
        <select {...common} value={value ?? ''}>
          <option value="">{field.placeholder ?? 'Select…'}</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={value ?? ''}
          placeholder={field.placeholder}
        />
      )}
      {field.hint && <div className="field-hint">{field.hint}</div>}
    </>
  );
}

export default function ResourceForm({
  title,
  fields,
  initialValues = {},
  onSubmit,
  onClose,
  isSaving,
  error,
  submitLabel = 'Save',
}) {
  const [values, setValues] = useState(() => {
    // Seeded from defaults so a create form starts valid rather than with undefined
    // values that React logs as uncontrolled-input warnings.
    const seeded = {};
    for (const f of fields) seeded[f.name] = initialValues[f.name] ?? f.defaultValue ?? '';
    return seeded;
  });

  const setField = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <Modal title={title} onClose={onClose} wide>
      <form onSubmit={handleSubmit} id="resource-form">
        {fields.map((field) => (
          <div className="form-field" key={field.name}>
            <Field field={field} value={values[field.name]} onChange={setField} />
          </div>
        ))}

        {/* The API's message, not a generic one — its zod errors name the field. */}
        {error && <p className="form-error">{error}</p>}

        <div className="submit-row">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

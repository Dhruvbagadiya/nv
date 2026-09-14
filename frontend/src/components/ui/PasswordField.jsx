import { useId, useState } from 'react';
import Icon from './Icon.jsx';

/**
 * A password input with a reveal toggle.
 *
 * Typing a password you cannot see, into a field you will be asked to retype, is
 * the reason password-confirmation mismatches happen at all. Every browser and
 * password manager offers this; the product did not, on any of its ten password
 * fields.
 *
 * The toggle is a <button>, not a checkbox styled as an icon, so it is reachable
 * by keyboard and announces its state — and it is `tabIndex={-1}` deliberately:
 * tabbing from the password field should reach the next field, not a control
 * that changes how the current one looks.
 */
export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  required = false,
  minLength,
  placeholder,
  hint,
  error,
}) {
  const [shown, setShown] = useState(false);
  const generated = useId();
  const fieldId = id ?? generated;
  const hintId = hint || error ? `${fieldId}-hint` : undefined;

  return (
    <div className="form-field">
      {label && <label className="flabel" htmlFor={fieldId}>{label}</label>}
      <div className="pwfield">
        <input
          id={fieldId}
          // The type flips, which is what makes the value visible. The input is
          // the same element either way, so the caret position and any selection
          // survive the toggle.
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          aria-describedby={hintId}
          aria-invalid={error ? 'true' : undefined}
        />
        <button
          type="button"
          className="pwfield__toggle"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          tabIndex={-1}
          title={shown ? 'Hide password' : 'Show password'}
        >
          <Icon name={shown ? 'eyeOff' : 'eye'} size={15} />
        </button>
      </div>
      {error
        ? <p className="form-error" id={hintId}>{error}</p>
        : hint && <p className="field-hint" id={hintId}>{hint}</p>}
    </div>
  );
}

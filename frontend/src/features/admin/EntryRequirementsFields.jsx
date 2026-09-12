import { useState } from 'react';

/*
 * Structured editor for a course's entry requirements.
 *
 * These were a raw JSON textarea, which asked an admin to know the key names
 * and to hand-write valid JSON to correct an IELTS score. The shape is stable
 * enough to deserve real fields: sixteen keys account for every requirement in
 * the catalogue.
 *
 * It is still stored as JSON, because the shape is genuinely provider-specific
 * and the next feed will publish something these fields do not have. That is
 * what "Other fields" is for — any key the form does not know about is listed
 * there and can be edited, so importing a new provider never silently drops
 * data an admin cannot see. Nothing is hidden.
 */

// One text input each. Order follows how an admissions officer reads a course:
// what you studied, how well, then the English evidence, then the exceptions.
const TEXT_FIELDS = [
  ['summary',               'Academic requirement', 'e.g. 12th Grade', true],
  ['academicScore',         'Academic score',        'e.g. 60%'],
  ['passoutYearAccepted',   'Qualification age',     'e.g. No more than 3 years'],
  ['twelfthEnglishMarks',   '12th English marks',    'e.g. 70'],
  ['twelfthEducationBoard', '12th education board',  'e.g. CBSE, ISC'],
  ['twelfthMaths',          '12th maths',            'e.g. 60'],
  ['homeEditionToefl',      'Home Edition TOEFL',    'e.g. Accepted'],
  ['homeEditionPte',        'Home Edition PTE',      'e.g. Accepted'],
  ['moi',                   'MOI accepted',          'e.g. Yes / No'],
  ['scholarship',           'Scholarship',           'e.g. Up to 30%'],
  ['programTypeNotes',      'Programme notes',       'Anything else worth stating'],
];

// Each is { overall, notLessThan }. Values are kept as strings, not numbers:
// the feed publishes "6.5", "L 16, R 17, W 17, S 19" and "No" in the same
// field, and all three carry meaning.
const BAND_FIELDS = [
  ['ielts',    'IELTS'],
  ['pte',      'PTE'],
  ['toefl',    'TOEFL'],
  ['duolingo', 'Duolingo'],
];

const TEXT_KEYS = new Set(TEXT_FIELDS.map(([k]) => k));
const BAND_KEYS = new Set(BAND_FIELDS.map(([k]) => k));

/**
 * Can the purpose-built control for this key actually hold this value?
 *
 * A key being KNOWN was taken as proof its value had the expected shape, and a
 * feed that publishes `ielts: "6.5"` rather than `{ overall: "6.5" }` broke that
 * assumption quietly: the band inputs read `reqs.ielts?.overall`, which is
 * undefined for a string, so both boxes rendered blank and the value appeared
 * nowhere at all — while the header comment above promises nothing is hidden.
 * Typing into the blank box then spread the string, turning "6.5" into
 * { 0:"6", 1:".", 2:"5", overall:"7.0" }.
 *
 * So membership is not enough: the VALUE decides. Anything a control cannot
 * represent goes to "Other fields", which round-trips JSON safely.
 */
function isModelled(key, v) {
  // Absent is fine everywhere — that is just an empty control.
  if (v == null || v === '') return true;
  if (BAND_KEYS.has(key)) return typeof v === 'object' && !Array.isArray(v);
  if (key === 'acceptedEnglishTests') return Array.isArray(v);
  if (TEXT_KEYS.has(key)) return typeof v === 'string' || typeof v === 'number';
  return false;
}

/** Strip empty values so a blank form saves null rather than a husk of nulls. */
export function cleanRequirements(value) {
  const out = {};
  for (const [k, v] of Object.entries(value ?? {})) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) out[k] = v;
    } else if (typeof v === 'object') {
      const inner = Object.fromEntries(
        Object.entries(v).filter(([, iv]) => iv != null && iv !== '')
      );
      if (Object.keys(inner).length) out[k] = inner;
    } else {
      out[k] = v;
    }
  }
  return Object.keys(out).length ? out : null;
}

function Field({ label, children, hint }) {
  return (
    <div className="form-field">
      <label className="flabel">{label}</label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export default function EntryRequirementsFields({ value, onChange }) {
  const reqs = value ?? {};
  const [newKey, setNewKey] = useState('');

  const setKey = (key, v) => onChange({ ...reqs, [key]: v });
  // The existing value is spread only when it is genuinely an object. Spreading
  // a string yields its characters as numbered keys, so correcting a mis-shaped
  // band used to bury the original value inside the replacement.
  const setBand = (key, half, v) => {
    const current = reqs[key];
    const base = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    onChange({ ...reqs, [key]: { ...base, [half]: v } });
  };

  // A feed publishing a single test as a bare string rendered as no chips, so
  // adding one silently replaced it. Shown as the one chip it means.
  const tests = Array.isArray(reqs.acceptedEnglishTests)
    ? reqs.acceptedEnglishTests
    : typeof reqs.acceptedEnglishTests === 'string' && reqs.acceptedEnglishTests
      ? [reqs.acceptedEnglishTests]
      : [];
  const setTests = (list) => setKey('acceptedEnglishTests', list);

  const extras = Object.keys(reqs).filter((k) => !isModelled(k, reqs[k]));

  return (
    <div className="reqs-editor">
      <div className="admin-form-grid">
        {TEXT_FIELDS.map(([key, label, placeholder, wide]) => (
          <div key={key} className="form-field" style={wide ? { gridColumn: '1 / -1' } : undefined}>
            <label className="flabel" htmlFor={`req-${key}`}>{label}</label>
            <input
              id={`req-${key}`}
              type="text"
              value={reqs[key] ?? ''}
              onChange={(e) => setKey(key, e.target.value)}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>

      <div className="admin-section-label">English tests</div>
      <p className="field-hint" style={{ marginTop: -6, marginBottom: 8 }}>
        Leave blank if the test is not mentioned. Enter “No” where the provider
        states it is not accepted — that is different from saying nothing.
      </p>
      <div className="reqs-bands">
        {BAND_FIELDS.map(([key, label]) => (
          <div key={key} className="reqs-band">
            <span className="reqs-band-name">{label}</span>
            <input
              type="text"
              aria-label={`${label} overall`}
              value={reqs[key]?.overall ?? ''}
              onChange={(e) => setBand(key, 'overall', e.target.value)}
              placeholder="Overall"
            />
            <input
              type="text"
              aria-label={`${label} no band below`}
              value={reqs[key]?.notLessThan ?? ''}
              onChange={(e) => setBand(key, 'notLessThan', e.target.value)}
              placeholder="No band below"
            />
          </div>
        ))}
      </div>

      <Field label="Accepted English tests" hint="Press Enter to add each one.">
        <ChipList value={tests} onChange={setTests} placeholder="e.g. IELTS" />
      </Field>

      {/* Anything the form does not model. Keeps a new provider's fields visible
          and editable instead of dropping them on the first admin save. */}
      <div className="admin-section-label">Other fields</div>
      {extras.length === 0 && <p className="field-hint">None.</p>}
      {extras.map((key) => (
        <ExtraField
          key={key}
          name={key}
          value={reqs[key]}
          onChange={(v) => setKey(key, v)}
          onRemove={() => {
            const next = { ...reqs };
            delete next[key];
            onChange(next);
          }}
        />
      ))}

      <div className="reqs-extra">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Add another field, e.g. workExperience"
          aria-label="New field name"
        />
        <button
          type="button"
          className="btn btn-outline"
          disabled={!newKey.trim() || newKey.trim() in reqs}
          onClick={() => { setKey(newKey.trim(), ''); setNewKey(''); }}
        >
          Add field
        </button>
      </div>
    </div>
  );
}

/**
 * One "Other field" row.
 *
 * The input rendered `JSON.stringify(value)` for an object but wrote back
 * `e.target.value` raw, so a single keystroke anywhere in the box turned
 * { years: 2, notes: "…" } into the STRING '{"years":2,"notes":"…"}'. It looked
 * identical when reopened, nothing reported it, and any consumer reading
 * `.years` got undefined from then on. Arrays went the same way (typeof [] is
 * "object"), and a number became its own text.
 *
 * So a non-scalar is edited as JSON and parsed back on the way out. The draft
 * is local state, because a half-typed object is not valid JSON and must not be
 * propagated — the parent keeps the last good value until this one parses.
 */
function ExtraField({ name, value, onChange, onRemove }) {
  const isScalar = value == null || typeof value === 'string' || typeof value === 'number';
  const asText = isScalar ? String(value ?? '') : JSON.stringify(value);

  const [draft, setDraft] = useState(asText);
  const [seededFrom, setSeededFrom] = useState(asText);
  // Re-seed when the value changes underneath — a different course loaded into
  // the same form. Keyed on the rendered text, in render, not an effect.
  if (asText !== seededFrom) {
    setSeededFrom(asText);
    setDraft(asText);
  }

  const [invalid, setInvalid] = useState(false);

  const handle = (text) => {
    setDraft(text);
    if (isScalar) { setInvalid(false); onChange(text); return; }
    try {
      onChange(JSON.parse(text));
      setInvalid(false);
    } catch {
      // Held back rather than saved as text: the parent keeps the last value
      // that parsed, so a typo cannot flatten the object.
      setInvalid(true);
    }
  };

  return (
    <div className="reqs-extra">
      <span className="reqs-extra-key" title={name}>{name}</span>
      <input
        type="text"
        aria-label={name}
        value={draft}
        onChange={(e) => handle(e.target.value)}
        aria-invalid={invalid || undefined}
      />
      <button type="button" className="btn btn-ghost" onClick={onRemove}>Remove</button>
      {invalid && (
        <p className="field-hint reqs-extra-error">
          Not valid JSON — the last working value is kept until this parses.
        </p>
      )}
    </div>
  );
}

/* A local chip list so this component stands alone; mirrors the tags editor. */
function ChipList({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const chips = Array.isArray(value) ? value : [];

  const add = () => {
    const v = draft.trim();
    if (v && !chips.includes(v)) onChange([...chips, v]);
    setDraft('');
  };

  return (
    <div className="chip-editor">
      <div className="chip-row">
        {chips.map((c) => (
          <span key={c} className="tag-pill">
            {c}
            <button type="button" onClick={() => onChange(chips.filter((x) => x !== c))}
              aria-label={`Remove ${c}`}>×</button>
          </span>
        ))}
      </div>
      <div className="chip-add">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <button type="button" className="btn btn-outline" onClick={add} disabled={!draft.trim()}>Add</button>
      </div>
    </div>
  );
}

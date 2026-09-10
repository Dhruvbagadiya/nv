import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Modal from '../../components/ui/Modal.jsx';
import InstitutionPicker from '../../components/ui/InstitutionPicker.jsx';
import { parseCsvToObjects } from '../../utils/csv.js';
import { bulkImportCourses } from '../../api/courses.js';
import { PROGRAM_LEVELS } from '../../constants/referenceData.js';

/**
 * Paste a spreadsheet, get courses.
 *
 * POST /courses/bulk-import has accepted 1,000 rows at a time since it was
 * written, with no way to reach it short of curl. Adding a university's
 * prospectus meant opening the single-course form once per programme.
 *
 * One institution per import rather than an institutionId column: the endpoint
 * wants a uuid, and asking someone to paste 200 uuids into a spreadsheet is not
 * a feature. It also matches how this is actually done — one university's course
 * list at a time.
 */
const LEVELS = new Set(PROGRAM_LEVELS.map((l) => (typeof l === 'string' ? l : l.value)));

// Real enum values, not friendly ones: the example is what people copy, and a
// made-up level here would teach the wrong code to everyone who used it.
const TEMPLATE =
  'title,programLevel,tuitionFee,currencyCode,minLength,maxLength,applicationFee\n' +
  '"MSc Data Science",MASTERS_DEGREE,15000,GBP,12,12,50\n' +
  '"BA (Hons) Business, Finance and Economics",BACHELORS_DEGREE,13500,GBP,36,48,\n';

/** One CSV row -> one API row, with the reason it cannot be imported if it cannot. */
function toRow(raw, index) {
  const errors = [];

  const title = raw.title ?? '';
  if (!title) errors.push('title is required');

  const tuitionFee = Number(raw.tuitionfee);
  if (raw.tuitionfee === '' || raw.tuitionfee == null) errors.push('tuitionFee is required');
  else if (!Number.isFinite(tuitionFee) || tuitionFee < 0) errors.push('tuitionFee must be a number');

  // Defaults to OTHER server-side, but a silent OTHER on a typo means 200
  // courses land unfilterable, so a wrong value is reported rather than coerced.
  const programLevel = (raw.programlevel || 'OTHER').toUpperCase();
  if (!LEVELS.has(programLevel)) errors.push(`programLevel "${raw.programlevel}" is not a known level`);

  const currencyCode = (raw.currencycode || '').toUpperCase();
  if (currencyCode && currencyCode.length !== 3) errors.push('currencyCode must be 3 letters');

  const num = (v) => (v === '' || v == null ? undefined : Number(v));
  const applicationFee = num(raw.applicationfee);
  if (applicationFee != null && !Number.isFinite(applicationFee)) errors.push('applicationFee must be a number');

  return {
    line: index + 2, // +1 for the header, +1 because humans count from one
    errors,
    payload: {
      title,
      programLevel,
      tuitionFee: Number.isFinite(tuitionFee) ? tuitionFee : 0,
      minLength: num(raw.minlength) ?? 0,
      maxLength: num(raw.maxlength) ?? 0,
      languageOfInstruction: raw.languageofinstruction || 'eng',
      ...(raw.shortname ? { shortName: raw.shortname } : {}),
      ...(currencyCode ? { currencyCode } : {}),
      ...(applicationFee != null && Number.isFinite(applicationFee) ? { applicationFee } : {}),
      ...(raw.externalurl ? { externalUrl: raw.externalurl } : {}),
      ...(raw.commissionamount ? { commissionAmount: Number(raw.commissionamount) } : {}),
      ...(raw.tags ? { tags: raw.tags.split('|').map((t) => t.trim()).filter(Boolean) } : {}),
      ...(raw.badges ? { badges: raw.badges.split('|').map((t) => t.trim()).filter(Boolean) } : {}),
    },
  };
}

export default function BulkImportDialog({ onClose, onImported }) {
  const [institutionId, setInstitutionId] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [text, setText] = useState('');
  const fileRef = useRef(null);

  const parsed = useMemo(() => {
    if (!text.trim()) return { rows: [], headers: [] };
    const { rows, headers } = parseCsvToObjects(text);
    return { headers, rows: rows.map(toRow) };
  }, [text]);

  const valid = parsed.rows.filter((r) => !r.errors.length);
  const invalid = parsed.rows.filter((r) => r.errors.length);

  const importMutation = useMutation({
    mutationFn: () =>
      bulkImportCourses(valid.map((r) => ({ ...r.payload, institutionId }))),
    onSuccess: (result) => onImported(result?.imported ?? valid.length),
  });

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    file.text().then(setText);
  };

  const error = importMutation.error
    ? (importMutation.error.response?.data?.error ?? 'Import failed. Nothing was saved.')
    : null;

  return (
    <Modal title="Import courses from a spreadsheet" onClose={onClose} wide>
      <div className="form-field">
        <InstitutionPicker
          id="bulk-institution"
          label="Institution"
          value={institutionId}
          selectedLabel={institutionName}
          onChange={(id, option) => { setInstitutionId(id); setInstitutionName(option?.label ?? ''); }}
          required
          hint="Every course in this file is added to this institution."
        />
      </div>

      <div className="form-field">
        <label className="flabel" htmlFor="bulk-csv">Course rows (CSV)</label>
        <div className="file-field__row" style={{ marginBottom: 6 }}>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={pickFile} className="file-field__input" id="bulk-file" />
          <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()}>
            Choose a .csv file
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setText(TEMPLATE)}>
            Paste an example
          </button>
        </div>
        <textarea
          id="bulk-csv"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="title,programLevel,tuitionFee,currencyCode…"
        />
        <p className="field-hint">
          First row is the header. <strong>title</strong> and <strong>tuitionFee</strong> are
          required; everything else is optional. Column names ignore case and spacing. Separate
          tags and badges with a <strong>|</strong>. Up to 1,000 rows per import.
        </p>
        {/* Guessing a level is the easiest way to get a whole file rejected, so
            the accepted codes are on the screen rather than in a wiki. */}
        <details className="field-hint">
          <summary style={{ cursor: 'pointer' }}>Accepted programLevel values</summary>
          <code style={{ display: 'block', marginTop: 4, lineHeight: 1.7 }}>
            {PROGRAM_LEVELS.map((l) => l.value).join(', ')}
          </code>
        </details>
      </div>

      {parsed.rows.length > 0 && (
        <div className="form-field">
          <div className="admin-section-label">
            {valid.length} ready{invalid.length > 0 && `, ${invalid.length} to fix`}
          </div>

          {/* Problems first: they are the reason someone is looking. */}
          {invalid.length > 0 && (
            <ul className="bulk-errors">
              {invalid.slice(0, 8).map((r) => (
                <li key={r.line}>
                  <strong>Line {r.line}:</strong> {r.errors.join('; ')}
                </li>
              ))}
              {invalid.length > 8 && <li>…and {invalid.length - 8} more</li>}
            </ul>
          )}

          <div className="picker-list" style={{ maxHeight: 190 }}>
            {valid.slice(0, 25).map((r) => (
              <div className="picker-row" key={r.line} style={{ cursor: 'default' }}>
                <span className="picker-main">
                  <span>{r.payload.title}</span>
                  <span className="picker-sub">
                    {r.payload.programLevel} · {r.payload.currencyCode ?? ''} {r.payload.tuitionFee}
                  </span>
                </span>
              </div>
            ))}
            {valid.length > 25 && (
              <div className="picker-empty">…and {valid.length - 25} more</div>
            )}
          </div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="submit-row">
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!institutionId || !valid.length || importMutation.isPending}
          onClick={() => importMutation.mutate()}
        >
          {importMutation.isPending
            ? 'Importing…'
            : `Import ${valid.length} course${valid.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </Modal>
  );
}

import { useState, useEffect } from 'react';
import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import Modal from '../../components/ui/Modal.jsx';
import EntryRequirementsFields, { cleanRequirements } from './EntryRequirementsFields.jsx';
import { MONTH_NAMES, MONTH_FULL, nextIntakes, formatIntake } from '../../utils/intakes.js';
import Icon from '../../components/ui/Icon.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { useInvalidateResource } from '../../hooks/useInvalidateResource.js';
import { useCountries, useInstitutions } from '../../hooks/useReferenceData.js';
import { fetchCourses, createCourse, updateCourse, archiveCourse, restoreCourse } from '../../api/courses.js';
import { formatFee } from '../../utils/format.js';
import { PROGRAM_LEVELS } from '../../constants/referenceData.js';
import SourceBadge, { ImportNotice } from '../../components/ui/SourceBadge.jsx';
import BulkImportDialog from './BulkImportDialog.jsx';
import { toast } from '../../store/useToast.js';

const LEVEL_LABEL = Object.fromEntries(PROGRAM_LEVELS.map((l) => [l.value, l.label]));

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Intake row editor ─────────────────────────────────────────────────────────
/*
 * Which months the course runs in, every year.
 *
 * This is the answer for a rolling intake: pick February and September once and
 * it stays true, instead of adding dated rows that have to be replaced every
 * year and silently advertise a passed intake the moment nobody does.
 *
 * The dated editor below is still there for the cases that need it — an intake
 * with a real application deadline, which a month alone cannot express.
 */
function IntakeMonthPicker({ months, onChange }) {
  const selected = Array.isArray(months) ? months : [];
  const toggle = (m) =>
    onChange(selected.includes(m) ? selected.filter((x) => x !== m) : [...selected, m].sort((a, b) => a - b));

  const upcoming = nextIntakes(selected, 3);

  return (
    <div className="month-picker">
      <div className="month-grid" role="group" aria-label="Intake months">
        {MONTH_NAMES.map((name, i) => {
          const m = i + 1;
          const on = selected.includes(m);
          return (
            <button
              key={m}
              type="button"
              className={`month-cell${on ? ' on' : ''}`}
              aria-pressed={on}
              aria-label={MONTH_FULL[i]}
              onClick={() => toggle(m)}
            >
              {name}
            </button>
          );
        })}
      </div>
      {/* Shown because the year is derived, not stored: this is what a student
          will actually be told, and it is worth seeing before saving. */}
      <p className="field-hint">
        {upcoming.length
          ? 'Runs every ' + selected.map((m) => MONTH_FULL[m - 1]).join(', ') +
            '. Next: ' + upcoming.map(formatIntake).join(' · ')
          : 'No months selected — this course will not appear under any intake filter.'}
      </p>
    </div>
  );
}

function IntakeEditor({ intakes, onChange }) {
  const add = () => onChange([...intakes, { startDate: '', openDate: '', submissionDeadline: '' }]);
  const remove = (i) => onChange(intakes.filter((_, idx) => idx !== i));
  const update = (i, key, val) =>
    onChange(intakes.map((intake, idx) => (idx === i ? { ...intake, [key]: val } : intake)));

  return (
    <div>
      {intakes.map((intake, i) => (
        <div key={i} className="intake-editor-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label className="flabel">Start date *</label>
            <input type="date" value={intake.startDate}
              onChange={(e) => update(i, 'startDate', e.target.value)} required />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label className="flabel">Open date</label>
            <input type="date" value={intake.openDate}
              onChange={(e) => update(i, 'openDate', e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label className="flabel">Submission deadline</label>
            <input type="date" value={intake.submissionDeadline}
              onChange={(e) => update(i, 'submissionDeadline', e.target.value)} />
          </div>
          <button type="button" className="btn btn-ghost"
            onClick={() => remove(i)} aria-label="Remove intake"
            style={{ alignSelf: 'flex-end', marginBottom: 12 }}><Icon name="close" size={14} /></button>
        </div>
      ))}
      <button type="button" className="btn btn-outline" onClick={add}>+ Add intake</button>
    </div>
  );
}

// ── Tag / badge chip editor ───────────────────────────────────────────────────
function ChipEditor({ value, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const chips = Array.isArray(value) ? value : [];

  const add = () => {
    const v = input.trim();
    if (v && !chips.includes(v)) onChange([...chips, v]);
    setInput('');
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {chips.map((c) => (
          <span key={c} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'var(--accent-50)', border: '1px solid var(--accent-100)',
            borderRadius: 'var(--radius-pill)', padding: '2px 8px', fontSize: 11, fontWeight: 600, color: 'var(--accent-700)',
          }}>
            {c}
            <button type="button" onClick={() => onChange(chips.filter((x) => x !== c))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-700)', padding: 0, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="text" value={input} placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          style={{ flex: 1, height: 31, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 9px', fontSize: 12.5, fontFamily: 'var(--font-sans)', background: 'var(--canvas)' }} />
        <button type="button" className="btn btn-outline" onClick={add}>Add</button>
      </div>
    </div>
  );
}

// ── Course modal form ─────────────────────────────────────────────────────────
function CourseModal({ initial, onClose, onSaved, institutions }) {
  const isEdit = Boolean(initial?.id);
  // When editing, attributes live inside initial.attributes
  const attr = initial?.attributes ?? {};

  const [form, setForm] = useState({
    institutionId:         attr.school ? '' : '',  // resolved below
    title:                 attr.name              ?? '',
    shortName:             attr.shortName         ?? '',
    slug:                  attr.slug              ?? '',
    programLevel:          attr.programLevel?.toUpperCase() ?? 'MASTERS_DEGREE',
    minLength:             attr.minLength         ?? '',
    maxLength:             attr.maxLength         ?? '',
    languageOfInstruction: attr.languageOfInstructionCode ?? 'eng',
    tuitionFee:            attr.tuition           ?? '',
    // '' means "not published" and is sent as null. 0 is a real answer -- the
    // course is free to apply to -- so the two must stay distinguishable here,
    // not collapsed the way Number('') === 0 would.
    applicationFee:        attr.applicationFee ?? '',
    // The raw override, not attr.currency (which falls back to the country).
    // Seeding from the resolved value wrote the inherited currency back as an
    // explicit override, so the course silently stopped following its country.
    currencyCode:          attr.currencyCode      ?? '',
    externalUrl:           attr.externalUrl       ?? '',
    // Held as an object now. It used to be a JSON string an admin had to type
    // by hand, which meant knowing the key names and getting the punctuation
    // right to correct an IELTS score.
    entryRequirements:     attr.entryRequirements ?? {},
    commissionAmount:      attr.commissionAmount  ?? '',
    abAppCreationEnabled:  attr.abAppCreationEnabled ?? false,
    intakeMonths:          attr.intakeMonths      ?? [],
    tags:                  attr.tags              ?? [],
    badges:                attr.badges            ?? [],
    // overallScore and scoreDetails have no input here, but they are carried so
    // a save preserves them. Mapping only the three dates discarded the score an
    // admissions decision rests on, on every save.
    intakes:               (attr.programIntakes ?? []).map((i) => ({
      startDate:          i.startDate          ?? '',
      openDate:           i.openDate           ?? '',
      submissionDeadline: i.submissionDeadline ?? '',
      overallScore:       i.overallScore       ?? null,
      scoreDetails:       i.scoreDetails       ?? [],
    })),
  });

  // For edit, find the institution by slug or name match.
  // useState initializer runs once — if institutions loads after the modal opens,
  // the match will be empty. useEffect re-runs when institutions arrives.
  const [instId, setInstId] = useState(() => {
    if (!isEdit) return '';
    const match = institutions.find(
      (i) => i.slug === attr.school?.slug || i.name === attr.school?.name
    );
    return match?.id ?? '';
  });

  // Re-run the match when the institutions list finishes loading.
  useEffect(() => {
    if (!isEdit || instId) return;
    const match = institutions.find(
      (i) => i.slug === attr.school?.slug || i.name === attr.school?.name
    );
    if (match) setInstId(match.id);
  }, [institutions, isEdit, instId, attr.school?.slug, attr.school?.name]);

  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (k === 'title' && !isEdit && f.slug === slugify(f.title)) next.slug = slugify(v);
    return next;
  });

  const save = useMutation({
    mutationFn: (payload) => isEdit ? updateCourse(initial.id, payload) : createCourse(payload),
    onSuccess: onSaved,
    onError: (e) => setError(e.response?.data?.error ?? 'Could not save course.'),
  });

  const submit = (e) => {
    e.preventDefault();
    setError(null);

    // Empty values are stripped, so a form nobody filled in saves null rather
    // than an object full of blanks.
    const parsedRequirements = cleanRequirements(form.entryRequirements);

    save.mutate({
      institutionId:         instId,
      title:                 form.title,
      shortName:             form.shortName    || null,
      slug:                  form.slug         || slugify(form.title) + '-' + Date.now(),
      programLevel:          form.programLevel,
      minLength:             Number(form.minLength)  || 0,
      maxLength:             Number(form.maxLength)  || 0,
      languageOfInstruction: form.languageOfInstruction || 'eng',
      tuitionFee:            Number(form.tuitionFee),
      // Empty means unknown, which the column now stores as NULL. Number('')
      // is 0, which would publish "free to apply" over a fee nobody stated.
      applicationFee:        form.applicationFee === '' ? null : Number(form.applicationFee),
      currencyCode:          form.currencyCode.trim() || null,
      externalUrl:           form.externalUrl.trim()  || null,
      entryRequirements:     parsedRequirements,
      commissionAmount:      form.commissionAmount !== '' ? Number(form.commissionAmount) : null,
      abAppCreationEnabled:  form.abAppCreationEnabled,
      intakeMonths:          form.intakeMonths,
      tags:                  form.tags,
      badges:                form.badges,
      intakes:               form.intakes
        .filter((i) => i.startDate)
        .map((i) => ({
          startDate:          new Date(i.startDate),
          openDate:           i.openDate           ? new Date(i.openDate)           : null,
          submissionDeadline: i.submissionDeadline ? new Date(i.submissionDeadline) : null,
          overallScore:       i.overallScore ?? null,
          scoreDetails:       Array.isArray(i.scoreDetails) ? i.scoreDetails : [],
        })),
    });
  };

  return (
    <Modal title={isEdit ? 'Edit course' : 'Add course'} onClose={onClose} wide>
      <form onSubmit={submit}>
        {/* An edit to a scraped course survives only until the next import of
            that feed, which rewrites the fields it owns by (source, externalId).
            Saying so here is the difference between an admin making an informed
            change and one wondering why their correction vanished overnight. */}
        {isEdit && <ImportNotice source={attr.source} externalId={attr.externalId} />}

        {/* Section: Basic info */}
        <div className="admin-section-label">Basic information</div>
        <div className="admin-form-grid">
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="flabel" htmlFor="c-inst">Institution *</label>
            <select id="c-inst" value={instId} onChange={(e) => setInstId(e.target.value)} required>
              <option value="">Select institution</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="flabel" htmlFor="c-title">Course title *</label>
            <input id="c-title" type="text" value={form.title}
              onChange={(e) => set('title', e.target.value)} required
              placeholder="e.g. Master of Science - Data Analytics" />
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="c-short">Short name</label>
            <input id="c-short" type="text" value={form.shortName}
              onChange={(e) => set('shortName', e.target.value)}
              placeholder="e.g. Data Analytics" />
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="c-slug">Slug *</label>
            <input id="c-slug" type="text" value={form.slug}
              onChange={(e) => set('slug', e.target.value)}
              placeholder="auto-derived from title" />
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="c-level">Program level *</label>
            <select id="c-level" value={form.programLevel}
              onChange={(e) => set('programLevel', e.target.value)} required>
              {PROGRAM_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="c-lang">Language</label>
            <input id="c-lang" type="text" value={form.languageOfInstruction}
              onChange={(e) => set('languageOfInstruction', e.target.value)}
              placeholder="eng" maxLength={10} />
          </div>
        </div>

        {/* Section: Duration & fees */}
        <div className="admin-section-label">Duration &amp; fees</div>
        <div className="admin-form-grid">
          <div className="form-field">
            <label className="flabel" htmlFor="c-min">Min length (months) *</label>
            <input id="c-min" type="number" min={0} value={form.minLength}
              onChange={(e) => set('minLength', e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="c-max">Max length (months) *</label>
            <input id="c-max" type="number" min={0} value={form.maxLength}
              onChange={(e) => set('maxLength', e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="c-tuition">Tuition fee *</label>
            <input id="c-tuition" type="number" min={0} value={form.tuitionFee}
              onChange={(e) => set('tuitionFee', e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="c-appfee">Application fee</label>
            {/* Not required, and deliberately so: most scraped courses do not
                publish one. Blank is stored as "unknown"; 0 means free. */}
            <input id="c-appfee" type="number" min={0} value={form.applicationFee}
              onChange={(e) => set('applicationFee', e.target.value)}
              placeholder="leave blank if not published" />
            <p className="field-hint">Blank shows as “Unknown”. Enter 0 only if applying is genuinely free.</p>
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="c-currency">Currency</label>
            <input id="c-currency" type="text" value={form.currencyCode}
              onChange={(e) => set('currencyCode', e.target.value.toUpperCase())}
              placeholder="GBP" maxLength={3} />
            <p className="field-hint">ISO 4217. Blank uses the country’s currency.</p>
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="c-commission">Commission amount</label>
            <input id="c-commission" type="number" min={0} value={form.commissionAmount}
              onChange={(e) => set('commissionAmount', e.target.value)}
              placeholder="Optional" />
          </div>
          {/* Was labelled "AB app creation enabled" — the upstream vendor's
              initials, which meant nothing to anyone reading this form. The
              column keeps its name; the label says what the flag does. */}
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.abAppCreationEnabled}
                onChange={(e) => set('abAppCreationEnabled', e.target.checked)} />
              <span>Agents can apply through the portal</span>
            </label>
            <div className="field-hint">
              Off means the student must apply on the university&apos;s own site. Agents see this
              on the course card before they start an application.
            </div>
          </div>
        </div>

        {/* Section: Provider data — populated by the scrapers, editable here.
            These are the fields the course card's eye icon shows. */}
        <div className="admin-section-label">Provider details</div>
        <div className="admin-form-grid">
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="flabel" htmlFor="c-exturl">Course page URL</label>
            <input id="c-exturl" type="url" value={form.externalUrl}
              onChange={(e) => set('externalUrl', e.target.value)}
              placeholder="https://university.example/courses/msc-computing" />
            <p className="field-hint">The university’s own page. Shown as a link in the course detail view.</p>
          </div>
        </div>

        <div className="admin-section-label">Entry requirements</div>
        <EntryRequirementsFields
          value={form.entryRequirements}
          onChange={(v) => set('entryRequirements', v)}
        />

        {/* Section: Tags & badges */}
        <div className="admin-section-label">Tags &amp; badges</div>
        <div className="form-field">
          <label className="flabel">Tags <span className="field-hint" style={{ display: 'inline' }}>(machine slugs e.g. top_programs)</span></label>
          <ChipEditor value={form.tags} onChange={(v) => set('tags', v)} placeholder="e.g. top_programs" />
        </div>
        <div className="form-field">
          <label className="flabel">Badges <span className="field-hint" style={{ display: 'inline' }}>(display labels e.g. Instant Offer)</span></label>
          <ChipEditor value={form.badges} onChange={(v) => set('badges', v)} placeholder="e.g. Instant Offer" />
        </div>

        {/* Section: Intakes */}
        <div className="admin-section-label">Intakes</div>
        <div className="form-field">
          <label className="flabel">Runs in these months, every year</label>
          <IntakeMonthPicker months={form.intakeMonths} onChange={(v) => set('intakeMonths', v)} />
        </div>

        <div className="form-field">
          <label className="flabel">
            Specific dated intakes
            <span className="field-hint" style={{ display: 'inline' }}> (optional)</span>
          </label>
          <p className="field-hint" style={{ marginTop: 0 }}>
            Only needed where a provider publishes a real start date or application
            deadline. For a course that simply runs every February and September, the
            months above are enough and never need updating.
          </p>
        </div>
        <IntakeEditor intakes={form.intakes} onChange={(v) => set('intakes', v)} />

        {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

        <div className="submit-row" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : (isEdit ? 'Save changes' : 'Add course')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const FILTER_DEFAULTS = { country: '', institutionId: '', programLevel: '', search: '', status: '', page: 1 };

export default function AdminCourses() {
  const [editing, setEditing] = useState(null);
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);
  const { options: countryOptions } = useCountries();
  const { institutions, options: instOptions } = useInstitutions(
    applied.country ? { country: applied.country } : {}
  );

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['admin-courses', applied],
    queryFn: () => fetchCourses(applied),
    placeholderData: keepPreviousData,
  });

  const invalidate = useInvalidateResource('courses');
  const [importing, setImporting] = useState(false);

  const archiveMutation = useMutation({ mutationFn: archiveCourse, onSuccess: invalidate });
  const restoreMutation = useMutation({ mutationFn: restoreCourse, onSuccess: invalidate });

  const programs = data?.data ?? [];
  const meta = data?.meta;

  const filterFields = [
    { name: 'country',      label: 'Country',       type: 'select', placeholder: 'All countries',      options: countryOptions },
    { name: 'institutionId',label: 'Institution',    type: 'select', placeholder: 'All institutions',   options: instOptions },
    { name: 'programLevel', label: 'Level',          type: 'select', placeholder: 'All levels',
      options: PROGRAM_LEVELS },
    { name: 'search',       label: 'Search',         type: 'text',   placeholder: 'Title or institution' },
    // Archiving is a soft delete with a restore endpoint, so an admin has to be
    // able to list what was archived; without this the Restore button could
    // never be reached.
    { name: 'status',       label: 'Status',         type: 'select', placeholder: 'Active',
      options: [
        { value: 'active',   label: 'Active' },
        { value: 'archived', label: 'Archived' },
        { value: 'all',      label: 'All' },
      ] },
  ];

  const columns = [
    {
      key: 'title',
      header: 'Course',
      render: (p) => (
        <div>
          <div className="cell-strong">{p.attributes.name}</div>
          {p.attributes.shortName && (
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{p.attributes.shortName}</div>
          )}
        </div>
      ),
    },
    {
      key: 'school',
      header: 'Institution',
      render: (p) => (
        <div>
          <div>{p.attributes.school.name}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>
            {p.attributes.school.city ? `${p.attributes.school.city} · ` : ''}
            {p.attributes.school.countryCode}
          </div>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Level',
      render: (p) => {
        const lv = p.attributes.programLevel?.toUpperCase();
        return <span style={{ fontSize: 11 }}>{LEVEL_LABEL[lv] ?? lv}</span>;
      },
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (p) => {
        const { minLength: mn, maxLength: mx } = p.attributes;
        if (!mn && !mx) return '—';
        return mn === mx ? `${mn}m` : `${mn}–${mx}m`;
      },
    },
    {
      key: 'tuition',
      header: 'Tuition',
      render: (p) => formatFee(p.attributes.tuition, p.attributes.currency),
    },
    {
      key: 'appFee',
      header: 'App. fee',
      // Blank is not free. Most scraped courses publish no figure, and printing
      // those as a dash or a zero would read as "free to apply".
      render: (p) =>
        p.attributes.applicationFee == null ? (
          <span className="cell-muted">Unknown</span>
        ) : p.attributes.applicationFee > 0 ? (
          formatFee(p.attributes.applicationFee, p.attributes.currency)
        ) : (
          'None'
        ),
    },
    {
      key: 'source',
      header: 'Source',
      // Scraped rows are rewritten by the next import, so an edit here is not
      // permanent. Saying so in the table is cheaper than an admin discovering
      // it when their change disappears.
      render: (p) => (
        <SourceBadge source={p.attributes.source} externalId={p.attributes.externalId} />
      ),
    },
    {
      key: 'intakes',
      header: 'Intakes',
      render: (p) => <span className="cell-mono">{p.attributes.programIntakes?.length ?? 0}</span>,
    },
    {
      key: '__actions',
      header: 'Actions',
      render: (p) => (
        <div className="action-row">
          <button className="btn btn-outline" onClick={() => setEditing(p)}>Edit</button>
          {p.attributes.archivedAt ? (
            <button className="btn btn-ghost" onClick={() => restoreMutation.mutate(p.id)}
              disabled={restoreMutation.isPending}>Restore</button>
          ) : (
            <button className="btn btn-ghost"
              onClick={() => window.confirm(`Archive "${p.attributes.name}"?`) && archiveMutation.mutate(p.id)}
              disabled={archiveMutation.isPending}>Archive</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page
      title="Courses"
      subtitle="Manage the program catalogue agents search from the Dashboard"
      actions={
        <>
          <button className="btn btn-outline" onClick={() => setImporting(true)}>Import CSV</button>
          <button className="btn btn-primary" onClick={() => setEditing({})}>Add course</button>
        </>
      }
    >
      <FilterBar fields={filterFields} values={draft} onChange={setField}
        onApply={apply} onClear={clear} busy={isFetching} />

      <DataTable
        columns={columns}
        rows={programs}
        isLoading={isLoading}
        isError={isError}
        emptyMessage="No courses match these filters."
        meta={meta ? { ...meta, total: meta.counts?.total } : null}
        onPageChange={setPage}
        getRowKey={(r) => r.id}
      />

      {importing && (
        <BulkImportDialog
          onClose={() => setImporting(false)}
          onImported={(n) => {
            setImporting(false);
            invalidate();
            toast.success(`${n} course${n === 1 ? '' : 's'} imported.`);
          }}
        />
      )}

      {editing !== null && (
        <CourseModal
          initial={editing.id ? editing : null}
          institutions={institutions}
          onClose={() => setEditing(null)}
          onSaved={() => { invalidate(); setEditing(null); }}
        />
      )}
    </Page>
  );
}

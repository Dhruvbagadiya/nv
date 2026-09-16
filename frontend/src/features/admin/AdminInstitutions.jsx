import { useState } from 'react';
import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query';
import Flag from '../../components/ui/Flag.jsx';
import Page from '../../components/ui/Page.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import Modal from '../../components/ui/Modal.jsx';
import InstitutionPhotos from './InstitutionPhotos.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { toast } from '../../store/useToast.js';
import { errorMessage } from '../../utils/format.js';
import { useInvalidateResource } from '../../hooks/useInvalidateResource.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import FileField from '../../components/ui/FileField.jsx';
import SourceBadge, { ImportNotice } from '../../components/ui/SourceBadge.jsx';
import { IMAGE_FORMATS } from '../../constants/imageTypes.js';
import { useInstitutionSetup } from './InstitutionSetupSections.jsx';
import {
  fetchInstitutionsPage,
  createInstitution,
  updateInstitution,
  setBlacklist,
  archiveInstitution,
  restoreInstitution,
} from '../../api/institutions.js';

const FILTER_DEFAULTS = { country: '', search: '', blacklisted: '', includeArchived: '', page: 1 };

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}


function InstitutionModal({ initial, onClose, onSaved, countries }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState({
    name:          initial?.name          ?? '',
    slug:          initial?.slug          ?? '',
    countryId:     initial?.countryId     ?? '',
    city:          initial?.city          ?? '',
    province:      initial?.province      ?? '',
    logoUrl:       initial?.logoUrl       ?? '',
    bannerUrl:     initial?.bannerUrl     ?? '',
    isTrending:    initial?.isTrending    ?? false,
    isBlacklisted: initial?.isBlacklisted ?? false,
  });
  const [error, setError] = useState(null);
  // Only on create. The three have their own screens for revising later; this is
  // for the one moment when the admin has the partnership agreement in front of
  // them, and on edit the sections would compete with the row that already
  // exists rather than replacing it.
  const setup = useInstitutionSetup();

  const set = (k, v) => setForm((f) => {
    const next = { ...f, [k]: v };
    // Auto-derive slug from name when creating and slug hasn't been manually touched
    if (k === 'name' && !isEdit && f.slug === slugify(f.name)) {
      next.slug = slugify(v);
    }
    return next;
  });

  const save = useMutation({
    mutationFn: (payload) =>
      isEdit ? updateInstitution(initial.id, payload) : createInstitution(payload),
    onSuccess: onSaved,
    onError: (e) => setError(e.response?.data?.error ?? 'Could not save institution.'),
  });

  const submit = (e) => {
    e.preventDefault();
    setError(null);

    // Named before the request, because the server's message for a nested block
    // would say "commission.tiers" and leave the admin looking for a field
    // called that.
    const problem = isEdit ? null : setup.problem();
    if (problem) {
      setError(problem);
      return;
    }

    save.mutate({
      ...(isEdit ? {} : setup.payload()),
      name:          form.name,
      slug:          form.slug || slugify(form.name),
      countryId:     form.countryId,
      city:          form.city     || null,
      province:      form.province || null,
      logoUrl:       form.logoUrl   || null,
      bannerUrl:     form.bannerUrl || null,
      isTrending:    form.isTrending,
      isBlacklisted: form.isBlacklisted,
    });
  };

  return (
    <Modal title={isEdit ? 'Edit institution' : 'Add institution'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <ImportNotice source={initial?.source} externalId={initial?.externalId} />
        <div className="admin-form-grid">
          <div className="form-field">
            <label className="flabel" htmlFor="inst-name">Institution name *</label>
            <input id="inst-name" type="text" value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. University of Hertfordshire" required />
            <div className="field-hint">
              The name agents search by. Include the campus if you keep campuses as separate
              rows — &ldquo;University of Law - Leeds&rdquo; rather than two rows both called
              &ldquo;University of Law&rdquo;.
            </div>
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="inst-slug">Slug *</label>
            <input id="inst-slug" type="text" value={form.slug}
              onChange={(e) => set('slug', e.target.value)}
              placeholder="auto-derived from name" required />
            <div className="field-hint">
              The address of this school&apos;s page. Auto-filled from the name; changing it later
              breaks any link already shared.
            </div>
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="inst-country">Country *</label>
            <select id="inst-country" value={form.countryId}
              onChange={(e) => set('countryId', e.target.value)} required>
              <option value="">Select country</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {/* No emoji in an <option>: it cannot hold an image, and on
                      Windows the emoji degrades to stray letters. */}
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="inst-city">City</label>
            <input id="inst-city" type="text" value={form.city}
              onChange={(e) => set('city', e.target.value)} placeholder="e.g. London" />
            <div className="field-hint">
              Shown under the institution name on every course card, and courses inherit it.
            </div>
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="inst-province">Province / State</label>
            <input id="inst-province" type="text" value={form.province}
              onChange={(e) => set('province', e.target.value)} placeholder="e.g. England" />
            <div className="field-hint">Optional. Shown beside the city on the school page.</div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FileField
              id="inst-logo"
              label="Logo"
              kind="image"
              category="institution-logos"
              value={form.logoUrl}
              onChange={(url) => set('logoUrl', url)}
              hint={`Square works best. ${IMAGE_FORMATS}, up to 5 MB.`}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FileField
              id="inst-banner"
              label="Banner"
              kind="image"
              category="institution-banners"
              value={form.bannerUrl}
              onChange={(url) => set('bannerUrl', url)}
              previewHeight={90}
              hint="Wide header image for the school page. One import supplies these; the other publishes none, so most rows have no banner until you add one."
            />
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isTrending}
                onChange={(e) => set('isTrending', e.target.checked)} />
              <span>Show in Trending Universities carousel</span>
            </label>
            <div className="field-hint">
              Puts this school in the carousel on the Report screen. Meant for a handful at a
              time — everything ticked is the same as nothing ticked.
            </div>
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isBlacklisted}
                onChange={(e) => set('isBlacklisted', e.target.checked)} />
              <span>Blacklisted (hidden from agents)</span>
            </label>
            <div className="field-hint">
              Hides the school and its courses from agents without deleting anything. Use this
              for a university you have stopped accepting applications for.
            </div>
          </div>
        </div>

        {/* Created in the SAME transaction as the institution, so none of this
            can land while the institution fails or the reverse. */}
        {!isEdit && (
          <div className="setup-sections">
            <div className="admin-section-label">Set up now, or leave for later</div>
            {setup.sections}
          </div>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="submit-row" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : (isEdit ? 'Save changes' : 'Add institution')}
          </button>
        </div>
      </form>

      {/* Outside the form on purpose: photos save immediately through their own
          endpoints, so nesting them would put controls that act at once beside a
          Save button that implies nothing has been applied yet. Only on edit --
          there is no institution to attach a photo to until one exists. */}
      {isEdit && (
        <InstitutionPhotos institutionId={initial.id} institutionName={initial.name} />
      )}
    </Modal>
  );
}

export default function AdminInstitutions() {
  const [editing, setEditing] = useState(null);
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);
  const { countries, isError: countriesFailed } = useCountries();

  const countryOptions = countries.map((c) => ({ value: c.code, label: c.name }));

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['admin-institutions', applied],
    queryFn: () => fetchInstitutionsPage({
      country:         applied.country         || undefined,
      search:          applied.search          || undefined,
      blacklisted:     applied.blacklisted     || undefined,
      includeArchived: applied.includeArchived || undefined,
      page:            applied.page,
    }),
    placeholderData: keepPreviousData,
  });

  const institutions = data?.items ?? [];

  const invalidate = useInvalidateResource('institutions');

  // None of the three reported a failure, so a refusal was invisible: the row
  // kept its old state and looked like it had simply been left alone.
  const blacklistMutation = useMutation({
    mutationFn: ({ id, isBlacklisted }) => setBlacklist(id, isBlacklisted),
    onSuccess: (_data, { isBlacklisted }) => {
      invalidate();
      toast.success(isBlacklisted ? 'Institution blacklisted.' : 'Institution removed from the blacklist.');
    },
    onError: (e) => toast.error(errorMessage(e, 'Could not change that institution.')),
  });

  const archiveMutation = useMutation({
    mutationFn: archiveInstitution,
    onSuccess: () => { invalidate(); toast.success('Institution archived.'); },
    onError: (e) => toast.error(errorMessage(e, 'Could not archive that institution.')),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreInstitution,
    onSuccess: () => { invalidate(); toast.success('Institution restored.'); },
    onError: (e) => toast.error(errorMessage(e, 'Could not restore that institution.')),
  });

  const filterFields = [
    { name: 'country',         label: 'Country',           type: 'select', placeholder: 'All countries',  options: countryOptions, optionsError: countriesFailed },
    { name: 'search',          label: 'Search',            type: 'text',   placeholder: 'Institution name' },
    { name: 'blacklisted',     label: 'Blacklisted',       type: 'select', placeholder: 'Any status',
      options: [{ value: 'true', label: 'Blacklisted only' }, { value: 'false', label: 'Active only' }] },
    { name: 'includeArchived', label: 'Show archived',     type: 'select', placeholder: 'Active only',
      options: [{ value: 'true', label: 'Include archived' }] },
  ];

  const columns = [
    {
      key: 'name',
      header: 'Institution',
      render: (inst) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {inst.logoUrl
            ? <img src={inst.logoUrl} alt="" style={{ width: 28, height: 28, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 5, padding: 2 }} />
            : <div style={{ width: 28, height: 28, borderRadius: 5, background: 'var(--ink-800)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                {inst.name.slice(0, 2).toUpperCase()}
              </div>
          }
          <div>
            <div className="cell-strong">{inst.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>
              {inst.city ? `${inst.city}${inst.province ? `, ${inst.province}` : ''}` : inst.slug}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'country',
      header: 'Country',
      render: (inst) => (
        <span className="cell-flag">
          <Flag
            isoCode={inst.country?.isoCode}
            emoji={inst.country?.flagEmoji}
            code={inst.country?.code}
            name={inst.country?.name}
          />{' '}
          {inst.country?.name}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (inst) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {inst.isBlacklisted && (
            <span className="status-pill" style={{ background: 'var(--danger-100)', color: 'var(--danger-700)' }}>Blacklisted</span>
          )}
          {inst.isTrending && (
            <span className="status-pill offer">Trending</span>
          )}
          {inst.archivedAt && (
            <span className="status-pill" style={{ background: 'var(--ink-100)', color: 'var(--ink-600)' }}>Archived</span>
          )}
          {!inst.isBlacklisted && !inst.archivedAt && (
            <span className="status-pill submission">Active</span>
          )}
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      // An imported row is rewritten by the next run of that feed, so an edit
      // here is not permanent. Saying so in the table is cheaper than an admin
      // discovering it when their correction disappears overnight.
      render: (inst) => <SourceBadge source={inst.source} externalId={inst.externalId} />,
    },
    {
      key: '__actions',
      header: 'Actions',
      render: (inst) => (
        <div className="action-row">
          <button className="btn btn-outline" onClick={() => setEditing(inst)}>Edit</button>
          <button
            className="btn btn-ghost"
            onClick={() => blacklistMutation.mutate({ id: inst.id, isBlacklisted: !inst.isBlacklisted })}
            disabled={blacklistMutation.isPending}
          >
            {inst.isBlacklisted ? 'Unblacklist' : 'Blacklist'}
          </button>
          {inst.archivedAt ? (
            <button className="btn btn-ghost" onClick={() => restoreMutation.mutate(inst.id)}
              disabled={restoreMutation.isPending}>Restore</button>
          ) : (
            <button className="btn btn-ghost"
              onClick={() => window.confirm(`Archive "${inst.name}"?`) && archiveMutation.mutate(inst.id)}
              disabled={archiveMutation.isPending}>Archive</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page
      title="Institutions"
      subtitle="Manage partner institutions agents can search and apply to"
      actions={<button className="btn btn-primary" onClick={() => setEditing({})}>Add institution</button>}
    >
      <FilterBar fields={filterFields} values={draft} onChange={setField}
        onApply={apply} onClear={clear} busy={isFetching} />

      <DataTable
        columns={columns}
        rows={institutions}
        isLoading={isLoading}
        isError={isError}
        emptyMessage="No institutions match these filters."
        getRowKey={(r) => r.id}
        meta={data?.meta}
        onPageChange={data?.meta ? setPage : undefined}
      />

      {editing !== null && (
        <InstitutionModal
          initial={editing.id ? editing : null}
          countries={countries}
          onClose={() => setEditing(null)}
          onSaved={() => { invalidate(); setEditing(null); }}
        />
      )}
    </Page>
  );
}

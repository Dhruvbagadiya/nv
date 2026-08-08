import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import {
  fetchInstitutions,
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

const emptyForm = {
  name: '', slug: '', countryId: '', city: '', province: '',
  logoUrl: '', isTrending: false, isBlacklisted: false,
};

function InstitutionModal({ initial, onClose, onSaved, countries }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState({
    name:          initial?.name          ?? '',
    slug:          initial?.slug          ?? '',
    countryId:     initial?.countryId     ?? '',
    city:          initial?.city          ?? '',
    province:      initial?.province      ?? '',
    logoUrl:       initial?.logoUrl       ?? '',
    isTrending:    initial?.isTrending    ?? false,
    isBlacklisted: initial?.isBlacklisted ?? false,
  });
  const [error, setError] = useState(null);

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
    save.mutate({
      name:          form.name,
      slug:          form.slug || slugify(form.name),
      countryId:     form.countryId,
      city:          form.city     || null,
      province:      form.province || null,
      logoUrl:       form.logoUrl  || null,
      isTrending:    form.isTrending,
      isBlacklisted: form.isBlacklisted,
    });
  };

  return (
    <Modal title={isEdit ? 'Edit institution' : 'Add institution'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="admin-form-grid">
          <div className="form-field">
            <label className="flabel" htmlFor="inst-name">Institution name *</label>
            <input id="inst-name" type="text" value={form.name}
              onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="inst-slug">Slug *</label>
            <input id="inst-slug" type="text" value={form.slug}
              onChange={(e) => set('slug', e.target.value)}
              placeholder="auto-derived from name" required />
            <div className="field-hint">Used in deep-links. Auto-filled from the name.</div>
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="inst-country">Country *</label>
            <select id="inst-country" value={form.countryId}
              onChange={(e) => set('countryId', e.target.value)} required>
              <option value="">Select country</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flagEmoji ? `${c.flagEmoji} ` : ''}{c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="inst-city">City</label>
            <input id="inst-city" type="text" value={form.city}
              onChange={(e) => set('city', e.target.value)} placeholder="e.g. London" />
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="inst-province">Province / State</label>
            <input id="inst-province" type="text" value={form.province}
              onChange={(e) => set('province', e.target.value)} placeholder="e.g. England" />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="flabel" htmlFor="inst-logo">Logo URL</label>
            <input id="inst-logo" type="text" value={form.logoUrl}
              onChange={(e) => set('logoUrl', e.target.value)}
              placeholder="https://…/logo.png" />
            {form.logoUrl && (
              <img src={form.logoUrl} alt="logo preview"
                style={{ marginTop: 6, height: 40, objectFit: 'contain',
                  border: '1px solid var(--border)', borderRadius: 6, padding: 4 }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            )}
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isTrending}
                onChange={(e) => set('isTrending', e.target.checked)} />
              <span>Show in Trending Universities carousel</span>
            </label>
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isBlacklisted}
                onChange={(e) => set('isBlacklisted', e.target.checked)} />
              <span>Blacklisted (hidden from agents)</span>
            </label>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="submit-row" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : (isEdit ? 'Save changes' : 'Add institution')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminInstitutions() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);
  const { countries } = useCountries();

  const countryOptions = countries.map((c) => ({ value: c.code, label: c.name }));

  const { data: institutions = [], isLoading, isError, isFetching } = useQuery({
    queryKey: ['admin-institutions', applied],
    queryFn: () => fetchInstitutions({
      country:         applied.country         || undefined,
      search:          applied.search          || undefined,
      blacklisted:     applied.blacklisted     || undefined,
      includeArchived: applied.includeArchived || undefined,
    }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-institutions'] });

  const blacklistMutation = useMutation({
    mutationFn: ({ id, isBlacklisted }) => setBlacklist(id, isBlacklisted),
    onSuccess: invalidate,
  });

  const archiveMutation = useMutation({
    mutationFn: archiveInstitution,
    onSuccess: invalidate,
  });

  const restoreMutation = useMutation({
    mutationFn: restoreInstitution,
    onSuccess: invalidate,
  });

  const filterFields = [
    { name: 'country',         label: 'Country',           type: 'select', placeholder: 'All countries',  options: countryOptions },
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
          {inst.country?.flagEmoji} {inst.country?.name}
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Flag from '../../components/ui/Flag.jsx';
import { fetchCountriesPage } from '../../api/countries.js';
import { createCountry, updateCountry, deleteCountry } from '../../api/admin.js';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { invalidateResource } from '../../hooks/useInvalidateResource.js';

// This screen has no filter bar, so `page` is the only URL-backed state — but it
// goes through useUrlFilters anyway so paging is linkable and back/forward-aware,
// as on every other admin table. Module-level for the stable reference the hook
// documents as required.
const FILTER_DEFAULTS = { page: 1 };

// Countries are reference data everything else hangs off — institutions,
// inquiries, updates and documents all point at them, and `code` appears in saved
// filter URLs. So this screen is deliberately conservative: code is create-only,
// and deletion is refused while anything still references the country.
function CountryModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    code: initial?.code ?? '',
    isoCode: initial?.isoCode ?? '',
    currencyCode: initial?.currencyCode ?? '',
    sortOrder: initial?.sortOrder ?? 0,
  });
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (payload) => (isEdit ? updateCountry(initial.id, payload) : createCountry(payload)),
    onSuccess: onSaved,
    onError: (e) =>
      setError(e.response?.data?.details?.[0]?.message ?? e.response?.data?.error ?? 'Could not save.'),
  });

  const submit = (e) => {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      isoCode: form.isoCode.toUpperCase(),
      currencyCode: form.currencyCode.toUpperCase(),
      sortOrder: Number(form.sortOrder) || 0,
    };
    // Only sent on create — the API rejects a changed code, and sending an
    // unchanged one would just be noise.
    if (!isEdit) payload.code = form.code.toUpperCase();
    save.mutate(payload);
  };

  return (
    <Modal title={isEdit ? `Edit ${initial.name}` : 'Add country'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-field">
          <label className="flabel" htmlFor="c-name">Country name *</label>
          <input id="c-name" type="text" value={form.name}
            onChange={(e) => set('name', e.target.value)} required />
        </div>

        <div className="form-field">
          <label className="flabel" htmlFor="c-code">Portal code *</label>
          <input id="c-code" type="text" value={form.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())}
            maxLength={4} disabled={isEdit} required placeholder="UK" />
          <div className="field-hint">
            {isEdit
              ? 'Cannot be changed — it appears in saved filter links and the header strip.'
              : 'Short code used in URLs and on the header chips. Need not be the ISO code.'}
          </div>
        </div>

        <div className="form-field">
          <label className="flabel" htmlFor="c-iso">ISO country code *</label>
          <input id="c-iso" type="text" value={form.isoCode}
            onChange={(e) => set('isoCode', e.target.value.toUpperCase())}
            maxLength={2} required placeholder="GB" style={{ textTransform: 'uppercase' }} />
          <div className="field-hint">
            Two letters (ISO 3166-1). This is what the flag is drawn from — note it
            differs from the portal code for several countries (UK → GB, GR → DE).
          </div>
          {/* Live preview, so a wrong code is obvious before saving rather than
              showing up as a blank flag in the header later. */}
          {form.isoCode.length === 2 && (
            <div className="flag-preview">
              <Flag isoCode={form.isoCode} code={form.code} name={form.name} size={28} />
              <span>Flag preview</span>
            </div>
          )}
        </div>

        <div className="form-field">
          <label className="flabel" htmlFor="c-currency">Currency *</label>
          <input id="c-currency" type="text" value={form.currencyCode}
            onChange={(e) => set('currencyCode', e.target.value.toUpperCase())}
            maxLength={3} required placeholder="GBP" style={{ textTransform: 'uppercase' }} />
          <div className="field-hint">
            Three letters (ISO 4217). Every tuition fee for this country is
            formatted in it.
          </div>
        </div>

        <div className="form-field">
          <label className="flabel" htmlFor="c-sort">Sort order</label>
          <input id="c-sort" type="number" value={form.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)} />
          <div className="field-hint">Controls the order of the header country strip.</div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="submit-row">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add country'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminCountries() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [removeError, setRemoveError] = useState(null);

  const { applied, setPage } = useUrlFilters(FILTER_DEFAULTS);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-countries', applied],
    queryFn: () => fetchCountriesPage({ page: applied.page }),
    placeholderData: keepPreviousData,
  });

  const countries = data?.items ?? [];

  const invalidate = () => {
    // The header strip and every country dropdown read the same query.
    invalidateResource(queryClient, 'countries');
  };

  const remove = useMutation({
    mutationFn: deleteCountry,
    onSuccess: () => {
      setRemoveError(null);
      invalidate();
    },
    // The API refuses while institutions or documents still point at it, and its
    // message names the counts — far more useful than "delete failed".
    onError: (e) => setRemoveError(e.response?.data?.error ?? 'Could not delete that country.'),
  });

  const columns = [
    {
      key: 'flag',
      header: 'Flag',
      render: (c) => <Flag isoCode={c.isoCode} emoji={c.flagEmoji} code={c.code} name={c.name} size={24} />,
    },
    { key: 'name', header: 'Country', className: 'cell-strong' },
    { key: 'code', header: 'Portal code', className: 'cell-mono' },
    { key: 'isoCode', header: 'ISO', className: 'cell-mono', render: (c) => c.isoCode ?? '—' },
    { key: 'currencyCode', header: 'Currency', className: 'cell-mono' },
    {
      key: 'institutionCount',
      header: 'Institutions',
      render: (c) => c.institutionCount ?? 0,
    },
    { key: 'sortOrder', header: 'Order', className: 'cell-mono' },
    {
      key: '__actions',
      header: 'Actions',
      render: (c) => (
        <div className="action-row">
          <button type="button" className="btn btn-outline" onClick={() => setEditing(c)}>Edit</button>
          <button
            type="button"
            className="btn btn-ghost"
            // Disabled rather than allowed-then-refused when we already know it
            // has institutions.
            disabled={remove.isPending || c.institutionCount > 0}
            title={c.institutionCount > 0 ? `${c.name} still has ${c.institutionCount} institutions` : undefined}
            onClick={() => window.confirm(`Delete ${c.name}?`) && remove.mutate(c.id)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <Page
      title="Countries"
      subtitle="Destinations shown in the header strip and every country filter"
      actions={
        <button className="btn btn-primary" onClick={() => setEditing({})}>Add country</button>
      }
    >
      {removeError && <p className="form-error">{removeError}</p>}

      <DataTable
        columns={columns}
        rows={countries}
        isLoading={isLoading}
        isError={isError}
        error={error}
        emptyMessage="No countries configured."
        meta={data?.meta}
        onPageChange={data?.meta ? setPage : undefined}
      />

      {editing && (
        <CountryModal
          initial={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            invalidate();
            setEditing(null);
          }}
        />
      )}
    </Page>
  );
}

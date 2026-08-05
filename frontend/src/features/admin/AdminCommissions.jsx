import AdminResourcePage from '../../components/admin/AdminResourcePage.jsx';
import { fetchCommissions } from '../../api/referenceScreens.js';
import { upsertCommission } from '../../api/admin.js';
import { useCountries, useInstitutions } from '../../hooks/useReferenceData.js';

const FILTER_DEFAULTS = { country: '', search: '', page: 1 };

export default function AdminCommissions() {
  const { options: countryOptions } = useCountries();
  const { options: institutionOptions } = useInstitutions();

  const resource = {
    title: 'Universities commission',
    subtitle: 'Commission rates agents see per institution',
    queryKey: 'admin-commissions',
    createLabel: 'Set commission',
    emptyMessage: 'No commission rates recorded.',
    list: fetchCommissions,
    // One row per institution, so create IS update — the API is a PUT upsert keyed
    // on institutionId, and there is no separate update path or delete.
    create: upsertCommission,
    // The row's id is the commission's, but the upsert keys on the institution.
    idOf: (c) => c.institutionId,

    filterDefaults: FILTER_DEFAULTS,
    filterFields: [
      { name: 'country', label: 'Country', type: 'select', placeholder: 'Any country', options: countryOptions },
      { name: 'search', label: 'Search', type: 'text', placeholder: 'Institution name' },
    ],

    columns: [
      { key: 'country', header: 'Country', render: (c) => c.institution.country.name },
      { key: 'institution', header: 'Institution', className: 'cell-strong', render: (c) => c.institution.name },
      {
        key: 'tiers',
        header: 'Commission',
        render: (c) => (
          <div>
            {c.tiers.map((t) => (
              <div className="status-line" key={t.label}>
                {t.label}: <b>{t.rate}</b>
              </div>
            ))}
          </div>
        ),
      },
      { key: 'notes', header: 'Notes', render: (c) => c.notes || '—' },
    ],

    formFields: [
      {
        name: 'institutionId',
        label: 'Institution',
        type: 'select',
        options: institutionOptions,
        required: true,
        hint: 'Saving over an institution that already has rates replaces them.',
      },
      {
        name: 'tiers',
        label: 'Rate tiers',
        type: 'tiers',
        // Explains the irregular data this Json column exists to hold.
        defaultValue: [{ label: 'All students', rate: '' }],
      },
      { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
    ],

    toForm: (c) => ({ institutionId: c.institutionId, tiers: c.tiers, notes: c.notes ?? '' }),

    toPayload: (v) => ({
      institutionId: v.institutionId,
      // Blank rows are dropped rather than sent — the API requires at least one
      // tier with a non-empty label and rate.
      tiers: (v.tiers ?? []).filter((t) => t.label?.trim() && t.rate?.trim()),
      notes: v.notes || null,
    }),
  };

  return <AdminResourcePage resource={resource} />;
}

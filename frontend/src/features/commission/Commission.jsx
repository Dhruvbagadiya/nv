import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import { fetchCommissions } from '../../api/referenceScreens.js';

const FILTER_DEFAULTS = { country: '', search: '', page: 1 };

const COLUMNS = [
  {
    key: 'country',
    header: 'Country',
    render: (c) => (
      <span>
        {c.institution.country.flagEmoji} {c.institution.country.name}
      </span>
    ),
  },
  {
    key: 'university',
    header: 'University name',
    className: 'cell-strong',
    render: (c) => c.institution.name,
  },
  {
    key: 'commission',
    header: 'Commission',
    // Tiers are irregular — a flat rate, or bands by student volume, or
    // per-programme. Rendered as lines rather than squeezed into one string.
    render: (c) => (
      <div>
        {c.tiers.map((t) => (
          <div key={t.label} className="status-line">
            {t.label === 'All students' ? (
              <b>{t.rate}</b>
            ) : (
              <>
                {t.label}: <b>{t.rate}</b>
              </>
            )}
          </div>
        ))}
        {c.notes && <div className="status-line">{c.notes}</div>}
      </div>
    ),
  },
];

export default function Commission() {
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);
  const { options: countryOptions } = useCountries();

  const fields = [
    {
      name: 'country',
      label: 'Country',
      type: 'select',
      placeholder: 'Select country',
      options: countryOptions,
    },
    {
      name: 'search',
      label: 'Search by name',
      type: 'text',
      placeholder: 'Enter keywords to search institute',
    },
  ];

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['commissions', applied],
    queryFn: () => fetchCommissions(applied),
    placeholderData: keepPreviousData,
  });

  return (
    <Page title="Commission of Universities" subtitle="Universities list">
      <FilterBar
        fields={fields}
        values={draft}
        onChange={setField}
        onApply={apply}
        onClear={clear}
        busy={isFetching}
      />
      <DataTable
        columns={COLUMNS}
        rows={data?.items}
        isLoading={isLoading}
        isError={isError}
        error={error}
        emptyMessage="No commission rates match these filters."
        meta={data?.meta}
        onPageChange={setPage}
      />
    </Page>
  );
}

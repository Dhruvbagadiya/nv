import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchMoiAcceptances } from '../../api/moiInstitutions.js';
import Page from '../../components/ui/Page.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import { fetchMoiCourseTypes } from '../../api/moiInstitutions.js';

// Reference conversion for the Phase 4 primitives. What changed:
//   - both filter dropdowns were empty <select>s with a single static <option>,
//     so neither filter could ever be used (F-09)
//   - no pagination, though the service returns totalPages (F-11)
//   - no error state: a failed request rendered as "No data available", which
//     tells the user something false
//   - filter state was component-local, so a filtered view could not be linked
//     or restored with the back button
const FILTER_DEFAULTS = { country: '', courseType: '', page: 1 };

const COLUMNS = [
  { key: 'country', header: 'Country', render: (m) => m.institution.country.name },
  {
    key: 'institution',
    header: 'University name',
    className: 'cell-strong',
    render: (m) => m.institution.name,
  },
  { key: 'courseType', header: 'Course type' },
  { key: 'years', header: 'Years' },
  {
    key: 'document',
    header: 'Document',
    render: (m) =>
      m.documentUrl ? (
        <a className="text-link" href={m.documentUrl} target="_blank" rel="noopener noreferrer">
          View
        </a>
      ) : (
        '—'
      ),
  },
];

export default function MoiAccepted() {
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);

  // Both dropdowns come from live data now. Course type in particular is a
  // free-text column, so a hardcoded list in the UI would drift from what is
  // actually stored and offer filters that match nothing.
  const { options: countryOptions } = useCountries();
  const { data: courseTypes = [] } = useQuery({
    queryKey: ['moi-course-types'],
    queryFn: fetchMoiCourseTypes,
    staleTime: 30 * 60 * 1000,
  });

  const fields = [
    {
      name: 'country',
      label: 'Country',
      type: 'select',
      placeholder: 'Select country',
      options: countryOptions,
    },
    {
      name: 'courseType',
      label: 'Course type',
      type: 'select',
      placeholder: 'All course types',
      options: courseTypes.map((t) => ({ value: t, label: t })),
    },
  ];

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['moi-institutions', applied],
    queryFn: () => fetchMoiAcceptances(applied),
    placeholderData: keepPreviousData,
  });

  return (
    <Page title="MOI accepted universities" subtitle="Universities list">
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
        emptyMessage="No MOI-accepted institutions match these filters."
        meta={data?.meta}
        onPageChange={setPage}
      />
    </Page>
  );
}

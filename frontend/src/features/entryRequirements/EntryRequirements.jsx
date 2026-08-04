import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { useCountries, useInstitutions } from '../../hooks/useReferenceData.js';
import { fetchEntryRequirements, fetchEnglishTests } from '../../api/referenceScreens.js';

// /entry-requirements/ug and /pg are this one component with a different `level`.
// They are the same table over the same data; only the subtitle and the filter
// results differ.
// Module-level constant: useUrlFilters requires a stable reference.
const FILTER_DEFAULTS = {
  country: '',
  institutionId: '',
  englishRequirement: '',
  credibilityInterview: '',
  page: 1,
};

const COLUMNS = [
  {
    key: 'university',
    header: 'University name',
    className: 'cell-strong',
    render: (r) => r.institution.name,
  },
  { key: 'englishRequirement', header: 'English requirement' },
  { key: 'academicRequirement', header: 'Academic requirement' },
  { key: 'offerTimeline', header: 'Offer timeline' },
  {
    key: 'credibilityInterview',
    header: 'Credibility interview',
    render: (r) => (
      <span className={`status-pill ${r.credibilityInterview ? 'offer' : 'submission'}`}>
        {r.credibilityInterview ? 'Yes' : 'No'}
      </span>
    ),
  },
  { key: 'financialInformation', header: 'Financial information' },
];

const SUBTITLES = { UG: 'Under Graduate Programs', PG: 'Post Graduate Programs' };

export default function EntryRequirements({ level }) {
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);
  const { options: countryOptions } = useCountries();
  const { options: institutionOptions } = useInstitutions(
    applied.country ? { country: applied.country } : {}
  );

  // The reference screen has a static "English Requirement" dropdown, but the
  // column is long free text, so the options are derived from the test names
  // actually present rather than guessed at.
  const { data: englishTests = [] } = useQuery({
    queryKey: ['english-tests', level],
    queryFn: () => fetchEnglishTests(level),
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
      name: 'institutionId',
      label: 'Institution name',
      type: 'select',
      placeholder: 'University name',
      options: institutionOptions,
    },
    {
      name: 'englishRequirement',
      label: 'English requirement',
      type: 'select',
      placeholder: 'Any test',
      options: englishTests.map((t) => ({ value: t, label: t })),
    },
    {
      name: 'credibilityInterview',
      label: 'Credibility interview',
      type: 'select',
      placeholder: 'Any',
      options: [
        { value: 'true', label: 'Required' },
        { value: 'false', label: 'Not required' },
      ],
    },
  ];

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['entry-requirements', level, applied],
    queryFn: () => fetchEntryRequirements({ ...applied, level }),
    placeholderData: keepPreviousData,
  });

  return (
    <Page title="Entry Requirements" subtitle={SUBTITLES[level]}>
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
        emptyMessage={`No ${level} entry requirements match these filters.`}
        meta={data?.meta}
        onPageChange={setPage}
      />
    </Page>
  );
}

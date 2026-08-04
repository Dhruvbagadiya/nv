import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import DocumentGrid from '../../components/ui/DocumentGrid.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { useCountries, useInstitutions } from '../../hooks/useReferenceData.js';
import { fetchDocuments } from '../../api/referenceScreens.js';

// All five Document Bank screens are this component behind five routes. In the
// reference portal they are five near-identical pages differing only by category,
// so making them five files would be five copies of the same bug surface.
const FILTER_DEFAULTS = { countryId: '', institutionId: '', search: '', page: 1 };

export const DOCUMENT_CATEGORIES = {
  VISA_DOCUMENT: { subtitle: 'Explore Visa Document', searchHint: 'Enter keywords to search documents' },
  REFUND_FORM: { subtitle: 'Explore Refund Forms', searchHint: 'Enter keywords to search refund forms' },
  INSTITUTE_BROCHURE: { subtitle: 'Explore Institute Brochures', searchHint: 'Enter keywords to search institute brochures' },
  SOP: { subtitle: 'Explore SOP', searchHint: 'Enter keywords to search SOPs' },
  LOR: { subtitle: 'Explore LOR', searchHint: 'Enter keywords to search LORs' },
};

export default function DocumentBank({ category }) {
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);
  const { countries } = useCountries();
  const { options: institutionOptions } = useInstitutions();
  const meta = DOCUMENT_CATEGORIES[category];

  const fields = [
    {
      name: 'countryId',
      label: 'Country',
      type: 'select',
      placeholder: 'Select country',
      options: countries.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      name: 'institutionId',
      label: 'Institution',
      type: 'select',
      placeholder: 'Select university',
      options: institutionOptions,
    },
    { name: 'search', label: 'Search by name', type: 'text', placeholder: meta.searchHint },
  ];

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['documents', category, applied],
    queryFn: () => fetchDocuments({ ...applied, category }),
    placeholderData: keepPreviousData,
  });

  return (
    <Page title="Document Bank" subtitle={meta.subtitle}>
      <FilterBar
        fields={fields}
        values={draft}
        onChange={setField}
        onApply={apply}
        onClear={clear}
        busy={isFetching}
      />
      <DocumentGrid
        documents={data?.items}
        isLoading={isLoading}
        isError={isError}
        meta={data?.meta}
        onPageChange={setPage}
      />
    </Page>
  );
}

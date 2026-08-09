import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import DocumentGrid from '../../components/ui/DocumentGrid.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { fetchDocuments, fetchDocumentFacets } from '../../api/referenceScreens.js';

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
  const meta = DOCUMENT_CATEGORIES[category];

  // Driven by what exists rather than the full country/institution lists. Every
  // document used to be unscoped, so both dropdowns offered every option and
  // every one returned an empty grid — which reads as a broken filter.
  const { data: facets } = useQuery({
    queryKey: ['document-facets', category],
    queryFn: () => fetchDocumentFacets(category),
    staleTime: 10 * 60 * 1000,
  });

  // A dropdown with nothing behind it is hidden rather than shown empty.
  const fields = [
    ...(facets?.countries?.length
      ? [{
          name: 'countryId',
          label: 'Country',
          type: 'select',
          placeholder: 'All countries',
          options: facets.countries.map((c) => ({ value: c.id, label: c.name })),
        }]
      : []),
    ...(facets?.institutions?.length
      ? [{
          name: 'institutionId',
          label: 'Institution',
          type: 'select',
          placeholder: 'All institutions',
          options: facets.institutions.map((i) => ({ value: i.id, label: i.name })),
        }]
      : []),
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

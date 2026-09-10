import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import Flag from '../../components/ui/Flag.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import { invalidateResource } from '../../hooks/useInvalidateResource.js';
import { fetchCourseInquiries } from '../../api/referenceScreens.js';
import { updateInquiryStage } from '../../api/admin.js';

// Stable reference — useUrlFilters memoises on the identity of `defaults`.
const FILTER_DEFAULTS = { countryId: '', intake: '', stage: '', page: 1 };

// Matches CourseInquiryStage in the schema. The order is the funnel an inquiry
// moves along, which is also the order the Report screen counts them in.
const STAGES = [
  { value: 'INQUIRY', label: 'Course inquiry' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'OFFERED', label: 'Offered' },
  { value: 'APPLIED', label: 'Applied' },
];

/**
 * "Ask Our Team" inquiries, and the screen for answering them.
 *
 * PATCH /course-inquiries/:id/stage has been admin-gated since it was written,
 * but had no client function and no screen — so an agent could raise an inquiry
 * and nobody could move it along. The four Course Inquiry tiles on the Report
 * screen counted stages that could never change.
 */
export default function AdminCourseInquiries() {
  const queryClient = useQueryClient();
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);
  const { countries } = useCountries();

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['course-inquiries', applied],
    queryFn: () => fetchCourseInquiries(applied),
    placeholderData: keepPreviousData,
  });

  const setStage = useMutation({
    mutationFn: ({ id, stage }) => updateInquiryStage(id, stage),
    onSuccess: () => invalidateResource(queryClient, 'course-inquiries'),
  });

  const columns = [
    {
      key: 'agent',
      header: 'Agent',
      className: 'cell-strong',
      render: (r) => r.agent?.name ?? r.agent?.email ?? '—',
    },
    { key: 'nationality', header: 'Nationality' },
    {
      key: 'country',
      header: 'Destination',
      render: (r) =>
        r.country ? (
          <span className="cell-flag">
            <Flag emoji={r.country.flagEmoji} code={r.country.code} name={r.country.name} />{' '}
            {r.country.name}
          </span>
        ) : (
          <span className="cell-muted">Any</span>
        ),
    },
    {
      key: 'intake',
      header: 'Intake',
      render: (r) => r.intake || <span className="cell-muted">Any</span>,
    },
    {
      key: 'courseType',
      header: 'Course type',
      render: (r) => r.courseType || <span className="cell-muted">Any</span>,
    },
    {
      key: 'createdAt',
      header: 'Raised',
      className: 'cell-mono',
      render: (r) => new Date(r.createdAt).toLocaleDateString(),
    },
    {
      key: 'stage',
      header: 'Stage',
      // Changed in place rather than behind an edit dialog: moving an inquiry
      // along is the entire job of this screen.
      render: (r) => (
        <select
          value={r.stage}
          disabled={setStage.isPending}
          aria-label={`Stage for the inquiry from ${r.agent?.name ?? 'this agent'}`}
          onChange={(e) => setStage.mutate({ id: r.id, stage: e.target.value })}
        >
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      ),
    },
  ];

  return (
    <Page
      title="Course inquiries"
      subtitle="Questions agents have sent to the team, and where each one has got to"
    >
      <FilterBar
        fields={[
          {
            name: 'countryId',
            label: 'Destination',
            type: 'select',
            placeholder: 'Any destination',
            // The API filters on the country's id, not its code.
            options: countries.map((c) => ({ value: c.id, label: c.name })),
          },
          { name: 'intake', label: 'Intake', type: 'text', placeholder: 'e.g. Sep 2027' },
          {
            name: 'stage',
            label: 'Stage',
            type: 'select',
            placeholder: 'Any stage',
            options: STAGES,
          },
        ]}
        values={draft}
        onChange={setField}
        onApply={apply}
        onClear={clear}
        busy={isFetching}
      />

      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        isError={isError}
        error={error}
        emptyMessage="No inquiries match these filters."
        meta={data?.meta}
        onPageChange={setPage}
      />
    </Page>
  );
}

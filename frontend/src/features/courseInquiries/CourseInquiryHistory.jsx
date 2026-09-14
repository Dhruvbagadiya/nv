import { useNavigate } from 'react-router-dom';
import Flag from '../../components/ui/Flag.jsx';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchInquiries } from '../../api/courseInquiries.js';
import Page from '../../components/ui/Page.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import {
  COURSE_INQUIRY_STAGES,
  courseInquiryStageLabel,
  intakeFilters,
} from '../../constants/referenceData.js';
import { formatDate } from '../../utils/format.js';

// This screen had no filters at all despite the API accepting countryId and intake,
// and no pagination despite the service returning totalPages. The Report screen's
// inquiry tiles now link in here with ?stage=…
const FILTER_DEFAULTS = { countryId: '', intake: '', stage: '', page: 1 };

// Same labels the form generates, but reaching back too: an intake that has
// already started must stay searchable, or the rows recording it drop out of
// reach. These were three fixed labels while the form let you type any intake at
// all, so the filter could only ever match by coincidence.
const INTAKES = intakeFilters();

export default function CourseInquiryHistory() {
  const navigate = useNavigate();
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);
  const { countries, isError: countriesFailed } = useCountries();

  const fields = [
    {
      name: 'countryId',
      label: 'Country',
      type: 'select',
      placeholder: 'Select country',
      // countryId, not code: CourseInquiry has a direct relation to Country.
      options: countries.map((c) => ({ value: c.id, label: c.name })),
      optionsError: countriesFailed,
    },
    {
      name: 'intake',
      label: 'Intake',
      type: 'select',
      placeholder: 'Any intake',
      options: INTAKES,
    },
    {
      name: 'stage',
      label: 'Stage',
      type: 'select',
      placeholder: 'Any stage',
      options: COURSE_INQUIRY_STAGES,
    },
  ];

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['course-inquiries', applied],
    queryFn: () => fetchInquiries(applied),
    placeholderData: keepPreviousData,
  });

  const columns = [
    { key: 'nationality', header: 'Nationality', className: 'cell-strong' },
    {
      key: 'country',
      header: 'Destination',
      // The country name, which this screen could not show at all before —
      // CourseInquiry.countryId had no relation, so there was nothing to join.
      render: (i) =>
        i.country ? (
          <>
            <Flag isoCode={i.country.isoCode} emoji={i.country.flagEmoji} code={i.country.code} name={i.country.name} /> {i.country.name}
          </>
        ) : (
          '—'
        ),
    },
    { key: 'intake', header: 'Intake', render: (i) => i.intake || '—' },
    { key: 'courseType', header: 'Course type', render: (i) => i.courseType || '—' },
    { key: 'stage', header: 'Stage', render: (i) => courseInquiryStageLabel(i.stage) },
    { key: 'createdAt', header: 'Raised', render: (i) => formatDate(i.createdAt) },
  ];

  return (
    <Page
      title="Course inquiry history"
      subtitle="Track all your course inquiries"
      actions={
        <button className="btn btn-primary" onClick={() => navigate('/partner/ask-team')}>
          New inquiry
        </button>
      }
    >
      <FilterBar
        fields={fields}
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
        emptyMessage="No course inquiries match these filters."
        meta={data?.meta}
        onPageChange={setPage}
      />
    </Page>
  );
}

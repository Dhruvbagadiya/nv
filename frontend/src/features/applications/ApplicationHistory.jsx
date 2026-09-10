import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchApplications } from '../../api/applications.js';
import Flag from '../../components/ui/Flag.jsx';
import Page from '../../components/ui/Page.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import ApplicationDetail from './ApplicationDetail.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { useCountries, useInstitutions } from '../../hooks/useReferenceData.js';
import { APPLICATION_STAGES, applicationStageLabel } from '../../constants/referenceData.js';
import { formatDate } from '../../utils/format.js';

// What changed here:
//  - the Country filter was an empty <select> with one static <option>
//  - the API accepted institutionId and stage filters that the UI never offered
//  - `page` was tracked in state and no pagination control was ever rendered, so
//    page 2 was unreachable (F-11)
//  - a failed request rendered as "No applications found", which is a lie
//  - filters were component-local, so a filtered view could not be linked. The
//    Report screen's tiles now link straight into this screen with ?stage=…
const FILTER_DEFAULTS = {
  country: '',
  institutionId: '',
  stage: '',
  passportNo: '',
  studentName: '',
  page: 1,
};

export default function ApplicationHistory() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(null);
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);
  const { options: countryOptions } = useCountries();
  const { options: institutionOptions } = useInstitutions(
    applied.country ? { country: applied.country } : {}
  );

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
      label: 'Institution',
      type: 'select',
      placeholder: 'All institutions',
      options: institutionOptions,
    },
    {
      name: 'stage',
      label: 'Stage',
      type: 'select',
      placeholder: 'Any stage',
      options: APPLICATION_STAGES,
    },
    { name: 'passportNo', label: 'Passport no.', type: 'text', placeholder: 'Enter passport number' },
    {
      name: 'studentName',
      label: 'Student name',
      type: 'text',
      placeholder: 'First name, last name, or both',
    },
  ];

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['applications', applied],
    queryFn: () => fetchApplications(applied),
    placeholderData: keepPreviousData,
  });

  const columns = [
    {
      key: 'reference',
      header: 'POEC ID',
      className: 'cell-mono',
      // The sequential reference agents read out, rather than the first 8
      // characters of a uuid, which is what this column used to show.
      render: (a) => a.reference,
    },
    {
      key: 'student',
      header: 'Student name & info',
      render: (a) => (
        <>
          <div className="cell-strong">{a.studentName}</div>
          <div className="picker-sub">Passport: {a.passportNo}</div>
        </>
      ),
    },
    {
      key: 'course',
      header: 'Institution / course',
      render: (a) => (
        <>
          <div>
            <Flag
              emoji={a.course.institution.country.flagEmoji}
              code={a.course.institution.country.code}
              name={a.course.institution.country.name}
            />{' '}
            {a.course.institution.name}
          </div>
          <div className="cell-strong">{a.course.title}</div>
          {a.intakeLabel && <div className="picker-sub">{a.intakeLabel}</div>}
        </>
      ),
    },
    {
      key: 'stage',
      header: 'Status',
      render: (a) => (
        <>
          <div className="status-line">
            <b>{applicationStageLabel(a.stage)}</b>
          </div>
          {a.stageNote && <div className="picker-sub">{a.stageNote}</div>}
        </>
      ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      render: (a) => (a.deadlineAt ? formatDate(a.deadlineAt) : '—'),
    },
  ];

  return (
    <Page
      title="Application history"
      subtitle="Track all your students’ applications with ease"
      actions={
        <button className="btn btn-primary" onClick={() => navigate('/partner/add-application')}>
          Add new application
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
        emptyMessage="No applications match these filters."
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(row) => setSelectedId(row.id)}
        rowLabel={(row) => `Open application for ${row.studentName ?? 'this student'}`}
        rowClickTitle="View details"
      />

      {selectedId && (
        <ApplicationDetail
          applicationId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </Page>
  );
}

/**
 * AdminApplications
 *
 * Shows ALL applications across every agent — admins need this to advance stages
 * and track the full pipeline. The partner ApplicationHistory only shows the
 * logged-in agent's own applications.
 *
 * Reuses the same backend endpoint (/api/applications) — admins have no agentId
 * scope applied so they see everything.
 */
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import ApplicationDetail from '../applications/ApplicationDetail.jsx';
import Flag from '../../components/ui/Flag.jsx';
import { fetchApplications } from '../../api/applications.js';
import { useCountries } from '../../hooks/useReferenceData.js';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { APPLICATION_STAGES, applicationStageLabel } from '../../constants/referenceData.js';
import { formatDate } from '../../utils/format.js';

const FILTER_DEFAULTS = {
  country: '', institutionId: '', stage: '',
  passportNo: '', studentName: '', page: 1,
};

const STAGE_COLORS = {
  PROFILE_ASSESSMENT:  { background: 'var(--ink-100)',    color: 'var(--ink-700)' },
  APPLICATION:         { background: 'var(--info-100)',   color: 'var(--info-700)' },
  CONDITIONAL_OFFER:   { background: 'var(--warning-100)',color: 'var(--warning-700)' },
  UNCONDITIONAL_OFFER: { background: 'var(--success-100)',color: 'var(--success-700)' },
  FEES_PAYMENT:        { background: 'var(--warning-100)',color: 'var(--warning-700)' },
  CAS_LETTER:          { background: 'var(--info-100)',   color: 'var(--info-700)' },
  VISA_APPLICATION:    { background: 'var(--purple-100)', color: 'var(--purple-700)' },
  VISA_APPROVAL:       { background: 'var(--success-100)',color: 'var(--success-700)' },
};

export default function AdminApplications() {
  const [selectedId, setSelectedId] = useState(null);
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);
  const { options: countryOptions } = useCountries();

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['admin-applications', applied],
    queryFn: () => fetchApplications(applied),
    placeholderData: keepPreviousData,
  });

  const filterFields = [
    { name: 'country',      label: 'Country',      type: 'select', placeholder: 'All countries',    options: countryOptions },
    // countryCode narrows the search to the chosen destination, which is what
    // the country-scoped institution list used to do before this became a
    // server-side search.
    { name: 'institutionId',label: 'Institution',   type: 'institution', countryCode: applied.country || undefined },
    {
      name: 'stage', label: 'Stage', type: 'select', placeholder: 'Any stage',
      options: APPLICATION_STAGES,
    },
    { name: 'studentName',  label: 'Student name', type: 'text',   placeholder: 'Search student' },
    { name: 'passportNo',   label: 'Passport no.', type: 'text',   placeholder: 'Passport number' },
  ];

  const columns = [
    {
      key: 'reference',
      header: 'POEC ID',
      className: 'cell-mono',
      render: (a) => `#${a.reference}`,
    },
    {
      key: 'student',
      header: 'Student',
      render: (a) => (
        <div>
          <div className="cell-strong">{a.studentName}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>PP: {a.passportNo}</div>
        </div>
      ),
    },
    {
      key: 'course',
      header: 'Course / Institution',
      render: (a) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flag
              emoji={a.course.institution.country.flagEmoji}
              code={a.course.institution.country.code}
              name={a.course.institution.country.name}
            />
            <span style={{ fontSize: 11.5, color: 'var(--ink-600)', fontWeight: 600 }}>
              {a.course.institution.name}
            </span>
          </div>
          <div className="cell-strong" style={{ fontSize: 12, marginTop: 2 }}>
            {a.course.title}
          </div>
          {a.intakeLabel && (
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{a.intakeLabel}</div>
          )}
        </div>
      ),
    },
    {
      key: 'agent',
      header: 'Agent',
      render: (a) => (
        <span style={{ fontSize: 12, color: 'var(--ink-600)' }}>{a.agent?.name ?? '—'}</span>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (a) => (
        <div>
          <span
            style={{
              ...(STAGE_COLORS[a.stage] ?? {}),
              fontSize: 10.5, fontWeight: 700, padding: '2px 8px',
              borderRadius: 'var(--radius-pill)', display: 'inline-block',
            }}
          >
            {applicationStageLabel(a.stage)}
          </span>
          {a.stageNote && (
            <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>
              {a.stageNote}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      render: (a) => a.deadlineAt
        ? <span style={{ color: 'var(--warning-700)', fontWeight: 600, fontSize: 12 }}>{formatDate(a.deadlineAt)}</span>
        : <span style={{ color: 'var(--ink-400)', fontSize: 12 }}>—</span>,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (a) => <span className="cell-mono" style={{ fontSize: 11 }}>{formatDate(a.createdAt)}</span>,
    },
  ];

  return (
    <Page
      title="All applications"
      subtitle="Every application across all agents — click a row to advance the stage"
    >
      <FilterBar
        fields={filterFields}
        values={draft}
        onChange={setField}
        onApply={apply}
        onClear={clear}
        busy={isFetching}
      />

      {data?.meta && (
        <div className="result-count" style={{ marginBottom: 8 }}>
          <b>{data.meta.total}</b> application{data.meta.total !== 1 ? 's' : ''}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        isError={isError}
        emptyMessage="No applications match these filters."
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(row) => setSelectedId(row.id)}
        rowLabel={(row) => `Open application for ${row.studentName ?? 'this student'}`}
        rowClickTitle="Click to view and advance stage"
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

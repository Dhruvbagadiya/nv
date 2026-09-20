import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchStudentApplications } from '../../api/students.js';
import Pagination from '../../components/ui/Pagination.jsx';
import { formatDate } from '../../utils/format.js';

const STAGE_LABELS = {
  PROFILE_ASSESSMENT:  'Profile Assessment',
  APPLICATION:         'Application',
  CONDITIONAL_OFFER:   'Conditional Offer',
  UNCONDITIONAL_OFFER: 'Unconditional Offer',
  FEES_PAYMENT:        'Fees Payment',
  CAS_LETTER:          'CAS Letter',
  VISA_APPLICATION:    'Visa Application',
  VISA_APPROVAL:       'Visa Approved',
};

const STAGE_COLOR = {
  PROFILE_ASSESSMENT:  { background: 'var(--ink-100)',     color: 'var(--ink-600)' },
  APPLICATION:         { background: 'var(--info-100)',    color: 'var(--info-700)' },
  CONDITIONAL_OFFER:   { background: 'var(--warning-100)', color: 'var(--warning-700)' },
  UNCONDITIONAL_OFFER: { background: 'var(--success-100)', color: 'var(--success-700)' },
  FEES_PAYMENT:        { background: 'var(--warning-100)', color: 'var(--warning-700)' },
  CAS_LETTER:          { background: 'var(--info-100)',    color: 'var(--info-700)' },
  VISA_APPLICATION:    { background: 'var(--purple-100)',  color: 'var(--purple-700)' },
  VISA_APPROVAL:       { background: 'var(--success-100)', color: 'var(--success-700)' },
};

const STAGE_FILTERS = [
  { value: '',                   label: 'All' },
  { value: 'PROFILE_ASSESSMENT', label: 'Assessment' },
  { value: 'APPLICATION',        label: 'Applied' },
  { value: 'CONDITIONAL_OFFER',  label: 'Conditional' },
  { value: 'UNCONDITIONAL_OFFER',label: 'Unconditional' },
  { value: 'FEES_PAYMENT',       label: 'Fees' },
  { value: 'CAS_LETTER',         label: 'CAS' },
  { value: 'VISA_APPLICATION',   label: 'Visa Filed' },
  { value: 'VISA_APPROVAL',      label: 'Approved' },
];

export default function StudentApplications() {
  const [stage, setStage] = useState('');
  const [page,  setPage]  = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['student-applications', stage, page],
    queryFn: () => fetchStudentApplications({ stage: stage || undefined, page, pageSize: 10 }),
    placeholderData: keepPreviousData,
  });

  const apps = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="student-apps-page">
      <div className="student-apps-inner">
        {/* Header */}
        <div className="student-apps-header">
          <div>
            <h1>My Applications</h1>
            <p>Track the status of every program you&apos;ve applied to</p>
          </div>
          {/* The "Browse programs" button that used to sit here was the second
              one on this screen — the empty state below renders the same link,
              and both were visible at once. Two buttons for one action is a
              choice the reader has to resolve before acting. The empty-state one
              is kept because it appears exactly when it is the thing to do. */}
        </div>

        {/* Stage filter chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {STAGE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => { setStage(f.value); setPage(1); }}
              style={{
                padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                border: '1px solid',
                ...(stage === f.value
                  ? { background: 'var(--accent-700)', color: 'var(--accent-contrast)', borderColor: 'var(--accent-700)' }
                  : { background: 'var(--surface)', color: 'var(--ink-600)', borderColor: 'var(--border)' }),
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Count */}
        {meta && (
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 12 }}>
            <b style={{ color: 'var(--ink-950)' }}>{meta.total}</b> application{meta.total !== 1 ? 's' : ''}
            {stage ? ` in "${STAGE_LABELS[stage]}"` : ''}
          </div>
        )}

        {isLoading && <p className="student-empty">Loading applications…</p>}
        {isError   && <p className="student-empty">Couldn&apos;t load applications.</p>}

        {!isLoading && !isError && apps.length === 0 && (
          <div className="student-empty-state">
            <div className="student-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 3 14 8 19 8"/>
              </svg>
            </div>
            <h3>{stage ? 'No applications in this stage' : 'No applications yet'}</h3>
            <p>
              {stage
                ? 'Try a different filter above.'
                : 'Find a program you love and submit your application.'}
            </p>
            {stage ? (
              <button
                className="btn btn-outline"
                style={{ marginTop: 12 }}
                onClick={() => setStage('')}
              >
                Show all
              </button>
            ) : (
              <Link
                to="/programs"
                className="student-apply-btn"
                style={{ marginTop: 12 }}
              >
                Browse programs
              </Link>
            )}
          </div>
        )}

        {/* Application cards */}
        <div className="student-apps-list">
          {apps.map((app) => {
            const stageStyle = STAGE_COLOR[app.stage] ?? {};
            const inst       = app.course?.institution;
            return (
              <Link key={app.id} to={`/my-applications/${app.id}`} className="student-app-card">
                <div className="student-app-card-left">
                  <div className="student-app-ref">POEC #{app.reference}</div>
                  <div className="student-app-title">{app.course?.title}</div>
                  <div className="student-app-school">
                    {inst?.name ?? '—'}
                    {inst?.country?.code ? ` · ${inst.country.code}` : ''}
                    {inst?.country?.flagEmoji ? ` ${inst.country.flagEmoji}` : ''}
                  </div>
                  {app.intakeLabel && (
                    <div className="student-app-intake">Intake: {app.intakeLabel}</div>
                  )}
                  <div className="student-app-date">Applied {formatDate(app.createdAt)}</div>
                </div>
                <div className="student-app-card-right">
                  <span className="student-app-stage" style={stageStyle}>
                    {STAGE_LABELS[app.stage] ?? app.stage}
                  </span>
                  {app.stageNote && (
                    <div className="student-app-note">{app.stageNote}</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            maxPage={meta.maxPage}
            total={meta.total}
            pageSize={meta.pageSize}
            onChange={setPage}
          />
        )}
      </div>
    </div>
  );
}

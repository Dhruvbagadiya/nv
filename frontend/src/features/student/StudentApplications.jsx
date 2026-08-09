import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchStudentApplications } from '../../api/students.js';
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
  PROFILE_ASSESSMENT:  { bg: 'var(--ink-100)',    color: 'var(--ink-600)' },
  APPLICATION:         { bg: 'var(--info-100)',    color: 'var(--info-700)' },
  CONDITIONAL_OFFER:   { bg: 'var(--warning-100)', color: 'var(--warning-700)' },
  UNCONDITIONAL_OFFER: { bg: 'var(--success-100)', color: 'var(--success-700)' },
  FEES_PAYMENT:        { bg: 'var(--warning-100)', color: 'var(--warning-700)' },
  CAS_LETTER:          { bg: 'var(--info-100)',    color: 'var(--info-700)' },
  VISA_APPLICATION:    { bg: 'var(--purple-100)',  color: 'var(--purple-700)' },
  VISA_APPROVAL:       { bg: 'var(--success-100)', color: 'var(--success-700)' },
};

export default function StudentApplications() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['student-applications'],
    queryFn: () => fetchStudentApplications({ pageSize: 50 }),
  });

  const apps = data?.items ?? [];

  return (
    <div className="student-apps-page">
      <div className="student-apps-inner">
        <div className="student-apps-header">
          <div>
            <h1>My Applications</h1>
            <p>Track the status of every program you&rsquo;ve applied to</p>
          </div>
          <Link to="/programs" className="student-apply-btn" style={{ textDecoration: 'none' }}>
            Browse programs
          </Link>
        </div>

        {isLoading && <p className="student-empty">Loading applications…</p>}
        {isError   && <p className="student-empty">Couldn&rsquo;t load applications.</p>}

        {!isLoading && !isError && apps.length === 0 && (
          <div className="student-empty-state">
            <div className="student-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 3 14 8 19 8"/>
              </svg>
            </div>
            <h3>No applications yet</h3>
            <p>Find a program you love and submit your application.</p>
            <Link to="/programs" className="student-apply-btn" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 12 }}>
              Browse programs
            </Link>
          </div>
        )}

        <div className="student-apps-list">
          {apps.map((app) => {
            const stageStyle = STAGE_COLOR[app.stage] ?? {};
            const inst = app.course?.institution;
            return (
              <Link key={app.id} to={`/my-applications/${app.id}`} className="student-app-card">
                <div className="student-app-card-left">
                  <div className="student-app-ref">POEC #{app.reference}</div>
                  <div className="student-app-title">{app.course?.title}</div>
                  <div className="student-app-school">
                    {inst?.name}
                    {inst?.country?.code ? ` · ${inst.country.code}` : ''}
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
      </div>
    </div>
  );
}

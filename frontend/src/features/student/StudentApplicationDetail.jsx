import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchStudentApplication } from '../../api/students.js';
import { formatDate, } from '../../utils/format.js';
import Icon from '../../components/ui/Icon.jsx';

const STAGES = [
  'PROFILE_ASSESSMENT', 'APPLICATION', 'CONDITIONAL_OFFER',
  'UNCONDITIONAL_OFFER', 'FEES_PAYMENT', 'CAS_LETTER',
  'VISA_APPLICATION', 'VISA_APPROVAL',
];
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

export default function StudentApplicationDetail() {
  const { id } = useParams();

  const { data: app, isLoading, isError } = useQuery({
    queryKey: ['student-application', id],
    queryFn: () => fetchStudentApplication(id),
  });

  if (isLoading) return <div className="student-detail-loading">Loading…</div>;
  if (isError || !app) return <div className="student-detail-loading">Application not found.</div>;

  const currentIdx = STAGES.indexOf(app.stage);
  const inst = app.course?.institution;
  const attr = app.course;

  return (
    <div className="student-apps-page">
      <div className="student-apps-inner">
        <Link to="/my-applications" className="student-back-link">← My applications</Link>

        <div className="student-app-detail-header">
          <div>
            <div className="student-app-ref" style={{ fontSize: 13 }}>POEC #{app.reference}</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800 }}>{attr?.title}</h1>
            <div style={{ color: 'var(--ink-500)', fontSize: 13, marginTop: 2 }}>
              {inst?.name} · {inst?.country?.name}
              {app.intakeLabel ? ` · ${app.intakeLabel}` : ''}
            </div>
          </div>
          {app.deadlineAt && (
            <div className="student-deadline-badge">
              Deadline: {formatDate(app.deadlineAt)}
            </div>
          )}
        </div>

        {/* Progress tracker */}
        <div className="student-progress-track">
          {STAGES.map((stage, i) => (
            <div key={stage} className={`student-progress-step${i <= currentIdx ? ' done' : ''}${i === currentIdx ? ' current' : ''}`}>
              <div className="student-progress-dot">{i < currentIdx ? <Icon name="check" size={12} /> : i + 1}</div>
              <div className="student-progress-label">{STAGE_LABELS[stage]}</div>
            </div>
          ))}
        </div>

        {/* Status note */}
        {app.stageNote && (
          <div className="student-status-note">
            <strong>Status:</strong> {app.stageNote}
          </div>
        )}

        {/* Details */}
        <div className="student-app-detail-grid">
          <div className="student-app-detail-item">
            <div className="student-meta-label">Student name</div>
            <div className="student-meta-val">{app.studentName}</div>
          </div>
          <div className="student-app-detail-item">
            <div className="student-meta-label">Passport number</div>
            <div className="student-meta-val">{app.passportNo}</div>
          </div>
          <div className="student-app-detail-item">
            <div className="student-meta-label">Applied on</div>
            <div className="student-meta-val">{formatDate(app.createdAt)}</div>
          </div>
          <div className="student-app-detail-item">
            <div className="student-meta-label">Current stage</div>
            <div className="student-meta-val">{STAGE_LABELS[app.stage] ?? app.stage}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

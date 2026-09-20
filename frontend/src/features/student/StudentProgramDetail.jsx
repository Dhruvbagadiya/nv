import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCourse } from '../../api/courses.js';
import { formatFee, formatApplicationFee, formatDuration } from '../../utils/format.js';
import { useAuth } from '../../store/useAuth.js';

export default function StudentProgramDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['course', id],
    queryFn: () => fetchCourse(id),
  });

  if (isLoading) return <div className="student-detail-loading">Loading program details…</div>;
  if (isError || !data?.data) return <div className="student-detail-loading">Program not found.</div>;

  const program = data.data;
  const a = program.attributes;
  const initials = a.school.name.slice(0, 2).toUpperCase();

  const handleApply = () => {
    if (!user) {
      navigate('/login', { state: { from: `/programs/${id}` } });
    } else {
      navigate(`/apply/${id}`);
    }
  };

  return (
    <div className="student-detail">
      <div className="student-detail-inner">
        {/* Back */}
        <Link to="/programs" className="student-back-link">← Back to programs</Link>

        {/* Header card */}
        <div className="student-detail-header">
          <div className="student-detail-school-row">
            {a.school.logoThumbnailUrl
              ? <img src={a.school.logoThumbnailUrl} alt="" className="student-detail-logo" />
              : <div className="student-detail-logo-fallback">{initials}</div>
            }
            <div>
              <div className="student-detail-school">{a.school.name}</div>
              <div className="student-detail-loc">
                {a.school.city ? `${a.school.city}, ` : ''}{a.school.province ? `${a.school.province}, ` : ''}{a.school.countryCode}
              </div>
            </div>
          </div>
          <div className="student-detail-level">{a.programLevel?.replace(/_/g, ' ')}</div>
          <h1 className="student-detail-title">{a.name}</h1>

          <div className="student-detail-stats">
            <div className="student-detail-stat">
              <div className="student-detail-stat-label">Tuition (1st yr)</div>
              <div className="student-detail-stat-val">{formatFee(a.tuition, a.currency)}</div>
            </div>
            <div className="student-detail-stat">
              <div className="student-detail-stat-label">Application fee</div>
              <div className="student-detail-stat-val">
                {formatApplicationFee(a.applicationFee, a.currency) ?? 'Not published'}
              </div>
            </div>
            <div className="student-detail-stat">
              <div className="student-detail-stat-label">Duration</div>
              <div className="student-detail-stat-val">
                {formatDuration(a.minLength, a.maxLength) ?? 'Not published'}
              </div>
            </div>
            <div className="student-detail-stat">
              <div className="student-detail-stat-label">Language</div>
              <div className="student-detail-stat-val">{a.languageOfInstructionCode?.toUpperCase()}</div>
            </div>
          </div>

          <button className="student-apply-btn" onClick={handleApply}>
            Apply now
          </button>
        </div>

        {/* Intakes */}
        {a.programIntakes?.length > 0 && (
          <div className="student-detail-section">
            <h2>Available intakes</h2>
            <div className="student-intakes-grid">
              {a.programIntakes.map((intake) => (
                <div key={intake.id} className="student-intake-card">
                  <div className="student-intake-start">
                    {new Date(intake.startDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </div>
                  {intake.submissionDeadline && (
                    <div className="student-intake-deadline">
                      Deadline: {new Date(intake.submissionDeadline).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                  {intake.openDate && (
                    <div className="student-intake-open">
                      Opens: {new Date(intake.openDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {a.tags?.length > 0 && (
          <div className="student-detail-section">
            <h2>Highlights</h2>
            <div className="student-tags">
              {a.tags.map((t) => (
                <span key={t} className="student-tag">
                  {t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              ))}
            </div>
          </div>
        )}

        {/*
          The second CTA that used to sit here — a navy "Ready to apply?" panel
          with a "Start application" button — called the IDENTICAL handleApply as
          the "Apply now" button above, and both were on screen at once. Two
          buttons for one action is a choice the reader has to resolve before
          acting, and the panel's --brand-800 navy had no relationship to the
          orange it sat beside. The primary action stays where the fees and
          duration it depends on are.
        */}
      </div>
    </div>
  );
}

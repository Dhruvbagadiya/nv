import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useInvalidateResource } from '../../hooks/useInvalidateResource.js';
import { fetchCourse } from '../../api/courses.js';
import { createStudentApplication } from '../../api/students.js';
import { useAuth } from '../../store/useAuth.js';
import { formatFee } from '../../utils/format.js';

export default function StudentApplyForm() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const [form, setForm] = useState({
    studentName: user?.name ?? '',
    passportNo:  '',
    intakeLabel: '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const { data: courseResp, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => fetchCourse(courseId),
  });
  const course = courseResp?.data;
  const attr   = course?.attributes;

  const invalidateApplications = useInvalidateResource('applications');

  const mutation = useMutation({
    mutationFn: () => createStudentApplication({
      courseId,
      studentName: form.studentName,
      passportNo:  form.passportNo,
      intakeLabel: form.intakeLabel || undefined,
    }),
    onSuccess: (app) => {
      // The list this navigates to is cached and stays fresh for 30s
      // (main.jsx), so a user who was just looking at it comes back to the old
      // set with the row they just created missing.
      invalidateApplications();
      navigate(`/my-applications/${app.id}`);
    },
  });

  if (courseLoading) return <div className="student-detail-loading">Loading…</div>;
  if (!attr)         return <div className="student-detail-loading">Program not found.</div>;

  const intakeLabels = (attr.programIntakes ?? []).map((i) => ({
    id:    i.id,
    label: new Date(i.startDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  }));

  /*
   * Mirrors the server, which refuses this submission outright — see the guard
   * in students.service.js. Disabling the button is the courtesy that explains
   * why; the server is the thing that actually enforces it, because this route
   * takes a JSON body and a disabled attribute stops nobody.
   */
  const verified = Boolean(user?.emailVerifiedAt);

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="student-apply-page">
      <div className="student-apply-inner">
        <Link to={`/programs/${courseId}`} className="student-back-link">← Back to program</Link>
        <h1 className="student-apply-heading">Apply for this program</h1>

        {/* Program summary */}
        <div className="student-apply-summary">
          <div className="student-apply-summary-title">{attr.name}</div>
          <div className="student-apply-summary-school">
            {attr.school.name} · {attr.school.countryCode}
          </div>
          <div className="student-apply-summary-fee">
            Tuition: {formatFee(attr.tuition, attr.currency)}
            {Number(attr.applicationFee) > 0 && (
              <> · App fee: {formatFee(attr.applicationFee, attr.currency)}</>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="student-apply-form">
          <div className="student-apply-field">
            <label htmlFor="a-name">Full name (as on passport) *</label>
            <input id="a-name" type="text" value={form.studentName}
              onChange={(e) => set('studentName', e.target.value)} required />
          </div>
          <div className="student-apply-field">
            <label htmlFor="a-passport">Passport number *</label>
            <input id="a-passport" type="text" value={form.passportNo}
              onChange={(e) => set('passportNo', e.target.value)}
              minLength={4} maxLength={40} required
              placeholder="e.g. P1234567" />
          </div>
          {intakeLabels.length > 0 && (
            <div className="student-apply-field">
              <label htmlFor="a-intake">Preferred intake</label>
              <select id="a-intake" value={form.intakeLabel}
                onChange={(e) => set('intakeLabel', e.target.value)}>
                <option value="">No preference</option>
                {intakeLabels.map((i) => (
                  <option key={i.id} value={i.label}>{i.label}</option>
                ))}
              </select>
            </div>
          )}

          {mutation.isError && (
            <div className="student-auth-error">
              {mutation.error?.response?.data?.error ?? 'Submission failed. Please try again.'}
            </div>
          )}

          <div className="student-apply-actions">
            <Link to={`/programs/${courseId}`} className="student-apply-cancel">Cancel</Link>
            {!verified && (
              <p className="student-auth-sub" style={{ marginBottom: 10 }}>
                Confirm your email address before submitting. Use the banner at the
                top of the page to send a new link.
              </p>
            )}
            <button
              type="submit"
              className="student-apply-btn"
              disabled={mutation.isPending || !verified}
              title={verified ? undefined : 'Confirm your email address first'}
            >
              {mutation.isPending ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

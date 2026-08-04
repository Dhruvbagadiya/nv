import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { createApplication } from '../../api/applications.js';
import { fetchCourse } from '../../api/courses.js';
import Page from '../../components/ui/Page.jsx';
import CoursePicker from './CoursePicker.jsx';
import { formatFee } from '../../utils/format.js';

export default function NewApplication() {
  const navigate = useNavigate();
  // Arriving from a course card's "Create application" button, which used to have
  // no onClick at all.
  const [searchParams] = useSearchParams();
  const preselectedCourseId = searchParams.get('courseId') ?? '';

  const [form, setForm] = useState({
    studentName: '',
    passportNo: '',
    courseId: preselectedCourseId,
    intakeLabel: '',
  });

  // Resolved separately from the picker so the chosen course is always shown with
  // its institution and intakes, even when it is not in the current search results.
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', form.courseId],
    queryFn: () => fetchCourse(form.courseId),
    enabled: Boolean(form.courseId),
  });

  const mutation = useMutation({
    mutationFn: createApplication,
    onSuccess: (application) => navigate(`/app-history?studentName=${encodeURIComponent(application.studentName)}`),
  });

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const currency = course?.institution?.country?.currencyCode ?? 'USD';
  // The API rejects an unknown or archived course with a 404 naming the problem,
  // rather than letting Prisma raise an opaque FK error as a 500.
  const errorMessage =
    mutation.error?.response?.data?.error ??
    (mutation.isError ? 'Couldn’t submit — check every field is filled in.' : null);

  return (
    <Page
      title="New application"
      subtitle="Let’s start by setting your preferences"
      actions={
        <Link className="btn btn-outline" to="/dashboard">
          Browse courses
        </Link>
      }
    >
      <form className="form-card" onSubmit={handleSubmit}>
        <h2>Give us your choice of study</h2>
        <div className="sub">Taking the first step toward studying abroad</div>

        <div className="field">
          <div style={{ width: '100%' }}>
            <div className="flabel">Student name</div>
            <input
              type="text"
              value={form.studentName}
              onChange={(e) => setField('studentName', e.target.value)}
              placeholder="As written in the passport"
              required
            />
          </div>
        </div>

        <div className="field">
          <div style={{ width: '100%' }}>
            <div className="flabel">Passport number</div>
            <input
              type="text"
              value={form.passportNo}
              onChange={(e) => setField('passportNo', e.target.value)}
              // Bounds mirror the API schema so the form fails before the request.
              minLength={4}
              maxLength={40}
              required
            />
          </div>
        </div>

        <div className="field">
          <div style={{ width: '100%' }}>
            <div className="flabel">Course</div>

            {form.courseId && (
              <div className="selected-course">
                {courseLoading ? (
                  <span>Loading course…</span>
                ) : course ? (
                  <>
                    <div>
                      <div className="cell-strong">{course.title}</div>
                      <div className="picker-sub">
                        {course.institution.name} · {course.institution.country.name} ·{' '}
                        {formatFee(course.tuitionFee, currency)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setField('courseId', '')}
                    >
                      Change
                    </button>
                  </>
                ) : (
                  <span>That course is no longer available. Pick another below.</span>
                )}
              </div>
            )}

            {!form.courseId && (
              <CoursePicker value={form.courseId} onChange={(id) => setField('courseId', id)} />
            )}
          </div>
        </div>

        {/* Intakes come from the selected course, so this only appears once one is
            chosen — an intake dropdown with nothing in it is the bug this screen
            already had. */}
        {course?.intakes?.length > 0 && (
          <div className="field">
            <div style={{ width: '100%' }}>
              <div className="flabel">Intake</div>
              <select
                value={form.intakeLabel}
                onChange={(e) => setField('intakeLabel', e.target.value)}
                required
              >
                <option value="">Select an intake</option>
                {course.intakes.map((intake) => (
                  <option key={intake} value={intake}>
                    {intake}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {errorMessage && <p className="form-error">{errorMessage}</p>}

        <div className="submit-row">
          <button
            className="btn btn-primary"
            type="submit"
            // Disabled without a course rather than letting the submit fail: the
            // old form could never satisfy this field at all.
            disabled={mutation.isPending || !form.courseId}
          >
            {mutation.isPending ? 'Submitting…' : 'Proceed for application'}
          </button>
        </div>
      </form>
    </Page>
  );
}

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createInquiry } from '../../api/courseInquiries.js';

export default function CourseInquiryForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nationality: 'Indian', countryId: '', intake: '', courseType: '' });

  const mutation = useMutation({
    mutationFn: createInquiry,
    onSuccess: () => navigate('/history'),
  });

  return (
    <div className="view active" id="view-ask-team">
      <div className="page-head">
        <div>
          <h1>New course inquiry</h1>
          <p>Let's start by setting your preferences</p>
        </div>
      </div>

      <form
        className="form-card"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(form);
        }}
      >
        <h2>Give us your choice of study</h2>
        <div className="sub">Taking the first step toward studying abroad</div>

        <div className="field">
          <div>
            <div className="flabel">Student nationality</div>
            <input
              type="text"
              value={form.nationality}
              onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
            />
          </div>
        </div>
        <div className="field">
          <div>
            <div className="flabel">Preferred intake</div>
            <input
              type="text"
              placeholder="e.g. Jan 2027"
              value={form.intake}
              onChange={(e) => setForm((f) => ({ ...f, intake: e.target.value }))}
            />
          </div>
        </div>
        <div className="field">
          <div>
            <div className="flabel">Course type</div>
            <input
              type="text"
              placeholder="e.g. Master's Degree"
              value={form.courseType}
              onChange={(e) => setForm((f) => ({ ...f, courseType: e.target.value }))}
            />
          </div>
        </div>

        <div className="submit-row">
          <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Submitting...' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}

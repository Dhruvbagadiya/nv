import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createApplication } from '../../api/applications.js';

export default function NewApplication() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ studentName: '', passportNo: '', courseId: '' });

  const mutation = useMutation({
    mutationFn: createApplication,
    onSuccess: () => navigate('/app-history'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <div className="view active" id="view-add-application">
      <div className="page-head">
        <div>
          <h1>New application</h1>
          <p>Let's start by setting your preferences</p>
        </div>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <h2>Give us your choice of study</h2>
        <div className="sub">Taking the first step toward studying abroad</div>

        <div className="field">
          <div>
            <div className="flabel">Student name</div>
            <input
              type="text"
              value={form.studentName}
              onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))}
              required
            />
          </div>
        </div>
        <div className="field">
          <div>
            <div className="flabel">Passport number</div>
            <input
              type="text"
              value={form.passportNo}
              onChange={(e) => setForm((f) => ({ ...f, passportNo: e.target.value }))}
              required
            />
          </div>
        </div>
        <div className="field">
          <div>
            <div className="flabel">Course</div>
            <select
              value={form.courseId}
              onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
              required
            >
              <option value="">Select a course from the Dashboard first</option>
              {/* TODO: populate from the course the agent selected, or a search field here */}
            </select>
          </div>
        </div>

        {mutation.isError && <p className="empty-state">Couldn't submit — check all fields are filled.</p>}

        <div className="submit-row">
          <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Submitting...' : 'Proceed for application'}
          </button>
        </div>
      </form>
    </div>
  );
}

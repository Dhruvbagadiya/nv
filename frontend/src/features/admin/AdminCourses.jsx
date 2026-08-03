import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCourses, createCourse, deleteCourse } from '../../api/courses.js';
import { fetchInstitutions } from '../../api/institutions.js';
import Page from '../../components/ui/Page.jsx';

const emptyForm = {
  institutionId: '',
  title: '',
  degreeLevel: "Master's Degree",
  city: '',
  tuitionFee: '',
  applicationFee: '',
  durationText: '',
};

export default function AdminCourses() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['courses', 'admin-list'],
    queryFn: () => fetchCourses({ page: 1 }),
  });
  const { data: institutions = [] } = useQuery({
    queryKey: ['institutions'],
    queryFn: () => fetchInstitutions(),
  });

  const createMutation = useMutation({
    mutationFn: (payload) =>
      createCourse({
        ...payload,
        tuitionFee: Number(payload.tuitionFee),
        applicationFee: Number(payload.applicationFee),
        tags: [],
        status: [],
        intakes: [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
  });

  return (
    <Page title="Courses" subtitle="Manage the course catalog agents search from the Dashboard">

      <div className="form-card" style={{ maxWidth: 560, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16 }}>Add course</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
        >
          <div className="field">
            <div style={{ width: '100%' }}>
              <div className="flabel">Institution</div>
              <select
                value={form.institutionId}
                onChange={(e) => setForm((f) => ({ ...f, institutionId: e.target.value }))}
                required
              >
                <option value="">Select institution</option>
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <div style={{ width: '100%' }}>
              <div className="flabel">Course title</div>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Master of Science - Data Analytics"
                required
              />
            </div>
          </div>
          <div className="field">
            <div style={{ width: '100%' }}>
              <div className="flabel">City</div>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="field">
            <div style={{ width: '100%' }}>
              <div className="flabel">Tuition fee (1st yr)</div>
              <input
                type="number"
                value={form.tuitionFee}
                onChange={(e) => setForm((f) => ({ ...f, tuitionFee: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="field">
            <div style={{ width: '100%' }}>
              <div className="flabel">Application fee</div>
              <input
                type="number"
                value={form.applicationFee}
                onChange={(e) => setForm((f) => ({ ...f, applicationFee: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="field">
            <div style={{ width: '100%' }}>
              <div className="flabel">Duration</div>
              <input
                type="text"
                value={form.durationText}
                onChange={(e) => setForm((f) => ({ ...f, durationText: e.target.value }))}
                placeholder="e.g. 12 - 24 months"
                required
              />
            </div>
          </div>
          <div className="submit-row">
            <button className="btn btn-primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding...' : 'Add course'}
            </button>
          </div>
        </form>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Institution</th>
              <th>Tuition</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4}>Loading...</td></tr>}
            {data?.items.map((c) => (
              <tr key={c.id}>
                <td className="cell-strong">{c.title}</td>
                <td>{c.institution.name}</td>
                <td>${c.tuitionFee} CAD</td>
                <td>
                  <button
                    className="btn btn-outline"
                    onClick={() => deleteMutation.mutate(c.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}

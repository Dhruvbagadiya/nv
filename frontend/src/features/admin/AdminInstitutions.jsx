import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchInstitutions, createInstitution, setBlacklist } from '../../api/institutions.js';
import Page from '../../components/ui/Page.jsx';

export default function AdminInstitutions() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', countryId: '' });

  const { data: institutions = [], isLoading } = useQuery({
    queryKey: ['institutions'],
    queryFn: () => fetchInstitutions(),
  });

  const createMutation = useMutation({
    mutationFn: createInstitution,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] });
      setForm({ name: '', countryId: '' });
    },
  });

  const blacklistMutation = useMutation({
    mutationFn: ({ id, isBlacklisted }) => setBlacklist(id, isBlacklisted),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['institutions'] }),
  });

  return (
    <Page
      title="Institutions"
      subtitle="Manage the partner institutions your agents can search and apply to"
    >

      <div className="form-card" style={{ maxWidth: 480, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16 }}>Add institution</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
        >
          <div className="field">
            <div style={{ width: '100%' }}>
              <div className="flabel">Institution name</div>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Institution A"
                required
              />
            </div>
          </div>
          <div className="field">
            <div style={{ width: '100%' }}>
              <div className="flabel">Country ID</div>
              <input
                type="text"
                value={form.countryId}
                onChange={(e) => setForm((f) => ({ ...f, countryId: e.target.value }))}
                placeholder="Country UUID — see Prisma Studio until a country picker is built"
                required
              />
            </div>
          </div>
          <div className="submit-row">
            <button className="btn btn-primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding...' : 'Add institution'}
            </button>
          </div>
        </form>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Country</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4}>Loading...</td></tr>}
            {institutions.length === 0 && !isLoading && <tr><td colSpan={4}>No institutions yet</td></tr>}
            {institutions.map((inst) => (
              <tr key={inst.id}>
                <td className="cell-strong">{inst.name}</td>
                <td>{inst.country?.name}</td>
                <td>
                  {inst.isBlacklisted ? (
                    <span className="status-pill" style={{ background: 'var(--red-bg, #FCEBEA)', color: 'var(--red, #B3261E)' }}>
                      Blacklisted
                    </span>
                  ) : (
                    <span className="status-pill submission">Active</span>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-outline"
                    onClick={() => blacklistMutation.mutate({ id: inst.id, isBlacklisted: !inst.isBlacklisted })}
                    disabled={blacklistMutation.isPending}
                  >
                    {inst.isBlacklisted ? 'Remove from blacklist' : 'Blacklist'}
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { fetchAllUsers, createUser } from '../../api/admin.js';
import { formatDate } from '../../utils/format.js';

const FILTER_DEFAULTS = { role: '', search: '', page: 1 };

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN',       label: 'Admin' },
  { value: 'AGENT',       label: 'Agent' },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

const ROLE_COLORS = {
  SUPER_ADMIN: { background: 'var(--purple-100)', color: 'var(--purple-700)' },
  ADMIN:       { background: 'var(--info-100)',   color: 'var(--info-700)' },
  AGENT:       { background: 'var(--success-100)',color: 'var(--success-700)' },
};

function CreateUserModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'AGENT' });
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: createUser,
    onSuccess: onSaved,
    onError: (e) => setError(e.response?.data?.error ?? 'Could not create user.'),
  });

  const submit = (e) => {
    e.preventDefault();
    setError(null);
    save.mutate(form);
  };

  return (
    <Modal title="Create user" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-field">
          <label className="flabel" htmlFor="u-name">Full name *</label>
          <input id="u-name" type="text" value={form.name}
            onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="form-field">
          <label className="flabel" htmlFor="u-email">Email *</label>
          <input id="u-email" type="email" value={form.email}
            onChange={(e) => set('email', e.target.value)} required />
        </div>
        <div className="form-field">
          <label className="flabel" htmlFor="u-password">Password *</label>
          <input id="u-password" type="password" value={form.password}
            onChange={(e) => set('password', e.target.value)}
            required minLength={10} placeholder="Min 10 characters" />
        </div>
        <div className="form-field">
          <label className="flabel" htmlFor="u-role">Role *</label>
          <select id="u-role" value={form.role} onChange={(e) => set('role', e.target.value)} required>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="submit-row" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['admin-users', applied],
    queryFn: () => fetchAllUsers(applied),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const filterFields = [
    { name: 'role',   label: 'Role',   type: 'select', placeholder: 'All roles',    options: ROLES },
    { name: 'search', label: 'Search', type: 'text',   placeholder: 'Name or email' },
  ];

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(150deg, var(--accent-500), var(--accent-700))',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>
            {u.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <div className="cell-strong">{u.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <span className="status-pill" style={ROLE_COLORS[u.role] ?? {}}>
          {ROLE_LABEL[u.role] ?? u.role}
        </span>
      ),
    },
    {
      key: 'stats',
      header: 'Activity',
      render: (u) => (
        <div style={{ fontSize: 11, color: 'var(--ink-600)' }}>
          <div>{u.applicationCount} application{u.applicationCount !== 1 ? 's' : ''}</div>
          {u.subAgentCount > 0 && (
            <div>{u.subAgentCount} sub-agent{u.subAgentCount !== 1 ? 's' : ''}</div>
          )}
        </div>
      ),
    },
    {
      key: 'parentAgentId',
      header: 'Type',
      render: (u) => u.parentAgentId
        ? <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>Sub-agent</span>
        : <span style={{ fontSize: 11, color: 'var(--ink-700)', fontWeight: 600 }}>Direct</span>,
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (u) => <span className="cell-mono" style={{ fontSize: 11 }}>{formatDate(u.createdAt)}</span>,
    },
  ];

  return (
    <Page
      title="Users"
      subtitle="All portal accounts — agents, admins and super admins"
      actions={<button className="btn btn-primary" onClick={() => setCreating(true)}>Create user</button>}
    >
      <FilterBar fields={filterFields} values={draft} onChange={setField}
        onApply={apply} onClear={clear} busy={isFetching} />

      <DataTable
        columns={columns}
        rows={data?.items}
        isLoading={isLoading}
        isError={isError}
        emptyMessage="No users match these filters."
        meta={data?.meta}
        onPageChange={setPage}
        getRowKey={(r) => r.id}
      />

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onSaved={() => { invalidate(); setCreating(false); }}
        />
      )}
    </Page>
  );
}

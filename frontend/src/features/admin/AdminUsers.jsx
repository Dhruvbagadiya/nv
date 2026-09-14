import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FilterBar from '../../components/ui/FilterBar.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import {
  fetchAllUsers, createUser,
  fetchUserDetail, updateUserAdmin, setUserActive, revokeUserSessions, adminResetPassword,
} from '../../api/admin.js';
import { formatDate } from '../../utils/format.js';
import { applicationStageLabel } from '../../constants/referenceData.js';
import { toast } from '../../store/useToast.js';
import PasswordField from '../../components/ui/PasswordField.jsx';
import { invalidateResource } from '../../hooks/useInvalidateResource.js';

const FILTER_DEFAULTS = { role: '', search: '', page: 1 };

/**
 * Every role the product has — for the filter and for labelling a row.
 *
 * Not for the create and edit forms. There is one Super Admin and there is meant
 * to stay one: it is the account that can create users, change roles and reset
 * anyone's password, so a second is a second copy of the keys to everything,
 * handed out through a dropdown. ASSIGNABLE is what those two forms offer.
 *
 * SUPER_ADMIN stays HERE, though. Removing it from this list would also remove
 * it from the role filter and from ROLE_LABEL — so the one account that holds it
 * would become unfindable and would render its badge as the raw enum. What is
 * gone is the ability to mint one, not the concept.
 */
const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN',       label: 'Admin' },
  { value: 'AGENT',       label: 'Agent' },
  { value: 'STUDENT',     label: 'Student' },
];
// Mirrors ASSIGNABLE_ROLES in backend/src/modules/auth/auth.schemas.js, which is
// where this is actually enforced — the route takes a JSON body, so dropping an
// <option> changes what is easy, not what is possible.
const ASSIGNABLE = ROLES.filter((r) => r.value !== 'SUPER_ADMIN');
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));
const ROLE_COLORS = {
  SUPER_ADMIN: { background: 'var(--purple-100)', color: 'var(--purple-700)' },
  ADMIN:       { background: 'var(--info-100)',   color: 'var(--info-700)' },
  AGENT:       { background: 'var(--success-100)',color: 'var(--success-700)' },
  STUDENT:     { background: 'var(--accent-100)', color: 'var(--accent-700)' },
};

// ── Create user modal ─────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'AGENT' });
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({
    mutationFn: createUser,
    onSuccess: onSaved,
    onError: (e) => setError(e.response?.data?.error ?? 'Could not create user.'),
  });

  /**
   * The admin types a password the account's owner will have to be told, and
   * nothing here echoes it back afterwards — so a typo is not discovered by the
   * admin, it is discovered by the person who cannot log in.
   *
   * Shown only once the second field has something in it: a mismatch warning
   * that appears on the first keystroke is an error about work in progress.
   */
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;

  const submit = (e) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }
    // `confirm` is local to this form and not part of the API's body, which is
    // `.strict()` — sending it would be a 400 naming a field the admin never
    // knew existed.
    const { confirm: _confirm, ...payload } = form;
    save.mutate(payload);
  };

  return (
    <Modal title="Create user" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-field">
          <label className="flabel" htmlFor="u-name">Full name *</label>
          <input id="u-name" type="text" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="form-field">
          <label className="flabel" htmlFor="u-email">Email *</label>
          <input id="u-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        </div>
        <PasswordField
          id="u-password"
          label="Password *"
          value={form.password}
          onChange={(v) => set('password', v)}
          required
          minLength={10}
          placeholder="Min 10 characters"
          hint="At least 10 characters. Share it with the account holder and ask them to change it."
        />
        <PasswordField
          id="u-password-confirm"
          label="Confirm password *"
          value={form.confirm}
          onChange={(v) => set('confirm', v)}
          required
          placeholder="Type it again"
          error={mismatch ? 'The two passwords do not match.' : null}
        />
        <div className="form-field">
          <label className="flabel" htmlFor="u-role">Role *</label>
          <select id="u-role" value={form.role} onChange={(e) => set('role', e.target.value)} required>
            {ASSIGNABLE.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="submit-row" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending || mismatch}>
            {save.isPending ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── User detail panel ─────────────────────────────────────────────────────────
function UserDetailPanel({ userId, onClose }) {
  const queryClient = useQueryClient();
  const [editForm,    setEditForm]    = useState(null); // { name, role }
  const [editError,   setEditError]   = useState(null);
  const [resetForm,   setResetForm]   = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const { data: user, isLoading } = useQuery({
    queryKey: ['users', 'detail', userId],
    queryFn: () => fetchUserDetail(userId),
    enabled: Boolean(userId),
  });

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // RELATED_KEYS.users already lists the detail key and ['admin-stats'];
  // hand-rolling the first two here is what left the dashboard Users tile
  // showing the old count after every create and deactivate.
  const invalidate = () => invalidateResource(queryClient, 'users');

  const updateMut = useMutation({
    mutationFn: (payload) => updateUserAdmin(userId, payload),
    onSuccess: () => { setEditForm(null); setEditError(null); invalidate(); },
    onError: (e) => setEditError(e.response?.data?.error ?? 'Update failed.'),
  });

  const activeMut = useMutation({
    mutationFn: (v) => setUserActive(userId, v),
    onSuccess: () => { invalidate(); },
    onError: (e) => toast.error(e.response?.data?.error ?? 'Action failed.'),
  });

  const revokeMut = useMutation({
    mutationFn: () => revokeUserSessions(userId),
    onSuccess: (r) => {
      toast.success(`${r.revokedCount} session${r.revokedCount !== 1 ? 's' : ''} revoked.`);
      invalidate();
    },
    onError: (e) => toast.error(e.response?.data?.error ?? 'Action failed.'),
  });

  const resetMut = useMutation({
    mutationFn: (pwd) => adminResetPassword(userId, pwd),
    onSuccess: (r) => {
      toast.success(r.message);
      setResetForm(false);
      setNewPassword('');
      invalidate();
    },
    onError: (e) => toast.error(e.response?.data?.error ?? 'Reset failed.'),
  });

  if (isLoading) return <Modal title="User" onClose={onClose}><p className="picker-empty">Loading…</p></Modal>;
  if (!user) return <Modal title="User" onClose={onClose}><p className="form-error">Could not load user.</p></Modal>;

  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Modal title="User details" subtitle={user.email} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: user.avatarUrl ? 'transparent'
              : 'linear-gradient(150deg, var(--accent-500), var(--accent-700))',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, overflow: 'hidden',
          }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink-950)' }}>{user.name}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{user.email}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="status-pill" style={ROLE_COLORS[user.role] ?? {}}>{ROLE_LABEL[user.role] ?? user.role}</span>
              {!user.isActive && <span className="status-pill" style={{ background: 'var(--danger-100)', color: 'var(--danger-700)' }}>Deactivated</span>}
              {user.parentAgentId && <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>Sub-agent</span>}
              <span style={{ fontSize: 11, color: 'var(--ink-400)', marginLeft: 2 }}>Joined {formatDate(user.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* ── Activity summary ────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            ['Applications', user.applicationCount],
            ['Inquiries', user.inquiryCount],
            ['Sub-agents', user.subAgentCount],
          ].map(([label, value]) => (
            <div key={label} style={{
              background: 'var(--canvas)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '10px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-950)', fontFamily: 'var(--font-mono)' }}>{value ?? 0}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Recent applications ─────────────────────────────────────── */}
        {user.recentApplications?.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink-400)', marginBottom: 8 }}>
              Recent applications
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {user.recentApplications.slice(0, 5).map((app) => (
                <div key={app.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 10, background: 'var(--canvas)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '7px 10px', fontSize: 12,
                }}>
                  <div>
                    <div className="cell-strong" style={{ fontSize: 12 }}>{app.studentName}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{app.course?.institution?.name} · #{app.reference}</div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--info-100)', color: 'var(--info-700)', whiteSpace: 'nowrap' }}>
                    {applicationStageLabel(app.stage)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Active sessions ─────────────────────────────────────────── */}
        <div style={{
          background: 'var(--canvas)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', padding: '10px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--ink-950)' }}>
              {user.activeSessions} active session{user.activeSessions !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Devices currently signed in</div>
          </div>
          {user.activeSessions > 0 && (
            <button
              className="btn btn-outline"
              style={{ fontSize: 12 }}
              disabled={revokeMut.isPending}
              onClick={() => window.confirm('Sign out all devices for this user?') && revokeMut.mutate()}
            >
              {revokeMut.isPending ? 'Revoking…' : 'Revoke all sessions'}
            </button>
          )}
        </div>

        {/* ── Edit form ───────────────────────────────────────────────── */}
        {editForm ? (
          <div style={{ background: 'var(--accent-50)', border: '1px solid var(--accent-100)', borderRadius: 'var(--radius-sm)', padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-950)', marginBottom: 12 }}>Edit user</div>
            <form onSubmit={(e) => {
              e.preventDefault();
              setEditError(null);
              // No `role` key at all for a super admin — not the current value
              // re-sent, which is still a value the schema refuses.
              updateMut.mutate(isSuperAdmin ? { name: editForm.name } : editForm);
            }}>
              <div className="form-field">
                <label className="flabel" htmlFor="ue-name">Name</label>
                <input id="ue-name" type="text" value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-field">
                <label className="flabel" htmlFor="ue-role">Role</label>
                {/* A super admin's role is shown, not offered. With SUPER_ADMIN
                    gone from the options a <select> bound to it has no matching
                    option, so the browser displays the first one instead — and
                    renaming the account would submit a demotion nobody asked
                    for. The server refuses it, but the failure the admin sees
                    would be about a field they never touched. */}
                {isSuperAdmin ? (
                  <>
                    <input id="ue-role" type="text" value={ROLE_LABEL[user.role]} readOnly disabled />
                    <p className="field-hint">
                      There is one Super Admin, and the role cannot be reassigned here.
                    </p>
                  </>
                ) : (
                  <select id="ue-role" value={editForm.role}
                    onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                    {ASSIGNABLE.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                )}
              </div>
              {editError && <p className="form-error">{editError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={updateMut.isPending}>
                  {updateMut.isPending ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setEditForm(null)}>Cancel</button>
              </div>
            </form>
          </div>
        ) : (
          // Action row when not editing
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => { setResetForm(false); setEditForm({ name: user.name, role: user.role }); }}>
                Edit
              </button>
              <button
                className="btn btn-outline"
                style={{ color: 'var(--warning-700)' }}
                onClick={() => { setEditForm(null); setResetForm((v) => !v); setNewPassword(''); }}
              >
                Reset password
              </button>
              <button
                className="btn btn-outline"
                style={{ color: user.isActive ? 'var(--danger-700)' : 'var(--success-700)' }}
                disabled={activeMut.isPending}
                onClick={() => {
                  const msg = user.isActive
                    ? `Deactivate ${user.name}? They will be signed out immediately.`
                    : `Reactivate ${user.name}?`;
                  if (window.confirm(msg)) activeMut.mutate(!user.isActive);
                }}
              >
                {activeMut.isPending
                  ? (user.isActive ? 'Deactivating…' : 'Activating…')
                  : (user.isActive ? 'Deactivate' : 'Reactivate')}
              </button>
            </div>

            {/* Inline reset-password form */}
            {resetForm && (
              <div style={{
                background: 'var(--warning-100)', border: '1px solid var(--warning-700)',
                borderRadius: 'var(--radius-sm)', padding: 12,
              }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--ink-950)', marginBottom: 8 }}>
                  Set a new password for {user.name}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 10 chars)"
                    minLength={10}
                    style={{
                      flex: 1, minWidth: 200, height: 34,
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      padding: '0 10px', fontFamily: 'var(--font-sans)', fontSize: 13,
                      background: 'var(--canvas)',
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={resetMut.isPending || newPassword.length < 10}
                    onClick={() => {
                      if (window.confirm(`Reset password for ${user.name}? This will sign them out everywhere.`)) {
                        resetMut.mutate(newPassword);
                      }
                    }}
                  >
                    {resetMut.isPending ? 'Resetting…' : 'Confirm reset'}
                  </button>
                  <button className="btn btn-outline" onClick={() => { setResetForm(false); setNewPassword(''); }}>
                    Cancel
                  </button>
                </div>
                <div className="field-hint" style={{ marginTop: 6 }}>
                  The user will be signed out on all devices immediately.
                </div>
              </div>
            )}
          </div>
        )}

        <div className="modal-foot" style={{ padding: 0, justifyContent: 'flex-start' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const { applied, draft, setField, apply, clear, setPage } = useUrlFilters(FILTER_DEFAULTS);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['users', 'admin', applied],
    queryFn: () => fetchAllUsers(applied),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => invalidateResource(queryClient, 'users');

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
            width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
            background: u.avatarUrl ? 'transparent'
              : 'linear-gradient(150deg, var(--accent-500), var(--accent-700))',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>
            {u.avatarUrl
              ? <img src={u.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : u.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
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
        <span className="status-pill" style={ROLE_COLORS[u.role] ?? {}}>{ROLE_LABEL[u.role] ?? u.role}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => !u.isActive
        ? <span className="status-pill" style={{ background: 'var(--danger-100)', color: 'var(--danger-700)' }}>Deactivated</span>
        : <span style={{ fontSize: 11, color: 'var(--success-700)', fontWeight: 600 }}>Active</span>,
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
      key: 'type',
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
      subtitle="All portal accounts — click any row for details"
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
        onRowClick={(u) => setSelectedId(u.id)}
        rowLabel={(u) => `Open ${u.name ?? u.email}`}
        rowClickTitle="View user details"
      />

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onSaved={() => { invalidate(); setCreating(false); }}
        />
      )}

      {selectedId && (
        <UserDetailPanel
          userId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </Page>
  );
}

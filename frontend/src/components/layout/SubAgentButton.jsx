import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Modal from '../ui/Modal.jsx';
import { fetchSubAgents, createSubAgent, removeSubAgent } from '../../api/admin.js';
import { useAuth } from '../../store/useAuth.js';

// The header's person+ icon. The schema has supported this all along
// (User.parentAgent, and the seed ships one), and the application scoping already
// works — an agent sees 8 applications where an admin sees 11 — but there was no UI.
//
// One level deep by design: the API refuses a sub-agent creating sub-agents, since
// nothing models an arbitrary-depth tree.
export default function SubAgentButton() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const queryClient = useQueryClient();
  const user = useAuth((s) => s.user);

  const { data: subAgents = [], isLoading } = useQuery({
    queryKey: ['sub-agents'],
    queryFn: fetchSubAgents,
    enabled: open,
  });

  const create = useMutation({
    mutationFn: createSubAgent,
    onSuccess: (subAgent) => {
      queryClient.invalidateQueries({ queryKey: ['sub-agents'] });
      setCreated({ ...subAgent, password: form.password });
      setForm({ name: '', email: '', password: '' });
    },
  });

  const remove = useMutation({
    mutationFn: removeSubAgent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sub-agents'] }),
  });

  const close = () => {
    setOpen(false);
    setCreated(null);
    create.reset();
  };

  // Only a top-level agent can have sub-agents, so the button is hidden rather than
  // shown-and-rejected for everyone else.
  if (user?.role !== 'AGENT' || user?.parentAgentId) return null;

  const error =
    create.error?.response?.data?.error ??
    create.error?.response?.data?.details?.[0]?.message ??
    (create.error ? 'Could not create that sub-agent.' : null);

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        title="Team members"
        aria-label="Manage team members"
        onClick={() => setOpen(true)}
      >
        <svg
          className="icon-svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="16" y1="11" x2="22" y2="11" />
        </svg>
      </button>

      {open && (
        <Modal
          title="Your team"
          subtitle="Sub-agents can submit and track applications under your agency"
          onClose={close}
        >
          {created ? (
            <div>
              <p className="modal-text">
                <b>{created.name}</b> can now sign in. Pass these details on securely — the password
                is not shown again and there is no email delivery.
              </p>
              <div className="credential-box">
                <div>
                  <span className="flabel">Email</span>
                  <div className="cell-mono">{created.email}</div>
                </div>
                <div>
                  <span className="flabel">Password</span>
                  <div className="cell-mono">{created.password}</div>
                </div>
              </div>
              <div className="submit-row">
                <button type="button" className="btn btn-primary" onClick={() => setCreated(null)}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="subagent-list">
                {isLoading && <div className="picker-empty">Loading…</div>}
                {!isLoading && subAgents.length === 0 && (
                  <div className="picker-empty">You have no sub-agents yet.</div>
                )}
                {subAgents.map((s) => (
                  <div className="subagent-row" key={s.id}>
                    <div>
                      <div className="cell-strong">{s.name}</div>
                      <div className="picker-sub">{s.email}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="picker-sub">
                        {s.applicationCount} application{s.applicationCount === 1 ? '' : 's'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: 11, color: 'var(--danger-700)', padding: '0 6px', height: 24 }}
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(`Remove ${s.name} from your agency? Their account and applications are kept.`)) {
                            remove.mutate(s.id);
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate(form);
                }}
              >
                <h3 className="section-heading">Add a sub-agent</h3>
                <div className="form-field">
                  <label className="flabel" htmlFor="sa-name">
                    Name
                  </label>
                  <input
                    id="sa-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="flabel" htmlFor="sa-email">
                    Email
                  </label>
                  <input
                    id="sa-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="flabel" htmlFor="sa-password">
                    Temporary password
                  </label>
                  <input
                    id="sa-password"
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    minLength={10}
                    required
                  />
                  {/* Shown as text on purpose: the agent has to read it out to the
                      person it belongs to, so masking it would be theatre. */}
                  <div className="field-hint">
                    At least 10 characters. Visible so you can pass it on, then have them change it.
                  </div>
                </div>

                {error && <p className="form-error">{error}</p>}

                <div className="submit-row">
                  <button type="submit" className="btn btn-primary" disabled={create.isPending}>
                    {create.isPending ? 'Creating…' : 'Create sub-agent'}
                  </button>
                </div>
              </form>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

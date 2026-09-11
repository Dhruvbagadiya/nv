/**
 * ApplicationDetail
 *
 * Slide-in panel (modal) that shows the full detail of a single application
 * and lets ADMIN / SUPER_ADMIN advance the stage, add a stage note, and set a
 * deadline. Opened from ApplicationHistory by clicking any row.
 *
 * AGENT role can view but not advance — the stage-change form is hidden for them.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateResource } from '../../hooks/useInvalidateResource.js';
import Modal from '../../components/ui/Modal.jsx';
import { fetchApplication, advanceApplicationStage } from '../../api/applications.js';
import { APPLICATION_STAGES, applicationStageLabel } from '../../constants/referenceData.js';
import { useAuth } from '../../store/useAuth.js';
import { formatDate } from '../../utils/format.js';
import Flag from '../../components/ui/Flag.jsx';
import Icon from '../../components/ui/Icon.jsx';

const STAGE_COLOR = {
  PROFILE_ASSESSMENT:  { background: 'var(--ink-100)',    color: 'var(--ink-700)' },
  APPLICATION:         { background: 'var(--info-100)',   color: 'var(--info-700)' },
  CONDITIONAL_OFFER:   { background: 'var(--warning-100)',color: 'var(--warning-700)' },
  UNCONDITIONAL_OFFER: { background: 'var(--success-100)',color: 'var(--success-700)' },
  FEES_PAYMENT:        { background: 'var(--warning-100)',color: 'var(--warning-700)' },
  CAS_LETTER:          { background: 'var(--info-100)',   color: 'var(--info-700)' },
  VISA_APPLICATION:    { background: 'var(--purple-100)', color: 'var(--purple-700)' },
  VISA_APPROVAL:       { background: 'var(--success-100)',color: 'var(--success-700)' },
};

// Ordered list of stage values for the stepper
const STAGE_VALUES = APPLICATION_STAGES.map((s) => s.value);

export default function ApplicationDetail({ applicationId, onClose }) {
  const user = useAuth((s) => s.user);
  const canAdvance = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const queryClient = useQueryClient();

  const [stageForm, setStageForm] = useState(null); // null = closed, or { stage, stageNote, deadlineAt }
  const [advanceError, setAdvanceError] = useState(null);

  const { data: app, isLoading, isError } = useQuery({
    queryKey: ['application', applicationId],
    queryFn: () => fetchApplication(applicationId),
    enabled: Boolean(applicationId),
  });

  const mutation = useMutation({
    mutationFn: (payload) => advanceApplicationStage(applicationId, payload),
    onSuccess: () => {
      // This renders as a modal OVER the admin applications table, which reads
      // ['admin-applications', …] — a key the two lines here never touched, so
      // closing the modal showed the old stage in the row behind it. The Report
      // panel and the dashboard tile count stages too.
      invalidateResource(queryClient, 'applications');
      setStageForm(null);
      setAdvanceError(null);
    },
    onError: (e) => setAdvanceError(e.response?.data?.error ?? 'Could not update stage.'),
  });

  const openStageForm = (targetStage) => {
    setAdvanceError(null);
    setStageForm({
      stage: targetStage,
      stageNote: '',
      deadlineAt: '',
    });
  };

  const submitStage = (e) => {
    e.preventDefault();
    mutation.mutate({
      stage: stageForm.stage,
      stageNote: stageForm.stageNote || null,
      deadlineAt: stageForm.deadlineAt || null,
    });
  };

  const currentStageIdx = app ? STAGE_VALUES.indexOf(app.stage) : -1;

  return (
    <Modal
      title={app ? `POEC #${app.reference}` : 'Application'}
      subtitle={app ? `${app.studentName} · ${app.passportNo}` : undefined}
      onClose={onClose}
      wide
    >
      {isLoading && <p className="picker-empty">Loading application…</p>}
      {isError   && <p className="form-error">Could not load application.</p>}

      {app && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Course info ─────────────────────────────────────────────── */}
          <div style={{
            background: 'var(--canvas)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Flag
                emoji={app.course.institution.country.flagEmoji}
                code={app.course.institution.country.code}
                name={app.course.institution.country.name}
              />
              <span style={{ fontWeight: 600, color: 'var(--ink-700)', fontSize: 12 }}>
                {app.course.institution.name}
              </span>
            </div>
            <div className="cell-strong" style={{ marginBottom: 3 }}>{app.course.title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-500)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {app.intakeLabel && <span>Intake: {app.intakeLabel}</span>}
              <span>Agent: {app.agent?.name ?? '—'}</span>
              <span>Submitted: {formatDate(app.createdAt)}</span>
              {app.deadlineAt && (
                <span style={{ color: 'var(--warning-700)', fontWeight: 600 }}>
                  Deadline: {formatDate(app.deadlineAt)}
                </span>
              )}
            </div>
          </div>

          {/* ── Pipeline stepper ─────────────────────────────────────────── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink-400)', marginBottom: 10 }}>
              Application pipeline
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {APPLICATION_STAGES.map(({ value, label }, idx) => {
                const isPast    = idx < currentStageIdx;
                const isCurrent = idx === currentStageIdx;
                const isFuture  = idx > currentStageIdx;
                const sc = STAGE_COLOR[value] ?? {};
                return (
                  <div
                    key={value}
                    onClick={() => canAdvance && isFuture && openStageForm(value)}
                    title={canAdvance && isFuture ? `Advance to ${label}` : undefined}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${isCurrent ? 'var(--accent-600)' : 'var(--border)'}`,
                      background: isCurrent ? sc.background : isPast ? 'var(--canvas)' : 'var(--surface)',
                      opacity: isFuture && !canAdvance ? 0.45 : 1,
                      cursor: canAdvance && isFuture ? 'pointer' : 'default',
                      transition: 'border-color .12s, background .12s',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => { if (canAdvance && isFuture) e.currentTarget.style.borderColor = 'var(--accent-500)'; }}
                    onMouseLeave={(e) => { if (canAdvance && isFuture) e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <div style={{
                      fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.03em',
                      color: isCurrent ? sc.color : isPast ? 'var(--success-700)' : 'var(--ink-400)',
                      marginBottom: 3,
                    }}>
                      {isPast ? <><Icon name="check" size={11} /> Done</>
                        : isCurrent ? 'Current'
                        : canAdvance ? <><Icon name="arrow" size={11} /> Advance</>
                        : 'Pending'}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: isCurrent ? sc.color : 'var(--ink-700)', lineHeight: 1.2 }}>
                      {label}
                    </div>
                    {isCurrent && app.stageNote && (
                      <div style={{ fontSize: 10.5, color: 'var(--ink-500)', marginTop: 3 }}>
                        {app.stageNote}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {canAdvance && (
              <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 6 }}>
                Click any future stage to advance this application.
              </div>
            )}
          </div>

          {/* ── Stage advance form (inline, appears when a future stage is clicked) */}
          {stageForm && (
            <div style={{
              background: 'var(--accent-50)', border: '1px solid var(--accent-100)',
              borderRadius: 'var(--radius-sm)', padding: 14,
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-950)', marginBottom: 12 }}>
                Advance to: <span style={{ color: 'var(--accent-700)' }}>{applicationStageLabel(stageForm.stage)}</span>
              </div>
              <form onSubmit={submitStage}>
                <div className="form-field">
                  <label className="flabel" htmlFor="af-note">Stage note (optional)</label>
                  <input
                    id="af-note"
                    type="text"
                    value={stageForm.stageNote}
                    onChange={(e) => setStageForm((f) => ({ ...f, stageNote: e.target.value }))}
                    placeholder="e.g. Conditional offer issued, pending document upload"
                    maxLength={500}
                  />
                  <div className="field-hint">Shown to the agent on the application row.</div>
                </div>
                <div className="form-field">
                  <label className="flabel" htmlFor="af-deadline">Deadline (optional)</label>
                  <input
                    id="af-deadline"
                    type="date"
                    value={stageForm.deadlineAt}
                    onChange={(e) => setStageForm((f) => ({ ...f, deadlineAt: e.target.value }))}
                  />
                  <div className="field-hint">Appears in the agent&rsquo;s &ldquo;Upcoming Deadlines&rdquo; panel.</div>
                </div>
                {advanceError && <p className="form-error">{advanceError}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
                    {mutation.isPending ? 'Saving…' : `Confirm: ${applicationStageLabel(stageForm.stage)}`}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setStageForm(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Student info ─────────────────────────────────────────────── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '6px 20px', fontSize: 12.5,
          }}>
            {[
              ['Student name', app.studentName],
              ['Passport no.', app.passportNo],
              ['Last updated', formatDate(app.updatedAt)],
              ['POEC reference', `#${app.reference}`],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink-400)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="modal-foot" style={{ padding: 0, justifyContent: 'flex-start' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

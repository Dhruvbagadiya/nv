import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Flag from '../../components/ui/Flag.jsx';
import { useAuth } from '../../store/useAuth.js';
import { fetchReportSummary } from '../../api/referenceScreens.js';
import { fetchApplications } from '../../api/applications.js';
import { APPLICATION_STAGES, applicationStageLabel } from '../../constants/referenceData.js';
import { errorMessage, formatDate } from '../../utils/format.js';

/**
 * The partner's landing screen.
 *
 * The first version of this led with four large cards holding four numbers, and
 * on a real account it read: 3, 0, 0, 0. Four hundred-pixel cards of nothing,
 * then a row of eight more mostly reading zero, then two panels saying there was
 * nothing to show. All chrome, no information.
 *
 * The mistake was designing for a busy agency. A dashboard's ordinary state is
 * NEARLY EMPTY — a new partner, a quiet week — and it has to look deliberate
 * then, not just when the numbers are big.
 *
 * So the hierarchy is inverted. With three applications, the three applications
 * are more use than a count of them, and counts are a thin strip rather than the
 * headline. Anything with nothing in it is not rendered at all: an empty panel
 * takes the same room as a full one and pays nothing back.
 */

const WON = ['VISA_APPROVAL'];
const OFFERED = ['CONDITIONAL_OFFER', 'UNCONDITIONAL_OFFER'];
const sum = (counts, keys) => keys.reduce((n, k) => n + (counts[k] ?? 0), 0);

function daysUntil(value) {
  // The null check has to come FIRST. `new Date(null)` is the epoch, not an
  // Invalid Date, so an application with no deadline measured from 1970 and
  // rendered "20710d overdue" on every row. Same shape as Number(null) being 0.
  if (!value) return null;
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return null;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOfDay(then) - startOfDay(new Date())) / 86_400_000);
}

function Due({ value }) {
  const days = daysUntil(value);
  if (days === null) return <span className="pdash-due pdash-due--none">—</span>;
  const tone = days < 0 ? 'danger' : days <= 7 ? 'warning' : 'neutral';
  const text =
    days < 0 ? `${Math.abs(days)}d overdue`
      : days === 0 ? 'Today'
        : days === 1 ? 'Tomorrow'
          : `${days}d`;
  return <span className={`pdash-due pdash-due--${tone}`}>{text}</span>;
}

/** Shortcuts, so the screen is useful on day one with no data at all. */
const SHORTCUTS = [
  ['/partner/courses', 'Browse courses', 'course'],
  ['/partner/commission', 'Commission', 'commission'],
  ['/partner/doc-bank/Visa Document', 'Document bank', 'folder'],
  ['/partner/moi', 'MOI accepted', 'moi'],
  ['/partner/ug-requirements', 'Entry requirements', 'checklist'],
  ['/partner/important-updates', 'Important updates', 'megaphone'],
];

export default function PartnerDashboard() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const summary = useQuery({ queryKey: ['report-summary'], queryFn: fetchReportSummary });
  // The applications themselves, not a count of them. One extra request, and it
  // is what turns this from a scoreboard into something an agent can work from.
  const recent = useQuery({
    queryKey: ['applications', { dashboard: true }],
    queryFn: () => fetchApplications({ page: 1, pageSize: 6 }),
  });

  const actions = (
    <>
      <button className="btn btn-outline" onClick={() => navigate('/partner/ask-team')}>
        Ask our team
      </button>
      <button className="btn btn-primary" onClick={() => navigate('/partner/add-application')}>
        + Add new application
      </button>
    </>
  );

  const subtitle = `Welcome back, ${user?.name ?? 'partner'}`;

  if (summary.isLoading) {
    return (
      <Page title="Dashboard" subtitle={subtitle} actions={actions}>
        <div className="pdash-strip pdash-strip--skeleton" aria-busy="true" />
        <div className="pdash-card pdash-card--skeleton" />
      </Page>
    );
  }

  if (summary.isError || !summary.data) {
    return (
      <Page title="Dashboard" subtitle={subtitle} actions={actions}>
        <div className="empty-state">
          <span className="e-icon e-icon--danger" aria-hidden="true"><Icon name="alert" size={20} /></span>
          <h3>{errorMessage(summary.error, 'Could not load your dashboard.')}</h3>
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <button type="button" className="btn btn-primary" onClick={() => summary.refetch()}>
              Try again
            </button>
          </div>
        </div>
      </Page>
    );
  }

  const counts = summary.data.applications ?? {};
  const total = sum(counts, APPLICATION_STAGES.map((s) => s.value));
  const approved = sum(counts, WON);
  const dueSoon = (summary.data.deadlines ?? []).filter((d) => {
    const n = daysUntil(d.deadlineAt);
    return n !== null && n <= 7;
  }).length;

  const applications = recent.data?.items ?? [];
  const activity = summary.data.recentNotifications ?? [];
  // Only the stages carrying work. Eight segments, six of them zero-width, is a
  // bar that describes nothing.
  const occupied = APPLICATION_STAGES.filter((s) => (counts[s.value] ?? 0) > 0);

  return (
    <Page title="Dashboard" subtitle={subtitle} actions={actions}>
      {/* One line, not four cards. These are context for the list below, and
          giving a zero the same room as a real figure is what made the first
          version read as empty. */}
      <div className="pdash-strip">
        <Link className="pdash-kpi" to="/partner/app-history">
          <b>{total - approved}</b> active
        </Link>
        <Link className="pdash-kpi" to="/partner/app-history?stage=CONDITIONAL_OFFER">
          <b>{sum(counts, OFFERED)}</b> offers
        </Link>
        <Link className="pdash-kpi" to="/partner/app-history?stage=VISA_APPROVAL">
          <b>{approved}</b> visas approved
        </Link>
        <Link className={`pdash-kpi${dueSoon ? ' pdash-kpi--alert' : ''}`} to="/partner/app-history">
          <b>{dueSoon}</b> due this week
        </Link>
        <Link className="pdash-strip__more" to="/partner/report">Full report</Link>
      </div>

      {/* The distribution as ONE bar. Eight cards flattened the shape into a row
          of equal boxes; a bar shows where the work actually sits. */}
      {occupied.length > 0 && (
        <div className="pdash-bar" role="img" aria-label={`Pipeline: ${occupied.map((s) => `${counts[s.value]} in ${s.label}`).join(', ')}`}>
          {occupied.map((s, i) => (
            <span
              key={s.value}
              className={`pdash-bar__seg pdash-bar__seg--${i % 4}`}
              style={{ flexGrow: counts[s.value] }}
              title={`${s.label}: ${counts[s.value]}`}
            />
          ))}
        </div>
      )}
      {occupied.length > 0 && (
        <div className="pdash-legend">
          {occupied.map((s, i) => (
            <Link key={s.value} className="pdash-legend__item" to={`/partner/app-history?stage=${s.value}`}>
              <span className={`pdash-legend__dot pdash-bar__seg--${i % 4}`} aria-hidden="true" />
              {s.label} <b>{counts[s.value]}</b>
            </Link>
          ))}
        </div>
      )}

      <div className="pdash-grid">
        <section className="pdash-card">
          <div className="pdash-card__head">
            <h2>Your applications</h2>
            <Link className="pdash-card__more" to="/partner/app-history">All applications</Link>
          </div>

          {recent.isLoading && <p className="field-hint">Loading…</p>}
          {recent.isError && <p className="form-error">Couldn’t load your applications.</p>}

          {!recent.isLoading && !recent.isError && applications.length === 0 && (
            <div className="pdash-blank">
              <p>No applications yet.</p>
              <button className="btn btn-primary" onClick={() => navigate('/partner/add-application')}>
                Add your first application
              </button>
            </div>
          )}

          {applications.length > 0 && (
            <table className="pdash-table">
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td className="pdash-table__ref">#{a.reference}</td>
                    <td>
                      <div className="pdash-table__name">{a.studentName}</div>
                      <div className="pdash-table__sub">
                        <Flag
                          isoCode={a.course?.institution?.country?.isoCode}
                          code={a.course?.institution?.country?.code}
                          size={13}
                        />
                        {a.course?.institution?.name ?? '—'}
                      </div>
                    </td>
                    <td className="pdash-table__stage">{applicationStageLabel(a.stage)}</td>
                    <td className="pdash-table__due"><Due value={a.deadlineAt} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className="pdash-side">
          {activity.length > 0 && (
            <section className="pdash-card">
              <div className="pdash-card__head"><h2>Recent activity</h2></div>
              <ul className="pdash-feed">
                {activity.slice(0, 5).map((n) => (
                  <li key={n.id}>
                    <span className="pdash-feed__title">{n.title}</span>
                    <span className="pdash-feed__meta">{formatDate(n.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="pdash-card">
            <div className="pdash-card__head"><h2>Shortcuts</h2></div>
            <div className="pdash-shortcuts">
              {SHORTCUTS.map(([to, label, icon]) => (
                <Link key={to} className="pdash-shortcut" to={to}>
                  <Icon name={icon} size={15} />
                  {label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Page>
  );
}

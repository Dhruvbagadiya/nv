import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Flag from '../../components/ui/Flag.jsx';
import { useAuth } from '../../store/useAuth.js';
import { fetchReportSummary } from '../../api/referenceScreens.js';
import { APPLICATION_STAGES } from '../../constants/referenceData.js';
import { errorMessage, formatDate } from '../../utils/format.js';

/**
 * The partner's landing screen.
 *
 * /partner/dashboard used to be the course finder — a search box and a grid of
 * 93,000 programmes under a heading that said Dashboard. Browsing the catalogue
 * is a task, not a summary, so it moved to /partner/courses and this took its
 * place.
 *
 * Deliberately NOT the Report screen with a different heading. Report answers
 * "what are all the numbers": eight stage tiles, inquiry tiles, every panel laid
 * out flat. A dashboard answers a different question — what is the state of my
 * business and what needs me today — so it leads with four figures rather than
 * fourteen, gives the most urgent thing the most room, and every number is a way
 * into the list behind it.
 *
 * One request. /api/reports/summary already returns all of this in a single
 * payload, for exactly the reason stated in its own service: every panel is
 * needed at once and six round trips would each pay their own latency.
 */

/** Stages that mean the application is done with us. */
const WON = ['VISA_APPROVAL'];
/** Stages where an offer is in hand. */
const OFFERED = ['CONDITIONAL_OFFER', 'UNCONDITIONAL_OFFER'];

const sum = (counts, keys) => keys.reduce((n, k) => n + (counts[k] ?? 0), 0);

/** Days until a date, negative once it has passed. */
function daysUntil(value) {
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return null;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOfDay(then) - startOfDay(new Date())) / 86_400_000);
}

function DeadlineUrgency({ days }) {
  if (days === null) return null;
  // Three states, because "in 12 days" and "2 days overdue" call for different
  // reactions and the same grey text gives them the same weight.
  const tone = days < 0 ? 'danger' : days <= 7 ? 'warning' : 'neutral';
  const text =
    days < 0 ? `${Math.abs(days)}d overdue`
      : days === 0 ? 'Today'
        : days === 1 ? 'Tomorrow'
          : `in ${days} days`;
  return <span className={`pdash-due pdash-due--${tone}`}>{text}</span>;
}

function StatCard({ label, value, hint, to, tone = 'neutral', icon }) {
  const body = (
    <>
      <span className={`pdash-stat__icon pdash-stat__icon--${tone}`} aria-hidden="true">
        <Icon name={icon} size={17} />
      </span>
      <span className="pdash-stat__value">{value}</span>
      <span className="pdash-stat__label">{label}</span>
      {hint && <span className="pdash-stat__hint">{hint}</span>}
    </>
  );
  // Every figure goes somewhere. A number you cannot click is a dead end, which
  // is the complaint the Report tiles were built to answer in the first place.
  return to ? <Link className="pdash-stat" to={to}>{body}</Link> : <div className="pdash-stat">{body}</div>;
}

export default function PartnerDashboard() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const agency = useAuth((s) => s.agencyProfile);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['report-summary'],
    queryFn: fetchReportSummary,
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

  if (isLoading) {
    return (
      <Page title="Dashboard" subtitle={`Welcome back, ${user?.name ?? 'partner'}`} actions={actions}>
        <div className="pdash-stats" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="pdash-stat pdash-stat--skeleton" />)}
        </div>
      </Page>
    );
  }

  if (isError || !data) {
    return (
      <Page title="Dashboard" subtitle={`Welcome back, ${user?.name ?? 'partner'}`} actions={actions}>
        <div className="empty-state">
          <span className="e-icon e-icon--danger" aria-hidden="true"><Icon name="alert" size={20} /></span>
          <h3>{errorMessage(error, 'Could not load your dashboard.')}</h3>
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <button type="button" className="btn btn-primary" onClick={() => refetch()}>Try again</button>
          </div>
        </div>
      </Page>
    );
  }

  const counts = data.applications ?? {};
  const total = sum(counts, APPLICATION_STAGES.map((s) => s.value));
  const approved = sum(counts, WON);
  const offers = sum(counts, OFFERED);
  // "Active" excludes the ones that are finished, because an agent's working set
  // is what is still moving — a total that never goes down is not a workload.
  const active = total - approved;

  const deadlines = data.deadlines ?? [];
  const overdueOrSoon = deadlines.filter((d) => {
    const n = daysUntil(d.deadlineAt);
    return n !== null && n <= 7;
  }).length;

  const busiest = Math.max(1, ...APPLICATION_STAGES.map((s) => counts[s.value] ?? 0));

  return (
    <Page
      title="Dashboard"
      subtitle={agency?.agencyName ? `${user?.name ?? 'Welcome'} · ${agency.agencyName}` : `Welcome back, ${user?.name ?? 'partner'}`}
      actions={actions}
    >
      <div className="pdash-stats">
        <StatCard
          icon="application" label="Active applications" value={active}
          hint={total ? `${total} all time` : 'Nothing filed yet'}
          to="/partner/app-history"
        />
        <StatCard
          icon="check" tone="info" label="Offers in hand" value={offers}
          hint="Conditional and unconditional"
          to="/partner/app-history?stage=CONDITIONAL_OFFER"
        />
        <StatCard
          icon="plane" tone="success" label="Visas approved" value={approved}
          hint="Students on their way"
          to="/partner/app-history?stage=VISA_APPROVAL"
        />
        <StatCard
          icon="clock" tone={overdueOrSoon ? 'warning' : 'neutral'}
          label="Deadlines this week" value={overdueOrSoon}
          hint={deadlines.length ? `${deadlines.length} upcoming in total` : 'None scheduled'}
          to="/partner/app-history"
        />
      </div>

      {/* The pipeline as one object rather than eight cards. Where the work is
          piling up is a shape, and eight equal tiles flatten it away. */}
      <section className="pdash-panel">
        <div className="pdash-panel__head">
          <h2>Pipeline</h2>
          <Link className="pdash-panel__more" to="/partner/report">Full report</Link>
        </div>
        <ol className="pdash-pipeline">
          {APPLICATION_STAGES.map((stage) => {
            const n = counts[stage.value] ?? 0;
            return (
              <li key={stage.value}>
                <Link
                  className={`pdash-stage${n ? '' : ' pdash-stage--empty'}`}
                  to={`/partner/app-history?stage=${stage.value}`}
                >
                  <span className="pdash-stage__n">{n}</span>
                  <span className="pdash-stage__label">{stage.label}</span>
                  {/* Scaled against the busiest stage, so the bar compares
                      stages with each other rather than against a total that
                      makes every bar a sliver. */}
                  <span className="pdash-stage__bar" aria-hidden="true">
                    <span style={{ width: `${(n / busiest) * 100}%` }} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="pdash-columns">
        <section className="pdash-panel">
          <div className="pdash-panel__head">
            <h2>Needs attention</h2>
          </div>
          {deadlines.length === 0 ? (
            <p className="field-hint">No deadlines in the next few weeks.</p>
          ) : (
            <ul className="pdash-list">
              {deadlines.map((d) => (
                <li key={d.id}>
                  <Link to="/partner/app-history" className="pdash-item">
                    <span className="pdash-item__main">
                      <span className="pdash-item__title">{d.studentName}</span>
                      <span className="pdash-item__meta">
                        {d.course?.institution?.name ?? '—'}
                        {d.intakeLabel ? ` · ${d.intakeLabel}` : ''}
                        {` · ${formatDate(d.deadlineAt)}`}
                      </span>
                    </span>
                    <DeadlineUrgency days={daysUntil(d.deadlineAt)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pdash-panel">
          <div className="pdash-panel__head">
            <h2>Recent activity</h2>
          </div>
          {(data.recentNotifications ?? []).length === 0 ? (
            <p className="field-hint">Nothing yet. Updates on your applications appear here.</p>
          ) : (
            <ul className="pdash-list">
              {data.recentNotifications.slice(0, 6).map((n) => (
                <li key={n.id}>
                  <div className="pdash-item">
                    <span className="pdash-item__main">
                      <span className="pdash-item__title">{n.title}</span>
                      <span className="pdash-item__meta">
                        {n.application?.course?.institution?.name ?? n.body}
                        {` · ${formatDate(n.createdAt)}`}
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(data.trending ?? []).length > 0 && (
        <section className="pdash-panel">
          <div className="pdash-panel__head">
            <h2>Popular right now</h2>
            <Link className="pdash-panel__more" to="/partner/courses">Browse all courses</Link>
          </div>
          <ul className="pdash-trending">
            {data.trending.slice(0, 8).map((inst) => (
              <li key={inst.id}>
                <Link to={`/partner/courses?institutionId=${inst.id}`} className="pdash-uni">
                  <Flag
                    isoCode={inst.country?.isoCode}
                    code={inst.country?.code}
                    name={inst.country?.name}
                    size={16}
                  />
                  <span>{inst.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}

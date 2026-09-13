import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Flag from '../../components/ui/Flag.jsx';
import { useAuth } from '../../store/useAuth.js';
import { fetchReportSummary } from '../../api/referenceScreens.js';
import { fetchApplications } from '../../api/applications.js';
import {
  APPLICATION_STAGES,
  applicationStageLabel,
  courseInquiryStageLabel,
} from '../../constants/referenceData.js';
import { errorMessage, formatDate } from '../../utils/format.js';

/**
 * The partner's landing screen.
 *
 * Two things this screen has already been got wrong, both worth keeping in view.
 *
 * The FIRST version led with four large cards holding four numbers, and on a real
 * account it read 3 / 0 / 0 / 0 — four hundred-pixel cards of nothing, then two
 * panels saying there was nothing to show. The mistake was designing for a busy
 * agency. A dashboard's ordinary state is NEARLY EMPTY, and it has to look
 * deliberate then, not only when the numbers are big. So: anything with no rows
 * behind it is not rendered at all, and the applications themselves outrank any
 * count of them.
 *
 * The SECOND is the reason every panel here maps to a query. A dashboard is the
 * easiest screen in any product to fill with plausible furniture — a client
 * count, commission earned to date, a conversion rate — and the furniture is
 * indistinguishable from the real figures beside it. Every number on this page
 * comes from a row someone entered. Where the data does not exist, the panel
 * does not exist.
 */

const WON = ['VISA_APPROVAL'];
const OFFERED = ['CONDITIONAL_OFFER', 'UNCONDITIONAL_OFFER'];
const sum = (counts, keys) => keys.reduce((n, k) => n + (counts[k] ?? 0), 0);

/**
 * A class from the five-step chart ramp — one hue, light to dark. See --chart-*.
 *
 * Spread across the whole series rather than taken one step at a time, because
 * the series is longer than the ramp: there are eight pipeline stages and five
 * steps, and `i % 5` would have painted stage 6 the same colour as stage 1 —
 * the darkest part of the bar back at its lightest, halfway along. Spreading
 * keeps the ramp monotonic at any length, which is the only thing a sequential
 * ramp promises.
 */
const rampStep = (i, of) => `pdash-fill--${Math.min(5, Math.floor((i / Math.max(1, of)) * 5) + 1)}`;

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

/**
 * A KPI tile.
 *
 * `delta` is optional and almost always absent, which is the point. Only the
 * application count has a time dimension to compare against — every other figure
 * here is a live count of rows in a state, with no history stored anywhere, so a
 * "+12% on last month" beside it would be a number this product does not know.
 */
function Kpi({ to, value, label, delta, tone }) {
  return (
    <Link className={`pdash-tile${tone ? ` pdash-tile--${tone}` : ''}`} to={to}>
      <span className="pdash-tile__value">{value}</span>
      <span className="pdash-tile__label">{label}</span>
      {delta}
    </Link>
  );
}

/** "+3 on last month", or nothing at all in a partner's first month. */
function Delta({ now, before }) {
  if (before === 0) return null;
  const diff = now - before;
  if (diff === 0) return <span className="pdash-delta pdash-delta--flat">level with last month</span>;
  const pct = Math.round((diff / before) * 100);
  return (
    <span className={`pdash-delta pdash-delta--${diff > 0 ? 'up' : 'down'}`}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(pct)}% on last month
    </span>
  );
}

/**
 * A ranked breakdown as horizontal bars.
 *
 * The design this was drawn from used a donut. A donut asks the reader to compare
 * arc lengths around a circle and then match each one to a legend swatch; bars
 * put the name, the bar and the number on one line and sort them, so the ranking
 * is read rather than worked out. Same data, no decoding step.
 *
 * Bars are labelled on both sides because the ramp's light steps sit under 3:1
 * against the surface — the label carries the contrast, not the fill.
 */
function Bars({ rows, max }) {
  return (
    <ul className="pdash-bars">
      {rows.map((r, i) => (
        <li key={r.key}>
          <span className="pdash-bars__label">{r.label}</span>
          <span className="pdash-bars__track">
            {/* Never zero-width: a row present in the data with an invisible bar
                reads as a rendering fault rather than as a small number. */}
            <span
              className={`pdash-bars__fill ${rampStep(i, rows.length)}`}
              style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }}
            />
          </span>
          <span className="pdash-bars__value">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Shortcuts, so the screen is useful on day one with no data at all. */
const SHORTCUTS = [
  ['/partner/add-application', 'New application', 'plus'],
  ['/partner/courses', 'Browse courses', 'course'],
  ['/partner/commission', 'Commission', 'commission'],
  ['/partner/doc-bank/Visa Document', 'Document bank', 'folder'],
  ['/partner/moi', 'MOI accepted', 'moi'],
  ['/partner/ug-requirements', 'Entry requirements', 'checklist'],
  ['/partner/important-updates', 'Important updates', 'megaphone'],
  ['/partner/ask-team', 'Ask our team', 'headset'],
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
        <div className="pdash-tiles" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="pdash-tile pdash-tile--skeleton" />)}
        </div>
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

  const data = summary.data;
  const counts = data.applications ?? {};
  const total = sum(counts, APPLICATION_STAGES.map((s) => s.value));
  const approved = sum(counts, WON);
  const deadlines = data.deadlines ?? [];
  const dueSoon = deadlines.filter((d) => {
    const n = daysUntil(d.deadlineAt);
    return n !== null && n <= 7;
  }).length;

  const monthly = data.monthly ?? { thisMonth: 0, lastMonth: 0 };
  const awaiting = data.awaitingDocuments ?? 0;
  const inquiries = sum(data.courseInquiries ?? {}, Object.keys(data.courseInquiries ?? {}));

  const applications = recent.data?.items ?? [];
  const activity = data.recentNotifications ?? [];
  const byCountry = data.byCountry ?? [];
  const topCourses = data.topCourses ?? [];
  const recentInquiries = data.recentInquiries ?? [];

  // Only the stages carrying work. Eight segments, six of them zero-width, is a
  // bar that describes nothing.
  const occupied = APPLICATION_STAGES.filter((s) => (counts[s.value] ?? 0) > 0);
  const countryMax = Math.max(1, ...byCountry.map((c) => c.count));
  const courseMax = Math.max(1, ...topCourses.map((c) => c.count));

  return (
    <Page title="Dashboard" subtitle={subtitle} actions={actions}>
      <div className="pdash-tiles">
        <Kpi
          to="/partner/app-history"
          value={total}
          label="Total applications"
          delta={<Delta now={monthly.thisMonth} before={monthly.lastMonth} />}
        />
        <Kpi to="/partner/app-history" value={total - approved} label="In progress" />
        <Kpi to="/partner/app-history?stage=CONDITIONAL_OFFER" value={sum(counts, OFFERED)} label="Offers received" />
        <Kpi to="/partner/app-history?stage=VISA_APPROVAL" value={approved} label="Visas approved" tone="good" />
        <Kpi
          to="/partner/app-history"
          value={dueSoon}
          label="Due this week"
          tone={dueSoon ? 'warning' : undefined}
        />
        {/* The one tile that names work rather than progress: an application with
            nothing attached cannot move, whatever stage it is sitting in. */}
        <Kpi
          to="/partner/app-history"
          value={awaiting}
          label="Awaiting documents"
          tone={awaiting ? 'warning' : undefined}
        />
      </div>

      {/* The distribution as ONE bar. Eight cards flattened the shape into a row
          of equal boxes; a bar shows where the work actually sits. */}
      {occupied.length > 0 && (
        <section className="pdash-card pdash-pipeline">
          <div className="pdash-card__head">
            <h2>Pipeline</h2>
            <Link className="pdash-card__more" to="/partner/report">Full report</Link>
          </div>
          <div
            className="pdash-bar"
            role="img"
            aria-label={`Pipeline: ${occupied.map((s) => `${counts[s.value]} in ${s.label}`).join(', ')}`}
          >
            {occupied.map((s, i) => (
              <span
                key={s.value}
                className={`pdash-bar__seg ${rampStep(i, occupied.length)}`}
                style={{ flexGrow: counts[s.value] }}
                title={`${s.label}: ${counts[s.value]}`}
              />
            ))}
          </div>
          <div className="pdash-legend">
            {occupied.map((s, i) => (
              <Link key={s.value} className="pdash-legend__item" to={`/partner/app-history?stage=${s.value}`}>
                <span className={`pdash-legend__dot ${rampStep(i, occupied.length)}`} aria-hidden="true" />
                {s.label} <b>{counts[s.value]}</b>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="pdash-grid">
        <div className="pdash-main">
          <section className="pdash-card">
            <div className="pdash-card__head">
              <h2>Recent applications</h2>
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

          <div className="pdash-pair">
            {byCountry.length > 0 && (
              <section className="pdash-card">
                <div className="pdash-card__head"><h2>By destination</h2></div>
                <Bars
                  max={countryMax}
                  rows={byCountry.slice(0, 6).map((c) => ({
                    key: c.id,
                    label: (
                      <>
                        <Flag isoCode={c.isoCode} code={c.code} size={16} />
                        {c.name}
                      </>
                    ),
                    value: c.count,
                  }))}
                />
              </section>
            )}

            {topCourses.length > 0 && (
              <section className="pdash-card">
                <div className="pdash-card__head"><h2>Most applied courses</h2></div>
                <Bars
                  max={courseMax}
                  rows={topCourses.map((c) => ({
                    key: c.id,
                    label: (
                      <>
                        <span className="pdash-bars__title">{c.title}</span>
                        <span className="pdash-bars__sub">{c.institution?.name}</span>
                      </>
                    ),
                    value: c.count,
                  }))}
                />
              </section>
            )}
          </div>
        </div>

        <div className="pdash-side">
          {deadlines.length > 0 && (
            <section className="pdash-card">
              <div className="pdash-card__head">
                <h2>Upcoming deadlines</h2>
                <Link className="pdash-card__more" to="/partner/app-history">All</Link>
              </div>
              <ul className="pdash-list">
                {deadlines.map((d) => (
                  <li key={d.id}>
                    <span className="pdash-list__main">
                      <span className="pdash-list__title">{d.studentName}</span>
                      <span className="pdash-list__sub">{d.course?.institution?.name ?? '—'}</span>
                    </span>
                    <Due value={d.deadlineAt} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {recentInquiries.length > 0 && (
            <section className="pdash-card">
              <div className="pdash-card__head">
                <h2>Recent inquiries</h2>
                <Link className="pdash-card__more" to="/partner/history">
                  {inquiries} total
                </Link>
              </div>
              <ul className="pdash-list">
                {recentInquiries.map((q) => (
                  <li key={q.id}>
                    <span className="pdash-list__main">
                      <span className="pdash-list__title">
                        <Flag isoCode={q.country?.isoCode} code={q.country?.code} size={14} />
                        {q.country?.name ?? q.nationality ?? '—'}
                      </span>
                      <span className="pdash-list__sub">{q.intake ?? '—'} · {q.courseType ?? '—'}</span>
                    </span>
                    <span className="pdash-pill">{courseInquiryStageLabel(q.stage)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

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

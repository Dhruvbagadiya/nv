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
 * Three things this screen has been got wrong, all worth keeping in view because
 * the first two are the same mistake made twice.
 *
 * ONE. The original led with four large cards holding four numbers, and on a real
 * account it read 3 / 0 / 0 / 0. TWO. The rewrite fixed the panels underneath and
 * then did the identical thing to the tiles — six of them, 120px tall, holding a
 * figure that occupies forty. A tile is sized by the room its content needs, not
 * by the room available, and four of any six read zero on a normal account.
 *
 * THREE, and the structural one: it was built as two independent tall columns.
 * Columns do not end together. The left ran out at "Most applied courses" while
 * the right carried on through activity and shortcuts, leaving six hundred pixels
 * of white nothing down the left of the page. So the layout is ROWS now — each
 * row is its own grid, its cells stretch to the same height, and a row with no
 * content does not exist rather than leaving a hole where it was.
 *
 * And the standing rule from the rebuild: every number here comes from a row
 * someone entered. A dashboard is the easiest screen in any product to fill with
 * plausible furniture, and the furniture is indistinguishable from the real
 * figures beside it. Where the data does not exist, the panel does not exist.
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
 * the darkest part of the bar back at its lightest, halfway along.
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
 * A KPI tile: icon badge, figure, label. Sized by its content.
 *
 * `delta` is optional and almost always absent, which is the point. Only the
 * application count has a time dimension to compare against — every other figure
 * here is a live count of rows in a state, with no history stored anywhere, so a
 * "+12% on last month" beside it would be a number this product does not know.
 */
function Kpi({ to, icon, value, label, delta, tone = 'neutral' }) {
  return (
    <Link className="pdash-tile" to={to}>
      <span className={`pdash-tile__icon pdash-tile__icon--${tone}`} aria-hidden="true">
        <Icon name={icon} size={16} />
      </span>
      <span className="pdash-tile__body">
        <span className={`pdash-tile__value pdash-tile__value--${tone}`}>{value}</span>
        <span className="pdash-tile__label">{label}</span>
      </span>
      {delta}
    </Link>
  );
}

/** "▲ 50% on last month", or nothing at all in a partner's first month. */
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
 * is read rather than worked out.
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

/** A panel. Own component so a row can be assembled from a list. */
function Card({ title, more, moreTo, children, className = '' }) {
  return (
    <section className={`pdash-card ${className}`.trim()}>
      <div className="pdash-card__head">
        <h2>{title}</h2>
        {more && <Link className="pdash-card__more" to={moreTo}>{more}</Link>}
      </div>
      {children}
    </section>
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

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  /**
   * The hero. It replaces Page's own head rather than sitting under it — two
   * headings stacked is how a banner turns into chrome.
   *
   * `line` is the only copy on this screen assembled from the data rather than
   * written, so it is built from clauses that are non-zero and nothing else. A
   * greeting that reads "0 in progress · 0 due this week" is worse than no
   * greeting: it is a sentence whose content is the absence of content.
   */
  const hero = (line) => (
    <header className="pdash-hero">
      <div className="pdash-hero__text">
        <p className="pdash-hero__date">{today}</p>
        <h1>Welcome back, {user?.name ?? 'partner'}</h1>
        {line && <p className="pdash-hero__line">{line}</p>}
      </div>
      <div className="pdash-hero__actions">
        <button className="btn btn-ghost-light" onClick={() => navigate('/partner/ask-team')}>
          Ask our team
        </button>
        <button className="btn btn-light" onClick={() => navigate('/partner/add-application')}>
          <Icon name="plus" size={15} /> Add new application
        </button>
      </div>
    </header>
  );

  if (summary.isLoading) {
    return (
      <Page>
        <div className="pdash">
          {hero(null)}
          <div className="pdash-tiles" aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="pdash-tile pdash-tile--skeleton" />)}
          </div>
          <div className="pdash-card pdash-card--skeleton" />
        </div>
      </Page>
    );
  }

  if (summary.isError || !summary.data) {
    return (
      <Page>
        <div className="pdash">
          {hero(null)}
          <div className="empty-state">
            <span className="e-icon e-icon--danger" aria-hidden="true"><Icon name="alert" size={20} /></span>
            <h3>{errorMessage(summary.error, 'Could not load your dashboard.')}</h3>
            <div style={{ marginTop: 'var(--sp-4)' }}>
              <button type="button" className="btn btn-primary" onClick={() => summary.refetch()}>
                Try again
              </button>
            </div>
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

  const clauses = [
    total - approved > 0 && `${total - approved} applications in progress`,
    dueSoon > 0 && `${dueSoon} due this week`,
    awaiting > 0 && `${awaiting} awaiting documents`,
  ].filter(Boolean);
  const line = total === 0
    ? 'Nothing filed yet — add your first application to get started.'
    : clauses.join(' · ');

  /**
   * The bottom row is whichever of these three has rows. Assembled rather than
   * written out, because the row's column count has to match how many survive:
   * three `&&` blocks in a fixed three-column grid leaves a gap where each
   * missing one used to be, which is the same void the two-column layout had,
   * only sideways.
   */
  const closers = [
    activity.length > 0 && (
      <Card key="activity" title="Recent activity">
        <ul className="pdash-feed">
          {activity.slice(0, 5).map((n) => (
            <li key={n.id}>
              <span className="pdash-feed__title">{n.title}</span>
              <span className="pdash-feed__meta">{formatDate(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
    ),
    recentInquiries.length > 0 && (
      <Card key="inquiries" title="Recent inquiries" more={`${inquiries} total`} moreTo="/partner/history">
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
      </Card>
    ),
    <Card key="shortcuts" title="Shortcuts">
      <div className="pdash-shortcuts">
        {SHORTCUTS.map(([to, label, icon]) => (
          <Link key={to} className="pdash-shortcut" to={to}>
            <Icon name={icon} size={15} />
            {label}
          </Link>
        ))}
      </div>
    </Card>,
  ].filter(Boolean);

  return (
    <Page>
      <div className="pdash">
        {hero(line)}

        <div className="pdash-tiles">
          <Kpi
            to="/partner/app-history" icon="application" tone="accent"
            value={total} label="Total applications"
            delta={<Delta now={monthly.thisMonth} before={monthly.lastMonth} />}
          />
          <Kpi to="/partner/app-history" icon="refresh" value={total - approved} label="In progress" />
          <Kpi
            to="/partner/app-history?stage=CONDITIONAL_OFFER" icon="inbox" tone="info"
            value={sum(counts, OFFERED)} label="Offers received"
          />
          <Kpi
            to="/partner/app-history?stage=VISA_APPROVAL" icon="check" tone="good"
            value={approved} label="Visas approved"
          />
          <Kpi
            to="/partner/app-history" icon="clock" tone={dueSoon ? 'warning' : 'neutral'}
            value={dueSoon} label="Due this week"
          />
          {/* The one tile that names work rather than progress: an application
              with nothing attached cannot move, whatever stage it sits in. */}
          <Kpi
            to="/partner/app-history" icon="document" tone={awaiting ? 'warning' : 'neutral'}
            value={awaiting} label="Awaiting documents"
          />
        </div>

        {/* The distribution as ONE bar. Eight cards flattened the shape into a
            row of equal boxes; a bar shows where the work actually sits. */}
        {occupied.length > 0 && (
          <Card title="Pipeline" more="Full report" moreTo="/partner/report" className="pdash-pipeline">
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
          </Card>
        )}

        {/* Row: the work itself, and what is about to be late. */}
        <div className="pdash-row pdash-row--wide">
          <Card title="Recent applications" more="All applications" moreTo="/partner/app-history">
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
          </Card>

          {deadlines.length > 0 ? (
            <Card title="Upcoming deadlines" more="All" moreTo="/partner/app-history">
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
            </Card>
          ) : (
            // Not omitted like the other empty panels, because this row is two
            // cells wide: dropping one stretches "Recent applications" across
            // the full page and leaves the table's four columns adrift in it.
            <Card title="Upcoming deadlines">
              <p className="pdash-quiet">Nothing due. Deadlines you set on an application show up here.</p>
            </Card>
          )}
        </div>

        {(byCountry.length > 0 || topCourses.length > 0) && (
          <div className="pdash-row">
            {byCountry.length > 0 && (
              <Card title="By destination">
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
              </Card>
            )}
            {topCourses.length > 0 && (
              <Card title="Most applied courses">
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
              </Card>
            )}
          </div>
        )}

        <div className={`pdash-row pdash-row--${closers.length}`}>{closers}</div>
      </div>
    </Page>
  );
}

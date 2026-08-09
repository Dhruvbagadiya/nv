import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Page from '../../components/ui/Page.jsx';
import StatTile, { StatTileGrid } from '../../components/ui/StatTile.jsx';
import { fetchReportSummary } from '../../api/referenceScreens.js';
import { APPLICATION_STAGES, COURSE_INQUIRY_STAGES } from '../../constants/referenceData.js';
import { formatDate } from '../../utils/format.js';

// Institution logos are optional and, in the reference portal, several of them are
// broken images rendering as raw alt text. Falling back to an initials chip means a
// missing logo degrades instead of looking like a bug.
function InstitutionLogo({ institution }) {
  const initials = institution.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 3)
    .join('')
    .toUpperCase();

  if (!institution.logoUrl) {
    return (
      <div className="trending-logo trending-logo-fallback" title={institution.name}>
        {initials}
      </div>
    );
  }
  return (
    <img
      className="trending-logo"
      src={institution.logoUrl}
      alt={institution.name}
      title={institution.name}
      // A URL that 404s would otherwise show a broken-image glyph and the alt text,
      // which is exactly what the reference screenshots do.
      onError={(e) => {
        e.currentTarget.replaceWith(
          Object.assign(document.createElement('div'), {
            className: 'trending-logo trending-logo-fallback',
            textContent: initials,
            title: institution.name,
          })
        );
      }}
    />
  );
}

function Panel({ title, action, children }) {
  return (
    <div className="report-panel">
      <div className="report-panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyPanel({ message }) {
  return (
    <div className="empty-state">
      <div className="e-icon">
        <svg
          className="icon-svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </div>
      <p>{message}</p>
    </div>
  );
}

export default function Report() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['report-summary'],
    queryFn: fetchReportSummary,
  });

  if (isLoading) return <Page title="Report"><p className="empty-state">Loading…</p></Page>;
  if (isError)
    return (
      <Page title="Report">
        <p className="empty-state">Couldn’t load your report.</p>
      </Page>
    );

  return (
    <Page title="Report" subtitle="A summary of your work with us">
      {/* Every tile links to the filtered list it counts. In the reference these
          numbers are inert, which makes the dashboard a dead end. */}
      <StatTileGrid>
        {APPLICATION_STAGES.map((s) => (
          <StatTile
            key={s.value}
            label={s.label}
            value={data.applications[s.value]}
            to={`/partner/app-history?stage=${s.value}`}
          />
        ))}
      </StatTileGrid>

      <h2 className="section-heading">Course Inquiry</h2>
      <StatTileGrid>
        {COURSE_INQUIRY_STAGES.map((s) => (
          <StatTile
            key={s.value}
            label={s.label}
            value={data.courseInquiries[s.value]}
            to={`/partner/history?stage=${s.value}`}
          />
        ))}
      </StatTileGrid>

      <div className="report-columns">
        <div className="report-main">
          <Panel title="Trending Universities">
            {data.trending.length === 0 ? (
              <EmptyPanel message="No trending universities yet." />
            ) : (
              <div className="trending-strip">
                {data.trending.map((i) => (
                  <InstitutionLogo key={i.id} institution={i} />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Recent Application Notifications"
            action={
              data.recentNotifications.length > 0 && (
                <Link className="btn btn-outline" to="/partner/app-history">
                  View all
                </Link>
              )
            }
          >
            {data.recentNotifications.length === 0 ? (
              <EmptyPanel message="No notifications yet." />
            ) : (
              <div className="notif-list">
                {data.recentNotifications.map((n) => (
                  <div className="notif-row" key={n.id}>
                    <div>
                      <div className="cell-strong">{n.title}</div>
                      <div className="notif-text">{n.body}</div>
                    </div>
                    <div className="notif-when">{formatDate(n.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="report-side">
          <Panel title="Useful Information">
            {data.usefulInformation.length === 0 ? (
              <EmptyPanel message="No useful information found." />
            ) : (
              data.usefulInformation.map((u) => (
                <div className="useful-item" key={u.id}>
                  <div className="cell-strong">{u.title}</div>
                  <div className="notif-text">{u.body}</div>
                  {u.linkUrl && (
                    <a className="alert-link" href={u.linkUrl} target="_blank" rel="noopener noreferrer">
                      Read more
                    </a>
                  )}
                </div>
              ))
            )}
          </Panel>

          <Panel title="Upcoming Application Deadlines">
            {data.deadlines.length === 0 ? (
              <EmptyPanel message="No upcoming deadlines found." />
            ) : (
              data.deadlines.map((a) => (
                <div className="useful-item" key={a.id}>
                  <div className="cell-strong">
                    POEC {a.reference} · {a.studentName}
                  </div>
                  <div className="notif-text">
                    {a.course.institution.name} — {a.intakeLabel}
                  </div>
                  <div className="alert-link">{formatDate(a.deadlineAt)}</div>
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>
    </Page>
  );
}

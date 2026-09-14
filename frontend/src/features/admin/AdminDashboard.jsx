import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import Page from '../../components/ui/Page.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Flag from '../../components/ui/Flag.jsx';
import { useAuth } from '../../store/useAuth.js';
import { fetchAdminStats, fetchActivity, fetchAgentSummary } from '../../api/admin.js';
import { fetchApplications } from '../../api/applications.js';
import { applicationStageLabel } from '../../constants/referenceData.js';
import { errorMessage, formatDate } from '../../utils/format.js';

/**
 * The admin landing screen.
 *
 * It was six stat cards over eight quick-action tiles: fourteen boxes, every one
 * of them a link, and not one row of anything that had happened. An admin opens
 * this to find out what needs doing — the sidebar is already a complete list of
 * where to go, so a grid of links restating it is a second navigation menu
 * wearing a dashboard's clothes.
 *
 * So the counts stay (they are the only cross-cutting numbers in the product)
 * and the quick-action grid is replaced by the two things an admin actually
 * needs: the applications waiting on them, and what the agencies have been
 * doing. It shares the partner dashboard's language deliberately — same hero,
 * same tiles, same cards — because they are the same product.
 */

function Stat({ to, icon, value, label, tone = 'neutral', loading }) {
  return (
    <Link className="pdash-tile" to={to}>
      <span className={`pdash-tile__icon pdash-tile__icon--${tone}`} aria-hidden="true">
        <Icon name={icon} size={16} />
      </span>
      <span className="pdash-tile__body">
        <span className="pdash-tile__value">{loading ? '…' : value ?? '—'}</span>
        <span className="pdash-tile__label">{label}</span>
      </span>
    </Link>
  );
}

const ACT_TYPE = {
  APPLICATION: { icon: 'clipboard', tone: 'accent' },
  DOCUMENT: { icon: 'document', tone: 'teal' },
  INQUIRY: { icon: 'chat', tone: 'purple' },
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: fetchAdminStats, staleTime: 2 * 60 * 1000 });
  const recent = useQuery({
    queryKey: ['admin-applications', { dashboard: true }],
    queryFn: () => fetchApplications({ page: 1, pageSize: 6 }),
  });
  const activity = useQuery({
    queryKey: ['activity', { dashboard: true }],
    queryFn: () => fetchActivity({ page: 1, pageSize: 8 }),
  });
  const agents = useQuery({ queryKey: ['agent-summary'], queryFn: fetchAgentSummary });

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const s = stats.data;
  const applications = recent.data?.items ?? [];
  const events = activity.data?.items ?? [];
  const roster = agents.data ?? [];

  return (
    <Page>
      <div className="pdash">
        <header className="pdash-hero">
          <div className="pdash-hero__text">
            <p className="pdash-hero__date">{today} · Admin</p>
            <h1>Welcome back, {user?.name ?? 'admin'}</h1>
            <p className="pdash-hero__line">
              {stats.isError
                ? 'Some figures could not be loaded.'
                : `${s?.institutions ?? '—'} institutions · ${s?.courses ?? '—'} courses · ${s?.users ?? '—'} users`}
            </p>
          </div>
          <div className="pdash-hero__actions">
            <button className="btn btn-ghost-light" onClick={() => navigate('/admin/activity')}>
              Agency activity
            </button>
            <button className="btn btn-light" onClick={() => navigate('/admin/applications')}>
              <Icon name="clipboard" size={15} /> Review applications
            </button>
          </div>
        </header>

        {stats.isError ? (
          <div className="empty-state">
            <span className="e-icon e-icon--danger" aria-hidden="true"><Icon name="alert" size={20} /></span>
            <h3>{errorMessage(stats.error, 'Could not load the admin figures.')}</h3>
            <div style={{ marginTop: 'var(--sp-4)' }}>
              <button type="button" className="btn btn-primary" onClick={() => stats.refetch()}>Try again</button>
            </div>
          </div>
        ) : (
          <div className="pdash-tiles">
            <Stat to="/admin/applications" icon="clipboard" tone="accent" value={s?.applications} label="Applications" loading={stats.isLoading} />
            <Stat to="/admin/institutions"  icon="institution" tone="info" value={s?.institutions} label="Institutions" loading={stats.isLoading} />
            <Stat to="/admin/courses"       icon="course" tone="good" value={s?.courses} label="Courses" loading={stats.isLoading} />
            <Stat to="/admin/users"         icon="users" value={s?.users} label="Users" loading={stats.isLoading} />
            <Stat to="/admin/documents"     icon="folder" tone="info" value={s?.documents} label="Documents" loading={stats.isLoading} />
            <Stat to="/admin/announcements" icon="megaphone" tone="warning" value={s?.activeBanners} label="Active banners" loading={stats.isLoading} />
          </div>
        )}

        <div className="pdash-row pdash-row--wide">
          <section className="pdash-card">
            <div className="pdash-card__head">
              <h2>Latest applications</h2>
              <Link className="pdash-card__more" to="/admin/applications">All applications</Link>
            </div>

            {recent.isLoading && <p className="field-hint">Loading…</p>}
            {recent.isError && <p className="form-error">Couldn’t load applications.</p>}
            {!recent.isLoading && !recent.isError && applications.length === 0 && (
              <p className="pdash-quiet">Nothing filed yet.</p>
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
                      {/* The column an admin screen needs and the partner one
                          does not: whose application this is. */}
                      <td className="pdash-table__stage">{a.agent?.name ?? '—'}</td>
                      <td className="pdash-table__stage">{applicationStageLabel(a.stage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="pdash-card">
            <div className="pdash-card__head">
              <h2>Agencies</h2>
              <Link className="pdash-card__more" to="/admin/activity">Activity</Link>
            </div>

            {agents.isLoading && <p className="field-hint">Loading…</p>}
            {agents.isError && <p className="form-error">Couldn’t load the agency list.</p>}
            {!agents.isLoading && !agents.isError && roster.length === 0 && (
              <p className="pdash-quiet">No active agencies.</p>
            )}

            {roster.length > 0 && (
              <ul className="pdash-list">
                {roster.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <span className="pdash-list__main">
                      <span className="pdash-list__title">{a.name}</span>
                      <span className="pdash-list__sub">
                        {a.lastActiveAt ? `Last filed ${formatDate(a.lastActiveAt)}` : 'Nothing filed yet'}
                      </span>
                    </span>
                    <span className="pdash-pill">{a.applications}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="pdash-card">
          <div className="pdash-card__head">
            <h2>Recent activity</h2>
            <Link className="pdash-card__more" to="/admin/activity">Full feed</Link>
          </div>

          {activity.isLoading && <p className="field-hint">Loading…</p>}
          {activity.isError && <p className="form-error">Couldn’t load the activity feed.</p>}
          {!activity.isLoading && !activity.isError && events.length === 0 && (
            <p className="pdash-quiet">
              Nothing yet. This feed is built from applications, document uploads and
              course inquiries — edits and sign-ins are not recorded anywhere.
            </p>
          )}

          {events.length > 0 && (
            <ul className="act-feed">
              {events.map((e) => {
                const t = ACT_TYPE[e.type] ?? { icon: 'bell', tone: 'neutral' };
                return (
                  <li key={e.id}>
                    <span className={`n-icon n-icon--${t.tone}`} aria-hidden="true">
                      <Icon name={t.icon} size={15} />
                    </span>
                    <span className="act-feed__main">
                      <span className="act-feed__title">{e.title}</span>
                      <span className="act-feed__sub">
                        {e.actor?.name ?? 'Unknown'}
                        {e.subject && <> · {e.subject}</>}
                      </span>
                    </span>
                    <span className="act-feed__when">{formatDate(e.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}

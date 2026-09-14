import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Flag from '../../components/ui/Flag.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { fetchActivity, fetchAgentSummary } from '../../api/admin.js';
import { errorMessage, formatDate } from '../../utils/format.js';

/**
 * What the agencies have been doing.
 *
 * WORTH BEING BLUNT: this is not an audit log, and it looks enough like one that
 * someone will assume it is. There is no audit table in this schema — nothing
 * records a login, an edit, a deletion or a refused permission. Three tables
 * carry an actor and a creation time, and this is those three merged:
 * applications filed, documents attached, inquiries raised.
 *
 * So it answers "which agencies are active, and on what". It does not answer
 * "who changed this", and the empty state says so rather than letting the
 * absence of rows imply nothing happened.
 */

const TYPE = {
  APPLICATION: { icon: 'clipboard', tone: 'accent', label: 'Application' },
  DOCUMENT: { icon: 'document', tone: 'teal', label: 'Document' },
  INQUIRY: { icon: 'chat', tone: 'purple', label: 'Inquiry' },
};

function Initials({ name }) {
  const letters = (name ?? '?')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join('');
  return <span className="act-avatar" aria-hidden="true">{letters || '?'}</span>;
}

export default function AdminActivity() {
  const [page, setPage] = useState(1);
  const [agentId, setAgentId] = useState('');

  const feed = useQuery({
    queryKey: ['activity', { page, agentId }],
    queryFn: () => fetchActivity({ page, pageSize: 20, ...(agentId && { agentId }) }),
    placeholderData: keepPreviousData,
  });
  const agents = useQuery({ queryKey: ['agent-summary'], queryFn: fetchAgentSummary });

  const items = feed.data?.items ?? [];
  const meta = feed.data?.meta ?? {};
  const roster = agents.data ?? [];
  const selected = roster.find((a) => a.id === agentId);

  const pick = (id) => { setAgentId(id === agentId ? '' : id); setPage(1); };

  return (
    <Page
      title="Agency activity"
      subtitle={
        selected
          ? `${selected.name} — ${selected.applications} applications, ${selected.inquiries} inquiries`
          : 'Applications filed, documents attached and inquiries raised, across every agency'
      }
    >
      <div className="act-grid">
        <section className="pdash-card">
          <div className="pdash-card__head">
            <h2>{selected ? selected.name : 'All agencies'}</h2>
            {meta.total != null && <span className="act-total">{meta.total} events</span>}
          </div>

          {feed.isLoading && <p className="field-hint">Loading…</p>}

          {feed.isError && (
            <div className="empty-state">
              <span className="e-icon e-icon--danger" aria-hidden="true"><Icon name="alert" size={20} /></span>
              <h3>{errorMessage(feed.error, 'Could not load the activity feed.')}</h3>
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <button type="button" className="btn btn-primary" onClick={() => feed.refetch()}>Try again</button>
              </div>
            </div>
          )}

          {!feed.isLoading && !feed.isError && items.length === 0 && (
            <div className="empty-state">
              <span className="e-icon" aria-hidden="true"><Icon name="clock" size={20} /></span>
              <h3>No activity recorded.</h3>
              {/* Named explicitly, because an empty feed on a screen that looks
                  like an audit log reads as "nobody did anything" rather than
                  "this only tracks three things". */}
              <p className="field-hint">
                This feed is built from applications, document uploads and course
                inquiries. Edits and sign-ins are not recorded anywhere.
              </p>
            </div>
          )}

          {items.length > 0 && (
            <ul className="act-feed">
              {items.map((e) => {
                const t = TYPE[e.type] ?? { icon: 'bell', tone: 'neutral', label: e.type };
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
                        {e.detail && <> · {e.detail}</>}
                        {e.country && (
                          <> <Flag isoCode={e.country.isoCode} code={e.country.code} size={13} /></>
                        )}
                      </span>
                    </span>
                    <span className="act-feed__when">
                      {formatDate(e.createdAt)}
                      {e.applicationId && (
                        <>
                          {' '}
                          <Link className="pdash-card__more" to="/admin/applications">Open</Link>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <Pagination
            page={meta.page ?? page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={meta.pageSize}
            maxPage={meta.maxPage}
            onChange={setPage}
          />
        </section>

        <section className="pdash-card">
          <div className="pdash-card__head"><h2>Agencies</h2></div>

          {agents.isError && <p className="form-error">Couldn’t load the agency list.</p>}
          {agents.isLoading && <p className="field-hint">Loading…</p>}

          {roster.length > 0 && (
            <ul className="act-roster">
              {roster.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={`act-agent${agentId === a.id ? ' act-agent--on' : ''}`}
                    aria-pressed={agentId === a.id}
                    onClick={() => pick(a.id)}
                  >
                    <Initials name={a.name} />
                    <span className="act-agent__main">
                      <span className="act-agent__name">{a.name}</span>
                      {/* Last ACTIVE, not last seen: there is no session record
                          to read, so this is the newest application they filed. */}
                      <span className="act-agent__meta">
                        {a.lastActiveAt ? `Last filed ${formatDate(a.lastActiveAt)}` : 'Nothing filed yet'}
                      </span>
                    </span>
                    <span className="act-agent__count">{a.applications}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!agents.isLoading && !agents.isError && roster.length === 0 && (
            <p className="field-hint">No active agencies.</p>
          )}
        </section>
      </div>
    </Page>
  );
}

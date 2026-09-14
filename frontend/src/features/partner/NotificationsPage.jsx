import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Page from '../../components/ui/Page.jsx';
import Icon from '../../components/ui/Icon.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { invalidateResource } from '../../hooks/useInvalidateResource.js';
import { toast } from '../../store/useToast.js';
import { errorMessage, formatDate } from '../../utils/format.js';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../api/notifications.js';

/**
 * The full notification history.
 *
 * The bell dropdown asks for ten rows and has no way to reach an eleventh, so
 * anything older than your last ten events was written to the database and then
 * unreachable — the API has paged since it was built, nothing called it with a
 * page. This is that call.
 *
 * Read state is per row and already server-side (`readAt`), so the only thing
 * this screen adds is reach: the same rows, all of them, with a filter for the
 * unread ones and a way to clear them in bulk.
 */

const KIND_ICON = {
  NEW_APPLICATION: 'clipboard',
  STAGE_CHANGE: 'refresh',
  DOCUMENT_QUERY: 'document',
  INFO_QUERY: 'info',
  SYSTEM: 'bell',
};
const KIND_TONE = {
  NEW_APPLICATION: 'accent',
  STAGE_CHANGE: 'info',
  DOCUMENT_QUERY: 'teal',
  INFO_QUERY: 'purple',
  SYSTEM: 'neutral',
};

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    // Under the ['notifications'] root, so the dropdown's invalidate reaches it
    // too — one key root per entity, variants after the root.
    queryKey: ['notifications', 'page', { page, unreadOnly }],
    queryFn: () => fetchNotifications({ page, pageSize: 20, ...(unreadOnly && { unreadOnly: true }) }),
    placeholderData: keepPreviousData,
  });
  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
  });

  const invalidate = () => invalidateResource(queryClient, 'notifications');
  const onError = (e) => toast.error(errorMessage(e, 'Could not mark that as read.'));
  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate, onError });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate, onError });

  const items = data?.items ?? [];
  const meta = data?.meta ?? {};

  const actions = (
    <>
      <button
        type="button"
        className={`chip${unreadOnly ? ' chip-active' : ''}`}
        aria-pressed={unreadOnly}
        onClick={() => { setUnreadOnly((v) => !v); setPage(1); }}
      >
        Unread only{unread > 0 ? ` (${unread})` : ''}
      </button>
      <button
        type="button"
        className="btn btn-outline"
        disabled={unread === 0 || readAll.isPending}
        onClick={() => readAll.mutate()}
      >
        Mark all read
      </button>
    </>
  );

  return (
    <Page
      title="Notifications"
      subtitle={unread > 0 ? `${unread} unread` : 'Everything read'}
      actions={actions}
    >
      {isLoading && <p className="field-hint">Loading…</p>}

      {/* A failed request rendering an empty list is indistinguishable from
          having no notifications — the same defect the dropdown had. */}
      {isError && (
        <div className="empty-state">
          <span className="e-icon e-icon--danger" aria-hidden="true"><Icon name="alert" size={20} /></span>
          <h3>{errorMessage(error, 'Could not load your notifications.')}</h3>
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <button type="button" className="btn btn-primary" onClick={() => refetch()}>Try again</button>
          </div>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="empty-state">
          <span className="e-icon" aria-hidden="true"><Icon name="bell" size={20} /></span>
          <h3>{unreadOnly ? 'Nothing unread.' : 'No notifications yet.'}</h3>
        </div>
      )}

      {items.length > 0 && (
        <ul className="notif-feed">
          {items.map((n) => (
            <li key={n.id} className={`notif-row${n.readAt ? ' notif-row--read' : ''}`}>
              <span className={`n-icon n-icon--${KIND_TONE[n.kind] ?? 'neutral'}`} aria-hidden="true">
                <Icon name={KIND_ICON[n.kind] ?? 'bell'} size={16} />
              </span>
              <span className="notif-row__main">
                <span className="notif-row__title">{n.title}</span>
                <span className="notif-row__body">{n.body}</span>
                <span className="notif-row__meta">
                  {formatDate(n.createdAt)}
                  {n.applicationId && (
                    <>
                      {' · '}
                      <Link to="/partner/app-history">View application</Link>
                    </>
                  )}
                </span>
              </span>
              {/* An explicit control rather than marking read on click. On the
                  dropdown the click also navigates, so read-on-click is a side
                  effect of going somewhere; here there is nowhere to go, and a
                  row that silently changes state when you touch it is how you
                  lose track of what you had not read yet. */}
              {!n.readAt ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={readOne.isPending}
                  onClick={() => readOne.mutate(n.id)}
                >
                  Mark read
                </button>
              ) : (
                <span className="notif-row__done">Read</span>
              )}
            </li>
          ))}
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
    </Page>
  );
}

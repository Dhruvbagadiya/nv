import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../api/notifications.js';
import { formatDate } from '../../utils/format.js';

// This used to render one synthesised item derived from a count of blacklisted
// institutions — there was no Notification table, so there was no read state and
// the badge showed "1 new" permanently. Now backed by the real model.
export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const queryClient = useQueryClient();

  // The badge only needs a number, so it does not fetch rows.
  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
  });

  // The list is only fetched once the panel is actually opened.
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => fetchNotifications({ pageSize: 10 }),
    enabled: open,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });

  // Click-outside and Escape. The panel had neither, so it could only be dismissed
  // by clicking the bell again and stayed open over whatever you clicked next.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const items = data?.items ?? [];

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
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
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {/* Only unread items justify the dot. It previously appeared whenever any
            notification existed, so it never cleared. */}
        {unread > 0 && <span className="dot-badge" />}
      </button>

      {open && (
        <div className="notif-panel open">
          <div className="notif-panel-head">
            Notifications
            {unread > 0 && <span className="count">{unread} new</span>}
            {unread > 0 && (
              <button
                type="button"
                className="alert-link"
                style={{ marginLeft: 'auto', background: 'none', border: 'none' }}
                onClick={() => readAll.mutate()}
                disabled={readAll.isPending}
              >
                Mark all read
              </button>
            )}
          </div>

          {isLoading && (
            <div className="notif-item">
              <div className="notif-text">Loading…</div>
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="notif-item">
              <div className="notif-text">You’re all caught up.</div>
            </div>
          )}

          {items.map((n) => (
            <div
              className="notif-item"
              key={n.id}
              style={n.readAt ? { opacity: 0.6 } : undefined}
              onClick={() => !n.readAt && readOne.mutate(n.id)}
            >
              <div className="notif-text">
                <strong>{n.title}</strong>
                <div>{n.body}</div>
              </div>
              <div className="alert-link" style={{ cursor: 'default' }}>
                {formatDate(n.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

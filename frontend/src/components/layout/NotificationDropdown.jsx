import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchNotifications } from '../../api/notifications.js';

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
  });

  return (
    <div className="notif-wrap">
      <div className="icon-btn" onClick={() => setOpen((o) => !o)} title="Notifications">
        <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {notifications.length > 0 && <span className="dot-badge" />}
      </div>
      {open && (
        <div className="notif-panel open">
          <div className="notif-panel-head">
            Notifications <span className="count">{notifications.length} new</span>
          </div>
          {notifications.map((n) => (
            <div className="notif-item" key={n.id}>
              <div className="notif-text">{n.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import * as notificationsService from './notifications.service.js';

// Every handler is scoped to req.user.sub. Notifications are per-user, so there is
// no "list all" even for an admin — an admin's bell shows an admin's items.

export async function listNotificationsHandler(req, res) {
  res.json(
    await notificationsService.listNotifications({
      userId: req.user.sub,
      unreadOnly: req.query.unreadOnly,
      page: req.query.page,
      pageSize: req.query.pageSize,
    })
  );
}

export async function unreadCountHandler(req, res) {
  res.json({ unread: await notificationsService.countUnread({ userId: req.user.sub }) });
}

export async function markReadHandler(req, res) {
  res.json(await notificationsService.markRead({ id: req.params.id, userId: req.user.sub }));
}

export async function markAllReadHandler(req, res) {
  res.json(await notificationsService.markAllRead({ userId: req.user.sub }));
}

import * as notificationsService from './notifications.service.js';

export async function listNotificationsHandler(req, res, next) {
  try {
    const items = await notificationsService.listNotifications();
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

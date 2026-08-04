import { api } from './client.js';

export async function fetchNotifications(params = {}) {
  const { data } = await api.get('/notifications', { params });
  return data; // { items, meta }
}

// Separate endpoint so the header badge does not have to pull a page of rows just
// to render a number.
export async function fetchUnreadCount() {
  const { data } = await api.get('/notifications/unread-count');
  return data.unread;
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.post('/notifications/read-all');
  return data;
}

import { api } from './client.js';

export async function fetchNotifications() {
  const { data } = await api.get('/notifications');
  return data.items || [];
}

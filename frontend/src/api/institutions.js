import { api } from './client.js';

export async function fetchInstitutions(filters = {}) {
  const { data } = await api.get('/institutions', { params: filters });
  return data.items;
}

export async function createInstitution(payload) {
  const { data } = await api.post('/institutions', payload);
  return data;
}

export async function setBlacklist(id, isBlacklisted) {
  const { data } = await api.patch(`/institutions/${id}/blacklist`, { isBlacklisted });
  return data;
}

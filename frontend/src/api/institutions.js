import { api } from './client.js';

export async function fetchInstitutions(filters = {}) {
  const { data } = await api.get('/institutions', { params: filters });
  return data.items;
}

export async function createInstitution(payload) {
  const { data } = await api.post('/institutions', payload);
  return data;
}

export async function updateInstitution(id, payload) {
  const { data } = await api.put(`/institutions/${id}`, payload);
  return data;
}

export async function setBlacklist(id, isBlacklisted) {
  const { data } = await api.patch(`/institutions/${id}/blacklist`, { isBlacklisted });
  return data;
}

export async function archiveInstitution(id) {
  await api.delete(`/institutions/${id}`);
}

export async function restoreInstitution(id) {
  const { data } = await api.post(`/institutions/${id}/restore`);
  return data;
}

import { api } from './client.js';

// Dropdowns: the whole (server-capped) list, no meta.
export async function fetchInstitutions(filters = {}) {
  const { data } = await api.get('/institutions', { params: filters });
  return data.items;
}

// Admin table: one page plus the meta DataTable needs to render its pager.
// Passing `page` is what switches the endpoint into its paged shape, so it must
// always be sent — hence the default rather than an `|| undefined` at the call
// site, which would silently fall back to the unpaginated list.
export async function fetchInstitutionsPage({ page = 1, ...filters } = {}) {
  const { data } = await api.get('/institutions', { params: { ...filters, page } });
  return data;
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

// ---------------------------------------------------------------- gallery
// Admin-only. Kept off the institution body because the gallery is edited one
// photo at a time; a whole-array save would let two admins overwrite each
// other's changes without either seeing a conflict.

export const fetchInstitutionPhotos = (id) =>
  api.get(`/institutions/${id}/photos`).then((r) => r.data);

export const addInstitutionPhoto = (id, body) =>
  api.post(`/institutions/${id}/photos`, body).then((r) => r.data);

export const deleteInstitutionPhoto = (id, photoId) =>
  api.delete(`/institutions/${id}/photos/${photoId}`);

export const reorderInstitutionPhotos = (id, ids) =>
  api.put(`/institutions/${id}/photos/reorder`, { ids }).then((r) => r.data);

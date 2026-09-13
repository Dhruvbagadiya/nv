import { api } from './client.js';

export async function fetchApplications(filters) {
  const { data } = await api.get('/applications', { params: filters });
  return data;
}

export async function fetchApplication(id) {
  const { data } = await api.get(`/applications/${id}`);
  return data;
}

export async function createApplication(payload) {
  const { data } = await api.post('/applications', payload);
  return data;
}

export async function advanceApplicationStage(id, payload) {
  // payload: { stage, stageNote?, deadlineAt? }
  const { data } = await api.patch(`/applications/${id}/stage`, payload);
  return data;
}

// ── Documents attached to an application ────────────────────────────────────

export async function fetchApplicationDocuments(id) {
  const { data } = await api.get(`/applications/${id}/documents`);
  return data.items;
}

/**
 * Multipart, and the file goes to the same endpoint that checks whether this
 * application is the caller's — so a refused upload stores nothing. Content-Type
 * is left unset on purpose: the browser has to add the multipart boundary, and
 * setting it by hand omits that and the request fails to parse.
 */
export async function uploadApplicationDocument(id, { file, kind, label }) {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  if (label) form.append('label', label);

  const { data } = await api.post(`/applications/${id}/documents`, form);
  return data;
}

export async function removeApplicationDocument(id, documentId) {
  await api.delete(`/applications/${id}/documents/${documentId}`);
}

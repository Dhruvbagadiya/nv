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

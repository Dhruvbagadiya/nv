import { api } from './client.js';

export async function fetchApplications(filters) {
  const { data } = await api.get('/applications', { params: filters });
  return data;
}

export async function createApplication(payload) {
  const { data } = await api.post('/applications', payload);
  return data;
}

import { api } from './client.js';

export async function fetchMoiAcceptances(filters) {
  const { data } = await api.get('/moi-institutions', { params: filters });
  return data;
}

import { api } from './client.js';

export async function fetchCountries(params) {
  const { data } = await api.get('/countries', { params });
  return data.items;
}

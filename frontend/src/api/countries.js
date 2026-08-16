import { api } from './client.js';

// Header strip and dropdowns: the whole list, no meta.
export async function fetchCountries(params) {
  const { data } = await api.get('/countries', { params });
  return data.items;
}

// Admin table: one page plus the meta DataTable needs for its pager. Sending
// `page` is what selects the paged shape, so it defaults rather than being
// omitted when falsy.
export async function fetchCountriesPage({ page = 1, ...params } = {}) {
  const { data } = await api.get('/countries', { params: { ...params, page } });
  return data;
}

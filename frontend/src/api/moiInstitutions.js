import { api } from './client.js';

export async function fetchMoiAcceptances(filters) {
  const { data } = await api.get('/moi-institutions', { params: filters });
  return data; // { items, meta }
}

// Distinct values actually present in the data — courseType is a free-text
// column, so the dropdown has to be derived rather than hardcoded.
export async function fetchMoiCourseTypes() {
  const { data } = await api.get('/moi-institutions/course-types');
  return data.items;
}

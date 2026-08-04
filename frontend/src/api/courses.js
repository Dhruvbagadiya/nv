import { api } from './client.js';

// Mirrors GET /api/courses?country=&search=&tag=&page= from the backend.
export async function fetchCourses({ country, search, tag, page = 1 }) {
  const params = { page };
  if (country && country !== 'ALL') params.country = country;
  if (search) params.search = search;
  if (tag) params.tag = tag;

  const { data } = await api.get('/courses', { params });
  return data; // { items, meta: { total, page, pageSize, totalPages } }
}

export async function createCourse(payload) {
  const { data } = await api.post('/courses', payload);
  return data;
}

export async function updateCourse(id, payload) {
  const { data } = await api.put(`/courses/${id}`, payload);
  return data;
}

// Archives rather than hard-deletes server-side; applications keep resolving
// their course. Named for what the caller intends.
export async function archiveCourse(id) {
  await api.delete(`/courses/${id}`);
}

export async function restoreCourse(id) {
  const { data } = await api.post(`/courses/${id}/restore`);
  return data;
}

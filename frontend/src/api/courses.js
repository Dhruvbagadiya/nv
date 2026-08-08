import { api } from './client.js';

// Mirrors GET /api/courses?country=&search=&tag=&programLevel=&page= from the backend.
// Response shape: { data: [{id, type, attributes}], meta: { counts: {total}, page, pageSize, totalPages } }
export async function fetchCourses({ country, search, tag, institutionId, programLevel, page = 1 }) {
  const params = { page };
  // Omitted rather than sent empty: the API's zod schemas reject a non-uuid
  // institutionId, and "" is not a uuid.
  if (country && country !== 'ALL') params.country = country;
  if (search) params.search = search;
  if (tag) params.tag = tag;
  if (institutionId) params.institutionId = institutionId;
  if (programLevel) params.programLevel = programLevel;

  const { data } = await api.get('/courses', { params });
  return data;
}

export async function fetchCourse(id) {
  const { data } = await api.get(`/courses/${id}`);
  return data;
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

import { api } from './client.js';

// Mirrors GET /api/courses?country=&search=&tag=&programLevel=&page= from the backend.
// Response shape: { data: [{id, type, attributes}], meta: { counts: {total}, page, pageSize, totalPages } }
export async function fetchCourses({
  country, search, tag, institutionId, programLevel, moiAccepted, status, page = 1,
}) {
  const params = { page };
  // Only the admin screen sends this. Omitted elsewhere so the API applies its
  // 'active' default and the catalogue never shows a soft-deleted course.
  if (status) params.status = status;
  // Omitted rather than sent empty: the API's zod schemas reject a non-uuid
  // institutionId, and "" is not a uuid.
  if (country && country !== 'ALL') params.country = country;
  if (search) params.search = search;
  if (tag) params.tag = tag;
  if (institutionId) params.institutionId = institutionId;
  if (programLevel) params.programLevel = programLevel;
  // Only when true. It narrows and never widens, so `moiAccepted=false` would
  // read as "courses that do NOT accept MOI" — a different question.
  if (moiAccepted) params.moiAccepted = 'true';

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

/**
 * Up to 1,000 courses in one call. The endpoint has existed since it was
 * written with no client function and no screen, so the only way to reach it
 * was curl.
 */
export async function bulkImportCourses(rows) {
  const { data } = await api.post('/courses/bulk-import', { rows });
  return data;
}

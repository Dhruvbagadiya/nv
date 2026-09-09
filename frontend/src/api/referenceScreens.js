import { api } from './client.js';

// One module for the read-only reference screens. They are all the same shape —
// a filtered list over a single table — so separate files per screen would be
// seven near-identical two-line modules.

export async function fetchCommissions(params) {
  const { data } = await api.get('/commissions', { params });
  return data; // { items, meta }
}

export async function fetchEntryRequirements(params) {
  const { data } = await api.get('/entry-requirements', { params });
  return data;
}

export async function fetchEnglishTests(level) {
  const { data } = await api.get('/entry-requirements/english-tests', { params: { level } });
  return data.items;
}

export async function fetchImportantUpdates(params) {
  const { data } = await api.get('/important-updates', { params });
  return data;
}

export async function fetchImportantUpdate(id) {
  const { data } = await api.get(`/important-updates/${id}`);
  return data;
}

export async function fetchDocuments(params) {
  const { data } = await api.get('/documents', { params });
  return data;
}

// Only the countries/institutions that actually have documents in this category,
// so the dropdowns cannot offer an option that returns an empty grid.
export async function fetchDocumentFacets(category) {
  const { data } = await api.get('/documents/facets', { params: { category } });
  return data;
}

export async function fetchDocumentCounts() {
  const { data } = await api.get('/documents/counts');
  return data.counts;
}

export async function fetchAnnouncements() {
  const { data } = await api.get('/announcements');
  return data.items;
}

export async function fetchSupportContacts(params) {
  // params carries `status` from the admin screen; the agent-facing screen calls
  // this with nothing and the endpoint defaults to active.
  const { data } = await api.get('/support-contacts', { params });
  return data.items;
}

// One request for the whole Report screen rather than six — every panel is needed
// at once, so separate calls would each pay their own latency.
export async function fetchReportSummary() {
  const { data } = await api.get('/reports/summary');
  return data;
}

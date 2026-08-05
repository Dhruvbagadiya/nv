import { api } from './client.js';

// Admin write calls. Reads reuse the same endpoints the agent-facing screens use —
// there is no separate admin view of the data, only permission to change it.

// ---- announcements (the global banners) ----
export const createAnnouncement = (b) => api.post('/announcements', b).then((r) => r.data);
export const updateAnnouncement = (id, b) => api.put(`/announcements/${id}`, b).then((r) => r.data);
export const deleteAnnouncement = (id) => api.delete(`/announcements/${id}`);
export const fetchAllAnnouncements = () =>
  // ?all=true includes inactive ones, which agents never see.
  api.get('/announcements', { params: { all: 'true' } }).then((r) => ({ items: r.data.items }));

// ---- support contacts ----
export const createSupportContact = (b) => api.post('/support-contacts', b).then((r) => r.data);
export const updateSupportContact = (id, b) =>
  api.put(`/support-contacts/${id}`, b).then((r) => r.data);
export const archiveSupportContact = (id) => api.delete(`/support-contacts/${id}`);

// ---- important updates ----
export const createImportantUpdate = (b) => api.post('/important-updates', b).then((r) => r.data);
export const updateImportantUpdate = (id, b) =>
  api.put(`/important-updates/${id}`, b).then((r) => r.data);
export const archiveImportantUpdate = (id) => api.delete(`/important-updates/${id}`);

// ---- documents ----
export const createDocument = (b) => api.post('/documents', b).then((r) => r.data);
export const updateDocument = (id, b) => api.put(`/documents/${id}`, b).then((r) => r.data);
export const archiveDocument = (id) => api.delete(`/documents/${id}`);
export const fetchStorageStatus = () => api.get('/documents/storage-status').then((r) => r.data);
export const createUploadUrl = (b) => api.post('/documents/upload-url', b).then((r) => r.data);

// One commission per institution and one entry requirement per (institution, level),
// so both are PUT upserts — there is nothing to create twice.
export const upsertCommission = (b) => api.put('/commissions', b).then((r) => r.data);
export const upsertEntryRequirement = (b) =>
  api.put('/entry-requirements', b).then((r) => r.data);

// ---- sub-agents ----
export const fetchSubAgents = () => api.get('/auth/sub-agents').then((r) => r.data.items);
export const createSubAgent = (b) => api.post('/auth/sub-agents', b).then((r) => r.data);

// Uploads the file straight to the bucket using a signed URL, then returns the
// public URL to store on the Document. The bytes never pass through our API.
export async function uploadFile(file, category) {
  const { uploadUrl, fileUrl, requiredHeaders } = await createUploadUrl({
    filename: file.name,
    contentType: file.type,
    size: file.size,
    category,
  });

  // Deliberately plain fetch, not the axios instance: `api` attaches an
  // Authorization header, and sending one to S3 alongside a presigned signature
  // makes it reject the request.
  const response = await fetch(uploadUrl, { method: 'PUT', headers: requiredHeaders, body: file });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status}). The signed URL may have expired.`);
  }
  return fileUrl;
}

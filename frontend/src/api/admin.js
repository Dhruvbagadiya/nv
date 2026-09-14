import { api } from './client.js';

// Admin write calls. Reads reuse the same endpoints the agent-facing screens use.

// ---- announcements ----
export const createAnnouncement   = (b)      => api.post('/announcements', b).then((r) => r.data);
export const updateAnnouncement   = (id, b)  => api.put(`/announcements/${id}`, b).then((r) => r.data);
export const deleteAnnouncement   = (id)     => api.delete(`/announcements/${id}`);
export const fetchAllAnnouncements = ()      =>
  api.get('/announcements', { params: { all: 'true' } }).then((r) => ({ items: r.data.items }));

// ---- support contacts ----
export const createSupportContact  = (b)     => api.post('/support-contacts', b).then((r) => r.data);
export const updateSupportContact  = (id, b) => api.put(`/support-contacts/${id}`, b).then((r) => r.data);
export const archiveSupportContact = (id)    => api.delete(`/support-contacts/${id}`);
export const restoreSupportContact = (id)    => api.post(`/support-contacts/${id}/restore`).then((r) => r.data);

// ---- important updates ----
export const createImportantUpdate  = (b)    => api.post('/important-updates', b).then((r) => r.data);
export const updateImportantUpdate  = (id, b) => api.put(`/important-updates/${id}`, b).then((r) => r.data);
export const archiveImportantUpdate = (id)   => api.delete(`/important-updates/${id}`);
export const restoreImportantUpdate = (id)   => api.post(`/important-updates/${id}/restore`).then((r) => r.data);

export const createDocument     = (b)     => api.post('/documents', b).then((r) => r.data);
export const updateDocument     = (id, b) => api.put(`/documents/${id}`, b).then((r) => r.data);
export const archiveDocument    = (id)    => api.delete(`/documents/${id}`);
export const restoreDocument    = (id)    => api.post(`/documents/${id}/restore`).then((r) => r.data);

// Entry requirements and commissions had no archive path at all: the list
// hard-coded `archivedAt: null` and nothing could set or clear it.
export const archiveEntryRequirement = (id)  => api.delete(`/entry-requirements/${id}`);
export const restoreEntryRequirement = (id)  => api.post(`/entry-requirements/${id}/restore`).then((r) => r.data);
export const archiveCommission       = (id)  => api.delete(`/commissions/${id}`);
export const restoreCommission       = (id)  => api.post(`/commissions/${id}/restore`).then((r) => r.data);

// Useful Information had no API at all — the model, its index and the Report
// panel that reads it all existed, but nothing could put a row there, so the
// panel has always read "No useful information found."
export const createUsefulInformation  = (b)     => api.post('/useful-information', b).then((r) => r.data);
export const updateUsefulInformation  = (id, b) => api.put(`/useful-information/${id}`, b).then((r) => r.data);
export const archiveUsefulInformation = (id)    => api.delete(`/useful-information/${id}`);
export const restoreUsefulInformation = (id)    => api.post(`/useful-information/${id}/restore`).then((r) => r.data);

// PATCH /:id/stage was admin-gated but had no client function and no screen.
export const updateInquiryStage = (id, stage) =>
  api.patch(`/course-inquiries/${id}/stage`, { stage }).then((r) => r.data);
export const fetchStorageStatus = ()      => api.get('/documents/storage-status').then((r) => r.data);
export const createUploadUrl    = (b)     => api.post('/documents/upload-url', b).then((r) => r.data);

// One uploader for the whole admin panel. `/api/uploads` replaced the three
// near-identical endpoints (documents, agency logo, profile avatar) and the
// "paste a URL" boxes that existed because nothing in the product could produce
// a link. Where the bytes land — R2 or the server's disk — is the server's
// decision, so callers only deal in the returned URL.
//
// `category` is a folder hint for the object key, sanitised server-side. It used
// to be accepted and then dropped here, so every upload landed in one flat
// prefix regardless of what it was.
async function upload(path, file, category) {
  const form = new FormData();
  form.append('file', file, file.name);
  if (category) form.append('category', category);
  const { data } = await api.post(path, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  // The whole response, not just data.fileUrl. A PDF upload also comes back with
  // a rendered thumbnailUrl, and a helper that threw that away meant the one
  // caller who wants it could not have it.
  return data;
}

/** Logos, banners — anything that ends up in an <img>. PNG/JPEG/WebP, 5 MB. */
export const uploadImage = (file, category) => upload('/uploads/image', file, category);

/** Documents, forms, attachments. The document allow-list, 25 MB. */
export const uploadFile = (file, category) => upload('/uploads/file', file, category);

export const fetchUploadStatus = () => api.get('/uploads/status').then((r) => r.data);

// ---- commissions (upsert keyed on institutionId) ----
export const upsertCommission = (b) => api.put('/commissions', b).then((r) => r.data);

// ---- entry requirements (upsert keyed on institutionId + level) ----
export const upsertEntryRequirement = (b) => api.put('/entry-requirements', b).then((r) => r.data);

// ---- MOI acceptances ----
export const fetchMoiAcceptances  = (p)     => api.get('/moi-institutions', { params: p }).then((r) => r.data);
export const createMoiAcceptance  = (b)     => api.post('/moi-institutions', b).then((r) => r.data);
export const updateMoiAcceptance  = (id, b) => api.put(`/moi-institutions/${id}`, b).then((r) => r.data);
export const deleteMoiAcceptance  = (id)    => api.delete(`/moi-institutions/${id}`);

// ---- sub-agents ----
export const fetchSubAgents  = ()     => api.get('/auth/sub-agents').then((r) => r.data.items);
export const createSubAgent  = (b)    => api.post('/auth/sub-agents', b).then((r) => r.data);
export const removeSubAgent  = (id)   => api.delete(`/auth/sub-agents/${id}`);

// ---- users (SUPER_ADMIN list + ADMIN detail/management) ----
export const fetchAllUsers        = (p)     => api.get('/auth/users', { params: p }).then((r) => r.data);
export const createUser           = (b)     => api.post('/auth/users', b).then((r) => r.data);
export const fetchUserDetail      = (id)    => api.get(`/auth/users/${id}`).then((r) => r.data);
export const updateUserAdmin      = (id, b) => api.put(`/auth/users/${id}`, b).then((r) => r.data);
export const setUserActive        = (id, v) => api.patch(`/auth/users/${id}/active`, { isActive: v }).then((r) => r.data);
export const revokeUserSessions   = (id)    => api.post(`/auth/users/${id}/revoke-sessions`).then((r) => r.data);
export const adminResetPassword   = (id, p) => api.post(`/auth/users/${id}/reset-password`, { newPassword: p }).then((r) => r.data);

// ---- admin dashboard stats ----
export const fetchAdminStats = () => api.get('/reports/admin-stats').then((r) => r.data);

// Uploads the file straight to the bucket using a signed URL.
// Only usable once S3/R2 credentials are configured; uploadFile() above is the
// path that also works against local disk.
export async function uploadFileSigned(file, category) {
  const { uploadUrl, fileUrl, requiredHeaders } = await createUploadUrl({
    filename:    file.name,
    contentType: file.type,
    size:        file.size,
    category,
  });
  const response = await fetch(uploadUrl, { method: 'PUT', headers: requiredHeaders, body: file });
  if (!response.ok) throw new Error(`Upload failed (${response.status}).`);
  return fileUrl;
}

// ---- countries ----
export const createCountry = (b) => api.post('/countries', b).then((r) => r.data);
export const updateCountry = (id, b) => api.put(`/countries/${id}`, b).then((r) => r.data);
export const deleteCountry = (id) => api.delete(`/countries/${id}`);

// ---- cross-agency activity (staff only) ----
export const fetchActivity     = (p) => api.get('/reports/activity', { params: p }).then((r) => r.data);
export const fetchAgentSummary = ()  => api.get('/reports/agent-summary').then((r) => r.data.items);

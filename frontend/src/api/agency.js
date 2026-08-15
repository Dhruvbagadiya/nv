import { api } from './client.js';

// All agency endpoints are at /api/agency (no /profile suffix)
export const fetchAgencyProfile  = ()        => api.get('/agency').then((r) => r.data.profile);
export const saveAgencyProfile = (payload) =>
  api.put('/agency', payload).then((r) => r.data.profile);
export const deleteAgencyProfile = ()        => api.delete('/agency');

/**
 * Upload a cropped logo blob.
 * @param {Blob} blob — the cropped image blob from the canvas
 * @param {string} mimeType — 'image/png' | 'image/jpeg' | 'image/webp'
 * @returns {Promise<string>} logoUrl
 */
export async function uploadAgencyLogo(blob, mimeType = 'image/png') {
  const form = new FormData();
  form.append('logo', blob, `logo.${mimeType.split('/')[1]}`);
  const { data } = await api.post('/agency/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.logoUrl;
}

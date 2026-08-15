import { api } from './client.js';

export const fetchProfile = () =>
  api.get('/profile').then((r) => r.data.profile);

export const updateProfile = (payload) =>
  api.put('/profile', payload).then((r) => r.data.profile);

export const changePassword = (payload) =>
  api.post('/profile/password', payload).then((r) => r.data);

/**
 * Upload an avatar blob (already cropped client-side).
 * @param {Blob} blob
 * @param {string} mimeType
 * @returns {Promise<object>} updated profile
 */
export async function uploadAvatar(blob, mimeType = 'image/png') {
  const form = new FormData();
  form.append('avatar', blob, `avatar.${mimeType.split('/')[1]}`);
  const { data } = await api.post('/profile/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.profile;
}

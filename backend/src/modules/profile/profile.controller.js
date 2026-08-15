import * as profileService from './profile.service.js';

export async function getProfileHandler(req, res) {
  res.json({ profile: await profileService.getProfile(req.user.sub) });
}

export async function updateProfileHandler(req, res) {
  res.json({ profile: await profileService.updateProfile(req.user.sub, req.body) });
}

export async function changePasswordHandler(req, res) {
  await profileService.changePassword(req.user.sub, req.body);
  // 200 with a message rather than 204 so the frontend can show a toast
  res.json({ message: 'Password changed. All other devices have been logged out.' });
}

export async function uploadAvatarHandler(req, res) {
  const profile = await profileService.saveAvatar(req.user.sub, req.file);
  res.json({ profile });
}

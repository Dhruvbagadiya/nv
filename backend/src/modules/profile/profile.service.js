import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../utils/prisma.js';
import { fileURLToPath } from 'node:url';
import { UnauthorizedError, BadRequestError } from '../../utils/httpErrors.js';
import { putObject, IMAGE_TYPES, AVATAR_MAX_BYTES } from '../../utils/storage.js';

// Fields returned in every profile response
const PROFILE_SELECT = {
  id: true, name: true, email: true, role: true,
  isActive: true, phone: true, bio: true, avatarUrl: true,
  parentAgentId: true, createdAt: true, updatedAt: true,
};

export async function getProfile(userId) {
  return prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
}

export async function updateProfile(userId, { name, phone, bio, avatarUrl }) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(name      !== undefined && { name }),
      ...(phone     !== undefined && { phone }),
      ...(bio       !== undefined && { bio }),
      ...(avatarUrl !== undefined && { avatarUrl }),
    },
    select: PROFILE_SELECT,
  });
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Current password is incorrect.');

  if (currentPassword === newPassword) {
    throw new BadRequestError('New password must be different from current password.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  // Revoke all other refresh tokens so every other device is logged out after
  // a password change — standard security behaviour.
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
  });
}

// ── Avatar upload ────────────────────────────────────────────────────────────
// Resolved from this module, not process.cwd(): cleanup of a previous local
// avatar silently targeted the wrong path when the process was started from
// anywhere other than backend/.
const LOCAL_UPLOADS = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'uploads'
);

export async function saveAvatar(userId, file) {
  if (!file) throw new BadRequestError('No image file provided.');

  // Was a third copy of the S3-or-disk branch, and the only one that built a
  // fresh S3Client on every single upload rather than caching it. putObject
  // owns that now.
  const { fileUrl: avatarUrl } = await putObject(file.buffer, {
    filename:    file.originalname,
    contentType: file.mimetype,
    category:    'avatars',
    allowed:     IMAGE_TYPES,
    maxBytes:    AVATAR_MAX_BYTES,
  });

  // Delete the old avatar file from local disk if it was a local upload
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
  if (user?.avatarUrl?.startsWith('/uploads/avatars/')) {
    const old = path.join(LOCAL_UPLOADS, user.avatarUrl.replace('/uploads/', ''));
    try { fs.unlinkSync(old); } catch { /* best-effort */ }
  }

  return prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
    select: PROFILE_SELECT,
  });
}

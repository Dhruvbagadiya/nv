import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../utils/prisma.js';
import { UnauthorizedError, BadRequestError } from '../../utils/httpErrors.js';
import { config } from '../../config.js';

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
const AVATAR_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'avatars');

function ensureAvatarDir() {
  fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
}

export async function saveAvatar(userId, file) {
  if (!file) throw new BadRequestError('No image file provided.');

  const ext     = file.mimetype === 'image/png' ? '.png'
                : file.mimetype === 'image/webp' ? '.webp'
                : '.jpg';
  const filename = `${crypto.randomUUID()}${ext}`;

  let avatarUrl;

  if (config.storage.enabled) {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: config.storage.region,
      ...(config.storage.endpoint && { endpoint: config.storage.endpoint }),
      credentials: { accessKeyId: config.storage.accessKeyId, secretAccessKey: config.storage.secretAccessKey },
      ...(config.storage.endpoint && { forcePathStyle: true }),
    });
    const key = `avatars/${filename}`;
    await s3.send(new PutObjectCommand({
      Bucket: config.storage.bucket, Key: key,
      Body: file.buffer, ContentType: file.mimetype,
    }));
    avatarUrl = `${config.storage.publicBaseUrl}/${key}`;
  } else {
    ensureAvatarDir();
    fs.writeFileSync(path.join(AVATAR_UPLOAD_DIR, filename), file.buffer);
    avatarUrl = `/uploads/avatars/${filename}`;
  }

  // Delete the old avatar file from local disk if it was a local upload
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
  if (user?.avatarUrl?.startsWith('/uploads/avatars/')) {
    const old = path.join(process.cwd(), user.avatarUrl.slice(1));
    try { fs.unlinkSync(old); } catch { /* best-effort */ }
  }

  return prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
    select: PROFILE_SELECT,
  });
}

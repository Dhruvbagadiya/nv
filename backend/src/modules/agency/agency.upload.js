/**
 * Logo upload handler.
 *
 * Strategy:
 *   - If S3 is configured  → upload to bucket, return public URL
 *   - Otherwise            → save to backend/uploads/logos/, serve via /uploads/*
 *
 * The cropping is done CLIENT-SIDE (canvas API) before this endpoint is called,
 * so what arrives here is already the final square PNG. This keeps the server
 * simple and avoids a server-side image processing dependency.
 *
 * Constraints enforced here:
 *   - Only image/png, image/jpeg, image/webp accepted
 *   - Max 2 MB
 *   - File is renamed to a UUID so paths are unguessable and never collide
 */
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../../config.js';
import { BadRequestError, HttpError } from '../../utils/httpErrors.js';

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES     = 2 * 1024 * 1024; // 2 MB — logos don't need to be large

// ── multer ──────────────────────────────────────────────────────────────────
// Always buffer in memory first — small images (< 2 MB) fit easily and we need
// the buffer to forward to S3 when storage is enabled.
export const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new BadRequestError(`Unsupported image type "${file.mimetype}". Use PNG, JPEG or WebP.`));
  },
});

// Ensure local uploads directory exists (created lazily, no boot-time side-effect).
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'logos');
function ensureDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── S3 client (lazy singleton) ───────────────────────────────────────────────
let _s3;
function getS3() {
  _s3 ??= new S3Client({
    region: config.storage.region,
    ...(config.storage.endpoint && { endpoint: config.storage.endpoint }),
    credentials: {
      accessKeyId:     config.storage.accessKeyId,
      secretAccessKey: config.storage.secretAccessKey,
    },
    ...(config.storage.endpoint && { forcePathStyle: true }),
  });
  return _s3;
}

// ── Main upload function ────────────────────────────────────────────────────
export async function saveLogo(file) {
  if (!file) throw new BadRequestError('No image file provided.');

  const ext      = file.mimetype === 'image/png'  ? '.png'
                 : file.mimetype === 'image/webp' ? '.webp'
                 : '.jpg';
  const filename = `${crypto.randomUUID()}${ext}`;

  // ── S3 / R2 ──────────────────────────────────────────────────────────────
  if (config.storage.enabled) {
    const key = `logos/${filename}`;
    await getS3().send(new PutObjectCommand({
      Bucket:      config.storage.bucket,
      Key:         key,
      Body:        file.buffer,
      ContentType: file.mimetype,
    }));
    return `${config.storage.publicBaseUrl}/${key}`;
  }

  // ── Local disk fallback ───────────────────────────────────────────────────
  ensureDir();
  const dest = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(dest, file.buffer);
  // Served by Express static middleware mounted in app.js at /uploads
  return `/uploads/logos/${filename}`;
}

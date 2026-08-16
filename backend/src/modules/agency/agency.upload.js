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
import multer from 'multer';
import { putObject, IMAGE_TYPES, LOGO_MAX_BYTES } from '../../utils/storage.js';
import { BadRequestError } from '../../utils/httpErrors.js';

const ALLOWED_MIME = Object.keys(IMAGE_TYPES);
const MAX_BYTES    = LOGO_MAX_BYTES; // 2 MB — logos don't need to be large

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

// ── Main upload function ────────────────────────────────────────────────────
// The S3-or-disk branch, its client, and the local directory handling all used
// to live here in a near-copy of the same logic in profile.service.js and
// storage.js. One implementation now, so a fix to any of it lands everywhere —
// and the local path is resolved relative to the module rather than
// process.cwd(), which quietly wrote to the wrong place when the process was
// started from a directory other than backend/.
export async function saveLogo(file) {
  if (!file) throw new BadRequestError('No image file provided.');

  const { fileUrl } = await putObject(file.buffer, {
    filename:    file.originalname,
    contentType: file.mimetype,
    category:    'logos',
    allowed:     IMAGE_TYPES,
    maxBytes:    MAX_BYTES,
  });

  return fileUrl;
}

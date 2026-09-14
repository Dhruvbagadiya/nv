/**
 * One upload endpoint for the admin panel.
 *
 * Admin forms used to ask for a *URL* — "Logo URL", "Banner URL", the attachment
 * on an Important Update — which meant an admin had to host the file somewhere
 * else first and paste a link back in. Nothing in the product could produce that
 * link, so in practice the fields stayed empty or pointed at someone else's
 * server.
 *
 * There were already three near-identical upload paths (documents, agency logo,
 * profile avatar), each with its own multer instance and its own idea of what a
 * safe file is. This is the shared one: the same `putObject` under it, so where
 * bytes land is decided by STORAGE_ENABLED (R2 when configured, backend/uploads
 * otherwise) rather than by the caller.
 *
 *   POST /api/uploads/image  — logos, banners, anything shown in an <img>
 *   POST /api/uploads/file   — documents, forms, attachments
 *
 * `category` is only a folder hint for the object key; putObject's buildKey
 * strips it to a single safe path segment, so a caller cannot traverse out of
 * the bucket prefix with it.
 */

import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { renderPdfThumbnail, thumbnailKeyFor } from '../../utils/pdfThumbnail.js';
import { BadRequestError } from '../../utils/httpErrors.js';
import { putObject, IMAGE_TYPES, IMAGE_TYPE_ADVICE, storageStatus, MAX_BYTES, putGeneratedObject } from '../../utils/storage.js';

const router = Router();
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

// Banners are wide header images and run larger than the 2 MB a square logo
// needs, so the image cap is its own number rather than borrowing LOGO_MAX_BYTES.
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const FILE_MAX_BYTES = MAX_BYTES;

const IMAGE_MIME = Object.keys(IMAGE_TYPES);

// Rejected at multer, before the bytes are buffered, so an obviously wrong file
// fails fast with a message naming what is accepted.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME.includes(file.mimetype)) return cb(null, true);
    // A named reason where there is one. "Unsupported image type image/heic" is
    // useless to someone whose phone picked the format for them.
    const advice = IMAGE_TYPE_ADVICE[file.mimetype];
    cb(new BadRequestError(
      advice ?? `Unsupported image type "${file.mimetype}". Use PNG, JPEG, WebP, GIF or AVIF.`
    ));
  },
});

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_MAX_BYTES },
});

router.post(
  '/image',
  ...admin,
  imageUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('No file provided.');

    const { fileUrl, storage } = await putObject(req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      category: req.body?.category ?? 'images',
      allowed: IMAGE_TYPES,
      maxBytes: IMAGE_MAX_BYTES,
    });

    res.json({ fileUrl, storage });
  })
);

router.post(
  '/file',
  ...admin,
  fileUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('No file provided.');

    // No `allowed` override: putObject's default list is the documents one, and
    // duplicating it here is how the two drift apart.
    const { key, fileUrl, storage } = await putObject(req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      category: req.body?.category ?? 'files',
    });

    // A preview for the Document Bank grid, which otherwise shows one identical
    // glyph per file. Best-effort on purpose: renderPdfThumbnail returns null
    // for anything it cannot draw, and refusing a perfectly good upload because
    // a picture of it could not be made would be the wrong trade.
    let thumbnailUrl = null;
    if (req.file.mimetype === 'application/pdf') {
      const jpeg = await renderPdfThumbnail(req.file.buffer);
      if (jpeg) {
        ({ fileUrl: thumbnailUrl } = await putGeneratedObject(jpeg, {
          key: thumbnailKeyFor(key),
          contentType: 'image/jpeg',
        }));
      }
    }

    res.json({ fileUrl, thumbnailUrl, storage });
  })
);

// Lets a form say up front where a file will land — the admin document form
// already does this so nobody picks a file and waits for a failure.
router.get('/status', ...admin, asyncHandler(async (_req, res) => res.json(storageStatus())));

export default router;

import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { putObject } from '../../utils/storage.js';
import { BadRequestError } from '../../utils/httpErrors.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listDocumentsQuery,
  createDocumentBody,
  updateDocumentBody,
  uploadUrlBody,
  idParam,
  DOCUMENT_CATEGORIES,
} from './documents.schemas.js';
import {
  listDocumentsHandler,
  countsHandler,
  facetsHandler,
  uploadUrlHandler,
  storageStatusHandler,
  createDocumentHandler,
  updateDocumentHandler,
  archiveDocumentHandler,
  restoreDocumentHandler,
} from './documents.controller.js';

const router = Router();
// Partner-side only — the partner document bank. Adding STUDENT to the Role
// enum silently widened every route that was merely `requireAuth`.
const partnerAuth = [requireAuth, requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN')];
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

router.get('/counts', ...partnerAuth, asyncHandler(countsHandler));

// Filter options that can actually return something, for the given category.
router.get(
  '/facets',
  ...partnerAuth,
  validate(z.object({ category: z.enum(DOCUMENT_CATEGORIES) }), 'query'),
  asyncHandler(facetsHandler)
);

// Static segments, admin-only. Both before /:id.
router.get('/storage-status', ...admin, asyncHandler(storageStatusHandler));
router.post('/upload-url',    ...admin, validate(uploadUrlBody), asyncHandler(uploadUrlHandler));

// POST /api/documents/upload — multipart upload, bytes through the API.
//
// Delegates to putObject, so where the file lands is decided by
// STORAGE_ENABLED rather than by this route: S3/R2 when configured, otherwise
// backend/uploads. It previously wrote to disk itself, which meant documents
// stayed on one box's filesystem even with a bucket configured, and — because it
// derived the extension straight from the client's filename — accepted .html,
// .svg and .exe. putObject enforces the same content-type allow-list the
// presigned path uses.
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // matches MAX_BYTES in storage.js
});

router.post(
  '/upload',
  ...admin,
  docUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('No file provided.');

    const { fileUrl, storage } = await putObject(req.file.buffer, {
      filename:    req.file.originalname,
      contentType: req.file.mimetype,
      category:    req.body?.category,
    });

    res.json({ fileUrl, storage });
  })
);

// GET /api/documents?category=VISA_DOCUMENT&countryId=&institutionId=&search=
router.get(
  '/',
  ...partnerAuth,
  validate(listDocumentsQuery, 'query'),
  asyncHandler(listDocumentsHandler)
);

// Registers a document that already exists at `fileUrl` — either pasted in, or
// just uploaded via /upload-url above.
router.post('/', ...admin, validate(createDocumentBody), asyncHandler(createDocumentHandler));

router.put(
  '/:id',
  ...admin,
  validate(idParam, 'params'),
  validate(updateDocumentBody),
  asyncHandler(updateDocumentHandler)
);

router.delete('/:id', ...admin, validate(idParam, 'params'), asyncHandler(archiveDocumentHandler));

// Archiving is reversible, but only if something can restore it. Without this
// the row stayed in the table and no endpoint could reach it again.
router.post('/:id/restore', ...admin, validate(idParam, 'params'), asyncHandler(restoreDocumentHandler));

export default router;

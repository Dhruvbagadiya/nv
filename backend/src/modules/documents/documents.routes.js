import { Router } from 'express';
import { z } from 'zod';
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

// POST /api/documents/upload — multipart file upload.
// Works with local disk when S3 is not configured (same as /api/agency/logo).
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const _dir = dirname(fileURLToPath(import.meta.url));
const DOCS_UPLOAD_DIR = path.join(_dir, '..', '..', '..', 'uploads', 'documents');

const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB for documents
});

router.post(
  '/upload',
  ...admin,
  docUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });

    const ext      = path.extname(req.file.originalname) || '.bin';
    const filename = `${crypto.randomUUID()}${ext}`;

    fs.mkdirSync(DOCS_UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(DOCS_UPLOAD_DIR, filename), req.file.buffer);

    res.json({ fileUrl: `/uploads/documents/${filename}` });
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

export default router;

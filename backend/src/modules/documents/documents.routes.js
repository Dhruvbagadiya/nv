import { Router } from 'express';
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
} from './documents.schemas.js';
import {
  listDocumentsHandler,
  countsHandler,
  uploadUrlHandler,
  storageStatusHandler,
  createDocumentHandler,
  updateDocumentHandler,
  archiveDocumentHandler,
} from './documents.controller.js';

const router = Router();
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

router.get('/counts', requireAuth, asyncHandler(countsHandler));

// Static segments, admin-only. Both before /:id.
router.get('/storage-status', ...admin, asyncHandler(storageStatusHandler));
router.post('/upload-url', ...admin, validate(uploadUrlBody), asyncHandler(uploadUrlHandler));

// GET /api/documents?category=VISA_DOCUMENT&countryId=&institutionId=&search=
router.get(
  '/',
  requireAuth,
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

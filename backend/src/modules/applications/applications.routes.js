import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import multer from 'multer';
import {
  listApplicationsQuery,
  createApplicationBody,
  updateStageBody,
  addDocumentBody,
  documentIdParam,
  idParam,
  documentListQuery,
} from './applications.schemas.js';
import {
  createApplicationHandler,
  listApplicationsHandler,
  getApplicationHandler,
  updateStageHandler,
  listDocumentsHandler,
  addDocumentHandler,
  archiveDocumentHandler,
} from './applications.controller.js';
import { MAX_BYTES } from '../../utils/storage.js';

const router = Router();
// Partner/admin only — students use /api/students/applications instead.
const partnerAuth = [requireAuth, requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN')];

// GET /api/applications?country=&institutionId=&stage=&passportNo=&studentName=&page=
router.get(
  '/',
  ...partnerAuth,
  validate(listApplicationsQuery, 'query'),
  asyncHandler(listApplicationsHandler)
);

// POST /api/applications
router.post(
  '/',
  ...partnerAuth,
  validate(createApplicationBody),
  asyncHandler(createApplicationHandler)
);

// Detail view — agent-scoped in the service.
router.get('/:id', ...partnerAuth, validate(idParam, 'params'), asyncHandler(getApplicationHandler));

// Advancing an application is staff work, not something the submitting agent does.
router.patch(
  '/:id/stage',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validate(idParam, 'params'),
  validate(updateStageBody),
  asyncHandler(updateStageHandler)
);

// ── Documents ───────────────────────────────────────────────────────────────
//
// Nested under the application on purpose. /api/uploads is ADMIN-only, so an
// agent previously had no reachable upload endpoint at all — and opening that
// one up would have given them a generic "store any file" route with no
// connection to anything they own. These carry the application in the path, so
// the ownership check and the write are the same decision.

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
});

// GET /api/applications/:id/documents
router.get(
  '/:id/documents',
  ...partnerAuth,
  validate(idParam, 'params'),
  validate(documentListQuery, 'query'),
  asyncHandler(listDocumentsHandler)
);

// POST /api/applications/:id/documents   (multipart: file + kind + label)
router.post(
  '/:id/documents',
  ...partnerAuth,
  validate(idParam, 'params'),
  // multer first: it parses the multipart body, so the text fields do not exist
  // for zod to validate until it has run.
  documentUpload.single('file'),
  validate(addDocumentBody),
  asyncHandler(addDocumentHandler)
);

// DELETE /api/applications/:id/documents/:documentId
router.delete(
  '/:id/documents/:documentId',
  ...partnerAuth,
  validate(documentIdParam, 'params'),
  asyncHandler(archiveDocumentHandler)
);

export default router;

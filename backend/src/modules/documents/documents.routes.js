import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listDocumentsQuery,
  createDocumentBody,
  updateDocumentBody,
  idParam,
} from './documents.schemas.js';
import {
  listDocumentsHandler,
  countsHandler,
  createDocumentHandler,
  updateDocumentHandler,
  archiveDocumentHandler,
} from './documents.controller.js';

const router = Router();
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

router.get('/counts', requireAuth, asyncHandler(countsHandler));

// GET /api/documents?category=VISA_DOCUMENT&countryId=&institutionId=&search=
router.get(
  '/',
  requireAuth,
  validate(listDocumentsQuery, 'query'),
  asyncHandler(listDocumentsHandler)
);

// NOTE: file upload is not wired here yet. `multer` is a dependency and this is
// where it belongs, but the storage backend (local disk vs S3/R2 presigned) is
// still an open decision, and picking one to satisfy an endpoint would be the
// wrong way round. For now documents are registered by URL, which is enough for
// the five read-only screens the reference portal actually shows.
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

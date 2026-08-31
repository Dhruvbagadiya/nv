import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listInstitutionsQuery,
  createInstitutionBody,
  updateInstitutionBody,
  blacklistBody,
  idParam,
  photoIdParam,
  addPhotoBody,
  reorderPhotosBody,
} from './institutions.schemas.js';
import {
  listInstitutionsHandler,
  listTrendingHandler,
  createInstitutionHandler,
  updateInstitutionHandler,
  setBlacklistHandler,
  archiveInstitutionHandler,
  restoreInstitutionHandler,
  listPhotosHandler,
  addPhotoHandler,
  deletePhotoHandler,
  reorderPhotosHandler,
} from './institutions.controller.js';

const router = Router();
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

// GET /api/institutions — public so the student programme browser can populate
// its institution filters without requiring sign-in.
router.get('/trending', asyncHandler(listTrendingHandler));
router.get('/', validate(listInstitutionsQuery, 'query'), asyncHandler(listInstitutionsHandler));

router.post('/', ...admin, validate(createInstitutionBody), asyncHandler(createInstitutionHandler));

router.put('/:id', ...admin, validate(idParam, 'params'), validate(updateInstitutionBody), asyncHandler(updateInstitutionHandler));

router.patch('/:id/blacklist', ...admin, validate(idParam, 'params'), validate(blacklistBody), asyncHandler(setBlacklistHandler));

router.delete('/:id', ...admin, validate(idParam, 'params'), asyncHandler(archiveInstitutionHandler));

router.post('/:id/restore', ...admin, validate(idParam, 'params'), asyncHandler(restoreInstitutionHandler));

// Gallery photos. Read is admin-only too: the public catalogue already receives
// a school's photos inside the program resource, so there is no unauthenticated
// caller for this and no reason to widen the surface.
router.get('/:id/photos', ...admin, validate(idParam, 'params'), asyncHandler(listPhotosHandler));

router.post('/:id/photos', ...admin, validate(idParam, 'params'), validate(addPhotoBody), asyncHandler(addPhotoHandler));

router.put('/:id/photos/reorder', ...admin, validate(idParam, 'params'), validate(reorderPhotosBody), asyncHandler(reorderPhotosHandler));

// Nested under the institution so ownership is checked by the path, not taken
// on trust from the photo id alone.
router.delete('/:id/photos/:photoId', ...admin, validate(photoIdParam, 'params'), asyncHandler(deletePhotoHandler));

export default router;

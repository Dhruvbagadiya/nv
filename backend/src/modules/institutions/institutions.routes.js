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
} from './institutions.schemas.js';
import {
  listInstitutionsHandler,
  listTrendingHandler,
  createInstitutionHandler,
  updateInstitutionHandler,
  setBlacklistHandler,
  archiveInstitutionHandler,
} from './institutions.controller.js';

const router = Router();
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

// Static segments before /:id, otherwise "trending" is parsed as an id and
// rejected by the uuid check.
router.get('/trending', requireAuth, asyncHandler(listTrendingHandler));

// GET /api/institutions?country=&search=&blacklisted=&trending=
// Any authenticated user — this powers the filter dropdowns everywhere.
router.get(
  '/',
  requireAuth,
  validate(listInstitutionsQuery, 'query'),
  asyncHandler(listInstitutionsHandler)
);

router.post('/', ...admin, validate(createInstitutionBody), asyncHandler(createInstitutionHandler));

router.put(
  '/:id',
  ...admin,
  validate(idParam, 'params'),
  validate(updateInstitutionBody),
  asyncHandler(updateInstitutionHandler)
);

router.patch(
  '/:id/blacklist',
  ...admin,
  validate(idParam, 'params'),
  validate(blacklistBody),
  asyncHandler(setBlacklistHandler)
);

router.delete('/:id', ...admin, validate(idParam, 'params'), asyncHandler(archiveInstitutionHandler));

export default router;

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listUpdatesQuery,
  createUpdateBody,
  updateUpdateBody,
  idParam,
} from './importantUpdates.schemas.js';
import {
  listUpdatesHandler,
  getUpdateHandler,
  createUpdateHandler,
  updateUpdateHandler,
  archiveUpdateHandler,
} from './importantUpdates.controller.js';

const router = Router();
// Partner-side only — partner-internal announcements. Adding STUDENT to the Role
// enum silently widened every route that was merely `requireAuth`.
const partnerAuth = [requireAuth, requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN')];
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

// GET /api/important-updates?from=&to=&countryId=&institutionId=&page=
router.get('/', ...partnerAuth, validate(listUpdatesQuery, 'query'), asyncHandler(listUpdatesHandler));

router.get('/:id', ...partnerAuth, validate(idParam, 'params'), asyncHandler(getUpdateHandler));

router.post('/', ...admin, validate(createUpdateBody), asyncHandler(createUpdateHandler));

router.put(
  '/:id',
  ...admin,
  validate(idParam, 'params'),
  validate(updateUpdateBody),
  asyncHandler(updateUpdateHandler)
);

router.delete('/:id', ...admin, validate(idParam, 'params'), asyncHandler(archiveUpdateHandler));

export default router;

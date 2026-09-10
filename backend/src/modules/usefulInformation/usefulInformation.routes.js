import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listUsefulInformationQuery,
  createUsefulInformationBody,
  updateUsefulInformationBody,
  idParam,
} from './usefulInformation.schemas.js';
import {
  listUsefulInformationHandler,
  createUsefulInformationHandler,
  updateUsefulInformationHandler,
  archiveUsefulInformationHandler,
  restoreUsefulInformationHandler,
} from './usefulInformation.controller.js';

const router = Router();
// Partner-side reference content. Adding STUDENT to the Role enum silently
// widened every route that was merely `requireAuth`.
const partnerAuth = [requireAuth, requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN')];
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

router.get('/', ...partnerAuth, validate(listUsefulInformationQuery, 'query'), asyncHandler(listUsefulInformationHandler));
router.post('/', ...admin, validate(createUsefulInformationBody), asyncHandler(createUsefulInformationHandler));
router.put('/:id', ...admin, validate(idParam, 'params'), validate(updateUsefulInformationBody), asyncHandler(updateUsefulInformationHandler));
router.delete('/:id', ...admin, validate(idParam, 'params'), asyncHandler(archiveUsefulInformationHandler));

// Archiving is reversible, but only if something can restore it.
router.post('/:id/restore', ...admin, validate(idParam, 'params'), asyncHandler(restoreUsefulInformationHandler));

export default router;

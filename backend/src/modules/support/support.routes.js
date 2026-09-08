import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createContactBody, updateContactBody, idParam, listContactsQuery } from './support.schemas.js';
import {
  listContactsHandler,
  createContactHandler,
  updateContactHandler,
  archiveContactHandler,
  restoreContactHandler,
} from './support.controller.js';

const router = Router();
// Partner-side only — the partner support team. Adding STUDENT to the Role
// enum silently widened every route that was merely `requireAuth`.
const partnerAuth = [requireAuth, requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN')];
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

router.get('/', ...partnerAuth, validate(listContactsQuery, 'query'), asyncHandler(listContactsHandler));
router.post('/', ...admin, validate(createContactBody), asyncHandler(createContactHandler));
router.put(
  '/:id',
  ...admin,
  validate(idParam, 'params'),
  validate(updateContactBody),
  asyncHandler(updateContactHandler)
);
router.delete('/:id', ...admin, validate(idParam, 'params'), asyncHandler(archiveContactHandler));

// Archiving is reversible, but only if something can restore it. Without this
// the row stayed in the table and no endpoint could reach it again.
router.post('/:id/restore', ...admin, validate(idParam, 'params'), asyncHandler(restoreContactHandler));

export default router;

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createContactBody, updateContactBody, idParam } from './support.schemas.js';
import {
  listContactsHandler,
  createContactHandler,
  updateContactHandler,
  archiveContactHandler,
} from './support.controller.js';

const router = Router();
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

router.get('/', requireAuth, asyncHandler(listContactsHandler));
router.post('/', ...admin, validate(createContactBody), asyncHandler(createContactHandler));
router.put(
  '/:id',
  ...admin,
  validate(idParam, 'params'),
  validate(updateContactBody),
  asyncHandler(updateContactHandler)
);
router.delete('/:id', ...admin, validate(idParam, 'params'), asyncHandler(archiveContactHandler));

export default router;

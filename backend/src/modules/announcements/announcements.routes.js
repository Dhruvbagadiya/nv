import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createAnnouncementBody,
  updateAnnouncementBody,
  idParam,
} from './announcements.schemas.js';
import {
  listAnnouncementsHandler,
  createAnnouncementHandler,
  updateAnnouncementHandler,
  deleteAnnouncementHandler,
} from './announcements.controller.js';

const router = Router();
// Partner-side only — the partner shell banners. Adding STUDENT to the Role
// enum silently widened every route that was merely `requireAuth`.
const partnerAuth = [requireAuth, requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN')];
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

router.get('/', ...partnerAuth, asyncHandler(listAnnouncementsHandler));

router.post('/', ...admin, validate(createAnnouncementBody), asyncHandler(createAnnouncementHandler));

router.put(
  '/:id',
  ...admin,
  validate(idParam, 'params'),
  validate(updateAnnouncementBody),
  asyncHandler(updateAnnouncementHandler)
);

router.delete('/:id', ...admin, validate(idParam, 'params'), asyncHandler(deleteAnnouncementHandler));

export default router;

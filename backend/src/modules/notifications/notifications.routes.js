import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listNotificationsQuery, idParam } from './notifications.schemas.js';
import {
  listNotificationsHandler,
  unreadCountHandler,
  markReadHandler,
  markAllReadHandler,
} from './notifications.controller.js';

const router = Router();
// Notifications are partner-facing. Students have no notifications table rows and
// the bell icon doesn't exist in the student shell, so this is partner-only.
const partnerAuth = [requireAuth, requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN')];

router.get('/unread-count', ...partnerAuth, asyncHandler(unreadCountHandler));
router.post('/read-all',    ...partnerAuth, asyncHandler(markAllReadHandler));

router.get('/', ...partnerAuth, validate(listNotificationsQuery, 'query'), asyncHandler(listNotificationsHandler));

router.patch('/:id/read', ...partnerAuth, validate(idParam, 'params'), asyncHandler(markReadHandler));

export default router;

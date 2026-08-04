import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
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

// Static segments before /:id.
// The badge polls this rather than fetching a page of rows to count them.
router.get('/unread-count', requireAuth, asyncHandler(unreadCountHandler));
router.post('/read-all', requireAuth, asyncHandler(markAllReadHandler));

// GET /api/notifications?unreadOnly=true&page=
router.get(
  '/',
  requireAuth,
  validate(listNotificationsQuery, 'query'),
  asyncHandler(listNotificationsHandler)
);

router.patch('/:id/read', requireAuth, validate(idParam, 'params'), asyncHandler(markReadHandler));

export default router;

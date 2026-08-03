import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { listNotificationsHandler } from './notifications.controller.js';

const router = Router();

// GET /api/notifications
router.get('/', requireAuth, listNotificationsHandler);

export default router;

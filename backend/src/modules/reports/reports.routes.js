import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { summaryHandler, adminStatsHandler } from './reports.controller.js';

const router = Router();

router.get('/summary', requireAuth, asyncHandler(summaryHandler));
router.get('/admin-stats', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), asyncHandler(adminStatsHandler));

export default router;

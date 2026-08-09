import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { summaryHandler, adminStatsHandler } from './reports.controller.js';

const router = Router();
// Partner-side only — the partner pipeline dashboard. Adding STUDENT to the Role
// enum silently widened every route that was merely `requireAuth`.
const partnerAuth = [requireAuth, requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN')];

router.get('/summary', ...partnerAuth, asyncHandler(summaryHandler));
router.get('/admin-stats', ...partnerAuth, requireRole('ADMIN', 'SUPER_ADMIN'), asyncHandler(adminStatsHandler));

export default router;

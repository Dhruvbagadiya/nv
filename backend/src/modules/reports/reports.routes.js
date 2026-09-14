import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { activityQuery } from './reports.schemas.js';
import {
  summaryHandler,
  adminStatsHandler,
  activityHandler,
  agentSummaryHandler,
} from './reports.controller.js';

const router = Router();
// Partner-side only — the partner pipeline dashboard. Adding STUDENT to the Role
// enum silently widened every route that was merely `requireAuth`.
const partnerAuth = [requireAuth, requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN')];

router.get('/summary', ...partnerAuth, asyncHandler(summaryHandler));

const staffAuth = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

router.get('/admin-stats', ...staffAuth, asyncHandler(adminStatsHandler));

// Cross-agency, so staff only. An agent reaching these would be reading every
// other agency's pipeline — the reason `scope.js` exists at all.
router.get('/activity', ...staffAuth, validate(activityQuery, 'query'), asyncHandler(activityHandler));
router.get('/agent-summary', ...staffAuth, asyncHandler(agentSummaryHandler));

export default router;

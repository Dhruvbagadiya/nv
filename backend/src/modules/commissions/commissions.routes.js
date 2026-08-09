import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listCommissionsQuery, upsertCommissionBody } from './commissions.schemas.js';
import { listCommissionsHandler, upsertCommissionHandler } from './commissions.controller.js';

const router = Router();
// Partner-side only — commission rates are the agency margin. Adding STUDENT to the Role
// enum silently widened every route that was merely `requireAuth`.
const partnerAuth = [requireAuth, requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN')];

// GET /api/commissions?country=&search=&page=
router.get(
  '/',
  ...partnerAuth,
  validate(listCommissionsQuery, 'query'),
  asyncHandler(listCommissionsHandler)
);

// One commission per institution, so this is an upsert rather than POST/PUT —
// there is nothing to create twice.
router.put(
  '/',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validate(upsertCommissionBody),
  asyncHandler(upsertCommissionHandler)
);

export default router;

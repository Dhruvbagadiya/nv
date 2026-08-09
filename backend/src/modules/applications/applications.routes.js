import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listApplicationsQuery,
  createApplicationBody,
  updateStageBody,
  idParam,
} from './applications.schemas.js';
import {
  createApplicationHandler,
  listApplicationsHandler,
  getApplicationHandler,
  updateStageHandler,
} from './applications.controller.js';

const router = Router();
// Partner/admin only — students use /api/students/applications instead.
const partnerAuth = [requireAuth, requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN')];

// GET /api/applications?country=&institutionId=&stage=&passportNo=&studentName=&page=
router.get(
  '/',
  ...partnerAuth,
  validate(listApplicationsQuery, 'query'),
  asyncHandler(listApplicationsHandler)
);

// POST /api/applications
router.post(
  '/',
  ...partnerAuth,
  validate(createApplicationBody),
  asyncHandler(createApplicationHandler)
);

// Detail view — agent-scoped in the service.
router.get('/:id', ...partnerAuth, validate(idParam, 'params'), asyncHandler(getApplicationHandler));

// Advancing an application is staff work, not something the submitting agent does.
router.patch(
  '/:id/stage',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validate(idParam, 'params'),
  validate(updateStageBody),
  asyncHandler(updateStageHandler)
);

export default router;

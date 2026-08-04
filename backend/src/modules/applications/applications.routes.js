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

// GET /api/applications?country=&institutionId=&stage=&passportNo=&studentName=&page=
router.get(
  '/',
  requireAuth,
  validate(listApplicationsQuery, 'query'),
  asyncHandler(listApplicationsHandler)
);

// POST /api/applications  { studentName, passportNo, courseId, intakeLabel? }
router.post(
  '/',
  requireAuth,
  validate(createApplicationBody),
  asyncHandler(createApplicationHandler)
);

// Detail view behind the eye icon in Application History. Agent-scoped in the
// service, so an agent cannot read another partner's student by guessing an id.
router.get('/:id', requireAuth, validate(idParam, 'params'), asyncHandler(getApplicationHandler));

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

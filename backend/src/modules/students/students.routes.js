import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  updateProfileBody,
  createApplicationBody,
  listApplicationsQuery,
  idParam,
} from './students.schemas.js';
import {
  getProfileHandler,
  updateProfileHandler,
  listApplicationsHandler,
  createApplicationHandler,
  getApplicationHandler,
} from './students.controller.js';

const router = Router();
const student = [requireAuth, requireRole('STUDENT')];

// GET  /api/students/profile
// PUT  /api/students/profile
router.get('/profile',  ...student, asyncHandler(getProfileHandler));
router.put('/profile',  ...student, validate(updateProfileBody), asyncHandler(updateProfileHandler));

// GET  /api/students/applications
// POST /api/students/applications
// GET  /api/students/applications/:id
router.get('/applications',     ...student, validate(listApplicationsQuery, 'query'), asyncHandler(listApplicationsHandler));
router.post('/applications',    ...student, validate(createApplicationBody), asyncHandler(createApplicationHandler));
router.get('/applications/:id', ...student, validate(idParam, 'params'), asyncHandler(getApplicationHandler));

export default router;

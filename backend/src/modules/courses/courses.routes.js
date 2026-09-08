import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { optionalAuth } from '../../middleware/optionalAuth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listCoursesQuery,
  createCourseBody,
  updateCourseBody,
  bulkImportBody,
  idParam,
} from './courses.schemas.js';
import {
  listCoursesHandler,
  getCourseHandler,
  createCourseHandler,
  updateCourseHandler,
  archiveCourseHandler,
  restoreCourseHandler,
  bulkImportHandler,
} from './courses.controller.js';

const router = Router();
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

// GET /api/courses — public so unauthenticated students can browse the programme
// catalogue without signing in first. Individual course detail is also public.
// Writes remain admin-only.
router.get('/', optionalAuth, validate(listCoursesQuery, 'query'), asyncHandler(listCoursesHandler));

router.get('/:id', validate(idParam, 'params'), asyncHandler(getCourseHandler));

// Admin-only writes.
// bulk-import must be declared before /:id, or "bulk-import" is parsed as an id
// and rejected by the uuid check.
router.post('/bulk-import', ...admin, validate(bulkImportBody), asyncHandler(bulkImportHandler));

router.post('/', ...admin, validate(createCourseBody), asyncHandler(createCourseHandler));

router.put(
  '/:id',
  ...admin,
  validate(idParam, 'params'),
  validate(updateCourseBody),
  asyncHandler(updateCourseHandler)
);

// Archives rather than hard-deletes; applications keep resolving their course.
router.delete('/:id', ...admin, validate(idParam, 'params'), asyncHandler(archiveCourseHandler));

router.post(
  '/:id/restore',
  ...admin,
  validate(idParam, 'params'),
  asyncHandler(restoreCourseHandler)
);

export default router;

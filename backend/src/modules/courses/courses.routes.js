import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import {
  listCoursesHandler,
  createCourseHandler,
  updateCourseHandler,
  deleteCourseHandler,
  bulkImportHandler,
} from './courses.controller.js';

const router = Router();

// GET /api/courses?country=CA&search=data&tag=Prime&page=1
router.get('/', requireAuth, listCoursesHandler);

// Admin-only writes
router.post('/', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), createCourseHandler);
router.put('/:id', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), updateCourseHandler);
router.delete('/:id', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), deleteCourseHandler);
router.post('/bulk-import', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), bulkImportHandler);

export default router;

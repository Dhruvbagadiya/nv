import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { createApplicationHandler, listApplicationsHandler } from './applications.controller.js';

const router = Router();

// GET /api/applications?country=&institutionId=&status=&passportNo=&studentName=&page=
router.get('/', requireAuth, listApplicationsHandler);

// POST /api/applications  { studentName, passportNo, courseId }
router.post('/', requireAuth, createApplicationHandler);

export default router;

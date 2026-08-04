import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listMoiQuery } from './moiInstitutions.schemas.js';
import { listMoiHandler, listCourseTypesHandler } from './moiInstitutions.controller.js';

const router = Router();

// Static segment first, so "course-types" is not parsed as a resource id.
router.get('/course-types', requireAuth, asyncHandler(listCourseTypesHandler));

// GET /api/moi-institutions?country=&institutionId=&courseType=&page=
router.get('/', requireAuth, validate(listMoiQuery, 'query'), asyncHandler(listMoiHandler));

export default router;

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listMoiQuery,
  createMoiBody,
  updateMoiBody,
  idParam,
} from './moiInstitutions.schemas.js';
import {
  listMoiHandler,
  listCourseTypesHandler,
  createMoiHandler,
  updateMoiHandler,
  deleteMoiHandler,
} from './moiInstitutions.controller.js';

const router = Router();
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

router.get('/course-types', requireAuth, asyncHandler(listCourseTypesHandler));
router.get('/', requireAuth, validate(listMoiQuery, 'query'), asyncHandler(listMoiHandler));
router.post('/', ...admin, validate(createMoiBody), asyncHandler(createMoiHandler));
router.put('/:id', ...admin, validate(idParam, 'params'), validate(updateMoiBody), asyncHandler(updateMoiHandler));
router.delete('/:id', ...admin, validate(idParam, 'params'), asyncHandler(deleteMoiHandler));

export default router;

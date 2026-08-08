import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listInstitutionsQuery,
  createInstitutionBody,
  updateInstitutionBody,
  blacklistBody,
  idParam,
} from './institutions.schemas.js';
import {
  listInstitutionsHandler,
  listTrendingHandler,
  createInstitutionHandler,
  updateInstitutionHandler,
  setBlacklistHandler,
  archiveInstitutionHandler,
  restoreInstitutionHandler,
} from './institutions.controller.js';

const router = Router();
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

router.get('/trending', requireAuth, asyncHandler(listTrendingHandler));

router.get('/', requireAuth, validate(listInstitutionsQuery, 'query'), asyncHandler(listInstitutionsHandler));

router.post('/', ...admin, validate(createInstitutionBody), asyncHandler(createInstitutionHandler));

router.put('/:id', ...admin, validate(idParam, 'params'), validate(updateInstitutionBody), asyncHandler(updateInstitutionHandler));

router.patch('/:id/blacklist', ...admin, validate(idParam, 'params'), validate(blacklistBody), asyncHandler(setBlacklistHandler));

router.delete('/:id', ...admin, validate(idParam, 'params'), asyncHandler(archiveInstitutionHandler));

router.post('/:id/restore', ...admin, validate(idParam, 'params'), asyncHandler(restoreInstitutionHandler));

export default router;

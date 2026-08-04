import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listCountriesQuery } from './countries.schemas.js';
import { listCountriesHandler } from './countries.controller.js';

const router = Router();

// GET /api/countries?withInstitutionsOnly=true
router.get(
  '/',
  requireAuth,
  validate(listCountriesQuery, 'query'),
  asyncHandler(listCountriesHandler)
);

export default router;

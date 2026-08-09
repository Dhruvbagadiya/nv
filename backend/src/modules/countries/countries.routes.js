import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listCountriesQuery,
  createCountryBody,
  updateCountryBody,
  idParam,
} from './countries.schemas.js';
import {
  listCountriesHandler,
  createCountryHandler,
  updateCountryHandler,
  deleteCountryHandler,
} from './countries.controller.js';

const router = Router();

// GET /api/countries?withInstitutionsOnly=true
router.get(
  '/',
  requireAuth,
  validate(listCountriesQuery, 'query'),
  asyncHandler(listCountriesHandler)
);


// Reads stay open to every authenticated user — students need the list to browse.
// Writes are admin-only.
const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

router.post('/', ...admin, validate(createCountryBody), asyncHandler(createCountryHandler));

router.put(
  '/:id',
  ...admin,
  validate(idParam, 'params'),
  validate(updateCountryBody),
  asyncHandler(updateCountryHandler)
);

// Refuses when anything still references the country — see the service.
router.delete('/:id', ...admin, validate(idParam, 'params'), asyncHandler(deleteCountryHandler));

export default router;

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listEntryRequirementsQuery,
  englishTestsQuery,
  upsertEntryRequirementBody,
} from './entryRequirements.schemas.js';
import {
  listEntryRequirementsHandler,
  listEnglishTestsHandler,
  upsertEntryRequirementHandler,
} from './entryRequirements.controller.js';

const router = Router();

router.get(
  '/english-tests',
  requireAuth,
  validate(englishTestsQuery, 'query'),
  asyncHandler(listEnglishTestsHandler)
);

// GET /api/entry-requirements?level=UG|PG&country=&institutionId=&englishRequirement=&credibilityInterview=
router.get(
  '/',
  requireAuth,
  validate(listEntryRequirementsQuery, 'query'),
  asyncHandler(listEntryRequirementsHandler)
);

// Unique on (institutionId, level), so an upsert rather than create-or-update.
router.put(
  '/',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validate(upsertEntryRequirementBody),
  asyncHandler(upsertEntryRequirementHandler)
);

export default router;

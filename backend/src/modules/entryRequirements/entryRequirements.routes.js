import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listEntryRequirementsQuery,
  englishTestsQuery,
  upsertEntryRequirementBody,
  idParam,
} from './entryRequirements.schemas.js';
import {
  listEntryRequirementsHandler,
  listEnglishTestsHandler,
  upsertEntryRequirementHandler,
  archiveEntryRequirementHandler,
  restoreEntryRequirementHandler,
} from './entryRequirements.controller.js';

const router = Router();
// Partner-side only — partner reference data. Adding STUDENT to the Role
// enum silently widened every route that was merely `requireAuth`.
const partnerAuth = [requireAuth, requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN')];

router.get(
  '/english-tests',
  ...partnerAuth,
  validate(englishTestsQuery, 'query'),
  asyncHandler(listEnglishTestsHandler)
);

// GET /api/entry-requirements?level=UG|PG&country=&institutionId=&englishRequirement=&credibilityInterview=
router.get(
  '/',
  ...partnerAuth,
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

const admin = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN')];

router.delete('/:id', ...admin, validate(idParam, 'params'), asyncHandler(archiveEntryRequirementHandler));

// Archiving is reversible, but only if something can restore it.
router.post('/:id/restore', ...admin, validate(idParam, 'params'), asyncHandler(restoreEntryRequirementHandler));

export default router;

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listInquiriesQuery,
  createInquiryBody,
  updateStageBody,
  idParam,
} from './courseInquiries.schemas.js';
import {
  createInquiryHandler,
  listInquiriesHandler,
  updateStageHandler,
} from './courseInquiries.controller.js';

const router = Router();
const partnerAuth = [requireAuth, requireRole('AGENT', 'ADMIN', 'SUPER_ADMIN')];

router.get('/', ...partnerAuth, validate(listInquiriesQuery, 'query'), asyncHandler(listInquiriesHandler));
router.post('/', ...partnerAuth, validate(createInquiryBody), asyncHandler(createInquiryHandler));

router.patch(
  '/:id/stage',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validate(idParam, 'params'),
  validate(updateStageBody),
  asyncHandler(updateStageHandler)
);

export default router;

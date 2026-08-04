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

// GET /api/course-inquiries?countryId=&intake=&stage=&page=
router.get(
  '/',
  requireAuth,
  validate(listInquiriesQuery, 'query'),
  asyncHandler(listInquiriesHandler)
);

// POST /api/course-inquiries  { nationality, countryId?, intake?, courseType? }
router.post('/', requireAuth, validate(createInquiryBody), asyncHandler(createInquiryHandler));

router.patch(
  '/:id/stage',
  requireAuth,
  requireRole('ADMIN', 'SUPER_ADMIN'),
  validate(idParam, 'params'),
  validate(updateStageBody),
  asyncHandler(updateStageHandler)
);

export default router;

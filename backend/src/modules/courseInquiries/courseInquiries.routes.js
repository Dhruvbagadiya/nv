import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { createInquiryHandler, listInquiriesHandler } from './courseInquiries.controller.js';

const router = Router();

// GET /api/course-inquiries?countryId=&intake=&page=
router.get('/', requireAuth, listInquiriesHandler);

// POST /api/course-inquiries  { nationality, countryId, intake, courseType }
router.post('/', requireAuth, createInquiryHandler);

export default router;

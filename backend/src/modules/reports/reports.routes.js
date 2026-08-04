import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { summaryHandler } from './reports.controller.js';

const router = Router();

// GET /api/reports/summary — everything the Report screen needs, in one request.
router.get('/summary', requireAuth, asyncHandler(summaryHandler));

export default router;

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { listInstitutionsHandler, createInstitutionHandler, setBlacklistHandler } from './institutions.controller.js';

const router = Router();

// GET /api/institutions?country=&search=  — any authenticated user (powers filter dropdowns)
router.get('/', requireAuth, listInstitutionsHandler);

// Admin-only writes
router.post('/', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), createInstitutionHandler);
router.patch('/:id/blacklist', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), setBlacklistHandler);

export default router;

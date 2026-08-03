import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { listMoiHandler } from './moiInstitutions.controller.js';

const router = Router();

// GET /api/moi-institutions?country=&institutionId=&courseType=&page=
router.get('/', requireAuth, listMoiHandler);

export default router;

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { upsertAgencyBody } from './agency.schemas.js';
import { logoUpload, saveLogo } from './agency.upload.js';
import {
  getAgencyProfileHandler,
  upsertAgencyProfileHandler,
  deleteAgencyProfileHandler,
} from './agency.controller.js';

const router = Router();
const agentOnly = [requireAuth, requireRole('AGENT')];

// GET    /api/agency/profile
// PUT    /api/agency/profile   { agencyName, logoUrl?, website? }
// DELETE /api/agency/profile
router.get('/',    ...agentOnly, asyncHandler(getAgencyProfileHandler));
router.put('/',    ...agentOnly, validate(upsertAgencyBody), asyncHandler(upsertAgencyProfileHandler));
router.delete('/', ...agentOnly, asyncHandler(deleteAgencyProfileHandler));

// POST /api/agency/logo
// Accepts a cropped image (already squared by the client), saves it, returns { logoUrl }.
// Multer's single() must run BEFORE requireRole because it parses multipart first.
router.post(
  '/logo',
  requireAuth,
  requireRole('AGENT'),
  logoUpload.single('logo'),
  asyncHandler(async (req, res) => {
    // Check DB — JWT doesn't carry parentAgentId
    const user = await import('../../utils/prisma.js')
      .then(({ prisma }) => prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { parentAgentId: true },
      }));
    if (user?.parentAgentId) {
      return res.status(403).json({ error: 'Sub-agents cannot upload a logo.' });
    }
    const logoUrl = await saveLogo(req.file);
    res.json({ logoUrl });
  })
);

export default router;

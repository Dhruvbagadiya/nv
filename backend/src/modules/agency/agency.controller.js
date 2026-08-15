import * as agencyService from './agency.service.js';
import { prisma } from '../../utils/prisma.js';
import { ForbiddenError } from '../../utils/httpErrors.js';

// Check in DB whether the caller is a sub-agent (parentAgentId set).
// The JWT only carries sub/role/name — parentAgentId is NOT in the token.
async function assertNotSubAgent(userId) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { parentAgentId: true },
  });
  if (user?.parentAgentId) {
    throw new ForbiddenError(
      'Sub-agents cannot modify agency branding. Ask your agency owner to update it.'
    );
  }
}

export async function getAgencyProfileHandler(req, res) {
  const profile = await agencyService.getAgencyProfileForUser(req.user.sub);
  res.json({ profile });
}

export async function upsertAgencyProfileHandler(req, res) {
  await assertNotSubAgent(req.user.sub);
  const profile = await agencyService.upsertAgencyProfile(req.user.sub, req.body);
  res.json({ profile });
}

export async function deleteAgencyProfileHandler(req, res) {
  await assertNotSubAgent(req.user.sub);
  await agencyService.deleteAgencyProfile(req.user.sub);
  res.status(204).send();
}

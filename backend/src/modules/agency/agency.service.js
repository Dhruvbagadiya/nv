import crypto from 'node:crypto';
import { prisma } from '../../utils/prisma.js';

// Resolve the agency profile for any user:
//   - Top-level agent  → their own AgencyProfile (if set)
//   - Sub-agent        → parent's AgencyProfile (if set)
//   - Admin / other    → null
export async function getAgencyProfileForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      parentAgentId: true,
      agencyProfile: true,
    },
  });

  if (!user || user.role !== 'AGENT') return null;

  if (!user.parentAgentId) return user.agencyProfile ?? null;

  // Sub-agent — inherit parent's profile
  const parent = await prisma.user.findUnique({
    where: { id: user.parentAgentId },
    select: { agencyProfile: true },
  });
  return parent?.agencyProfile ?? null;
}

export async function upsertAgencyProfile(userId, { agencyName, logoUrl, website, accentColor }) {
  return prisma.agencyProfile.upsert({
    where: { userId },
    update: {
      agencyName,
      logoUrl:     logoUrl     ?? null,
      website:     website     ?? null,
      accentColor: accentColor ?? null,
      updatedAt:   new Date(),
    },
    create: {
      id: crypto.randomUUID(),
      userId,
      agencyName,
      logoUrl:     logoUrl     ?? null,
      website:     website     ?? null,
      accentColor: accentColor ?? null,
    },
  });
}

export async function deleteAgencyProfile(userId) {
  await prisma.agencyProfile.deleteMany({ where: { userId } });
}

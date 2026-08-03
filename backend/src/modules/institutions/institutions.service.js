import { prisma } from '../../utils/prisma.js';

export async function listInstitutions({ country, search }) {
  return prisma.institution.findMany({
    where: {
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(country && { country: { code: country } }),
    },
    include: { country: true },
    orderBy: { name: 'asc' },
  });
}

export async function createInstitution({ name, countryId, logoUrl }) {
  return prisma.institution.create({ data: { name, countryId, logoUrl } });
}

export async function setBlacklistStatus(institutionId, isBlacklisted) {
  return prisma.institution.update({
    where: { id: institutionId },
    data: { isBlacklisted },
  });
}

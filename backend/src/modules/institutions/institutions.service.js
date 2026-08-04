import { prisma } from '../../utils/prisma.js';

const INSTITUTION_INCLUDE = { country: true };

// Not paginated: this feeds institution dropdowns, which need every option. The
// blacklist modal ("Click for list" in the red banner) uses blacklisted=true.
export async function listInstitutions({ country, search, blacklisted, trending, includeArchived }) {
  return prisma.institution.findMany({
    where: {
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(country && { country: { code: country } }),
      // Explicit undefined check: `blacklisted === false` is a real filter
      // ("show me the active ones"), and a plain truthiness test would drop it.
      ...(blacklisted !== undefined && { isBlacklisted: blacklisted }),
      ...(trending !== undefined && { isTrending: trending }),
    },
    include: INSTITUTION_INCLUDE,
    orderBy: { name: 'asc' },
  });
}

// Drives the "Trending Universities" carousel on the Report screen.
export async function listTrending({ limit = 12 } = {}) {
  return prisma.institution.findMany({
    where: { isTrending: true, archivedAt: null },
    include: INSTITUTION_INCLUDE,
    orderBy: { name: 'asc' },
    take: limit,
  });
}

export async function createInstitution(data) {
  return prisma.institution.create({ data, include: INSTITUTION_INCLUDE });
}

export async function updateInstitution(id, data) {
  return prisma.institution.update({ where: { id }, data, include: INSTITUTION_INCLUDE });
}

export async function setBlacklistStatus(id, isBlacklisted) {
  return prisma.institution.update({
    where: { id },
    data: { isBlacklisted },
    include: INSTITUTION_INCLUDE,
  });
}

// Archive, not delete: courses, applications, commissions and entry requirements
// all hang off an institution, so removing the row would either fail on a
// constraint or cascade further than anyone intends.
export async function archiveInstitution(id) {
  return prisma.institution.update({
    where: { id },
    data: { archivedAt: new Date() },
    include: INSTITUTION_INCLUDE,
  });
}

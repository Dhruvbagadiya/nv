import { prisma } from '../../utils/prisma.js';
import { paginateQuery } from '../../utils/pagination.js';

// Universities Commission screen (reference images 1-2): Country | University
// Name | Commission, filtered by country and a name search.
//
// The row is keyed on the institution rather than the commission, because the
// screen is a list of universities that happens to show their rates — sorting and
// filtering are both by institution.
export async function listCommissions({ country, search, page, pageSize }) {
  const where = {
    archivedAt: null,
    institution: {
      archivedAt: null,
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(country && { country: { code: country } }),
    },
  };

  return paginateQuery(
    prisma.universityCommission,
    {
      where,
      include: {
        institution: {
          include: { country: { select: { code: true, name: true, flagEmoji: true } } },
        },
      },
      orderBy: [{ institution: { country: { sortOrder: 'asc' } } }, { institution: { name: 'asc' } }],
    },
    { page, pageSize }
  );
}

export async function upsertCommission({ institutionId, tiers, notes }) {
  return prisma.universityCommission.upsert({
    where: { institutionId },
    update: { tiers, notes, archivedAt: null },
    create: { institutionId, tiers, notes },
    include: { institution: { include: { country: true } } },
  });
}

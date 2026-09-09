import { prisma } from '../../utils/prisma.js';
import { paginateQuery } from '../../utils/pagination.js';
import { archiveWhere } from '../../utils/softDelete.js';

// Universities Commission screen (reference images 1-2): Country | University
// Name | Commission, filtered by country and a name search.
//
// The row is keyed on the institution rather than the commission, because the
// screen is a list of universities that happens to show their rates — sorting and
// filtering are both by institution.
export async function listCommissions({ country, search, status, page, pageSize }) {
  const where = {
    ...archiveWhere(status),
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

export async function upsertCommission({ institutionId, tiers, ...rest }) {
  // `rest` carries notes and the structured fields. Spread rather than listed,
  // so adding a column to the schema does not need a matching edit here — the
  // shape is already validated, and listing the fields is exactly how the
  // structured ones came to be dropped in the first place.
  return prisma.universityCommission.upsert({
    where: { institutionId },
    update: { tiers, ...rest, archivedAt: null },
    create: { institutionId, tiers, ...rest },
    include: { institution: { include: { country: true } } },
  });
}

export async function archiveCommission(id) {
  return prisma.universityCommission.update({ where: { id }, data: { archivedAt: new Date() } });
}

// Archiving without this is a one-way door: the row stays in the table and no
// endpoint can reach it again.
export async function restoreCommission(id) {
  return prisma.universityCommission.update({ where: { id }, data: { archivedAt: null } });
}

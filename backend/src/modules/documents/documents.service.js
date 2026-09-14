import { prisma } from '../../utils/prisma.js';
import { paginateQuery } from '../../utils/pagination.js';
import { archiveWhere } from '../../utils/softDelete.js';

const DOCUMENT_INCLUDE = {
  country: { select: { id: true, code: true, name: true } },
  institution: { select: { id: true, name: true } },
};

// All five Document Bank screens (images 7-18) are this one query with a
// different `category`. Visa Documents, Refund Forms, Institute Brochures, SOP
// and LOR are the same UI over the same table.
export async function listDocuments({ category, countryId, institutionId, search, status, page, pageSize }) {
  const where = {
    category,
    ...archiveWhere(status),
    ...(countryId && { countryId }),
    ...(institutionId && { institutionId }),
    ...(search && { title: { contains: search, mode: 'insensitive' } }),
  };

  return paginateQuery(
    prisma.document,
    { where, include: DOCUMENT_INCLUDE, orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }] },
    // SOP has ~50 tiles where LOR has 6, so the page size is worth being generous
    // with — a grid of tiles does not have a table's vertical cost.
    { page, pageSize }
  );
}

// Counts per category, so the Document Bank sub-menu can show how many documents
// sit behind each link rather than making the user open all five to find out.
export async function countByCategory() {
  const rows = await prisma.document.groupBy({
    by: ['category'],
    where: { archivedAt: null },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.category, r._count._all]));
}

export async function createDocument(data) {
  return prisma.document.create({ data, include: DOCUMENT_INCLUDE });
}

export async function updateDocument(id, data) {
  return prisma.document.update({ where: { id }, data, include: DOCUMENT_INCLUDE });
}

export async function archiveDocument(id) {
  return prisma.document.update({ where: { id }, data: { archivedAt: new Date() } });
}

// Archiving a document was irreversible through the API: listDocuments filtered
// archivedAt: null unconditionally, so nothing could find the row to restore it.
export async function restoreDocument(id) {
  return prisma.document.update({ where: { id }, data: { archivedAt: null } });
}

// Which countries and institutions actually have documents in this category.
//
// The filters were correct but every option returned nothing, because no document
// carried a scope — indistinguishable from a broken filter. Offering only the
// values that can return a result is the same rule applied elsewhere in this
// codebase: no control that does nothing.
export async function listFacets({ category }) {
  // Grouped in the database, not in Node. The previous version ran findMany over
  // every document in the category and deduped in JS — at a million rows that is
  // 28 seconds and a million objects held in memory, versus ~0.2s for this.
  const [countryGroups, institutionGroups, unscoped] = await Promise.all([
    prisma.document.groupBy({
      by: ['countryId'],
      where: { category, archivedAt: null, countryId: { not: null } },
      _count: { _all: true },
    }),
    prisma.document.groupBy({
      by: ['institutionId'],
      where: { category, archivedAt: null, institutionId: { not: null } },
      _count: { _all: true },
    }),
    prisma.document.count({
      where: { category, archivedAt: null, countryId: null, institutionId: null },
    }),
  ]);

  // Only the referenced rows are then fetched — bounded by how many distinct
  // scopes exist, not by how many documents there are.
  const [countries, institutions] = await Promise.all([
    countryGroups.length
      ? prisma.country.findMany({
          where: { id: { in: countryGroups.map((g) => g.countryId) } },
          select: { id: true, name: true, code: true, flagEmoji: true, isoCode: true },
          orderBy: { name: 'asc' },
        })
      : [],
    institutionGroups.length
      ? prisma.institution.findMany({
          where: { id: { in: institutionGroups.map((g) => g.institutionId) } },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : [],
  ]);

  return { countries, institutions, unscoped };
}

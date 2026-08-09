import { prisma } from '../../utils/prisma.js';
import { paginateQuery } from '../../utils/pagination.js';

const DOCUMENT_INCLUDE = {
  country: { select: { id: true, code: true, name: true } },
  institution: { select: { id: true, name: true } },
};

// All five Document Bank screens (images 7-18) are this one query with a
// different `category`. Visa Documents, Refund Forms, Institute Brochures, SOP
// and LOR are the same UI over the same table.
export async function listDocuments({ category, countryId, institutionId, search, page, pageSize }) {
  const where = {
    category,
    archivedAt: null,
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

// Which countries and institutions actually have documents in this category.
//
// The filters were correct but every option returned nothing, because no document
// carried a scope — indistinguishable from a broken filter. Offering only the
// values that can return a result is the same rule applied elsewhere in this
// codebase: no control that does nothing.
export async function listFacets({ category }) {
  const rows = await prisma.document.findMany({
    where: { category, archivedAt: null },
    select: {
      country: { select: { id: true, name: true, code: true, flagEmoji: true } },
      institution: { select: { id: true, name: true } },
    },
  });

  const countries = new Map();
  const institutions = new Map();
  for (const r of rows) {
    if (r.country) countries.set(r.country.id, r.country);
    if (r.institution) institutions.set(r.institution.id, r.institution);
  }

  const byName = (a, b) => a.name.localeCompare(b.name);
  return {
    countries: [...countries.values()].sort(byName),
    institutions: [...institutions.values()].sort(byName),
    // How many have no scope at all, so the UI can say what "all" means.
    unscoped: rows.filter((r) => !r.country && !r.institution).length,
  };
}

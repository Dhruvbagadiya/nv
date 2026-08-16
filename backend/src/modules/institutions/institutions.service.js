import { prisma } from '../../utils/prisma.js';
import { ConflictError } from '../../utils/httpErrors.js';
import { paginateQuery } from '../../utils/pagination.js';

const INSTITUTION_INCLUDE = { country: true };

// Enough for every real catalogue while bounding the response.
const MAX_INSTITUTION_OPTIONS = 2000;

// URL-safe slug derived from name when not explicitly provided.
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function institutionWhere({ country, search, blacklisted, trending, includeArchived }) {
  return {
    ...(includeArchived ? {} : { archivedAt: null }),
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
    ...(country && { country: { code: country } }),
    ...(blacklisted !== undefined && { isBlacklisted: blacklisted }),
    ...(trending !== undefined && { isTrending: trending }),
  };
}

// The unpaginated form, for the dropdowns: they need every option at once, so
// the only bound is the hard cap.
export async function listInstitutions(filters) {
  return prisma.institution.findMany({
    where: institutionWhere(filters),
    include: INSTITUTION_INCLUDE,
    orderBy: { name: 'asc' },
    // Hard cap. "The whole list" must not become unbounded as the catalogue
    // grows. Callers that need more should page (below) or search.
    take: MAX_INSTITUTION_OPTIONS,
  });
}

// The paged form, for the admin table. Without this the table shared the
// dropdown's capped list and would silently stop showing rows past the cap,
// with nothing on screen to say the list had been truncated.
export async function listInstitutionsPage(filters, pageArgs) {
  return paginateQuery(
    prisma.institution,
    { where: institutionWhere(filters), include: INSTITUTION_INCLUDE, orderBy: { name: 'asc' } },
    pageArgs
  );
}

export async function listTrending({ limit = 12 } = {}) {
  return prisma.institution.findMany({
    where: { isTrending: true, archivedAt: null },
    include: INSTITUTION_INCLUDE,
    orderBy: { name: 'asc' },
    take: limit,
  });
}

export async function createInstitution(data) {
  const slug = data.slug || slugify(data.name);

  // Ensure slug uniqueness — append a short timestamp suffix if collision.
  const existing = await prisma.institution.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

  return prisma.institution.create({
    data: { ...data, slug: finalSlug },
    include: INSTITUTION_INCLUDE,
  });
}

export async function updateInstitution(id, data) {
  // If slug is being changed, check it won't collide with another row.
  if (data.slug) {
    const conflict = await prisma.institution.findFirst({
      where: { slug: data.slug, NOT: { id } },
    });
    if (conflict) throw new ConflictError('That slug is already used by another institution');
  }
  return prisma.institution.update({ where: { id }, data, include: INSTITUTION_INCLUDE });
}

export async function setBlacklistStatus(id, isBlacklisted) {
  return prisma.institution.update({
    where: { id },
    data: { isBlacklisted },
    include: INSTITUTION_INCLUDE,
  });
}

export async function archiveInstitution(id) {
  return prisma.institution.update({
    where: { id },
    data: { archivedAt: new Date() },
    include: INSTITUTION_INCLUDE,
  });
}

export async function restoreInstitution(id) {
  return prisma.institution.update({
    where: { id },
    data: { archivedAt: null },
    include: INSTITUTION_INCLUDE,
  });
}

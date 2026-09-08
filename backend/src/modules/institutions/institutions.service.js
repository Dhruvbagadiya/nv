import { prisma } from '../../utils/prisma.js';
import { slugify } from '../../utils/slug.js';
import { ConflictError } from '../../utils/httpErrors.js';
import { paginateQuery } from '../../utils/pagination.js';

const INSTITUTION_INCLUDE = { country: true };

// Enough for every real catalogue while bounding the response.
const MAX_INSTITUTION_OPTIONS = 2000;

// URL-safe slug derived from name when not explicitly provided.
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

// ============================================================================
// Gallery photos
// ============================================================================
//
// Deliberately their own endpoints rather than a nested write on the institution
// body. There are 4,985 rows across 1,290 institutions, so returning them with
// every list response would multiply a filter dropdown's payload for data almost
// no caller wants; and a whole-array PUT would make two admins editing different
// photos silently overwrite each other.

// Bounded so one institution with a large gallery cannot dominate a response.
const MAX_PHOTOS_PER_INSTITUTION = 60;

export async function listPhotos(institutionId) {
  return prisma.schoolPhoto.findMany({
    where: { institutionId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    take: MAX_PHOTOS_PER_INSTITUTION,
  });
}

export async function addPhoto(institutionId, data) {
  // Appended, not inserted at 0: an admin adding a photo is adding to the end
  // of a gallery, and renumbering everything else would be a surprise.
  const last = await prisma.schoolPhoto.findFirst({
    where: { institutionId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  return prisma.schoolPhoto.create({
    data: {
      institutionId,
      url: data.url,
      thumbnailUrl: data.thumbnailUrl ?? null,
      fileName: data.fileName ?? null,
      position: data.position ?? (last ? last.position + 1 : 0),
      // Added by hand, so it belongs to no feed and no import will rewrite it.
      source: 'manual',
    },
  });
}

export async function deletePhoto(institutionId, photoId) {
  // Scoped by institution rather than deleting on the id alone: the route nests
  // the photo under its institution, and the service should enforce that rather
  // than trust the path to have been built correctly. deleteMany returns a
  // count instead of throwing, which distinguishes "not this institution's"
  // from "already gone".
  const { count } = await prisma.schoolPhoto.deleteMany({
    where: { id: photoId, institutionId },
  });
  if (count === 0) {
    const err = new Error('Photo not found on this institution');
    err.status = 404;
    throw err;
  }
}

/**
 * Reorder a gallery from an explicit list of ids.
 *
 * Scoped to the institution and run in one transaction: a partial reorder would
 * leave two photos claiming the same position, and ordering would then fall
 * back to createdAt with no sign anything went wrong.
 */
export async function reorderPhotos(institutionId, ids) {
  const owned = await prisma.schoolPhoto.findMany({
    where: { institutionId },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((p) => p.id));
  const unknown = ids.filter((id) => !ownedIds.has(id));
  if (unknown.length) {
    const err = new Error('Photo does not belong to this institution: ' + unknown[0]);
    err.status = 400;
    throw err;
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.schoolPhoto.update({ where: { id }, data: { position: index } })
    )
  );
  return listPhotos(institutionId);
}

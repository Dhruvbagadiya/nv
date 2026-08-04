import { prisma } from '../../utils/prisma.js';

const COURSE_INCLUDE = { institution: { include: { country: true } } };

// Archived courses stay in the table so existing applications keep resolving,
// but they must never appear in the catalogue agents search.
const NOT_ARCHIVED = { archivedAt: null, institution: { archivedAt: null } };

export async function searchCourses({
  country,
  search,
  tag,
  degreeLevel,
  institutionId,
  page = 1,
  pageSize = 12,
}) {
  const where = {
    ...NOT_ARCHIVED,
    // Search used to match the course title only, so typing an institution name —
    // the obvious thing to try — returned nothing.
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { institution: { name: { contains: search, mode: 'insensitive' } } },
        { city: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(tag && { tags: { has: tag } }),
    ...(degreeLevel && { degreeLevel }),
    ...(institutionId && { institutionId }),
    ...(country &&
      country !== 'ALL' && {
        institution: { archivedAt: null, country: { code: country } },
      }),
  };

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: COURSE_INCLUDE,
      // Was unordered, which in Postgres means no guaranteed order at all — the
      // same query could return the same course on page 1 and page 2, or skip one
      // entirely. Pagination is only coherent over a stable sort.
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.course.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function createCourse(data) {
  return prisma.course.create({ data, include: COURSE_INCLUDE });
}

export async function updateCourse(id, data) {
  return prisma.course.update({ where: { id }, data, include: COURSE_INCLUDE });
}

// Soft delete. A hard delete on a course with applications hit the FK constraint
// and surfaced as a 500, and it is wrong regardless: an application has to keep
// pointing at the course it was submitted against, so withdrawing a course from
// the catalogue cannot mean erasing the record of it.
export async function archiveCourse(id) {
  return prisma.course.update({
    where: { id },
    data: { archivedAt: new Date() },
    include: COURSE_INCLUDE,
  });
}

export async function restoreCourse(id) {
  return prisma.course.update({
    where: { id },
    data: { archivedAt: null },
    include: COURSE_INCLUDE,
  });
}

// Bulk import for CSV uploads — each row is validated/shaped by the caller
// before reaching here; this just does the insert.
export async function bulkCreateCourses(rows) {
  return prisma.course.createMany({ data: rows, skipDuplicates: true });
}

import { prisma } from '../../utils/prisma.js';

// Mirrors the filter/pagination behavior already proven out in the
// mockup's renderCourses() — country, search text, quick-filter tag, page.
export async function searchCourses({ country, search, tag, page = 1, pageSize = 12 }) {
  const where = {
    ...(search && {
      title: { contains: search, mode: 'insensitive' },
    }),
    ...(tag && {
      tags: { has: tag },
    }),
    ...(country &&
      country !== 'ALL' && {
        institution: { country: { code: country } },
      }),
  };

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: { institution: { include: { country: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.course.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function createCourse(data) {
  return prisma.course.create({
    data,
    include: { institution: { include: { country: true } } },
  });
}

export async function updateCourse(id, data) {
  return prisma.course.update({
    where: { id },
    data,
    include: { institution: { include: { country: true } } },
  });
}

export async function deleteCourse(id) {
  return prisma.course.delete({ where: { id } });
}

// Bulk import for CSV uploads — each row is validated/shaped by the
// caller (controller) before reaching here; this just does the insert.
export async function bulkCreateCourses(rows) {
  return prisma.course.createMany({ data: rows, skipDuplicates: true });
}

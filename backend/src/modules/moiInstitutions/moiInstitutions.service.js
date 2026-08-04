import { prisma } from '../../utils/prisma.js';
import { paginateQuery } from '../../utils/pagination.js';

export async function listMoiAcceptances({ country, institutionId, courseType, page, pageSize }) {
  const institutionFilter = {
    archivedAt: null,
    ...(institutionId && { id: institutionId }),
    ...(country && { country: { code: country } }),
  };

  return paginateQuery(
    prisma.moiAcceptance,
    {
      where: {
        ...(courseType && { courseType }),
        institution: institutionFilter,
      },
      include: { institution: { include: { country: true } } },
      // Was unordered, so page 2 could repeat a row from page 1.
      orderBy: [{ institution: { name: 'asc' } }, { courseType: 'asc' }, { id: 'asc' }],
    },
    { page, pageSize }
  );
}

// Distinct course types actually present, so the filter dropdown offers only
// values that can return something. courseType is free text, so hardcoding a list
// in the UI would drift from the data.
export async function listCourseTypes() {
  const rows = await prisma.moiAcceptance.findMany({
    distinct: ['courseType'],
    select: { courseType: true },
    orderBy: { courseType: 'asc' },
  });
  return rows.map((r) => r.courseType);
}

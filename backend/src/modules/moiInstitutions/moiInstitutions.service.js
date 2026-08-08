import { prisma } from '../../utils/prisma.js';
import { paginateQuery } from '../../utils/pagination.js';
import { NotFoundError } from '../../utils/httpErrors.js';

const MOI_INCLUDE = { institution: { include: { country: true } } };

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
      include: MOI_INCLUDE,
      orderBy: [{ institution: { name: 'asc' } }, { courseType: 'asc' }, { id: 'asc' }],
    },
    { page, pageSize }
  );
}

export async function listCourseTypes() {
  const rows = await prisma.moiAcceptance.findMany({
    distinct: ['courseType'],
    select: { courseType: true },
    orderBy: { courseType: 'asc' },
  });
  return rows.map((r) => r.courseType);
}

export async function createMoiAcceptance(data) {
  return prisma.moiAcceptance.create({ data, include: MOI_INCLUDE });
}

export async function updateMoiAcceptance(id, data) {
  const existing = await prisma.moiAcceptance.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('MOI acceptance not found');
  return prisma.moiAcceptance.update({ where: { id }, data, include: MOI_INCLUDE });
}

export async function deleteMoiAcceptance(id) {
  const existing = await prisma.moiAcceptance.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('MOI acceptance not found');
  return prisma.moiAcceptance.delete({ where: { id } });
}

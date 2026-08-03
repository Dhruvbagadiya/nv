import { prisma } from '../../utils/prisma.js';

export async function listMoiAcceptances({ country, institutionId, courseType, page = 1, pageSize = 20 }) {
  const where = {
    ...(courseType && { courseType }),
    institution: {
      ...(institutionId && { id: institutionId }),
      ...(country && { country: { code: country } }),
    },
  };

  const [items, total] = await Promise.all([
    prisma.moiAcceptance.findMany({
      where,
      include: { institution: { include: { country: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.moiAcceptance.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

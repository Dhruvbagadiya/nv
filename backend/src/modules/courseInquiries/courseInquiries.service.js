import { prisma } from '../../utils/prisma.js';

export async function createInquiry({ agentId, nationality, countryId, intake, courseType }) {
  return prisma.courseInquiry.create({
    data: { agentId, nationality, countryId, intake, courseType },
  });
}

export async function listInquiries({ agentId, countryId, intake, page = 1, pageSize = 20 }) {
  const where = {
    ...(agentId && { agentId }),
    ...(countryId && { countryId }),
    ...(intake && { intake }),
  };

  const [items, total] = await Promise.all([
    prisma.courseInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.courseInquiry.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

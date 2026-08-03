import { prisma } from '../../utils/prisma.js';

export async function createApplication({ agentId, studentName, passportNo, courseId }) {
  return prisma.application.create({
    data: {
      agentId,
      studentName,
      passportNo,
      courseId,
      primaryStatus: 'Application Request',
      secondaryStatus: 'Profile Under Review',
    },
    include: { course: { include: { institution: { include: { country: true } } } } },
  });
}

// Mirrors the Application History filter panel: country, institution,
// intake, status, passport, student name, mobile/email.
export async function listApplications({ agentId, country, institutionId, status, passportNo, studentName, page = 1, pageSize = 20 }) {
  const where = {
    ...(agentId && { agentId }),
    ...(passportNo && { passportNo: { contains: passportNo, mode: 'insensitive' } }),
    ...(studentName && { studentName: { contains: studentName, mode: 'insensitive' } }),
    ...(status && { primaryStatus: status }),
    course: {
      ...(institutionId && { institutionId }),
      ...(country && {
        institution: { country: { code: country } },
      }),
    },
  };

  const [items, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: { course: { include: { institution: { include: { country: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.application.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

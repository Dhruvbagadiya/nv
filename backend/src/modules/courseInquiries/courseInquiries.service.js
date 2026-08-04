import { prisma } from '../../utils/prisma.js';
import { paginateQuery } from '../../utils/pagination.js';

const INQUIRY_INCLUDE = {
  // countryId was a bare scalar with no relation, so the history table had no way
  // to show a country name — only the raw id it never rendered.
  country: { select: { id: true, code: true, name: true, flagEmoji: true } },
  agent: { select: { id: true, name: true } },
};

export async function createInquiry({ agentId, nationality, countryId, intake, courseType }) {
  return prisma.courseInquiry.create({
    data: { agentId, nationality, countryId, intake, courseType },
    include: INQUIRY_INCLUDE,
  });
}

export async function listInquiries({ agentId, countryId, intake, stage, page, pageSize }) {
  const where = {
    ...(agentId && { agentId }),
    ...(countryId && { countryId }),
    ...(intake && { intake }),
    ...(stage && { stage }),
  };

  return paginateQuery(
    prisma.courseInquiry,
    { where, include: INQUIRY_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] },
    { page, pageSize }
  );
}

// The four "Course Inquiry" tiles on the Report screen.
export async function countByStage({ agentId }) {
  const rows = await prisma.courseInquiry.groupBy({
    by: ['stage'],
    where: { ...(agentId && { agentId }) },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.stage, r._count._all]));
}

export async function updateInquiryStage({ id, stage }) {
  return prisma.courseInquiry.update({ where: { id }, data: { stage }, include: INQUIRY_INCLUDE });
}

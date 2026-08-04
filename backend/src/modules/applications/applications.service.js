import { prisma } from '../../utils/prisma.js';
import { NotFoundError } from '../../utils/httpErrors.js';
import { paginateQuery } from '../../utils/pagination.js';

const APPLICATION_INCLUDE = {
  course: { include: { institution: { include: { country: true } } } },
  agent: { select: { id: true, name: true } },
};

// The note shown on the second line of the status cell. Free text by design —
// `stage` is what code reasons about, this is what a human reads.
const DEFAULT_STAGE_NOTE = 'Profile Under Review';

export async function createApplication({
  agentId,
  studentName,
  passportNo,
  courseId,
  intakeLabel,
}) {
  // Fail with a 404 naming the problem rather than letting Prisma raise an opaque
  // foreign-key error that the handler would surface as a 500.
  const course = await prisma.course.findFirst({
    where: { id: courseId, archivedAt: null },
    select: { id: true },
  });
  if (!course) throw new NotFoundError('That course is not available for new applications');

  return prisma.application.create({
    data: {
      agentId,
      studentName,
      passportNo,
      courseId,
      intakeLabel,
      // stage defaults to PROFILE_ASSESSMENT in the schema.
      stageNote: DEFAULT_STAGE_NOTE,
    },
    include: APPLICATION_INCLUDE,
  });
}

// Mirrors the Application History filter panel: country, institution, stage,
// passport, student name.
export async function listApplications({
  agentId,
  country,
  institutionId,
  stage,
  passportNo,
  studentName,
  page,
  pageSize,
}) {
  const courseFilter = {
    ...(institutionId && { institutionId }),
    ...(country && { institution: { country: { code: country } } }),
  };

  const where = {
    ...(agentId && { agentId }),
    ...(passportNo && { passportNo: { contains: passportNo, mode: 'insensitive' } }),
    ...(studentName && { studentName: { contains: studentName, mode: 'insensitive' } }),
    // Was `primaryStatus: status` against a free-text column, so filtering
    // depended on the caller spelling the stored string exactly.
    ...(stage && { stage }),
    // Only constrain the relation when there is something to constrain by;
    // `course: {}` is a no-op but obscures the intent.
    ...(Object.keys(courseFilter).length > 0 && { course: courseFilter }),
  };

  return paginateQuery(
    prisma.application,
    { where, include: APPLICATION_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] },
    { page, pageSize }
  );
}

// Scoped by agentId for agents, so one partner cannot read another's students by
// guessing an id. Admins pass agentId undefined and see everything.
export async function getApplication({ id, agentId }) {
  const application = await prisma.application.findFirst({
    where: { id, ...(agentId && { agentId }) },
    include: APPLICATION_INCLUDE,
  });
  if (!application) throw new NotFoundError('Application not found');
  return application;
}

export async function updateApplicationStage({ id, stage, stageNote, deadlineAt }) {
  return prisma.application.update({
    where: { id },
    data: {
      stage,
      ...(stageNote !== undefined && { stageNote }),
      ...(deadlineAt !== undefined && { deadlineAt }),
    },
    include: APPLICATION_INCLUDE,
  });
}

// Powers the 8 stat tiles on the Report screen. One grouped query rather than
// eight counts — which is the whole reason `stage` became an enum.
export async function countByStage({ agentId }) {
  const rows = await prisma.application.groupBy({
    by: ['stage'],
    where: { ...(agentId && { agentId }) },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.stage, r._count._all]));
}

export async function listUpcomingDeadlines({ agentId, limit = 10 }) {
  return prisma.application.findMany({
    where: { ...(agentId && { agentId }), deadlineAt: { gte: new Date() } },
    include: APPLICATION_INCLUDE,
    orderBy: { deadlineAt: 'asc' },
    take: limit,
  });
}

import { prisma } from '../../utils/prisma.js';
import { NotFoundError } from '../../utils/httpErrors.js';
import { paginateQuery } from '../../utils/pagination.js';
import { assertNotDuplicate } from './duplicateGuard.js';

const APPLICATION_INCLUDE = {
  course: { include: { institution: { include: { country: true } } } },
  agent: { select: { id: true, name: true } },
  // So a row can say whether anything is attached without a request per row.
  // Counted live rather than denormalised onto the Application: a stored counter
  // has to be kept in step by every upload, archive and restore, and the index
  // on (applicationId, createdAt) makes this cheap.
  _count: { select: { documents: { where: { archivedAt: null } } } },
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

  // One application per PERSON per course for this agency. Keyed on the passport
  // rather than the account, because one agent files for many students.
  await assertNotDuplicate({ agentId, courseId, passportNo, byAccount: false });

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

// ============================================================================
// Documents attached to an application
// ============================================================================

const DOCUMENT_SELECT = {
    id: true,
    kind: true,
    label: true,
    fileUrl: true,
    fileName: true,
    contentType: true,
    sizeBytes: true,
    createdAt: true,
    uploadedBy: { select: { id: true, name: true } },
};

/**
 * Resolve the application these documents belong to, applying the caller's
 * scope.
 *
 * Every document operation goes through this first. The alternative — checking
 * ownership on the DOCUMENT — would let an agent reach another agency's file by
 * its id alone, because a document id carries no agent. Scoping the parent is
 * the only check that cannot be bypassed by addressing the child directly.
 */
async function applicationForDocuments({ applicationId, agentId }) {
    const application = await prisma.application.findFirst({
        where: { id: applicationId, ...(agentId && { agentId }) },
        select: { id: true },
    });
    // Deliberately the same 404 an unknown id produces. Telling an agent that an
    // application exists but is not theirs is itself a disclosure.
    if (!application) throw new NotFoundError('Application not found');
    return application;
}

/**
 * Paged, because an application accumulates documents for as long as it is open
 * — a passport, ten transcripts, the financials, then a revised set of each —
 * and this returned every one of them in a single array with the thumbnails
 * attached. Fine at four documents, a slow screen at eighty.
 *
 * The ownership check stays a separate query rather than folding into a `where`
 * on the relation, because the two have to be distinguishable: an application
 * that is not yours must 404, and one of yours with nothing attached must be an
 * empty page. One query cannot say which of those it found.
 */
export async function listApplicationDocuments({ applicationId, agentId, page, pageSize = 24 }) {
    await applicationForDocuments({ applicationId, agentId });
    return paginateQuery(
        prisma.applicationDocument,
        {
            where: { applicationId, archivedAt: null },
            select: DOCUMENT_SELECT,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        },
        { page, pageSize }
    );
}

export async function addApplicationDocument({ applicationId, agentId, uploadedById, file }) {
    await applicationForDocuments({ applicationId, agentId });
    return prisma.applicationDocument.create({
        data: { applicationId, uploadedById, ...file },
        select: DOCUMENT_SELECT,
    });
}

/**
 * Archived rather than deleted. An application is a record of what was
 * submitted, so a document that was once attached is part of that record even
 * after the agent replaces it — and the stored file is left in place, because
 * removing bytes on a soft delete is how a "restore" becomes impossible.
 */
export async function archiveApplicationDocument({ applicationId, documentId, agentId }) {
    await applicationForDocuments({ applicationId, agentId });
    const { count } = await prisma.applicationDocument.updateMany({
        // applicationId in the WHERE, not just the document id: without it, a
        // document id from another application would archive on the strength of
        // the caller owning *some* application.
        where: { id: documentId, applicationId, archivedAt: null },
        data: { archivedAt: new Date() },
    });
    if (!count) throw new NotFoundError('Document not found');
}

// ============================================================================
// Dashboard aggregates
// ============================================================================

/**
 * Applications per destination country.
 *
 * Two queries rather than one groupBy, because the country is two joins away
 * (Application -> Course -> Institution -> Country) and Prisma's groupBy only
 * groups by columns on the model itself. The first fetches the pairing, the
 * second names the countries; the counting is done here.
 */
export async function countByCountry({ agentId }) {
    const rows = await prisma.application.findMany({
        where: { ...(agentId && { agentId }) },
        select: { course: { select: { institution: { select: { countryId: true } } } } },
    });
    if (!rows.length) return [];

    const tally = new Map();
    for (const r of rows) {
        const id = r.course?.institution?.countryId;
        if (id) tally.set(id, (tally.get(id) ?? 0) + 1);
    }

    const countries = await prisma.country.findMany({
        where: { id: { in: [...tally.keys()] } },
        select: { id: true, code: true, name: true, isoCode: true },
    });

    return countries
        .map((c) => ({ ...c, count: tally.get(c.id) ?? 0 }))
        .sort((a, b) => b.count - a.count);
}

/** The courses this agent files into most, with the institution that runs them. */
export async function topCourses({ agentId, limit = 5 }) {
    const rows = await prisma.application.groupBy({
        by: ['courseId'],
        where: { ...(agentId && { agentId }) },
        _count: { _all: true },
        orderBy: { _count: { courseId: 'desc' } },
        take: limit,
    });
    if (!rows.length) return [];

    const courses = await prisma.course.findMany({
        where: { id: { in: rows.map((r) => r.courseId) } },
        select: { id: true, title: true, institution: { select: { name: true } } },
    });
    const byId = new Map(courses.map((c) => [c.id, c]));

    // Ordered by the groupBy, not by the findMany, which returns whatever order
    // the planner likes.
    return rows
        .map((r) => ({ ...byId.get(r.courseId), count: r._count._all }))
        .filter((c) => c.id);
}

/**
 * How the month is going against the one before it.
 *
 * Computed from createdAt rather than stored, so there is no snapshot table to
 * keep in step — and no history to backfill. The cost is that it only ever
 * compares two calendar months, which is what the tile says it is.
 */
export async function monthOverMonth({ agentId }) {
    const now = new Date();
    const startOfThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [thisMonth, lastMonth] = await Promise.all([
        prisma.application.count({
            where: { ...(agentId && { agentId }), createdAt: { gte: startOfThis } },
        }),
        prisma.application.count({
            where: { ...(agentId && { agentId }), createdAt: { gte: startOfLast, lt: startOfThis } },
        }),
    ]);
    return { thisMonth, lastMonth };
}

/**
 * Applications carrying no document at all.
 *
 * The one number on the dashboard that names work rather than progress: an
 * application with nothing attached cannot move, whatever stage it is sitting in.
 */
export async function countAwaitingDocuments({ agentId }) {
    return prisma.application.count({
        where: {
            ...(agentId && { agentId }),
            documents: { none: { archivedAt: null } },
        },
    });
}

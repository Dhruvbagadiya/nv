import { prisma } from '../../utils/prisma.js';
import { toSkipTake, paginated } from '../../utils/pagination.js';

/**
 * What the agencies have been doing.
 *
 * THIS IS NOT AN AUDIT LOG, and it is worth being blunt about that because it
 * looks like one. There is no audit table in this schema: nothing records a
 * login, an edit, a deletion, or a failed permission check. What exists is three
 * tables that happen to carry an actor and a creation time, and this merges them
 * into one feed:
 *
 *   Application         — an agent filed an application
 *   ApplicationDocument — an agent attached a file to one
 *   CourseInquiry       — an agent asked about a course
 *
 * So it answers "which agencies are active, and on what" honestly, and answers
 * "who deleted this" not at all. Building the second means an AuditLog model and
 * a write on every mutating route, which is a different piece of work.
 */

const ACTORS = { select: { id: true, name: true, email: true } };

/**
 * Merged in JS rather than in SQL.
 *
 * Three tables with different columns cannot be paged by the database without a
 * UNION over a hand-written query, which would mean raw SQL and its own
 * injection surface for a screen an admin opens occasionally. The merge is
 * correct because of one property: anything in the global top N must be in the
 * top N of the stream it came from. So each stream gives up `skip + take` rows,
 * the merge sorts them, and the window is sliced out.
 *
 * The cost is that deep pages read three times the offset. toSkipTake already
 * refuses past MAX_OFFSET, which caps it — and an activity feed is something you
 * filter by agent, not something you page to row 9,000 of.
 */
export async function listActivity({ agentId, page, pageSize }) {
  const { skip, take, page: safePage, pageSize: safeSize } = toSkipTake({ page, pageSize });
  const reach = skip + take;
  const scope = agentId ? { agentId } : {};

  const [applications, documents, inquiries, counts] = await Promise.all([
    prisma.application.findMany({
      where: scope,
      select: {
        id: true, reference: true, studentName: true, stage: true, createdAt: true,
        agent: ACTORS,
        course: { select: { title: true, institution: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: reach,
    }),
    prisma.applicationDocument.findMany({
      // Documents carry their uploader, not an agentId — an admin can attach one
      // too, and filtering by `agentId` here would silently return nothing.
      where: { archivedAt: null, ...(agentId && { uploadedById: agentId }) },
      select: {
        id: true, fileName: true, kind: true, createdAt: true,
        uploadedBy: ACTORS,
        application: { select: { id: true, reference: true, studentName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: reach,
    }),
    prisma.courseInquiry.findMany({
      where: scope,
      select: {
        id: true, intake: true, courseType: true, stage: true, createdAt: true,
        agent: ACTORS,
        country: { select: { code: true, name: true, isoCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: reach,
    }),
    Promise.all([
      prisma.application.count({ where: scope }),
      prisma.applicationDocument.count({ where: { archivedAt: null, ...(agentId && { uploadedById: agentId }) } }),
      prisma.courseInquiry.count({ where: scope }),
    ]),
  ]);

  const events = [
    ...applications.map((a) => ({
      id: `application:${a.id}`,
      type: 'APPLICATION',
      createdAt: a.createdAt,
      actor: a.agent,
      title: `Filed application #${a.reference}`,
      subject: a.studentName,
      detail: a.course?.institution?.name ?? null,
      stage: a.stage,
      applicationId: a.id,
    })),
    ...documents.map((d) => ({
      id: `document:${d.id}`,
      type: 'DOCUMENT',
      createdAt: d.createdAt,
      actor: d.uploadedBy,
      title: `Uploaded ${d.fileName}`,
      subject: d.application?.studentName ?? null,
      detail: d.application ? `Application #${d.application.reference}` : null,
      kind: d.kind,
      applicationId: d.application?.id ?? null,
    })),
    ...inquiries.map((q) => ({
      id: `inquiry:${q.id}`,
      type: 'INQUIRY',
      createdAt: q.createdAt,
      actor: q.agent,
      title: 'Raised a course inquiry',
      subject: q.country?.name ?? null,
      detail: [q.intake, q.courseType].filter(Boolean).join(' · ') || null,
      stage: q.stage,
      country: q.country,
    })),
  ];

  // Tie-broken on id, so two events written in the same millisecond — a bulk
  // import does this constantly — do not swap places between page 1 and page 2
  // and drop a row out of both.
  events.sort((a, b) => (b.createdAt - a.createdAt) || a.id.localeCompare(b.id));

  const total = counts.reduce((n, c) => n + c, 0);
  return paginated(events.slice(skip, skip + take), total, { page: safePage, pageSize: safeSize });
}

/**
 * The agencies themselves, ranked by what they have filed.
 *
 * One query per metric rather than a join: an agent with no applications has to
 * appear (they are the ones worth calling), and an inner join would drop them.
 */
export async function listAgentSummary({ limit = 10 }) {
  const agents = await prisma.user.findMany({
    where: { role: 'AGENT', isActive: true },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!agents.length) return [];

  const ids = agents.map((a) => a.id);
  const [appRows, inquiryRows, lastRows] = await Promise.all([
    prisma.application.groupBy({
      by: ['agentId'],
      where: { agentId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.courseInquiry.groupBy({
      by: ['agentId'],
      where: { agentId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.application.groupBy({
      by: ['agentId'],
      where: { agentId: { in: ids } },
      _max: { createdAt: true },
    }),
  ]);

  const by = (rows, read) => new Map(rows.map((r) => [r.agentId, read(r)]));
  const apps = by(appRows, (r) => r._count._all);
  const inquiries = by(inquiryRows, (r) => r._count._all);
  const last = by(lastRows, (r) => r._max.createdAt);

  return agents
    .map((a) => ({
      ...a,
      applications: apps.get(a.id) ?? 0,
      inquiries: inquiries.get(a.id) ?? 0,
      lastActiveAt: last.get(a.id) ?? null,
    }))
    .sort((a, b) => b.applications - a.applications || a.name.localeCompare(b.name))
    .slice(0, limit);
}

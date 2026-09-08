import { prisma } from '../../utils/prisma.js';
import { NotFoundError } from '../../utils/httpErrors.js';
import { toSkipTake, maxReachablePage } from '../../utils/pagination.js';
import { slugify } from '../../utils/slug.js';
import { archiveWhere } from '../../utils/softDelete.js';

// ============================================================================
// Helpers
// ============================================================================

// Full include used by every query that needs to produce a program response.
const PROGRAM_INCLUDE = {
  institution: {
    include: {
      country: {
        select: { code: true, currencyCode: true },
      },
      commission: true,
      // Gallery photos back the detail view. Bounded: a school with 40 photos
      // must not multiply the payload of a 12-card page by 40.
      photos: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        take: 12,
        select: { id: true, url: true, thumbnailUrl: true },
      },
    },
  },
  intakes: {
    orderBy: { startDate: 'asc' },
  },
};

// Archived courses stay in the table so existing applications keep resolving,
// but they must never appear in the catalogue agents search.
const NOT_ARCHIVED = { archivedAt: null, institution: { archivedAt: null } };

// ============================================================================
// Response shaping
// ============================================================================

/**
 * Build the structured commission object from a UniversityCommission record.
 * Falls back to null if no commission is configured for the institution.
 */
function buildCommission(commission) {
  if (!commission) return null;

  const {
    commissionType,
    rateFrom,
    rateTo,
    amountFrom,
    amountTo,
    isTierAdjusted,
    maxNumberOfInstallments,
    tuitionBasis,
  } = commission;

  if (!commissionType) return null;

  const obj = {
    type: commissionType,
    isTierAdjusted: Boolean(isTierAdjusted),
  };

  if (rateFrom != null) obj.rateFrom = Number(rateFrom);
  if (rateTo != null) obj.rateTo = Number(rateTo);
  if (amountFrom != null) obj.amountFrom = Number(amountFrom);
  if (amountTo != null) obj.amountTo = Number(amountTo);
  if (maxNumberOfInstallments != null) obj.maxNumberOfInstallments = maxNumberOfInstallments;
  if (tuitionBasis != null) obj.tuitionBasis = tuitionBasis;

  return obj;
}

/**
 * Shape a raw Prisma Course row (with includes) into the target API object:
 *
 *   { id, type: "program", attributes: { ... } }
 */
function toProgramResource(course) {
  const { institution } = course;
  const country = institution.country;

  const school = {
    id: institution.id,
    name: institution.name,
    slug: institution.slug,
    city: institution.city ?? null,
    province: institution.province ?? null,
    countryCode: country.code,
    logoThumbnailUrl: institution.logoUrl ?? null,
    bannerUrl: institution.bannerUrl ?? null,
    photos: (institution.photos ?? []).map((p) => ({
      id: p.id,
      url: p.url,
      thumbnailUrl: p.thumbnailUrl ?? null,
    })),
  };

  const programIntakes = (course.intakes ?? []).map((intake) => ({
    id: intake.id,
    openDate: intake.openDate ? intake.openDate.toISOString().slice(0, 10) : null,
    overallScore: intake.overallScore ?? null,
    scoreDetails: Array.isArray(intake.scoreDetails) ? intake.scoreDetails : [],
    startDate: intake.startDate.toISOString().slice(0, 10),
    submissionDeadline: intake.submissionDeadline
      ? intake.submissionDeadline.toISOString().slice(0, 10)
      : null,
  }));

  const commission = buildCommission(institution.commission);

  const attributes = {
    abAppCreationEnabled: course.abAppCreationEnabled,
    // Number(null) is 0, so this must branch: null means no fee was published,
    // and collapsing it to 0 would present an unknown fee as a free one.
    applicationFee: course.applicationFee == null ? null : Number(course.applicationFee),
    commissionAmount: course.commissionAmount != null ? Number(course.commissionAmount) : null,
    // The course's own currency wins where the feed publishes one: a country
    // default cannot express De Montfort University Dubai, a UK institution
    // quoting AED, or Lincoln University (New Zealand) quoting NZD.
    currency: course.currencyCode ?? country.currencyCode,
    // The raw override, for callers that must tell "inherits its country's
    // currency" from "is explicitly priced in it". An editor seeded from
    // `currency` above would write the inherited value back as an override and
    // silently stop the course inheriting.
    currencyCode: course.currencyCode ?? null,
    id: course.id,
    languageOfInstructionCode: course.languageOfInstruction,
    maxLength: course.maxLength,
    minLength: course.minLength,
    name: course.title,
    programIntakes,
    // The recurring pattern, 1-12. Dated instances stay in programIntakes; this
    // says which months the course runs in every year, which is the only thing
    // a provider that publishes "Feb, Sep" with no year can tell us -- and the
    // only form that does not go stale each intake season.
    intakeMonths: course.intakeMonths ?? [],
    programLevel: toProgramLevelSlug(course.programLevel),
    school,
    shortName: course.shortName ?? null,
    slug: course.slug,
    successScore: course.successScoreIntent
      ? { intent: course.successScoreIntent, label: course.successScoreLabel ?? null }
      : null,
    tags: course.tags ?? [],
    // The admin form reads this on open and posts it back on save. While the
    // serializer omitted it, the form read [] and wrote [] — quietly destroying
    // the badges on 55,446 courses one unrelated edit at a time.
    badges: course.badges ?? [],
    tuition: Number(course.tuitionFee),
    // The admin table branches on this to offer Restore instead of Archive. It
    // was read there before it was ever sent, so the button could not appear
    // and an archived course had no way back through the UI.
    archivedAt: course.archivedAt ? course.archivedAt.toISOString() : null,
    // Which feed owns this row. Admin screens surface it because an edit to a
    // scraped course is overwritten by the next import of that feed -- the
    // importer matches on (source, externalId) and rewrites the fields it owns.
    // Without this an admin has no way to tell which edits will survive.
    source: course.source ?? 'manual',
    externalId: course.externalId ?? null,
    // Published by instantapply only; ApplyBoard rows carry null for both.
    // entryRequirements is free-form per provider, so it is passed through as
    // stored rather than flattened into columns the next feed would not fit.
    entryRequirements: course.entryRequirements ?? null,
    externalUrl: course.externalUrl ?? null,
  };

  // Only include commission key if it exists
  if (commission) attributes.commission = commission;

  return {
    id: course.id,
    type: 'program',
    attributes,
  };
}

/**
 * Convert the ProgramLevel enum value to the snake_case slug the API emits.
 * e.g. MASTERS_DEGREE → "masters_degree"
 */
function toProgramLevelSlug(enumValue) {
  return enumValue ? enumValue.toLowerCase() : 'other';
}

// ============================================================================
// Queries
// ============================================================================

export async function searchCourses({
  country,
  search,
  tag,
  programLevel,
  institutionId,
  intakeMonth,
  status = 'active',
  page = 1,
  pageSize = 12,
}) {
  // Shares the deep-offset guard with every other list endpoint.
  const { skip, take: safeSize, page: safePage } = toSkipTake({ page, pageSize: pageSize ?? 12 });

  // Resolved separately so the OR below stays within a single table. An OR that
  // spans the Course->Institution join cannot use the trigram indexes on either
  // side; Postgres falls back to a sequential scan. Two indexed queries beat one
  // unindexed one by ~10x at a million rows.
  let matchingInstitutionIds = null;
  if (search) {
    const matches = await prisma.institution.findMany({
      where: {
        archivedAt: null,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      // Bounded: a one-letter search must not build an IN list of every
      // institution. Course title/shortName still match beyond this cap.
      take: 1000,
    });
    matchingInstitutionIds = matches.map((m) => m.id);
  }

  // 'active' is the default and the only thing the public catalogue ever asks
  // for. The others exist so an admin can find a soft-deleted course again --
  // archiving is reversible, but only if something can list the archived rows.
  //
  // NOT_ARCHIVED also excludes courses whose institution is archived, which the
  // shared helper cannot know about, so the active case keeps using it.
  const where = {
    ...(status === 'active' ? NOT_ARCHIVED : archiveWhere(status)),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { shortName: { contains: search, mode: 'insensitive' } },
        ...(matchingInstitutionIds.length
          ? [{ institutionId: { in: matchingInstitutionIds } }]
          : []),
      ],
    }),
    ...(tag && { tags: { has: tag } }),
    ...(intakeMonth && { intakeMonths: { has: Number(intakeMonth) } }),
    ...(programLevel && { programLevel }),
    ...(institutionId && { institutionId }),
    ...(country &&
      country !== 'ALL' && {
        institution: { archivedAt: null, country: { code: country } },
      }),
  };

  const [rows, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: PROGRAM_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip,
      take: safeSize,
    }),
    prisma.course.count({ where }),
  ]);

  const totalPages = Math.ceil(total / safeSize);
  return {
    data: rows.map(toProgramResource),
    meta: {
      counts: { total },
      page: safePage,
      pageSize: safeSize,
      totalPages,
      // The catalogue is deeper than the offset limit allows: 93,076 courses is
      // 7,757 pages, and anything past ~834 is refused. Sending the reachable
      // limit stops the client offering a "last page" button that always fails.
      maxPage: maxReachablePage(totalPages, safeSize),
    },
  };
}

export async function getCourse(id) {
  const course = await prisma.course.findFirst({
    where: { id, archivedAt: null },
    include: PROGRAM_INCLUDE,
  });
  if (!course) throw new NotFoundError('Course not found or no longer available');
  return toProgramResource(course);
}

export async function createCourse(data) {
  const { intakes, ...rest } = data;

  // Course.slug is required with no database default, but the request schema
  // makes it optional — so a create without one raised a
  // PrismaClientValidationError, which carries no `.code` and surfaced as a 500.
  // Derived here the way institutions have always done it. The uniqueness
  // suffix keeps two courses of the same name at different institutions from
  // colliding on a constraint the caller cannot see.
  const slug = rest.slug || `${slugify(rest.title)}-${Date.now().toString(36)}`;

  const course = await prisma.course.create({
    data: {
      ...rest,
      slug,
      ...(intakes?.length && {
        intakes: {
          create: intakes,
        },
      }),
    },
    include: PROGRAM_INCLUDE,
  });
  return toProgramResource(course);
}

export async function updateCourse(id, data) {
  const { intakes, ...rest } = data;

  // Intakes were previously destructured off and discarded, so editing a course
  // silently dropped every intake change with no error. When the caller supplies
  // them, replace the set; when the key is absent, leave the existing rows alone
  // (an update that omits intakes should not wipe them).
  const course = await prisma.course.update({
    where: { id },
    data: {
      ...rest,
      // `intakes?.length`, not `intakes`: [] is truthy, and the admin form sends
      // the key on every save filtered to rows that have a start date. A course
      // whose intake rows were never filled in therefore had every CourseIntake
      // row deleted by an unrelated edit. An empty array now means "nothing to
      // say about intakes", the same as omitting the key; clearing them is a
      // deliberate act that belongs behind its own endpoint.
      ...(intakes?.length && {
        intakes: {
          deleteMany: {},
          create: intakes,
        },
      }),
    },
    include: PROGRAM_INCLUDE,
  });
  return toProgramResource(course);
}

export async function archiveCourse(id) {
  return prisma.course.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
}

export async function restoreCourse(id) {
  const course = await prisma.course.update({
    where: { id },
    data: { archivedAt: null },
    include: PROGRAM_INCLUDE,
  });
  return toProgramResource(course);
}

export async function bulkCreateCourses(rows) {
  return prisma.course.createMany({ data: rows, skipDuplicates: true });
}

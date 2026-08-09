import { prisma } from '../../utils/prisma.js';
import { NotFoundError } from '../../utils/httpErrors.js';

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
    applicationFee: Number(course.applicationFee),
    commissionAmount: course.commissionAmount != null ? Number(course.commissionAmount) : null,
    currency: country.currencyCode,
    id: course.id,
    languageOfInstructionCode: course.languageOfInstruction,
    maxLength: course.maxLength,
    minLength: course.minLength,
    name: course.title,
    programIntakes,
    programLevel: toProgramLevelSlug(course.programLevel),
    school,
    shortName: course.shortName ?? null,
    slug: course.slug,
    successScore: course.successScoreIntent
      ? { intent: course.successScoreIntent, label: course.successScoreLabel ?? null }
      : null,
    tags: course.tags ?? [],
    tuition: Number(course.tuitionFee),
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
  page = 1,
  pageSize = 12,
}) {
  const safePage = Math.max(1, Math.trunc(Number(page) || 1));
  const safeSize = Math.min(100, Math.max(1, Math.trunc(Number(pageSize) || 12)));

  const where = {
    ...NOT_ARCHIVED,
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { shortName: { contains: search, mode: 'insensitive' } },
        { institution: { name: { contains: search, mode: 'insensitive' } } },
        { institution: { city: { contains: search, mode: 'insensitive' } } },
      ],
    }),
    ...(tag && { tags: { has: tag } }),
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
      skip: (safePage - 1) * safeSize,
      take: safeSize,
    }),
    prisma.course.count({ where }),
  ]);

  return {
    data: rows.map(toProgramResource),
    meta: {
      counts: { total },
      page: safePage,
      pageSize: safeSize,
      totalPages: Math.ceil(total / safeSize),
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
  const course = await prisma.course.create({
    data: {
      ...rest,
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
      ...(intakes && {
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

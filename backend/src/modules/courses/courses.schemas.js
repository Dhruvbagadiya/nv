import { z } from 'zod';
import { optionalUuid, optionalText, optionalEnum } from '../../utils/queryTypes.js';

// Shared pagination coercion. Query strings arrive as text so `coerce` is
// required — `Number('abc')` previously became `skip: NaN`, which Prisma
// turns into a 500.
export const paginationQuery = {
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(12),
};

// Machine-readable program level values the API accepts on input.
const PROGRAM_LEVELS = [
  'MASTERS_DEGREE',
  'POST_GRADUATE_CERTIFICATE',
  'DIPLOMA',
  'CERTIFICATE',
  'BACHELORS_DEGREE',
  'THREE_YEAR_BACHELORS',
  'FOUR_YEAR_BACHELORS',
  'FOUNDATION',
  'OTHER',
];

export const listCoursesQuery = z.object({
  country: optionalText(8),
  search: optionalText(200),
  tag: optionalText(80),
  // Accepts either the new enum key or the legacy degreeLevel string.
  // The service maps it to the prisma enum field.
  programLevel: optionalEnum(PROGRAM_LEVELS),
  institutionId: optionalUuid(),
  // Archived courses are hidden by default -- the catalogue agents search must
  // never show them. Admin screens need to reach them, though: archiving is a
  // soft delete and there is a restore endpoint, which was unreachable while
  // nothing could list an archived row.
  status: z.enum(['active', 'archived', 'all']).default('active'),
  ...paginationQuery,
});

// Intake object used inside createCourseBody.
const intakeFields = z.object({
  startDate: z.coerce.date(),
  openDate: z.coerce.date().optional().nullable(),
  submissionDeadline: z.coerce.date().optional().nullable(),
  overallScore: z.number().optional().nullable(),
  scoreDetails: z.array(z.unknown()).default([]),
});

const courseFields = {
  institutionId: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  shortName: z.string().trim().max(120).optional().nullable(),
  slug: z.string().trim().min(1).max(280).optional(),
  programLevel: z.enum(PROGRAM_LEVELS).default('OTHER'),
  minLength: z.coerce.number().int().nonnegative().default(0),
  maxLength: z.coerce.number().int().nonnegative().default(0),
  languageOfInstruction: z.string().trim().max(10).default('eng'),
  tuitionFee: z.coerce.number().nonnegative(),
  // Nullable: "no application fee published" and "no fee charged" are different
  // facts, and the column now stores the first as NULL rather than as a 0 that
  // reads as free. An admin editing a scraped course must be able to leave it
  // unknown instead of being forced to invent a number.
  applicationFee: z.coerce.number().nonnegative().optional().nullable(),
  // ISO 4217 for this course's fees. Null falls back to the country's currency,
  // which is right for most rows but cannot express a UK university's Dubai
  // campus quoting AED.
  currencyCode: z.string().trim().length(3).toUpperCase().optional().nullable(),
  // The provider's own page for the course.
  externalUrl: z.string().trim().url().max(2048).optional().nullable(),
  // Free-form per provider (IELTS/PTE/TOEFL bands, academic score, MOI, and
  // whatever the next feed publishes), so it is stored and validated as an
  // object rather than as a fixed set of columns that would encode one
  // provider's format as the schema.
  entryRequirements: z.record(z.unknown()).optional().nullable(),
  commissionAmount: z.coerce.number().nonnegative().optional().nullable(),
  abAppCreationEnabled: z.boolean().default(false),
  successScoreIntent: z.enum(['positive', 'negative', 'neutral']).optional().nullable(),
  successScoreLabel: z.string().trim().max(80).optional().nullable(),
  tags: z.array(z.string().trim().max(80)).max(20).default([]),
  badges: z.array(z.string().trim().max(80)).max(10).default([]),
  // Structured intakes replacing the old String[] array.
  intakes: z.array(intakeFields).max(50).default([]),
};

export const createCourseBody = z.object(courseFields).strict();

// Every field optional, but at least one required — an empty PATCH is a caller
// bug and silently returning the unchanged row hides it.
export const updateCourseBody = z
  .object(courseFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const bulkImportBody = z.object({
  rows: z
    .array(
      z.object({
        institutionId: z.string().uuid(),
        title: z.string().trim().min(1).max(240),
        shortName: z.string().trim().max(120).optional().nullable(),
        slug: z.string().trim().max(280).optional(),
        programLevel: z.enum(PROGRAM_LEVELS).default('OTHER'),
        minLength: z.coerce.number().int().nonnegative().default(0),
        maxLength: z.coerce.number().int().nonnegative().default(0),
        languageOfInstruction: z.string().trim().max(10).default('eng'),
        tuitionFee: z.coerce.number().nonnegative(),
        applicationFee: z.coerce.number().nonnegative().optional().nullable(),
        currencyCode: z.string().trim().length(3).toUpperCase().optional().nullable(),
        externalUrl: z.string().trim().url().max(2048).optional().nullable(),
        entryRequirements: z.record(z.unknown()).optional().nullable(),
        commissionAmount: z.coerce.number().nonnegative().optional().nullable(),
        abAppCreationEnabled: z.boolean().default(false),
        tags: z.array(z.string().trim().max(80)).max(20).default([]),
        badges: z.array(z.string().trim().max(80)).max(10).default([]),
      })
    )
    .min(1)
    .max(1000),
});

export const idParam = z.object({ id: z.string().uuid() });

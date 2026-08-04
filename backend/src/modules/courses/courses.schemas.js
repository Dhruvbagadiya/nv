import { z } from 'zod';

// Shared by the list endpoints. `coerce` matters: query strings arrive as text,
// and `Number('abc')` previously became `skip: NaN`, which Prisma turns into a 500.
export const paginationQuery = {
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(12),
};

export const listCoursesQuery = z.object({
  country: z.string().trim().max(8).optional(),
  search: z.string().trim().max(200).optional(),
  tag: z.string().trim().max(80).optional(),
  degreeLevel: z.string().trim().max(80).optional(),
  institutionId: z.string().uuid().optional(),
  ...paginationQuery,
});

const courseFields = {
  institutionId: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  degreeLevel: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(120),
  // Fees are money: reject negatives rather than storing them and rendering
  // "$-500" on a card.
  tuitionFee: z.coerce.number().nonnegative(),
  applicationFee: z.coerce.number().nonnegative(),
  durationText: z.string().trim().min(1).max(80),
  tags: z.array(z.string().trim().max(80)).max(20).default([]),
  // Renamed from `status`, which read like a lifecycle field next to
  // Application.stage but only ever held display pills.
  badges: z.array(z.string().trim().max(80)).max(10).default([]),
  intakes: z.array(z.string().trim().max(40)).max(24).default([]),
};

export const createCourseBody = z.object(courseFields).strict();

// Every field optional, but at least one required — an empty PATCH is a caller
// bug, and silently returning the unchanged row hides it.
export const updateCourseBody = z
  .object(courseFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const bulkImportBody = z.object({
  rows: z.array(z.object(courseFields).strict()).min(1).max(1000),
});

export const idParam = z.object({ id: z.string().uuid() });

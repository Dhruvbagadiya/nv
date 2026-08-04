import { z } from 'zod';

export const COURSE_INQUIRY_STAGES = ['INQUIRY', 'PENDING', 'OFFERED', 'APPLIED'];

export const listInquiriesQuery = z.object({
  countryId: z.string().uuid().optional(),
  intake: z.string().trim().max(40).optional(),
  stage: z.enum(COURSE_INQUIRY_STAGES).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const createInquiryBody = z
  .object({
    nationality: z.string().trim().min(1).max(80),
    // Optional, but must be a real uuid when present — an empty string used to
    // reach Prisma and fail the foreign key as a 500.
    countryId: z.string().uuid().optional(),
    intake: z.string().trim().max(40).optional(),
    courseType: z.string().trim().max(80).optional(),
  })
  .strict();

export const updateStageBody = z.object({ stage: z.enum(COURSE_INQUIRY_STAGES) }).strict();

export const idParam = z.object({ id: z.string().uuid() });

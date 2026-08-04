import { z } from 'zod';

const queryBool = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

export const listEntryRequirementsQuery = z.object({
  // Required: there is no meaningful combined UG+PG view, and defaulting to one
  // silently would make the other screen look empty.
  level: z.enum(['UG', 'PG']),
  country: z.string().trim().max(8).optional(),
  institutionId: z.string().uuid().optional(),
  englishRequirement: z.string().trim().max(80).optional(),
  credibilityInterview: queryBool,
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const englishTestsQuery = z.object({ level: z.enum(['UG', 'PG']) });

export const upsertEntryRequirementBody = z
  .object({
    institutionId: z.string().uuid(),
    level: z.enum(['UG', 'PG']),
    englishRequirement: z.string().trim().min(1).max(2000),
    academicRequirement: z.string().trim().min(1).max(2000),
    offerTimeline: z.string().trim().min(1).max(500),
    credibilityInterview: z.boolean(),
    financialInformation: z.string().trim().min(1).max(2000),
  })
  .strict();

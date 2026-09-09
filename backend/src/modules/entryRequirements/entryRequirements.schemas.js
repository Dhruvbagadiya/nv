import { z } from 'zod';
import { optionalUuid, optionalText, queryBool } from '../../utils/queryTypes.js';
import { STATUS_VALUES } from '../../utils/softDelete.js';

export const listEntryRequirementsQuery = z.object({
  // Required: there is no meaningful combined UG+PG view, and defaulting to one
  // silently would make the other screen look empty.
  level: z.enum(['UG', 'PG']),
  // Defaults to 'active', so a caller that omits it never sees archived rows.
  status: z.enum(STATUS_VALUES).default('active'),
  country: optionalText(8),
  institutionId: optionalUuid(),
  englishRequirement: optionalText(80),
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

export const idParam = z.object({ id: z.string().uuid() });

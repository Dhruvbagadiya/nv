import { z } from 'zod';
import { optionalText, queryBool } from '../../utils/queryTypes.js';

// `page` deliberately has no .default(1): its absence is the signal that the
// caller wants the whole (capped) list rather than a page. Every dropdown in the
// app fetches this endpoint and would break if it silently started receiving
// page 1 of N, so pagination is opt-in.
export const listInstitutionsQuery = z.object({
  country:        optionalText(8),
  search:         optionalText(200),
  blacklisted:    queryBool,
  trending:       queryBool,
  includeArchived: queryBool,
  page:           z.coerce.number().int().positive().optional(),
  pageSize:       z.coerce.number().int().positive().max(100).optional(),
});

export const createInstitutionBody = z
  .object({
    name:         z.string().trim().min(1).max(200),
    slug:         z.string().trim().min(1).max(220).optional(),
    countryId:    z.string().uuid(),
    city:         z.string().trim().max(120).nullable().optional(),
    province:     z.string().trim().max(120).nullable().optional(),
    logoUrl:      z.string().url().max(500).nullable().optional(),
    isTrending:   z.boolean().optional(),
    isBlacklisted: z.boolean().optional(),
  })
  .strict();

export const updateInstitutionBody = createInstitutionBody
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const blacklistBody = z.object({ isBlacklisted: z.boolean() }).strict();

export const idParam = z.object({ id: z.string().uuid() });

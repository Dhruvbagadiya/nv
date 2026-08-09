import { z } from 'zod';
import { optionalText, queryBool } from '../../utils/queryTypes.js';

export const listInstitutionsQuery = z.object({
  country:        optionalText(8),
  search:         optionalText(200),
  blacklisted:    queryBool,
  trending:       queryBool,
  includeArchived: queryBool,
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

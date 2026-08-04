import { z } from 'zod';

// Query strings carry no booleans: "false" is truthy as a string, so an untyped
// flag becomes a filter you cannot turn off.
const queryBool = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

export const listInstitutionsQuery = z.object({
  country: z.string().trim().max(8).optional(),
  search: z.string().trim().max(200).optional(),
  blacklisted: queryBool,
  trending: queryBool,
  includeArchived: queryBool,
});

export const createInstitutionBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    // A uuid, and the admin UI now sends one from a real country picker rather
    // than asking an operator to paste an id out of Prisma Studio.
    countryId: z.string().uuid(),
    logoUrl: z.string().url().max(500).nullable().optional(),
    isTrending: z.boolean().optional(),
  })
  .strict();

export const updateInstitutionBody = createInstitutionBody
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const blacklistBody = z.object({ isBlacklisted: z.boolean() }).strict();

export const idParam = z.object({ id: z.string().uuid() });

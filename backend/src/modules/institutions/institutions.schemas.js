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
    // Wide header image for the institution page. Populated by the Catalogue A
    // import; Catalogue B publishes no banners, so it stays null for those.
    bannerUrl:    z.string().url().max(500).nullable().optional(),
    isTrending:   z.boolean().optional(),
    isBlacklisted: z.boolean().optional(),
  })
  .strict();

export const updateInstitutionBody = createInstitutionBody
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const blacklistBody = z.object({ isBlacklisted: z.boolean() }).strict();

export const idParam = z.object({ id: z.string().uuid() });


// ---------------------------------------------------------------- gallery

export const photoIdParam = z.object({
  id: z.string().uuid(),
  photoId: z.string().uuid(),
});

export const addPhotoBody = z
  .object({
    url: z.string().trim().url().max(500),
    thumbnailUrl: z.string().trim().url().max(500).nullable().optional(),
    fileName: z.string().trim().max(200).nullable().optional(),
    // Omitted means "append"; the service works out the next position.
    position: z.coerce.number().int().nonnegative().optional(),
  })
  .strict();

export const reorderPhotosBody = z
  .object({
    // The full list, in the order wanted. Capped to match the read limit so a
    // reorder cannot be used to write an unbounded transaction.
    ids: z.array(z.string().uuid()).min(1).max(60),
  })
  .strict();

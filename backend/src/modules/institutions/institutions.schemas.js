import { z } from 'zod';
import { commissionDetailFields, withCommissionRanges } from '../commissions/commissions.schemas.js';
import { entryRequirementDetailFields } from '../entryRequirements/entryRequirements.schemas.js';
import { moiDetailFields } from '../moiInstitutions/moiInstitutions.schemas.js';
import { optionalText, queryBool, uploadedUrl } from '../../utils/queryTypes.js';

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
    // uploadedUrl, not .url(): a FileField writes whatever the upload endpoint
    // returned, and with S3 unconfigured that is the relative /uploads/ path.
    logoUrl:      uploadedUrl(500).nullable().optional(),
    // Wide header image for the institution page. Populated by the Catalogue A
    // import; Catalogue B publishes no banners, so it stays null for those.
    bannerUrl:    uploadedUrl(500).nullable().optional(),
    isTrending:   z.boolean().optional(),
    isBlacklisted: z.boolean().optional(),

    /**
     * The three things an institution is useless without, accepted here so they
     * do not have to be entered on three other screens afterwards.
     *
     * All three hang off institutionId and there was never a technical reason
     * they could not be created together — only that nobody had. The cost of
     * three trips is not the typing: it is that an institution can sit in the
     * catalogue for weeks with no commission and no entry requirements, looking
     * complete, because the second and third steps are easy to forget and
     * nothing anywhere says they are missing.
     *
     * Every one is OPTIONAL and every one is written in the SAME transaction as
     * the institution. Sequential requests would let the institution exist with
     * its commission having failed — a half-created row the admin has no way to
     * see, which is worse than the three steps this replaces.
     *
     * Field definitions are imported, not restated: two copies of the rate
     * bounds means the copy nobody is editing is the one that drifts.
     */
    commission: withCommissionRanges(
      z.object(commissionDetailFields).strict()
    ).optional(),

    // At most two: the unique constraint is (institutionId, level) and there
    // are two levels, so a third entry is necessarily a duplicate.
    entryRequirements: z
      .array(z.object(entryRequirementDetailFields).strict())
      .max(2)
      .optional()
      .refine(
        (rows) => !rows || new Set(rows.map((r) => r.level)).size === rows.length,
        'Only one entry requirement per level'
      ),

    moiAcceptances: z
      .array(z.object(moiDetailFields).strict())
      .max(20)
      .optional()
      .refine(
        (rows) => !rows || new Set(rows.map((r) => r.courseType)).size === rows.length,
        'Each course type can appear only once'
      ),
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

import { z } from 'zod';

export const listCommissionsQuery = z.object({
  country: z.string().trim().max(8).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// Tiers are irregular by nature — one flat rate, or bands by student volume, or
// per-programme rates. Validated as a shape rather than as fixed columns, but
// still validated: `tiers` reaching Prisma as arbitrary Json would let a typo
// render as an empty commission cell with no error anywhere.
export const upsertCommissionBody = z
  .object({
    institutionId: z.string().uuid(),
    tiers: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(120),
          rate: z.string().trim().min(1).max(40),
        })
      )
      .min(1)
      .max(20),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

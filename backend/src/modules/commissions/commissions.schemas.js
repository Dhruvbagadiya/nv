import { z } from 'zod';
import { optionalText } from '../../utils/queryTypes.js';
import { STATUS_VALUES } from '../../utils/softDelete.js';

export const listCommissionsQuery = z.object({
  // Defaults to 'active', so a caller that omits it never sees archived rows.
  status: z.enum(STATUS_VALUES).default('active'),
  country: optionalText(8),
  search: optionalText(200),
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

    // The structured fields the program response is actually built from.
    // buildCommission() in courses.service.js returns null unless
    // commissionType is set, and this schema is .strict() — so none of these
    // could be sent, commissionType was never set, and every program card
    // showed commission: null no matter what an admin typed into the tiers.
    commissionType: z.enum(['percentage', 'fixed_amount']).nullable().optional(),
    // Percentages, so bounded: a rate of 900 is a typo, not a deal.
    rateFrom: z.number().min(0).max(100).nullable().optional(),
    rateTo: z.number().min(0).max(100).nullable().optional(),
    amountFrom: z.number().min(0).nullable().optional(),
    amountTo: z.number().min(0).nullable().optional(),
    isTierAdjusted: z.boolean().optional(),
    maxNumberOfInstallments: z.number().int().min(1).max(60).nullable().optional(),
    tuitionBasis: z.enum(['net', 'gross']).nullable().optional(),
  })
  .strict()
  // A range that reads backwards would silently render as "15% – 5%".
  .refine(
    (v) => v.rateFrom == null || v.rateTo == null || v.rateFrom <= v.rateTo,
    { message: 'Rate from must not be greater than rate to', path: ['rateTo'] }
  )
  .refine(
    (v) => v.amountFrom == null || v.amountTo == null || v.amountFrom <= v.amountTo,
    { message: 'Amount from must not be greater than amount to', path: ['amountTo'] }
  );

export const idParam = z.object({ id: z.string().uuid() });

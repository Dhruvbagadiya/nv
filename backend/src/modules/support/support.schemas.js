import { z } from 'zod';

export const createContactBody = z
  .object({
    name: z.string().trim().min(1).max(160),
    // Free-form: these are international numbers written the way staff give them
    // out, and enforcing a format would reject valid ones.
    phone: z.string().trim().min(5).max(40),
    avatarUrl: z.string().trim().max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
  })
  .strict();

export const updateContactBody = createContactBody
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const idParam = z.object({ id: z.string().uuid() });

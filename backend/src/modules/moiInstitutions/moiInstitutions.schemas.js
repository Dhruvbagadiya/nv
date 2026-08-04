import { z } from 'zod';

export const listMoiQuery = z.object({
  country: z.string().trim().max(8).optional(),
  institutionId: z.string().uuid().optional(),
  courseType: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

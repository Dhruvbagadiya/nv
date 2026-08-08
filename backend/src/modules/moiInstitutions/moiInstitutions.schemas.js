import { z } from 'zod';

export const listMoiQuery = z.object({
  country:       z.string().trim().max(8).optional(),
  institutionId: z.string().uuid().optional(),
  courseType:    z.string().trim().max(80).optional(),
  page:          z.coerce.number().int().positive().default(1),
  pageSize:      z.coerce.number().int().positive().max(100).default(20),
});

export const createMoiBody = z.object({
  institutionId: z.string().uuid(),
  courseType:    z.string().trim().min(1).max(80),
  years:         z.coerce.number().int().positive(),
  documentUrl:   z.string().url().max(500).nullable().optional(),
}).strict();

export const updateMoiBody = createMoiBody
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const idParam = z.object({ id: z.string().uuid() });

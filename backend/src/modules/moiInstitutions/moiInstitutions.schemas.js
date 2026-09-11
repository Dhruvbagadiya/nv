import { z } from 'zod';
import { optionalUuid, optionalText, uploadedUrl } from '../../utils/queryTypes.js';

export const listMoiQuery = z.object({
  country:       optionalText(8),
  institutionId: optionalUuid(),
  courseType:    optionalText(80),
  page:          z.coerce.number().int().positive().default(1),
  pageSize:      z.coerce.number().int().positive().max(100).default(20),
});

export const createMoiBody = z.object({
  institutionId: z.string().uuid(),
  courseType:    z.string().trim().min(1).max(80),
  years:         z.coerce.number().int().positive(),
  // uploadedUrl, not .url(): the form uploads this file, and the upload
  // endpoint returns a relative /uploads/ path unless S3 is configured.
  documentUrl:   uploadedUrl(500).nullable().optional(),
}).strict();

export const updateMoiBody = createMoiBody
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const idParam = z.object({ id: z.string().uuid() });

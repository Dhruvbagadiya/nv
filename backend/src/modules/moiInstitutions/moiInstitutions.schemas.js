import { z } from 'zod';
import { optionalUuid, optionalText, optionalEnum, uploadedUrl } from '../../utils/queryTypes.js';
import { PROGRAM_LEVELS } from '../courses/courses.schemas.js';

export const listMoiQuery = z.object({
  country:       optionalText(8),
  institutionId: optionalUuid(),
  courseType:    optionalText(80),
  programLevel:  optionalEnum(PROGRAM_LEVELS),
  page:          z.coerce.number().int().positive().default(1),
  pageSize:      z.coerce.number().int().positive().max(100).default(20),
});

/**
 * An MOI acceptance EXCEPT whose it is — see commissionDetailFields for why:
 * POST /institutions accepts these nested, before the institution has an id.
 */
export const moiDetailFields = {
  /// The label the agent screens render. Kept because they already render it,
  /// and because a provider occasionally names an award the enum has no value
  /// for -- but written from `programLevel` by every form now, so the two
  /// cannot drift the way four spellings of "Bachelor's Degree" did.
  courseType:    z.string().trim().min(1).max(80),
  // The machine-readable half, and the only one a JOIN can use: it is what lets
  // "courses this school accepts an MOI letter for" be a query. Optional because
  // rows written before the column existed carry only prose.
  programLevel:  optionalEnum(PROGRAM_LEVELS),
  years:         z.coerce.number().int().positive(),
  // uploadedUrl, not .url(): the form uploads this file, and the upload
  // endpoint returns a relative /uploads/ path unless S3 is configured.
  documentUrl:   uploadedUrl(500).nullable().optional(),
};

export const createMoiBody = z.object({
  institutionId: z.string().uuid(),
  ...moiDetailFields,
}).strict();

export const updateMoiBody = createMoiBody
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const idParam = z.object({ id: z.string().uuid() });

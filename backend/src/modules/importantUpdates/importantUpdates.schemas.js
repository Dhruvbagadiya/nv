import { z } from 'zod';
import { optionalUuid, optionalDate } from '../../utils/queryTypes.js';

export const listUpdatesQuery = z
  .object({
    // The screen's "Publish Date From/To" inputs. Coerced to Date so the service
    // never has to parse strings.
    from: optionalDate(),
    to: optionalDate(),
    countryId: optionalUuid(),
    institutionId: optionalUuid(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  })
  // A reversed range silently returns nothing, which reads as "no updates" rather
  // than "your dates are backwards".
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: '"from" must be on or before "to"',
    path: ['from'],
  });

export const createUpdateBody = z
  .object({
    title: z.string().trim().min(1).max(240),
    body: z.string().trim().min(1).max(20000),
    publishDate: z.coerce.date(),
    countryId: z.string().uuid().nullable().optional(),
    institutionId: z.string().uuid().nullable().optional(),
    attachmentUrl: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const updateUpdateBody = createUpdateBody
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const idParam = z.object({ id: z.string().uuid() });

import { z } from 'zod';
import { optionalText } from '../../utils/queryTypes.js';
import { STATUS_VALUES } from '../../utils/softDelete.js';

export const listUsefulInformationQuery = z.object({
  // Defaults to 'active', so a caller that omits it never sees archived rows.
  status: z.enum(STATUS_VALUES).default('active'),
  search: optionalText(200),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const createUsefulInformationBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(2000),
    // A bounded string rather than z.string().url(): the panel links out to
    // guidance that may be a path inside the app as easily as a full URL, and
    // the same choice is already made for Document.fileUrl.
    linkUrl: z.string().trim().max(1000).nullable().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

export const updateUsefulInformationBody = createUsefulInformationBody
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const idParam = z.object({ id: z.string().uuid() });

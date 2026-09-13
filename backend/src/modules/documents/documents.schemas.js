import { z } from 'zod';
import { STATUS_VALUES } from '../../utils/softDelete.js';
import { optionalUuid, optionalText } from '../../utils/queryTypes.js';

export const DOCUMENT_CATEGORIES = [
  'VISA_DOCUMENT',
  'REFUND_FORM',
  'INSTITUTE_BROCHURE',
  'SOP',
  'LOR',
];

export const listDocumentsQuery = z.object({
  // Lets an admin find a soft-deleted row again. Defaults to 'active', so a
  // caller that omits it never sees archived rows by accident.
  status: z.enum(STATUS_VALUES).default('active'),
  // Required. There is no combined view of all five categories, and defaulting to
  // one would make the other four look empty.
  category: z.enum(DOCUMENT_CATEGORIES),
  countryId: optionalUuid(),
  institutionId: optionalUuid(),
  search: optionalText(200),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(48),
});

export const createDocumentBody = z
  .object({
    category: z.enum(DOCUMENT_CATEGORIES),
    title: z.string().trim().min(1).max(300),
    // Deliberately a plain bounded string, not z.string().url(): the column holds
    // an opaque locator so that switching between local paths and S3/R2 presigned
    // URLs stays a service-layer decision rather than a schema migration.
    fileUrl: z.string().trim().min(1).max(1000),
    // Written by the server, not typed by an admin, and null whenever the
    // render did not produce one — so optional and nullable rather than required
    // alongside fileUrl.
    thumbnailUrl: z.string().trim().max(500).nullable().optional(),
    countryId: z.string().uuid().nullable().optional(),
    institutionId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

export const updateDocumentBody = createDocumentBody
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const idParam = z.object({ id: z.string().uuid() });

export const uploadUrlBody = z
  .object({
    filename: z.string().trim().min(1).max(300),
    contentType: z.string().trim().min(1).max(200),
    // Optional because a client may not know it; checked against the cap when sent.
    size: z.number().int().positive().optional(),
    category: z.enum(DOCUMENT_CATEGORIES).optional(),
  })
  .strict();

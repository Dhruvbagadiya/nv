import { z } from 'zod';

export const DOCUMENT_CATEGORIES = [
  'VISA_DOCUMENT',
  'REFUND_FORM',
  'INSTITUTE_BROCHURE',
  'SOP',
  'LOR',
];

export const listDocumentsQuery = z.object({
  // Required. There is no combined view of all five categories, and defaulting to
  // one would make the other four look empty.
  category: z.enum(DOCUMENT_CATEGORIES),
  countryId: z.string().uuid().optional(),
  institutionId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
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

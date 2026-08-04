import { z } from 'zod';

export const ANNOUNCEMENT_VARIANTS = ['DANGER', 'INFO', 'WARNING'];

export const createAnnouncementBody = z
  .object({
    variant: z.enum(ANNOUNCEMENT_VARIANTS),
    message: z.string().trim().min(1).max(1000),
    ctaLabel: z.string().trim().max(80).nullable().optional(),
    ctaUrl: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
  })
  .strict()
  // A button with a label and no destination renders as a dead control, which is
  // the exact class of bug this project has been clearing out.
  .refine((v) => !v.ctaLabel || v.ctaUrl, {
    message: 'ctaUrl is required when ctaLabel is set',
    path: ['ctaUrl'],
  });

export const updateAnnouncementBody = z
  .object({
    variant: z.enum(ANNOUNCEMENT_VARIANTS).optional(),
    message: z.string().trim().min(1).max(1000).optional(),
    ctaLabel: z.string().trim().max(80).nullable().optional(),
    ctaUrl: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const idParam = z.object({ id: z.string().uuid() });

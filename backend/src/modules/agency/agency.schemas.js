import { z } from 'zod';

// Validate hex color: #RGB or #RRGGBB
const hexColor = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Must be a valid hex color (e.g. #C96E0E)')
  .nullable()
  .optional();

// Accept either a full URL (https://cdn.example.com/logo.png)
// or a local relative path from the uploads endpoint (/uploads/logos/...)
const logoUrlSchema = z
  .string()
  .max(500)
  .refine(
    (v) => {
      try { new URL(v); return true; } catch { /* not absolute */ }
      return v.startsWith('/uploads/');
    },
    { message: 'Must be a valid URL or a /uploads/ path' }
  )
  .nullable()
  .optional();

export const upsertAgencyBody = z.object({
  agencyName:  z.string().trim().min(1).max(120),
  logoUrl:     logoUrlSchema,
  website:     z.string().url().max(300).nullable().optional(),
  accentColor: hexColor,
}).strict();

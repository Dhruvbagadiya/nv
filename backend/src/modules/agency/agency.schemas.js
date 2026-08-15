import { z } from 'zod';

// Validate hex color: #RGB or #RRGGBB
const hexColor = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Must be a valid hex color (e.g. #C96E0E)')
  .nullable()
  .optional();

export const upsertAgencyBody = z.object({
  agencyName:  z.string().trim().min(1).max(120),
  logoUrl:     z.string().url().max(500).nullable().optional(),
  website:     z.string().url().max(300).nullable().optional(),
  accentColor: hexColor,
}).strict();

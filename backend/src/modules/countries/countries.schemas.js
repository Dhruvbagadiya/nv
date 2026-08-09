import { z } from 'zod';

export const listCountriesQuery = z.object({
  // Query strings have no booleans — "false" is a non-empty string and therefore
  // truthy, which is a classic way to end up with a filter that cannot be
  // switched off. Coerced explicitly.
  withInstitutionsOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

// The portal's own shorthand. Uppercase and short — it appears in URLs
// (?country=UK) and on the header chips.
const codeField = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(4)
  .regex(/^[A-Z]+$/, 'Use letters only, e.g. UK');

export const createCountryBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    code: codeField,
    // ISO 3166-1 alpha-2. Exactly two letters — flag images are keyed on it, and
    // anything else silently yields a broken image.
    isoCode: z
      .string()
      .trim()
      .toUpperCase()
      .length(2, 'ISO code is exactly two letters, e.g. GB')
      .regex(/^[A-Z]{2}$/, 'ISO code is exactly two letters, e.g. GB'),
    currencyCode: z
      .string()
      .trim()
      .toUpperCase()
      .length(3, 'Currency is a 3-letter ISO code, e.g. GBP')
      .regex(/^[A-Z]{3}$/, 'Currency is a 3-letter ISO code, e.g. GBP'),
    sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  })
  .strict();

// `code` is accepted so a caller can send an unchanged object back, but the
// service refuses any actual change — see the note there.
export const updateCountryBody = createCountryBody
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const idParam = z.object({ id: z.string().uuid() });

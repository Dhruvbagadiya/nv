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

import { z } from 'zod';

// An empty query parameter means "not filtering by this", not "filter by empty".
//
// A browser form with nothing selected serialises as `?countryId=&stage=&page=1`.
// zod's `.optional()` only permits the key to be ABSENT — a present empty string
// is still validated, so `z.string().uuid().optional()` rejects `countryId=` with
// "Invalid uuid" and the whole request 400s. Six of the eight filtered screens
// failed on first load for exactly this reason, the Dashboard among them.
//
// It went unnoticed because every API test either sent a real value or omitted
// the key entirely — neither of which is what the client actually does.
//
// Wrap any optional QUERY field with this. Body schemas are left alone: there an
// empty string is usually a genuine mistake worth reporting.
export const optionalQuery = (schema) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

// Query strings carry no booleans: "false" is a non-empty string and therefore
// truthy, so an untyped flag becomes a filter that cannot be switched off.
export const queryBool = optionalQuery(
  z.enum(['true', 'false']).transform((v) => v === 'true')
);

export const optionalUuid = () => optionalQuery(z.string().uuid());
export const optionalText = (max = 200) => optionalQuery(z.string().trim().max(max));
export const optionalEnum = (values) => optionalQuery(z.enum(values));
export const optionalDate = () => optionalQuery(z.coerce.date());

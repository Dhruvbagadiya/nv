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

// The same problem exists in request BODIES. A form's unselected <select>
// submits "" in JSON exactly as it does in a query string, so an optional body
// field must treat "" as "not provided" too. Creating a course inquiry with no
// destination chosen 400'd with "Invalid uuid" for precisely this reason.
//
// Only for OPTIONAL fields: a REQUIRED one receiving "" is a genuine error and
// should still be reported.
export const optionalBody = optionalQuery;

export const optionalUuid = () => optionalQuery(z.string().uuid());
export const optionalText = (max = 200) => optionalQuery(z.string().trim().max(max));
export const optionalEnum = (values) => optionalQuery(z.enum(values));
export const optionalDate = () => optionalQuery(z.coerce.date());

/**
 * A URL produced by the upload endpoints.
 *
 * `putObject` returns an absolute CDN URL when S3/R2 is configured and a
 * RELATIVE path — `/uploads/<key>` — when it is not (utils/storage.js). A plain
 * `z.string().url()` accepts the first and rejects the second, so on a box
 * running local storage every logo, banner and attachment a FileField uploaded
 * came back 400 "Invalid url" at save time.
 *
 * Agency logos and profile avatars each carried their own copy of this
 * refinement and so worked; institutions and MOI documents used `.url()` and did
 * not. One helper, used by every field a FileField writes.
 */
export const uploadedUrl = (max = 500) =>
  z
    .string()
    .max(max)
    .refine(
      (v) => {
        try {
          new URL(v);
          return true;
        } catch {
          /* not absolute — fall through to the local-path check */
        }
        return v.startsWith('/uploads/');
      },
      { message: 'Must be a valid URL or a /uploads/ path' }
    );

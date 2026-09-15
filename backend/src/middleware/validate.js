import { BadRequestError } from '../utils/httpErrors.js';

// zod was already a dependency but imported nowhere — every controller passed
// req.body / req.query straight into Prisma. Beyond the obvious injection of
// unexpected fields, `Number(page)` on garbage produced `skip: NaN`, which
// Prisma turns into a 500.
//
//   router.get('/', validate(listQuerySchema, 'query'), asyncHandler(list))
//
// The parsed (and therefore coerced + defaulted) result replaces the raw input,
// so handlers can trust types: `req.query.page` is a real number afterwards.
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        // `unrecognized_keys` carries an EMPTY path — the offending key is in
        // `i.keys` instead — so joining the path gave "" and the client rendered
        // ": Unrecognized key(s) in object", a message with a colon and no
        // subject. Every schema here is .strict(), which makes this the issue a
        // caller sending one field too many actually gets.
        field: i.path.join('.') || i.keys?.join(', ') || '',
        message: i.message,
      }));
      return next(new BadRequestError(`Invalid request ${source}`, details));
    }
    req[source] = result.data;
    next();
  };
}

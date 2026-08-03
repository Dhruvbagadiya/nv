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
        field: i.path.join('.'),
        message: i.message,
      }));
      return next(new BadRequestError(`Invalid request ${source}`, details));
    }
    req[source] = result.data;
    next();
  };
}

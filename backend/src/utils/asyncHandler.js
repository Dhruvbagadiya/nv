// Express 4 does not catch rejections from async handlers — an unhandled one
// hangs the request forever. Every controller was hand-writing the same
// try/catch/next(err) to work around it; this wrapper does it once.
//
//   router.get('/', asyncHandler(listThings))
//
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

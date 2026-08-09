// Express 4 does not catch rejections from async handlers — an unhandled one
// hangs the request forever. Every controller was hand-writing the same
// try/catch/next(err) to work around it; this wrapper does it once.
//
//   router.get('/', asyncHandler(listThings))
//
export const asyncHandler = (fn) => (req, res, next) => {
  // try/catch as well as .catch: a handler that throws synchronously (a bad
  // destructure, a thrown guard before the first await) throws before
  // Promise.resolve can wrap it. Express 4 catches that case itself, but a
  // wrapper whose whole job is "never let an error escape" should not depend on
  // which side of the first await the throw happened on.
  try {
    return Promise.resolve(fn(req, res, next)).catch(next);
  } catch (err) {
    return next(err);
  }
};

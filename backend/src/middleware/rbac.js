import { ForbiddenError, UnauthorizedError } from '../utils/httpErrors.js';

// Usage: router.post('/', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), handler)
//
// Always compose after requireAuth. This already failed closed — an absent
// req.user was rejected rather than waved through — which is exactly what the
// frontend's ProtectedRoute got wrong, and why the API was still safe while the
// admin UI leaked.
export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    // 401 vs 403 is a real distinction for the client: "log in" vs "you're logged
    // in but this isn't yours".
    if (!req.user) return next(new UnauthorizedError('Authentication required'));
    if (!allowedRoles.includes(req.user.role)) return next(new ForbiddenError());
    next();
  };
}

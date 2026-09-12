/**
 * Attach req.user when a valid token is present, and carry on when it is not.
 *
 * Some endpoints are deliberately public — the course catalogue is browsable
 * without signing in — but still need to behave differently for an admin. A
 * plain `requireAuth` would break the public case; no auth at all means the
 * endpoint cannot tell an admin from a stranger, which is how
 * `GET /api/courses?status=archived` ended up letting anyone enumerate
 * soft-deleted rows.
 *
 * Never throws. A malformed or expired token is treated as no token, because a
 * public endpoint should not start failing for someone whose session lapsed.
 */

import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getAuthState } from '../utils/userCache.js';

export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  try {
    const claims = jwt.verify(header.slice('Bearer '.length), config.jwt.accessSecret);
    const state = await getAuthState(claims.sub);
    // Same rule as requireAuth: a deactivated account is not privileged, and the
    // stored role beats the token's copy.
    if (state?.isActive) req.user = { ...claims, role: state.role };
  } catch {
    // Deliberately silent — see above.
  }
  next();
}

/** Roles allowed to see soft-deleted rows through a public list endpoint. */
export const canSeeArchived = (user) => user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

/**
 * Roles allowed to see what the agency earns on a course.
 *
 * The course catalogue is deliberately public so students can browse without an
 * account, but commission is partner-confidential everywhere else in the
 * product: /api/commissions requires a partner role, the screen lives under
 * /partner/*, and the only components that render it are partner components.
 * The figures rode along on the public programme payload anyway, so they sat in
 * the network tab of any anonymous visitor to /programs — the UI simply never
 * drew them.
 *
 * Written as an allow-list rather than `role !== 'STUDENT'`, which is the
 * negation pattern utils/scope.js exists to keep out of this codebase: with a
 * negation, an anonymous caller (`user` undefined) passes.
 */
export const canSeeCommission = (user) =>
  user?.role === 'AGENT' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

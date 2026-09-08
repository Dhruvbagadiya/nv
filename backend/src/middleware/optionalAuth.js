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

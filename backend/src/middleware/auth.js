import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { UnauthorizedError, ForbiddenError } from '../utils/httpErrors.js';
import { getAuthState } from '../utils/userCache.js';

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing access token'));
  }
  try {
    req.user = jwt.verify(header.slice('Bearer '.length), config.jwt.accessSecret);

    // The token is proof of who signed in, not of what they may still do. It
    // carries `role` and lives 15 minutes, so without this a deactivated or
    // demoted account kept its privileges until the token expired on its own.
    // Cached for 30s, and evicted on any write that changes either field.
    const state = await getAuthState(req.user.sub);
    if (!state) return next(new UnauthorizedError('Account no longer exists'));
    if (!state.isActive) return next(new ForbiddenError('This account has been deactivated'));

    // The stored role wins over the token's copy, so a demotion binds at once
    // rather than at the next refresh.
    req.user.role = state.role;

    next();
  } catch (err) {
    // Distinguished so the client knows to try /auth/refresh rather than
    // bouncing the user to the login screen for a merely-stale token.
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Access token expired'));
    }
    next(new UnauthorizedError('Invalid access token'));
  }
}

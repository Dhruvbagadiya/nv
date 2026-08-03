import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { UnauthorizedError } from '../utils/httpErrors.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing access token'));
  }
  try {
    req.user = jwt.verify(header.slice('Bearer '.length), config.jwt.accessSecret);
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

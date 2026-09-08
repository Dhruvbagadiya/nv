/**
 * Sign an access token the way auth.service.js does, so route tests can hit a
 * guarded endpoint without going through login.
 */
import jwt from 'jsonwebtoken';
import { config } from '../../src/config.js';

export function tokenFor({ sub = 'u-test', role = 'AGENT' } = {}) {
  return jwt.sign({ sub, role }, config.jwt.accessSecret, { expiresIn: '15m' });
}

export const bearer = (opts) => `Bearer ${tokenFor(opts)}`;

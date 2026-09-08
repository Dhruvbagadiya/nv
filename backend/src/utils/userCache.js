/**
 * A very short-lived cache of the fields that decide what a request may do.
 *
 * Access tokens carry `role` and are valid for 15 minutes, and nothing revoked
 * them mid-flight. So deactivating a compromised account, or demoting a Super
 * Admin, left them with full privileges until their token happened to expire.
 * Revoking refresh tokens does not help — the access token is already issued.
 *
 * Re-reading the user on every request fixes that but adds a query to every
 * authenticated call. A 30-second TTL is the compromise: one primary-key lookup
 * per user per 30s, and the worst case for a revoked privilege drops from 15
 * minutes to 30 seconds. Writes that change either field evict the entry, so in
 * practice it is immediate.
 *
 * In-process on purpose. The alternative is Redis, and a cache that survives a
 * restart is a cache that can be stale after a deploy — for a single-container
 * deployment this is both simpler and safer.
 */

import { prisma } from './prisma.js';

const TTL_MS = 30_000;
const entries = new Map();

export async function getAuthState(userId) {
  const hit = entries.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.state;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, role: true },
  });

  // A deleted user caches as null too, so a token for a removed account does not
  // hit the database on every request it makes.
  const state = user ?? null;
  entries.set(userId, { state, at: Date.now() });
  return state;
}

/** Call after any write that changes a user's role or active flag. */
export function evictAuthState(userId) {
  entries.delete(userId);
}

/** Test seam, and used when the whole table is touched. */
export function clearAuthCache() {
  entries.clear();
}

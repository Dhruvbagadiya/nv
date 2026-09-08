/**
 * Is this connection string pointing at a database on this machine?
 *
 * One implementation, two callers that must never disagree:
 *
 *   scripts/guard-local-db.mjs  refuses `prisma migrate dev` and `migrate reset`
 *                               against anything else, because backend/.env
 *                               points at production and those commands drop and
 *                               recreate the schema when they see drift
 *   tests/setup.js              asserts the test suite is not about to open a
 *                               client against a real database
 *
 * Kept deliberately narrow. A hostname that merely *looks* local (a tunnel, a
 * hosts-file alias) is treated as remote, because the cost of a false "yes" here
 * is dropping a production table and the cost of a false "no" is one flag.
 */
export function isLocalDatabaseUrl(url) {
  return /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(String(url ?? ''));
}

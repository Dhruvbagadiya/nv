/**
 * Runs before any module in the backend test suite is imported.
 *
 * Its job is to make it impossible for a test to touch the real database.
 *
 * backend/.env points at production, because that is what the import and sync
 * scripts need. Services import a shared PrismaClient singleton, so a single
 * forgotten `vi.mock` in one test file would open a live connection to a
 * catalogue of 93,076 courses and every application. Tests are also where
 * `deleteMany` and `updateMany` get written by hand.
 *
 * So the URL is replaced here, before `src/config.js` is ever evaluated. The
 * mock is the mechanism; this is the seatbelt for when someone forgets it.
 */

import { isLocalDatabaseUrl } from '../src/utils/dbUrl.js';

// Not a real database. Nothing listens on this port in CI or on a dev machine,
// so an unmocked Prisma call fails to connect instead of succeeding quietly
// against production — a loud failure is the point.
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/nv_test_never_created';

// config.js validates these at import time and rejects the .env.example
// placeholders, so the suite cannot start without them.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-characters-long';

// If this ever fails, someone has changed the line above and the suite is one
// forgotten mock away from writing to production.
if (!isLocalDatabaseUrl(process.env.DATABASE_URL)) {
  throw new Error(
    'Test setup refused to run: DATABASE_URL is not local.\n' +
      'The backend suite must never be able to reach a real database.'
  );
}

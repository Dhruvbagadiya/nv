import { defineConfig } from 'vitest/config';

// Node environment, and only the DB-free suites. Anything that needs Postgres
// lives in scripts/verify-auth.mjs instead: the database is not reachable from
// every environment this repo is worked on from (see README), so making the unit
// suite depend on it would mean it simply never runs.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'tests/**/*.test.js'],
    // Replaces DATABASE_URL with an unreachable local one before any module is
    // imported. Services share a PrismaClient singleton and .env points at
    // production, so one forgotten vi.mock would otherwise be enough to write
    // to live data from a test.
    setupFiles: ['./tests/setup.js'],
  },
});

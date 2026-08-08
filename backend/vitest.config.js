import { defineConfig } from 'vitest/config';

// Node environment, and only the DB-free suites. Anything that needs Postgres
// lives in scripts/verify-auth.mjs instead: the database is not reachable from
// every environment this repo is worked on from (see README), so making the unit
// suite depend on it would mean it simply never runs.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'tests/**/*.test.js'],
  },
});

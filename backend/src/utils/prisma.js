import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

/**
 * The single shared Prisma instance. Every module imports this and none
 * constructs its own.
 *
 * TWO THINGS ARE CONFIGURED HERE THAT USED TO BE DEFAULTS, and a default is not
 * a decision:
 *
 * The POOL SIZE. Prisma sizes it as `physical_cpus * 2 + 1`, so the number of
 * connections this container holds changes when the host changes — a droplet
 * resize silently alters it, and a managed Postgres has a hard connection cap
 * that the API, the migration job and any ops script all draw from. Stating it
 * makes the cap something we set against, rather than something we discover.
 *
 * SLOW QUERY LOGGING. There was none. When the database CPU spiked there was no
 * way to learn which query did it — the graph said "something", the logs said
 * nothing, and the only remaining move was to guess. Every query over the
 * threshold is now logged with its duration and its SQL.
 */

/**
 * Pool settings appended to the connection string.
 *
 * Prisma takes these from the URL rather than from the constructor, so they have
 * to be query parameters. Existing ones are respected: an operator who has
 * tuned the URL by hand should not have it overwritten from here.
 */
function withPoolSettings(url) {
  try {
    const parsed = new URL(url);
    // Below the smallest managed-Postgres cap, and leaving headroom for a
    // migration job, an ops script and a psql session to coexist with the API.
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '10');
    }
    // How long a request waits for a free connection before failing. The default
    // is 10s, which on a saturated pool means requests pile up for ten seconds
    // and then fail anyway — long enough for the client to have given up and
    // retried, making it worse.
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '5');
    }
    return parsed.toString();
  } catch {
    // A URL Node cannot parse is one Prisma will reject with a better message
    // than anything thrown from here.
    return url;
  }
}

/** Queries slower than this are logged. Overridable without a deploy. */
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS ?? 300);

export const prisma = new PrismaClient({
  datasources: { db: { url: withPoolSettings(config.databaseUrl) } },
  // `event` rather than `stdout`: emitting every query to the log would bury the
  // slow ones among thousands of fast ones, which is how query logging gets
  // turned off again a week later.
  log: [
    { level: 'query', emit: 'event' },
    { level: 'warn', emit: 'stdout' },
    { level: 'error', emit: 'stdout' },
  ],
});

prisma.$on('query', (e) => {
  if (e.duration < SLOW_QUERY_MS) return;
  // The params are NOT logged. They carry passport numbers, student names and
  // password hashes, and a log line is the easiest place in the system for
  // those to end up somewhere nobody meant them to be. The query shape is what
  // identifies the problem; the values never are.
  console.warn(`[slow query] ${e.duration}ms  ${e.query.replace(/\s+/g, ' ').slice(0, 300)}`);
});

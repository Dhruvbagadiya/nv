/**
 * What the database is actually spending its time on.
 *
 *   docker compose -f deploy/docker-compose.prod.yml run --rm api \
 *     node ops/db-report.mjs
 *
 * READ ONLY. Every statement here is a SELECT against a catalog or statistics
 * view; it writes nothing and takes no locks worth the name.
 *
 * The insights graph says CPU was high at 19:10 and nothing else. This turns
 * that into a list: which queries cost the most total time, which tables are
 * being read sequentially because an index is missing, which indexes have never
 * been used, and where the disk has gone. Guessing at a query plan from a CPU
 * chart is how the wrong thing gets optimised.
 *
 * pg_stat_statements is enabled by default on DigitalOcean managed Postgres. If
 * it is missing the section is skipped with a note rather than failing the run —
 * the other four sections are worth having on their own.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

const rows = (n) => Number(process.argv.find((a) => a.startsWith('--top='))?.split('=')[1] ?? n);
const TOP = rows(15);

const heading = (title) => console.log(`\n\n=== ${title} ${'='.repeat(Math.max(0, 60 - title.length))}`);
const table = (data, empty = 'nothing to report') => {
    if (!data.length) return console.log(`  ${empty}`);
    console.table(data);
};

// ── 1. Size ─────────────────────────────────────────────────────────────────
heading('Biggest tables');
console.log('Table size is the index size PLUS the rows. A table whose indexes');
console.log('outweigh its data is usually over-indexed: every write pays for all');
console.log('of them, and an index nothing reads is pure cost.\n');
table(await prisma.$queryRaw`
  SELECT
    relname                                              AS table,
    pg_size_pretty(pg_total_relation_size(c.oid))        AS total,
    pg_size_pretty(pg_relation_size(c.oid))              AS rows_only,
    pg_size_pretty(pg_indexes_size(c.oid))               AS indexes,
    n_live_tup                                           AS live_rows
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY pg_total_relation_size(c.oid) DESC
  LIMIT 15
`);

// ── 2. Sequential scans ─────────────────────────────────────────────────────
heading('Tables read sequentially');
console.log('A sequential scan reads every row. On a small table that is correct and');
console.log('cheaper than an index; on a large one it is a missing index, and it is');
console.log('the single most likely cause of a CPU spike. Read the two together:');
console.log('many seq scans over many live rows is the pair that matters.\n');
table(await prisma.$queryRaw`
  SELECT
    relname        AS table,
    seq_scan       AS seq_scans,
    seq_tup_read   AS rows_read_sequentially,
    idx_scan       AS index_scans,
    n_live_tup     AS live_rows
  FROM pg_stat_user_tables
  WHERE seq_scan > 0
  ORDER BY seq_tup_read DESC
  LIMIT 15
`);

// ── 3. Unused indexes ───────────────────────────────────────────────────────
heading('Indexes nothing has used');
console.log('Every one of these is paid for on every insert and update to its table,');
console.log('and returns nothing. Counts reset when the stats do, so a fresh database');
console.log('or a recent restart makes everything look unused — check uptime below');
console.log('before dropping anything. A UNIQUE index is a constraint, not an');
console.log('optimisation, and is excluded.\n');
table(await prisma.$queryRaw`
  SELECT
    s.relname   AS table,
    s.indexrelname AS index,
    pg_size_pretty(pg_relation_size(s.indexrelid)) AS size,
    s.idx_scan  AS scans
  FROM pg_stat_user_indexes s
  JOIN pg_index i ON i.indexrelid = s.indexrelid
  WHERE s.idx_scan = 0 AND NOT i.indisunique AND NOT i.indisprimary
  ORDER BY pg_relation_size(s.indexrelid) DESC
  LIMIT 20
`, 'every index has been used at least once');

// ── 4. Dead rows ────────────────────────────────────────────────────────────
heading('Dead rows awaiting vacuum');
console.log('Postgres keeps the old version of every updated row until vacuum');
console.log('removes it. A table with more dead rows than live ones makes every scan');
console.log('read both, which looks exactly like a query that got slower on its own.\n');
table(await prisma.$queryRaw`
  SELECT
    relname       AS table,
    n_live_tup    AS live,
    n_dead_tup    AS dead,
    last_autovacuum,
    last_autoanalyze
  FROM pg_stat_user_tables
  WHERE n_dead_tup > 1000
  ORDER BY n_dead_tup DESC
  LIMIT 15
`, 'no table has a meaningful number of dead rows');

// ── 5. Slowest statements ───────────────────────────────────────────────────
heading('Queries by total time');
console.log('TOTAL time, not mean: a 2ms query run fifty thousand times costs more');
console.log('than a 400ms one run twice, and only the first shows up as sustained');
console.log('CPU. The spike on the graph is likely the second kind; the baseline is');
console.log('the first.\n');
try {
    const slow = await prisma.$queryRawUnsafe(`
    SELECT
      round(total_exec_time)::int   AS total_ms,
      calls,
      round(mean_exec_time::numeric, 2) AS mean_ms,
      round(max_exec_time)::int     AS max_ms,
      left(regexp_replace(query, '\\s+', ' ', 'g'), 130) AS query
    FROM pg_stat_statements
    WHERE query NOT LIKE '%pg_stat_statements%'
    ORDER BY total_exec_time DESC
    LIMIT ${TOP}
  `);
    table(slow);
    console.log('\nReset the counters after a change to measure it:');
    console.log('  SELECT pg_stat_statements_reset();');
} catch (err) {
    console.log(`  unavailable — ${err.message.split('\n')[0]}`);
    console.log('  Enable it with: CREATE EXTENSION pg_stat_statements;');
}

// ── 6. Connections ──────────────────────────────────────────────────────────
heading('Connections');
console.log('Prisma sizes its pool from the HOST cpu count unless told otherwise, so');
console.log('a droplet resize changes it silently. The API, the migration job and any');
console.log('ops script all draw from one managed cap.\n');
table(await prisma.$queryRaw`
  SELECT state, count(*)::int AS connections
  FROM pg_stat_activity
  WHERE datname = current_database()
  GROUP BY state
  ORDER BY connections DESC
`);
const [{ max_connections }] = await prisma.$queryRaw`SHOW max_connections`;
const [{ uptime }] = await prisma.$queryRaw`
  SELECT date_trunc('second', now() - pg_postmaster_start_time())::text AS uptime
`;
console.log(`\n  max_connections: ${max_connections}`);
console.log(`  server uptime:   ${uptime}   (stats above cover at most this long)`);

await prisma.$disconnect();

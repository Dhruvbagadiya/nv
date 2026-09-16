import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Indexes the hot lists depend on, and the pairing between schema and migration.
 *
 * Postgres uses ONE index per scan. Given `WHERE archivedAt IS NULL ORDER BY
 * createdAt DESC LIMIT 12`, two single-column indexes do not combine: it either
 * walks archivedAt and sorts the result, or walks createdAt in order and
 * discards archived rows as it goes. At 93,000 courses both are work the
 * database should not be doing.
 *
 * The second test is the one that matters most. This project runs `migrate
 * deploy` only — never `migrate dev` — so an index added to schema.prisma with
 * no migration beside it exists on nobody's database. It would pass every test,
 * read correctly in review, and do nothing in production.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(join(here, '..', 'prisma', 'schema.prisma'), 'utf8');

const MIGRATIONS = (() => {
  const root = join(here, '..', 'prisma', 'migrations');
  return readdirSync(root)
    .filter((d) => !d.endsWith('.toml'))
    .map((d) => {
      try {
        return readFileSync(join(root, d, 'migration.sql'), 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');
})();

/** Each one: the model, and the (filter, sort) pair the query actually runs. */
const REQUIRED = [
  ['Course', ['archivedAt', 'createdAt'], 'the catalogue default: active courses, newest first'],
  ['Course', ['institutionId', 'archivedAt', 'createdAt'], 'the same page narrowed to one school'],
  ['Application', ['agentId', 'deadlineAt'], "the dashboard's deadline panel"],
  ['Application', ['agentId', 'stage'], "the Report screen's stage tiles"],
  ['Notification', ['userId', 'readAt', 'createdAt'], 'the notification list: unread, newest first'],
];

describe('composite indexes for the hot lists', () => {
  it.each(REQUIRED)('%s has (%s) — %s', (model, columns) => {
    // The @@index line, however the sort modifiers are written.
    const pattern = new RegExp(
      `@@index\\(\\[${columns.map((c) => `${c}[^,\\]]*`).join(', ')}\\]\\)`
    );
    expect(SCHEMA).toMatch(pattern);
  });

  /**
   * An index in the schema with no migration behind it is an index nobody has.
   * `migrate dev` would have written one; this project never runs it, because
   * it drops the hand-written trigram GIN indexes that are not in the schema at
   * all.
   */
  it.each(REQUIRED)('%s (%s) has a migration that creates it', (model, columns) => {
    const created = [...MIGRATIONS.matchAll(/CREATE INDEX[^;]+?ON "(\w+)"\s*\(([^)]*)\)/gs)]
      .filter(([, table]) => table === model)
      .map(([, , cols]) => cols.replace(/"|\s|DESC|ASC/g, '').split(','));

    expect(
      created.some((cols) =>
        cols.length === columns.length && columns.every((c, i) => cols[i] === c)
      ),
      `no migration creates ${model}(${columns.join(', ')}) — it would exist on nobody's database`
    ).toBe(true);
  });
});

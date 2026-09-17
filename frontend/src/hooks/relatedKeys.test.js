import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELATED_KEYS } from './useInvalidateResource.js';

/**
 * The failure this guards is silent.
 *
 * `invalidateQueries({ queryKey: ['agency-profile'] })` against a key no query
 * uses does not throw, warn, or return anything a caller could check — it simply
 * refetches nothing. That exact call sat in AgencySettings for months. In the
 * other direction, a cache keyed on a root of its own shares a prefix with
 * nothing, so no entry in RELATED_KEYS can ever reach it: that is how a newly
 * created institution stayed missing from the picker on fourteen screens.
 *
 * Neither is visible in a screen test, because both look exactly like success.
 * So the source is read and the two directions are asserted against each other.
 *
 * Reading the source rather than rendering follows `styles/cardAlignment.test.js`:
 * where the defect is a relationship between two files, the relationship is what
 * gets asserted.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..');

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.jsx?$/.test(entry) && !/\.test\./.test(entry)) out.push(p);
  }
  return out;
}

// Matches `queryKey: ['x', …]` and the JSX prop form `queryKey={['x', …]}`.
// Only a literal first element is captured; a key built from a variable cannot
// be checked this way and is deliberately skipped rather than guessed at.
const QUERY_ROOT = /queryKey[:=]\s*\{?\s*\[\s*(['"`])([^'"`$]+)\1/g;

/** Every query key root the app actually uses → the files that use it. */
const queryRoots = (() => {
  const roots = new Map();
  for (const file of sourceFiles(SRC)) {
    for (const match of readFileSync(file, 'utf8').matchAll(QUERY_ROOT)) {
      const root = match[2];
      if (!roots.has(root)) roots.set(root, []);
      roots.get(root).push(relative(SRC, file));
    }
  }
  return roots;
})();

/**
 * Roots that legitimately nothing invalidates. Each needs a reason, because the
 * whole point of the second test is that this list stays short.
 */
const NOT_INVALIDATED_BY_DESIGN = {
  // Reports whether S3/R2 is configured. Read from the environment at boot; no
  // mutation in the app can change it.
  'storage-status': 'server configuration, not data',
  // The document-type catalogue is a constant in the bundle, filtered locally.
  // It goes through useQuery only because EntityPicker's search is built on one;
  // there is no server call to go stale.
  'document-kinds': 'a constant in the bundle, not fetched',
  // Same: the twenty ProgramLevel values, searched locally. It goes through
  // useQuery only because EntityPicker's search is built on one.
  'program-levels': 'a constant in the bundle, not fetched',
};

describe('RELATED_KEYS is wired to keys that exist', () => {
  it('finds the query keys at all, so a silent regex failure cannot pass this file', () => {
    expect(queryRoots.size).toBeGreaterThan(20);
    expect(queryRoots.has('institutions')).toBe(true);
  });

  // The AgencySettings direction: invalidating a name nothing queries.
  it.each(
    Object.entries(RELATED_KEYS).flatMap(([resource, keys]) =>
      keys.map((key) => [resource, key[0]])
    )
  )('%s → [%s] names a key some query uses', (_resource, root) => {
    expect(
      queryRoots.has(root),
      `RELATED_KEYS invalidates ['${root}'], but no useQuery uses that root. ` +
        `Invalidating it refetches nothing, silently.`
    ).toBe(true);
  });

  // The InstitutionPicker direction: a cache on a root nothing can reach.
  it.each([...queryRoots.keys()].sort())('the [%s] cache is reachable from some resource', (root) => {
    if (root in NOT_INVALIDATED_BY_DESIGN) return;

    const reachable = Object.values(RELATED_KEYS).some((keys) => keys.some((k) => k[0] === root));

    expect(
      reachable,
      `['${root}'] (${queryRoots.get(root).join(', ')}) is not listed under any ` +
        `resource in RELATED_KEYS, so no mutation can refresh it and it goes ` +
        `stale until the page is reloaded. Either key it under the entity it ` +
        `holds — one key root per entity — or add it to a resource's list.`
    ).toBe(true);
  });
});

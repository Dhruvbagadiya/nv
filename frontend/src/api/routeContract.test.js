import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Does every call the client makes reach a route the server actually has?
 *
 * Nothing else in the suite asks this. The screen tests mock the api module, so
 * they pass whatever the real endpoint would say; the backend route tests call
 * the server directly and never see the client. A path the client gets wrong —
 * or a route renamed on the server — therefore shows up first in production, as
 * a 404 nobody wrote a test for. Both halves live in this repo, so the question
 * can simply be asked.
 *
 * What this can and cannot prove: it checks that method + path resolve. It says
 * nothing about the body being acceptable to the route's schema — that is what
 * the backend schema tests are for. It is deliberately noisy about anything it
 * cannot parse rather than skipping it silently, since a regex that quietly
 * stops matching is exactly how a guard like this rots.
 */

const here = dirname(fileURLToPath(import.meta.url));
const BACKEND = join(here, '..', '..', '..', 'backend', 'src');

// ---------------------------------------------------------------- the client

// `api.get('/x')`, `api.post(\`/x/${id}\`, body)`. The interpolations become
// :param so a template and a route parameter can be compared.
const CLIENT_CALL = /\bapi\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g;

const clientCalls = (() => {
  const calls = [];
  for (const file of readdirSync(here).filter((f) => f.endsWith('.js') && !f.includes('.test.'))) {
    const src = readFileSync(join(here, file), 'utf8');
    for (const [, method, , rawPath] of src.matchAll(CLIENT_CALL)) {
      calls.push({
        method: method.toUpperCase(),
        path: rawPath.replace(/\$\{[^}]+\}/g, ':param'),
        file,
      });
    }
  }
  return calls;
})();

// ---------------------------------------------------------------- the server

/** Mount prefixes, read from the single app.use('/api/…') block in app.js. */
const mounts = (() => {
  const app = readFileSync(join(BACKEND, 'app.js'), 'utf8');
  const byVariable = new Map();
  for (const [, prefix, variable] of app.matchAll(
    /app\.use\(\s*'(\/api\/[^']*)'\s*,\s*(\w+)\s*\)/g
  )) {
    // Rate limiters are mounted on paths too; only router variables count.
    if (/Routes$/.test(variable)) byVariable.set(variable, prefix);
  }

  // routerVariable -> module directory, from the import statements.
  const resolved = new Map();
  for (const [, variable, path] of app.matchAll(
    /import\s+(\w+Routes)\s+from\s+'([^']+)'/g
  )) {
    if (byVariable.has(variable)) resolved.set(basename(path, '.routes.js'), byVariable.get(variable));
  }
  return resolved;
})();

const ROUTE = /\brouter\.(get|post|put|patch|delete)\(\s*'([^']*)'/g;

const serverRoutes = (() => {
  const routes = new Set();
  const modules = join(BACKEND, 'modules');
  for (const dir of readdirSync(modules)) {
    const moduleDir = join(modules, dir);
    if (!statSync(moduleDir).isDirectory()) continue;

    for (const file of readdirSync(moduleDir).filter((f) => f.endsWith('.routes.js'))) {
      const prefix = mounts.get(basename(file, '.routes.js'));
      if (prefix === undefined) continue; // not mounted; nothing can call it

      for (const [, method, routePath] of readFileSync(join(moduleDir, file), 'utf8').matchAll(ROUTE)) {
        // '/' means the mount point itself; ':id' and ':anything' are one param.
        const full = (prefix + routePath).replace(/:[A-Za-z0-9_]+/g, ':param').replace(/\/$/, '');
        routes.add(`${method.toUpperCase()} ${full}`);
      }
    }
  }
  return routes;
})();

// ---------------------------------------------------------------- assertions

describe('every API client call reaches a route that exists', () => {
  // If either regex stops matching, every other assertion below passes
  // vacuously. These are the tripwire.
  it('parsed both sides', () => {
    expect(clientCalls.length).toBeGreaterThan(50);
    expect(serverRoutes.size).toBeGreaterThan(50);
    expect(mounts.size).toBeGreaterThan(15);
  });

  it.each(clientCalls.map((c) => [`${c.method} ${c.path}`, c]))('%s', (_label, call) => {
    const target = `${call.method} /api${call.path.split('?')[0].replace(/\/$/, '')}`;

    expect(
      serverRoutes.has(target),
      `${call.file} calls ${target}, which no mounted Express route serves. ` +
        `It is a 404 at runtime, and the screen tests cannot catch it because ` +
        `they mock this module.`
    ).toBe(true);
  });
});

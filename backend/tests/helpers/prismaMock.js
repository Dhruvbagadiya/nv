/**
 * A deep mock for the shared Prisma client.
 *
 * Every service does `import { prisma } from '../../utils/prisma.js'`, so a test
 * can replace that one module and the real PrismaClient is never constructed:
 *
 *   vi.mock('../../src/utils/prisma.js', async () => {
 *     const { prismaMock } = await import('../helpers/prismaMock.js');
 *     return { prisma: prismaMock };
 *   });
 *
 * Written as a Proxy rather than pulled from vitest-mock-extended: that package
 * exists to give a mock the *types* of the thing it stands in for, and this repo
 * is plain JavaScript. A Proxy gives the same ergonomics — any model, any method,
 * no declaration — in twenty lines and no dependency.
 *
 * WHAT THIS CAN AND CANNOT PROVE. It verifies the call you make to Prisma: which
 * method, and the exact `where`/`data`/`include` you pass. It cannot tell you the
 * query is *correct* — a wrong `where` that is still valid Prisma passes happily.
 * That is the deliberate trade for a suite that runs everywhere with no database.
 * Query correctness is covered by scripts/verify-auth.mjs and by the repair
 * scripts, which run --dry-run against a real database and print counts.
 */

import { vi } from 'vitest';

// Methods that must resolve rather than return undefined, so `await`ing them in
// a service does not explode before the assertion runs.
const RESOLVING = new Set([
  'findMany', 'findFirst', 'findUnique', 'findUniqueOrThrow', 'findFirstOrThrow',
  'create', 'createMany', 'update', 'updateMany', 'upsert',
  'delete', 'deleteMany', 'count', 'aggregate', 'groupBy',
]);

const created = new Map();

function modelProxy(model) {
  return new Proxy({}, {
    get(_target, method) {
      const key = `${model}.${String(method)}`;
      if (!created.has(key)) {
        const fn = vi.fn();
        // A bare findMany defaults to [] and a bare count to 0, so a service can
        // run end to end without every test stubbing every call it happens to
        // make. Anything a test cares about, it overrides explicitly.
        if (method === 'findMany') fn.mockResolvedValue([]);
        else if (method === 'count') fn.mockResolvedValue(0);
        else if (RESOLVING.has(String(method))) fn.mockResolvedValue(null);
        created.set(key, fn);
      }
      return created.get(key);
    },
  });
}

const models = new Map();

export const prismaMock = new Proxy({}, {
  get(_target, prop) {
    const name = String(prop);

    // $transaction takes either an array of promises or a callback. Both are
    // used in this codebase, and the callback form must receive something that
    // behaves like the client or `tx.user.update(...)` throws.
    if (name === '$transaction') {
      if (!created.has('$transaction')) {
        created.set('$transaction', vi.fn(async (arg) =>
          typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)
        ));
      }
      return created.get('$transaction');
    }

    if (name === '$queryRaw' || name === '$queryRawUnsafe' || name === '$executeRaw' || name === '$executeRawUnsafe') {
      if (!created.has(name)) created.set(name, vi.fn().mockResolvedValue([]));
      return created.get(name);
    }

    if (name === '$connect' || name === '$disconnect' || name === '$on' || name === '$use') {
      if (!created.has(name)) created.set(name, vi.fn());
      return created.get(name);
    }

    // Anything else is a model delegate: prisma.course, prisma.user, ...
    if (name.startsWith('$') || name === 'then' || typeof prop === 'symbol') return undefined;
    if (!models.has(name)) models.set(name, modelProxy(name));
    return models.get(name);
  },
});

/** Clear every mock this proxy has handed out. Call in beforeEach. */
export function resetPrismaMock() {
  for (const fn of created.values()) {
    fn.mockClear();
  }
}

/** Forget the mocks entirely, including their default resolutions. */
export function hardResetPrismaMock() {
  created.clear();
  models.clear();
}

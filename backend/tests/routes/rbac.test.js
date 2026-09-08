import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});

const { prismaMock, resetPrismaMock } = await import('../helpers/prismaMock.js');
const { clearAuthCache } = await import('../../src/utils/userCache.js');
const app = (await import('../../src/app.js')).default;
const { bearer } = await import('../helpers/authToken.js');

beforeEach(() => {
  resetPrismaMock();
  clearAuthCache();
});

/**
 * Nothing verified that an agent could not reach an admin endpoint. Roles are
 * enforced by a middleware argument on ~40 route definitions, and a single
 * omission is invisible in review and silent at runtime — the endpoint simply
 * works for everyone.
 *
 * Each row is [method, path, rolesAllowedToPassTheGuard]. The assertion is only
 * about the guard: a 4xx that is not 401/403 means the request got past RBAC and
 * failed on validation or a missing record, which is what we want to see.
 */
const ADMIN_ONLY = ['ADMIN', 'SUPER_ADMIN'];
const SUPER_ONLY = ['SUPER_ADMIN'];

const ROUTES = [
  ['post',   '/api/countries',                              ADMIN_ONLY],
  ['put',    '/api/countries/11111111-1111-1111-1111-111111111111', ADMIN_ONLY],
  ['delete', '/api/countries/11111111-1111-1111-1111-111111111111', ADMIN_ONLY],
  ['post',   '/api/courses',                                ADMIN_ONLY],
  ['post',   '/api/courses/bulk-import',                    ADMIN_ONLY],
  ['put',    '/api/courses/11111111-1111-1111-1111-111111111111',   ADMIN_ONLY],
  ['delete', '/api/courses/11111111-1111-1111-1111-111111111111',   ADMIN_ONLY],
  ['post',   '/api/institutions',                           ADMIN_ONLY],
  ['put',    '/api/institutions/11111111-1111-1111-1111-111111111111', ADMIN_ONLY],
  ['delete', '/api/institutions/11111111-1111-1111-1111-111111111111', ADMIN_ONLY],
  ['put',    '/api/commissions',                            ADMIN_ONLY],
  ['put',    '/api/entry-requirements',                     ADMIN_ONLY],
  ['post',   '/api/moi-institutions',                       ADMIN_ONLY],
  ['post',   '/api/announcements',                          ADMIN_ONLY],
  ['post',   '/api/important-updates',                      ADMIN_ONLY],
  ['post',   '/api/support-contacts',                       ADMIN_ONLY],
  ['post',   '/api/auth/users',                             SUPER_ONLY],
  ['get',    '/api/auth/users',                             SUPER_ONLY],
  ['put',    '/api/auth/users/11111111-1111-1111-1111-111111111111', SUPER_ONLY],
  ['patch',  '/api/auth/users/11111111-1111-1111-1111-111111111111/active', SUPER_ONLY],
  ['post',   '/api/auth/users/11111111-1111-1111-1111-111111111111/reset-password', SUPER_ONLY],
];

describe.each(ROUTES)('%s %s', (method, path, allowed) => {
  it('rejects an unauthenticated caller', async () => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
  });

  it('rejects an agent', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'AGENT' });
    const res = await request(app)[method](path).set('Authorization', bearer({ role: 'AGENT' })).send({});
    expect(res.status).toBe(403);
  });

  it('rejects a student', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'STUDENT' });
    const res = await request(app)[method](path).set('Authorization', bearer({ role: 'STUDENT' })).send({});
    expect(res.status).toBe(403);
  });

  it(`lets ${allowed.join(' or ')} past the guard`, async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: allowed[0] });
    const res = await request(app)[method](path).set('Authorization', bearer({ role: allowed[0] })).send({});
    // Past RBAC. It may still fail validation or not find a record — that is a
    // different layer, and asserting a 2xx here would require stubbing every
    // service call on every route.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ADMIN must not reach the user-management endpoints: the admin UI gates the
// whole Users screen to SUPER_ADMIN, and with `role` writable an ADMIN could
// otherwise promote themselves.
describe('user management is Super Admin only', () => {
  it.each([
    ['post', '/api/auth/users'],
    ['put', '/api/auth/users/11111111-1111-1111-1111-111111111111'],
    ['post', '/api/auth/users/11111111-1111-1111-1111-111111111111/reset-password'],
  ])('refuses a plain ADMIN on %s %s', async (method, path) => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'ADMIN' });
    const res = await request(app)[method](path).set('Authorization', bearer({ role: 'ADMIN' })).send({});
    expect(res.status).toBe(403);
  });
});

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
  prismaMock.course.count.mockResolvedValue(0);
  prismaMock.institution.count.mockResolvedValue(0);
});

/** What the service was actually asked to fetch. */
const courseWhere = () => prismaMock.course.findMany.mock.calls[0][0].where;

// GET /api/courses is public so students can browse without signing in, but it
// accepted `status=archived` from anyone — letting the whole internet enumerate
// courses an admin had deliberately hidden.
describe('archived rows are not publicly enumerable', () => {
  it('ignores status=archived from an anonymous caller', async () => {
    await request(app).get('/api/courses?status=archived').expect(200);

    // The active filter is still applied, so nothing archived comes back.
    expect(courseWhere().archivedAt).toBeNull();
  });

  it('ignores status=all from an agent', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'AGENT' });

    await request(app)
      .get('/api/courses?status=all')
      .set('Authorization', bearer({ role: 'AGENT' }))
      .expect(200);

    expect(courseWhere().archivedAt).toBeNull();
  });

  it('honours status=archived for an admin', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'ADMIN' });

    await request(app)
      .get('/api/courses?status=archived')
      .set('Authorization', bearer({ role: 'ADMIN' }))
      .expect(200);

    expect(courseWhere().archivedAt).toEqual({ not: null });
  });

  // A token is proof of who signed in, not of what they may still do.
  it('treats a deactivated admin as anonymous', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: false, role: 'ADMIN' });

    await request(app)
      .get('/api/courses?status=archived')
      .set('Authorization', bearer({ role: 'ADMIN' }))
      .expect(200);

    expect(courseWhere().archivedAt).toBeNull();
  });

  // The token still says ADMIN; the database says otherwise, and the database wins.
  it('uses the stored role, not the role baked into the token', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'AGENT' });

    await request(app)
      .get('/api/courses?status=archived')
      .set('Authorization', bearer({ role: 'ADMIN' }))
      .expect(200);

    expect(courseWhere().archivedAt).toBeNull();
  });
});

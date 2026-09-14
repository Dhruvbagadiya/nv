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

const SUPER = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  resetPrismaMock();
  clearAuthCache();
  prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'SUPER_ADMIN' });
});

const asSuper = (req) => req.set('Authorization', bearer({ role: 'SUPER_ADMIN', sub: SUPER }));

/**
 * There is one Super Admin and there is meant to stay one.
 *
 * It is the account that can create users, change any role and reset anyone's
 * password, so a second is a second copy of the keys to everything. Removing the
 * <option> from the admin screen is not the control — these routes take a JSON
 * body, and the only thing that can refuse `{"role":"SUPER_ADMIN"}` is the thing
 * that reads the body. This file is that assertion.
 *
 * The same hole has been closed twice here already: `registerSchema` once
 * forwarded a caller-supplied role into a service whose signature defaulted it,
 * and `PUT /users/:id` once passed req.body straight to prisma.user.update.
 */

describe('SUPER_ADMIN cannot be assigned', () => {
  it('refuses to create one', async () => {
    const res = await asSuper(
      request(app).post('/api/auth/users').send({
        name: 'Second Super', email: 'second@example.com',
        password: 'a-long-enough-password', role: 'SUPER_ADMIN',
      })
    );

    expect(res.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('refuses to promote an existing account to one', async () => {
    // The other half of the same door: without this, "no new super admins" is a
    // two-step process rather than an impossible one.
    const res = await asSuper(
      request(app).put(`/api/auth/users/${TARGET}`).send({ role: 'SUPER_ADMIN' })
    );

    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('still creates the roles that are meant to be assignable', async () => {
    // Two findUnique calls in order: the auth middleware's cached role lookup,
    // then the duplicate-email check, which must miss for the create to proceed.
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ isActive: true, role: 'SUPER_ADMIN' })
      .mockResolvedValueOnce(null);
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: TARGET, role: 'ADMIN' });

    const res = await asSuper(
      request(app).post('/api/auth/users').send({
        name: 'New Admin', email: 'admin2@example.com',
        password: 'a-long-enough-password', role: 'ADMIN',
      })
    );

    expect(res.status).toBeLessThan(400);
    expect(prismaMock.user.create).toHaveBeenCalled();
  });

  // The existing super admin must stay readable, editable by name, and findable.
  // Removing the value from the enum entirely would have taken all three.
  it('still lists by the role, so the one account is findable', async () => {
    const res = await asSuper(request(app).get('/api/auth/users?role=SUPER_ADMIN'));

    expect(res.status).toBe(200);
    expect(prismaMock.user.findMany.mock.calls[0][0].where.role).toBe('SUPER_ADMIN');
  });

  it('still renames one without touching its role', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: TARGET, role: 'SUPER_ADMIN', isActive: true });
    prismaMock.user.update.mockResolvedValue({ id: TARGET, name: 'Renamed' });

    const res = await asSuper(
      request(app).put(`/api/auth/users/${TARGET}`).send({ name: 'Renamed' })
    );

    expect(res.status).toBe(200);
    // No `role` in the write at all — `assertAdminRemains` only objects when a
    // role is actually being changed away from SUPER_ADMIN.
    expect(prismaMock.user.update.mock.calls[0][0].data.role).toBeUndefined();
  });
});

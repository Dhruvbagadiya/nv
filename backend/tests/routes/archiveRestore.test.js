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

const ID = '11111111-1111-1111-1111-111111111111';
const asAdmin = (req) => req.set('Authorization', bearer({ role: 'ADMIN' }));

beforeEach(() => {
  resetPrismaMock();
  clearAuthCache();
  prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'ADMIN' });
  prismaMock.document.count.mockResolvedValue(0);
  prismaMock.importantUpdate.count.mockResolvedValue(0);
});

/**
 * Archiving set archivedAt and every list filtered `archivedAt: null`
 * unconditionally, so the row remained in the table with no endpoint able to
 * reach it. From an operator's point of view a mis-click destroyed the record.
 *
 * Course and Institution already did this correctly; these three did not.
 */
describe.each([
  ['documents',         '/api/documents',        'document',       { category: 'SOP' }],
  ['important updates', '/api/important-updates', 'importantUpdate', {}],
  ['support contacts',  '/api/support-contacts', 'supportContact', {}],
])('%s', (_name, path, model, extraQuery) => {
  const qs = (params) => new URLSearchParams({ ...extraQuery, ...params }).toString();

  it('hides archived rows by default', async () => {
    await asAdmin(request(app).get(`${path}?${qs({})}`)).expect(200);

    const where = prismaMock[model].findMany.mock.calls[0][0].where;
    expect(where.archivedAt).toBeNull();
  });

  it('can list only the archived rows', async () => {
    await asAdmin(request(app).get(`${path}?${qs({ status: 'archived' })}`)).expect(200);

    const where = prismaMock[model].findMany.mock.calls[0][0].where;
    expect(where.archivedAt).toEqual({ not: null });
  });

  it('can list both', async () => {
    await asAdmin(request(app).get(`${path}?${qs({ status: 'all' })}`)).expect(200);

    const where = prismaMock[model].findMany.mock.calls[0][0].where;
    expect(where.archivedAt).toBeUndefined();
  });

  it('restores an archived row', async () => {
    prismaMock[model].update.mockResolvedValue({ id: ID, archivedAt: null });

    await asAdmin(request(app).post(`${path}/${ID}/restore`)).expect(200);

    expect(prismaMock[model].update).toHaveBeenCalledWith({
      where: { id: ID },
      data: { archivedAt: null },
    });
  });

  it('will not let an agent restore anything', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'AGENT' });

    await request(app)
      .post(`${path}/${ID}/restore`)
      .set('Authorization', bearer({ role: 'AGENT' }))
      .expect(403);
  });
});

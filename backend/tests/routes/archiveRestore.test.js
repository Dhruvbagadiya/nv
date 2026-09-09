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
  prismaMock.entryRequirement.count.mockResolvedValue(0);
  prismaMock.universityCommission.count.mockResolvedValue(0);
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
  // These two had no archive or restore at all — the list hard-coded
  // `archivedAt: null` and nothing could ever set or clear it.
  ['entry requirements', '/api/entry-requirements', 'entryRequirement', { level: 'UG' }],
  ['commissions',        '/api/commissions',        'universityCommission', {}],
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

/**
 * buildCommission() in courses.service.js returns null unless commissionType is
 * set, and upsertCommissionBody was .strict() with only institutionId, tiers and
 * notes — so the eight structured fields it reads could not be sent, and every
 * program card showed commission: null however the tiers were filled in.
 */
describe('commission structured fields', () => {
  const INSTITUTION_ID = '22222222-2222-2222-2222-222222222222';
  const body = {
    institutionId: INSTITUTION_ID,
    tiers: [{ label: '1-5 students', rate: '15%' }],
    commissionType: 'percentage',
    rateFrom: 10,
    rateTo: 15,
    isTierAdjusted: true,
    maxNumberOfInstallments: 3,
    tuitionBasis: 'net',
  };

  it('carries them through to the database', async () => {
    prismaMock.universityCommission.upsert.mockResolvedValue({ id: ID });

    await asAdmin(request(app).put('/api/commissions').send(body)).expect(200);

    const call = prismaMock.universityCommission.upsert.mock.calls[0][0];
    expect(call.create.commissionType).toBe('percentage');
    expect(call.create.rateFrom).toBe(10);
    expect(call.create.tuitionBasis).toBe('net');
    expect(call.update.maxNumberOfInstallments).toBe(3);
  });

  it('refuses a range that reads backwards', async () => {
    const res = await asAdmin(
      request(app).put('/api/commissions').send({ ...body, rateFrom: 15, rateTo: 5 })
    );
    expect(res.status).toBe(400);
  });

  it('still refuses a field that is not in the schema', async () => {
    const res = await asAdmin(
      request(app).put('/api/commissions').send({ ...body, sneaky: 'value' })
    );
    expect(res.status).toBe(400);
  });
});

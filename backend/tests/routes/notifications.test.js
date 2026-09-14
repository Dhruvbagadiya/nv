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

const AGENT = '11111111-1111-4111-8111-111111111111';
const OTHER = '44444444-4444-4444-8444-444444444444';
const NOTE = '55555555-5555-4555-8555-555555555555';

beforeEach(() => {
  resetPrismaMock();
  clearAuthCache();
  prismaMock.user.findUnique.mockResolvedValue({ isActive: true, role: 'AGENT' });
});

const asAgent = (req) => req.set('Authorization', bearer({ role: 'AGENT', sub: AGENT }));

/**
 * Read state on the bell.
 *
 * The panel's whole visible effect is a dot disappearing, which is exactly the
 * kind of change that can silently not happen: the mutation resolves, the row is
 * untouched, and the only evidence is a badge that never clears. Before this
 * module existed the badge was synthesised from a count of blacklisted
 * institutions and showed "1 new" permanently, so this is a regression that has
 * already shipped once.
 *
 * The other half is ownership. `readAt` is the only writable field an agent can
 * reach on a row that is not theirs, and the id is in the URL.
 */

describe('PATCH /api/notifications/:id/read', () => {
  it('stamps readAt, scoped to the caller — not by id alone', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 });

    const res = await asAgent(request(app).patch(`/api/notifications/${NOTE}/read`));

    expect(res.status).toBe(200);
    const { where, data } = prismaMock.notification.updateMany.mock.calls[0][0];
    // userId in the WHERE is what stops someone marking another agent's
    // notification read by guessing an id — and `updateMany` rather than
    // `update`, so a miss is a no-op rather than a 404 that confirms the id.
    expect(where).toEqual({ id: NOTE, userId: AGENT, readAt: null });
    expect(data.readAt).toBeInstanceOf(Date);
  });

  it('treats a second click as done, not as an error', async () => {
    // Already read: the scoped updateMany matches nothing because of readAt:null.
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.notification.findFirst.mockResolvedValue({ id: NOTE });

    const res = await asAgent(request(app).patch(`/api/notifications/${NOTE}/read`));

    expect(res.status).toBe(200);
  });

  it('404s on someone else’s notification, the same as on one that does not exist', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 });
    // The existence probe is itself scoped to the caller, so another agent's row
    // is indistinguishable from a row that was never there.
    prismaMock.notification.findFirst.mockResolvedValue(null);

    const res = await asAgent(request(app).patch(`/api/notifications/${NOTE}/read`));

    expect(res.status).toBe(404);
    expect(prismaMock.notification.findFirst.mock.calls[0][0].where).toEqual({ id: NOTE, userId: AGENT });
  });
});

describe('POST /api/notifications/read-all', () => {
  it('clears only the caller’s unread rows', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 4 });

    const res = await asAgent(request(app).post('/api/notifications/read-all'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: 4 });
    const { where } = prismaMock.notification.updateMany.mock.calls[0][0];
    expect(where).toEqual({ userId: AGENT, readAt: null });
    expect(where.userId).not.toBe(OTHER);
  });
});

describe('GET /api/notifications', () => {
  it('counts unread for the caller only', async () => {
    prismaMock.notification.count.mockResolvedValue(3);

    const res = await asAgent(request(app).get('/api/notifications/unread-count'));

    expect(res.body).toEqual({ unread: 3 });
    expect(prismaMock.notification.count.mock.calls[0][0].where).toEqual({ userId: AGENT, readAt: null });
  });

  it('lists the caller’s own rows, newest first', async () => {
    const res = await asAgent(request(app).get('/api/notifications'));

    expect(res.status).toBe(200);
    const args = prismaMock.notification.findMany.mock.calls[0][0];
    expect(args.where.userId).toBe(AGENT);
    expect(args.orderBy[0]).toEqual({ createdAt: 'desc' });
  });

  // The badge and the list are separate queries, and the panel invalidates by
  // the ['notifications'] prefix. A list that filtered unread by default would
  // make "mark all read" empty the panel as well as the badge.
  it('does not hide read rows unless asked', async () => {
    await asAgent(request(app).get('/api/notifications'));
    expect(prismaMock.notification.findMany.mock.calls[0][0].where.readAt).toBeUndefined();

    resetPrismaMock();
    await asAgent(request(app).get('/api/notifications?unreadOnly=true'));
    expect(prismaMock.notification.findMany.mock.calls[0][0].where.readAt).toBeNull();
  });
});

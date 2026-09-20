import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});
vi.mock('../../src/utils/mailer.js', async () => {
  const actual = await vi.importActual('../../src/utils/mailer.js');
  return { ...actual, sendMail: vi.fn().mockResolvedValue(true) };
});

const { prismaMock, resetPrismaMock } = await import('../helpers/prismaMock.js');
const service = await import('../../src/modules/auth/auth.service.js');
const { config } = await import('../../src/config.js');
const bcrypt = (await import('bcryptjs')).default;

const PASSWORD = 'correct-horse-battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const user = (over = {}) => ({
  id: 'u1', name: 'Test', email: 't@x.com', passwordHash: HASH,
  role: 'AGENT', isActive: true, emailVerifiedAt: new Date('2026-01-01'),
  phone: null, bio: null, avatarUrl: null, parentAgentId: null,
  createdAt: new Date('2026-01-01'),
  ...over,
});

// The row issueRefreshToken would have written, echoed back so the caller sees
// the expiresAt the service actually chose.
const captureIssued = () => {
  const seen = {};
  prismaMock.refreshToken.create.mockImplementation(async ({ data }) => {
    Object.assign(seen, data);
    return { ...data, id: 'rt1' };
  });
  return seen;
};

beforeEach(() => {
  resetPrismaMock();
  prismaMock.refreshToken.update.mockResolvedValue({});
  prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 0 });
});

/*
 * Session length is split by what an account can SEE, not by seniority.
 *
 * A staff session reaches every applicant's passport number, date of birth and
 * phone; a student session reaches one record. Left open on a shared machine
 * those are very different exposures, which is the whole reason the windows
 * differ.
 */
describe('how long a session lasts without being used', () => {
  it.each([
    ['SUPER_ADMIN', config.jwt.idleStaffMs],
    ['ADMIN', config.jwt.idleStaffMs],
    ['AGENT', config.jwt.idleStaffMs],
    ['STUDENT', config.jwt.idleStudentMs],
  ])('gives %s its own idle window', async (role, expectedMs) => {
    prismaMock.user.findUnique.mockResolvedValue(user({ role }));
    const issued = captureIssued();

    const before = Date.now();
    await service.login('t@x.com', PASSWORD);

    const actual = issued.expiresAt.getTime() - before;
    // Generous bound: this asserts WHICH window was chosen, not the clock.
    expect(Math.abs(actual - expectedMs)).toBeLessThan(5000);
  });

  it('gives staff a shorter window than students', () => {
    // The relationship is the point. If a later edit inverts these, the
    // individual assertions above still pass against the new constants.
    expect(config.jwt.idleStaffMs).toBeLessThan(config.jwt.idleStudentMs);
  });
});

describe('the absolute cap', () => {
  const tokenRow = (over = {}) => ({
    id: 'rt-old', userId: 'u1', tokenHash: 'h', revokedAt: null, revokedReason: null,
    expiresAt: new Date(Date.now() + DAY),
    sessionStartedAt: new Date(Date.now() - DAY),
    user: user(),
    ...over,
  });

  it('refuses a session older than the cap, however recently it was used', async () => {
    // expiresAt is comfortably in the future — this session is in ACTIVE use.
    // It is refused anyway, which is the entire point of a second clock.
    prismaMock.refreshToken.findUnique.mockResolvedValue(tokenRow({
      sessionStartedAt: new Date(Date.now() - config.jwt.absoluteMs - HOUR),
    }));

    await expect(service.refresh('tok')).rejects.toThrow(/sign in again/i);
  });

  it('marks it EXPIRED, not REPLAY', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(tokenRow({
      sessionStartedAt: new Date(Date.now() - config.jwt.absoluteMs - HOUR),
    }));

    await expect(service.refresh('tok')).rejects.toThrow();
    // REPLAY means a token was presented twice and is a possible theft signal.
    // An old session is routine, and conflating the two would put noise into
    // the one field that is worth alerting on.
    expect(prismaMock.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokedReason: 'EXPIRED' }) })
    );
  });

  it('does NOT revoke the user\'s other sessions', async () => {
    // Signing out of a laptop because a phone hit the cap would be a bug. Only
    // a replayed token justifies taking down every session.
    prismaMock.refreshToken.findUnique.mockResolvedValue(tokenRow({
      sessionStartedAt: new Date(Date.now() - config.jwt.absoluteMs - HOUR),
    }));

    await expect(service.refresh('tok')).rejects.toThrow();
    expect(prismaMock.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('carries the original sign-in time across a rotation', async () => {
    // THE test for this feature. If the rotation re-stamped sessionStartedAt,
    // every refresh would push the ceiling away and the cap would measure
    // idleness — exactly what expiresAt already measures — so a session in
    // regular use would never end.
    const started = new Date(Date.now() - 20 * DAY);
    prismaMock.refreshToken.findUnique.mockResolvedValue(tokenRow({ sessionStartedAt: started }));
    const issued = captureIssued();

    await service.refresh('tok');

    expect(issued.sessionStartedAt.getTime()).toBe(started.getTime());
    // ...while the idle window DOES move forward, which is what rotation is for.
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('keeps a session inside the cap alive', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(tokenRow({
      sessionStartedAt: new Date(Date.now() - (config.jwt.absoluteMs - DAY)),
    }));
    captureIssued();

    const out = await service.refresh('tok');
    expect(out.user.id).toBe('u1');
  });

  it('gives a rotated staff session the staff window, not the default', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(
      tokenRow({ user: user({ role: 'AGENT' }) })
    );
    const issued = captureIssued();

    const before = Date.now();
    await service.refresh('tok');

    expect(Math.abs((issued.expiresAt.getTime() - before) - config.jwt.idleStaffMs))
      .toBeLessThan(5000);
  });
});

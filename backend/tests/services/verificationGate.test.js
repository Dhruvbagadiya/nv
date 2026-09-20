import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});
// Never actually send from a test.
vi.mock('../../src/utils/mailer.js', async () => {
  const actual = await vi.importActual('../../src/utils/mailer.js');
  return { ...actual, sendMail: vi.fn().mockResolvedValue(true) };
});

const { prismaMock, resetPrismaMock } = await import('../helpers/prismaMock.js');
const service = await import('../../src/modules/auth/auth.service.js');
const bcrypt = (await import('bcryptjs')).default;

// One real hash so the password comparison is genuine rather than mocked away.
const PASSWORD = 'correct-horse-battery';
const HASH = bcrypt.hashSync(PASSWORD, 4);

const user = (over = {}) => ({
  id: 'u1', name: 'Test', email: 't@x.com', passwordHash: HASH,
  role: 'STUDENT', isActive: true, emailVerifiedAt: null,
  phone: null, bio: null, avatarUrl: null, parentAgentId: null,
  createdAt: new Date('2026-01-01'),
  ...over,
});

beforeEach(() => {
  resetPrismaMock();
  prismaMock.refreshToken.create.mockResolvedValue({});
});

/*
 * The gate can lock people out of a live site, so these pin down exactly who it
 * applies to. The scoping is the whole point: applied to every role it would
 * have locked out the super admin, the admin and both agents on the day it
 * deployed — none of them has an emailVerifiedAt, because none of them
 * self-registered.
 */
describe('the email verification gate', () => {
  it('refuses an unconfirmed STUDENT, with a code the client can act on', async () => {
    prismaMock.user.findUnique.mockResolvedValue(user());

    await expect(service.login('t@x.com', PASSWORD)).rejects.toMatchObject({
      status: 401,
      details: { code: 'EMAIL_UNVERIFIED' },
    });
  });

  it('lets a confirmed STUDENT in', async () => {
    prismaMock.user.findUnique.mockResolvedValue(user({ emailVerifiedAt: new Date() }));
    const out = await service.login('t@x.com', PASSWORD);
    expect(out.user.id).toBe('u1');
  });

  it.each(['SUPER_ADMIN', 'ADMIN', 'AGENT'])(
    'does NOT gate %s — an administrator vouched for that address',
    async (role) => {
      prismaMock.user.findUnique.mockResolvedValue(user({ role, emailVerifiedAt: null }));
      const out = await service.login('t@x.com', PASSWORD);
      expect(out.user.role).toBe(role);
    }
  );

  it('still reports a wrong password as a wrong password, not as unconfirmed', async () => {
    prismaMock.user.findUnique.mockResolvedValue(user());
    await expect(service.login('t@x.com', 'wrong')).rejects.toMatchObject({ status: 401 });
    await expect(service.login('t@x.com', 'wrong')).rejects.not.toMatchObject({
      details: { code: 'EMAIL_UNVERIFIED' },
    });
  });
});

/*
 * The gate creates a deadlock without this: someone who cannot sign in cannot
 * reach an authenticated endpoint to ask for a new link.
 */
describe('resending a confirmation without a session', () => {
  it('sends when the address is registered and unconfirmed', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: 'u1' })                       // lookup by email
      .mockResolvedValueOnce(user());                            // inside sendEmailVerification
    prismaMock.$transaction.mockImplementation(async (fn) => fn(prismaMock));
    prismaMock.emailVerificationToken.create.mockResolvedValue({});

    await service.resendEmailVerificationByEmail('t@x.com');
    expect(prismaMock.emailVerificationToken.create).toHaveBeenCalled();
  });

  it('says nothing different for an address that does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    // Resolves rather than throwing — a 404 here would confirm who has an account.
    await expect(service.resendEmailVerificationByEmail('nobody@x.com')).resolves.toBeUndefined();
    expect(prismaMock.emailVerificationToken.create).not.toHaveBeenCalled();
  });

  it('issues nothing for an already-confirmed account', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: 'u1' })
      .mockResolvedValueOnce(user({ emailVerifiedAt: new Date() }));
    await service.resendEmailVerificationByEmail('t@x.com');
    expect(prismaMock.emailVerificationToken.create).not.toHaveBeenCalled();
  });
});

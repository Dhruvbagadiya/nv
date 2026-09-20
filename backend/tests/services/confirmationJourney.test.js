import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});

// Capture what would have been sent instead of sending it. The link in the
// email IS the credential, so this is also how the test gets hold of a token —
// exactly as a real applicant does, by reading it out of the message.
const sent = [];
vi.mock('../../src/utils/mailer.js', async () => {
  const actual = await vi.importActual('../../src/utils/mailer.js');
  return {
    ...actual,
    sendMail: vi.fn(async (msg) => { sent.push(msg); return true; }),
  };
});

const { prismaMock, resetPrismaMock } = await import('../helpers/prismaMock.js');
const service = await import('../../src/modules/auth/auth.service.js');
const crypto = (await import('node:crypto')).default;

const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');

/*
 * A stateful stand-in for the two tables this journey touches.
 *
 * The other tests in this directory stub one call at a time, which is the right
 * tool for "does login refuse this user". It is the wrong tool here: the bug
 * this file exists to catch is a MISMATCH BETWEEN STEPS — a token written in one
 * shape and looked up in another, a flag set on one row and read from another.
 * Per-call stubs hide exactly that class of fault, because each step is handed
 * the answer it wanted rather than what the previous step actually wrote.
 */
let users, tokens;

function wireStore() {
  users = new Map();
  tokens = [];

  prismaMock.user.findUnique.mockImplementation(async ({ where }) => {
    if (where.id) return users.get(where.id) ?? null;
    return [...users.values()].find((u) => u.email === where.email) ?? null;
  });
  prismaMock.user.create.mockImplementation(async ({ data }) => {
    const row = {
      id: `u${users.size + 1}`, isActive: true, emailVerifiedAt: null,
      phone: null, bio: null, avatarUrl: null, parentAgentId: null,
      createdAt: new Date('2026-09-20'), ...data,
    };
    users.set(row.id, row);
    return row;
  });
  prismaMock.user.update.mockImplementation(async ({ where, data }) => {
    Object.assign(users.get(where.id), data);
    return users.get(where.id);
  });

  prismaMock.emailVerificationToken.create.mockImplementation(async ({ data }) => {
    const row = { id: `t${tokens.length + 1}`, usedAt: null, ...data };
    tokens.push(row);
    return row;
  });
  prismaMock.emailVerificationToken.updateMany.mockImplementation(async ({ where, data }) => {
    let count = 0;
    for (const t of tokens) {
      if (t.userId === where.userId && (where.usedAt !== null || t.usedAt === null)) {
        Object.assign(t, data); count += 1;
      }
    }
    return { count };
  });
  prismaMock.emailVerificationToken.findUnique.mockImplementation(async ({ where }) => {
    const t = tokens.find((x) => x.tokenHash === where.tokenHash);
    return t ? { ...t, user: users.get(t.userId) } : null;
  });
  prismaMock.emailVerificationToken.update.mockImplementation(async ({ where, data }) => {
    const t = tokens.find((x) => x.id === where.id);
    Object.assign(t, data);
    return t;
  });

  prismaMock.studentProfile.create.mockImplementation(async ({ data }) => data);
  prismaMock.refreshToken.create.mockResolvedValue({});
}

const PASSWORD = 'correct-horse-battery';
const SIGNUP = {
  name: 'Asha Menon',
  email: 'asha@example.com',
  phone: '+91 99259 13764',
  password: PASSWORD,
};

// The token out of the most recent link, read the way the applicant reads it.
const tokenFromLastEmail = () => {
  const html = sent.at(-1).html;
  return new URL(html.match(/https?:\/\/[^"'\s]*verify-email[^"'\s]*/)[0]).searchParams.get('token');
};

beforeEach(() => {
  resetPrismaMock();
  sent.length = 0;
  wireStore();
});

describe('the confirmation journey, start to finish', () => {
  it('registers, blocks the login, confirms, then lets them in', async () => {
    // 1. Sign up.
    const user = await service.registerStudent(SIGNUP);
    expect(users.get(user.id).emailVerifiedAt).toBeNull();

    // The number they gave is stored against the profile the counsellor reads,
    // not dropped on the floor by a handler that forwards the whole body.
    expect(prismaMock.studentProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: '+91 99259 13764' }) })
    );

    // 2. Exactly one email, to the address they typed.
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('asha@example.com');

    // 3. Signing in is refused, and refused in a way the client can act on —
    //    "invalid password" to someone whose password is correct is the bug
    //    that sends people to the reset form for no reason.
    await expect(service.login(SIGNUP.email, PASSWORD)).rejects.toMatchObject({
      status: 401,
      details: { code: 'EMAIL_UNVERIFIED' },
    });

    // 4. Click the link.
    await expect(service.verifyEmail(tokenFromLastEmail()))
      .resolves.toEqual({ alreadyVerified: false });

    // 5. Now in.
    const session = await service.login(SIGNUP.email, PASSWORD);
    expect(session.user.id).toBe(user.id);
    // The field the banner and the apply button both read. It was returning
    // undefined once, which left the banner up for a confirmed account.
    expect(session.user.emailVerifiedAt).toBeTruthy();
  });

  it('survives the link being clicked twice', async () => {
    await service.registerStudent(SIGNUP);
    const token = tokenFromLastEmail();

    await service.verifyEmail(token);
    // A mail client that prefetches links, or a person who taps back and
    // forward, must not be told their confirmed address is invalid.
    await expect(service.verifyEmail(token))
      .resolves.toEqual({ alreadyVerified: true });
  });

  it('kills the old link when a new one is sent', async () => {
    await service.registerStudent(SIGNUP);
    const first = tokenFromLastEmail();

    await service.resendEmailVerificationByEmail(SIGNUP.email);
    const second = tokenFromLastEmail();
    expect(second).not.toBe(first);

    // The forwarded older email is dead...
    await expect(service.verifyEmail(first)).rejects.toMatchObject({ status: 400 });
    // ...and the account is still unconfirmed, so the first link failing did
    // not quietly confirm anybody.
    expect([...users.values()][0].emailVerifiedAt).toBeNull();

    await expect(service.verifyEmail(second)).resolves.toEqual({ alreadyVerified: false });
  });

  it('stores only a hash of the link, never the link itself', async () => {
    await service.registerStudent(SIGNUP);
    const token = tokenFromLastEmail();

    // Someone with read access to the table must not be able to confirm
    // anybody's address with what they find there.
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).toBe(sha256(token));
    expect(JSON.stringify(tokens[0])).not.toContain(token);
  });

  it('answers a resend identically whoever asks', async () => {
    await service.registerStudent(SIGNUP);
    await service.verifyEmail(tokenFromLastEmail());
    sent.length = 0;

    // Unknown address, and an address that is already confirmed. Neither may
    // behave differently from the other, or this endpoint becomes a way to ask
    // the server who has an account.
    await expect(service.resendEmailVerificationByEmail('nobody@example.com')).resolves.toBeUndefined();
    await expect(service.resendEmailVerificationByEmail(SIGNUP.email)).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it('refuses a made-up token', async () => {
    await expect(service.verifyEmail('not-a-real-token')).rejects.toMatchObject({ status: 400 });
  });

  it('refuses an expired link, and says so distinguishably', async () => {
    await service.registerStudent(SIGNUP);
    const token = tokenFromLastEmail();
    tokens[0].expiresAt = new Date(Date.now() - 1000);

    // Separate message from "not valid": one means request a new one, the other
    // means this link was never ours, and the page offers a resend for both.
    await expect(service.verifyEmail(token)).rejects.toThrow(/expired/i);
  });
});

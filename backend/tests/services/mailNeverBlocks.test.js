import { describe, it, expect, vi } from 'vitest';

/*
 * Every transactional send in this system is best-effort: a mail provider having
 * a bad minute must never turn a successful action into an error. The student
 * has their application, the stage really did change — failing the request would
 * be reporting a problem that did not happen.
 *
 * sendMail is the chokepoint that guarantees it, so this pins down that it
 * cannot throw, in the three ways it can fail.
 */
describe('sendMail never throws', () => {
  it('returns false and logs when mail is not configured', async () => {
    vi.resetModules();
    vi.doMock('../../src/config.js', () => ({
      config: { mail: { enabled: false }, appUrl: 'https://x.test' },
    }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendMail } = await import('../../src/utils/mailer.js');

    await expect(sendMail({ to: 'a@b.com', subject: 's', html: '<p>hi</p>' }))
      .resolves.toBe(false);
    // Loud, not silent: the link has to be findable in the logs.
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns false when the provider rejects the request', async () => {
    vi.resetModules();
    vi.doMock('../../src/config.js', () => ({
      config: {
        mail: { enabled: true, provider: 'resend', apiKey: 'bad', from: 'a@b.com' },
        appUrl: 'https://x.test',
      },
    }));
    vi.doMock('axios', () => ({
      default: { post: vi.fn().mockRejectedValue({ response: { status: 401, data: 'nope' } }) },
    }));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sendMail } = await import('../../src/utils/mailer.js');

    await expect(sendMail({ to: 'a@b.com', subject: 's', html: '<p>hi</p>' }))
      .resolves.toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('returns true on a successful send', async () => {
    vi.resetModules();
    vi.doMock('../../src/config.js', () => ({
      config: {
        mail: { enabled: true, provider: 'resend', apiKey: 'k', from: 'a@b.com' },
        appUrl: 'https://x.test',
      },
    }));
    vi.doMock('axios', () => ({ default: { post: vi.fn().mockResolvedValue({ data: {} }) } }));
    const { sendMail } = await import('../../src/utils/mailer.js');

    await expect(sendMail({ to: 'a@b.com', subject: 's', html: '<p>hi</p>' }))
      .resolves.toBe(true);
  });
});

describe('the templates escape what users typed', () => {
  it('does not let a name inject markup into the email body', async () => {
    vi.resetModules();
    const { applicationStageEmail } = await import('../../src/utils/mailer.js');
    const { html } = applicationStageEmail({
      name: '<script>alert(1)</script>',
      reference: 7, program: 'P', institution: 'I', stage: 'Applied',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

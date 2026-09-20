import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});

const sent = [];
vi.mock('../../src/utils/mailer.js', async () => {
  const actual = await vi.importActual('../../src/utils/mailer.js');
  return { ...actual, sendMail: vi.fn(async (m) => { sent.push(m); return true; }) };
});

/*
 * Set before config.js is first evaluated, which happens on the controller
 * import below. Email C is addressed to MAIL_TEAM_TO or, failing that,
 * MAIL_FROM, and returns early when neither is set — so without this the
 * assertions below pass an empty outbox around and prove nothing.
 */
process.env.MAIL_TEAM_TO = 'team@nvimmigrationpvtltd.com';

const { prismaMock, resetPrismaMock } = await import('../helpers/prismaMock.js');
const controller = await import('../../src/modules/applications/applications.controller.js');

/*
 * These assert that the facts are actually IN the email, not merely that one
 * was sent.
 *
 * That distinction caught a real bug. `facts()` filters falsy rows so a missing
 * value produces no line rather than the word "undefined" — good for the reader,
 * and it meant three call sites could pass `course.name`, a field the Course
 * model does not have (it is `title`), and every email went out with the program
 * silently missing. Nothing threw, nothing logged, and a test that only counted
 * sends was perfectly green.
 */

// Shaped like APPLICATION_INCLUDE returns it, because the point is to catch a
// field name that does not survive the trip from Prisma to the template.
const application = () => ({
  id: 'a1',
  agentId: 'u1',
  reference: 1042,
  studentName: 'Asha Menon',
  course: {
    title: 'Master of Science - Computational Sciences',
    institution: { name: 'University of Leeds' },
  },
});

beforeEach(() => {
  resetPrismaMock();
  sent.length = 0;
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'u1', name: 'Asha Menon', email: 'asha@example.com', role: 'STUDENT',
  });
});

describe('what the notification emails actually say', () => {
  it('names the program and institution in the team alert', async () => {
    await controller.notifyTeamOfNewApplication(application());

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('team@nvimmigrationpvtltd.com');
    expect(sent[0].subject).toContain('1042');
    expect(sent[0].subject).toContain('Asha Menon');
    // The regression. `course.name` would leave both of these absent.
    expect(sent[0].html).toContain('Master of Science - Computational Sciences');
    expect(sent[0].html).toContain('University of Leeds');
  });

  it('never leaks a raw undefined into a message a person reads', async () => {
    // A course that failed to load must produce a shorter email, not one that
    // says "Program: undefined" to an applicant.
    await controller.notifyTeamOfNewApplication({ ...application(), course: null });

    expect(sent).toHaveLength(1);
    expect(sent[0].html).not.toMatch(/undefined|null|\[object Object\]/);
  });

  it('still sends the alert when the owner lookup fails', async () => {
    // The alert exists so a self-submitted application is not left unseen.
    // Losing it because the "submitted by" line could not be filled in would
    // trade the whole message for one of its footnotes.
    prismaMock.user.findUnique.mockRejectedValue(new Error('db down'));
    await controller.notifyTeamOfNewApplication(application());

    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain('Master of Science - Computational Sciences');
  });
});

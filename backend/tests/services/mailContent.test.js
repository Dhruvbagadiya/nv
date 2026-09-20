import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/utils/prisma.js', async () => {
  const { prismaMock } = await import('../helpers/prismaMock.js');
  return { prisma: prismaMock };
});

// The stage handler is driven directly, so the row it acts on is supplied
// rather than written: what is under test is WHO gets told, not the update.
vi.mock('../../src/modules/applications/applications.service.js', async () => {
  const actual = await vi.importActual('../../src/modules/applications/applications.service.js');
  return { ...actual, updateApplicationStage: vi.fn() };
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
const applicationsService = await import('../../src/modules/applications/applications.service.js');
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

  it('gives the team the APPLICANT\'s contact details, not the filer\'s', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1', name: 'Priya', email: 'priya@nvimmigrationpvtltd.com', role: 'AGENT',
    });
    await controller.notifyTeamOfNewApplication({
      ...application(),
      studentEmail: 'asha@example.com',
      studentPhone: '+91 99259 13764',
    });

    const html = sent[0].html;
    // Someone reading this alert should be able to ring the applicant. It used
    // to print the filer's address under a bare "Email" directly beneath the
    // student's name, so the one contact line was a colleague's.
    expect(html).toContain('asha@example.com');
    expect(html).toContain('+91 99259 13764');
    // The filer is still there, but labelled as the filer.
    expect(html).toMatch(/Filed by:[\s\S]{0,40}priya@nvimmigrationpvtltd\.com/);
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


/*
 * WHO the stage-change email reaches.
 *
 * This is the point of putting contact details on the application. Before it, an
 * agency-filed application stored a name and a passport, so the one message that
 * says "your offer came through" went to the member of staff who typed the form
 * and the applicant was told nothing at all.
 */
describe('who hears about a stage change', () => {
  const withOwner = (owner) => {
    prismaMock.user.findUnique.mockResolvedValue(owner);
    prismaMock.notification.create.mockResolvedValue({});
  };

  const runStageChange = async (app) => {
    applicationsService.updateApplicationStage.mockResolvedValue(app);
    await controller.updateStageHandler(
      { params: { id: app.id }, body: { stage: 'CONDITIONAL_OFFER' } },
      { json: () => {} }
    );
  };

  const agentFiled = {
    ...application(),
    studentEmail: 'asha@example.com',
    studentPhone: '+91 99259 13764',
    course: { title: 'MSc Data Science', institution: { name: 'University of Leeds' } },
  };

  it('tells the applicant AND keeps the agent informed', async () => {
    withOwner({ id: 'u1', name: 'Priya (NV staff)', email: 'priya@nvimmigrationpvtltd.com', role: 'AGENT' });
    await runStageChange(agentFiled);

    const to = sent.map((m) => m.to).sort();
    expect(to).toEqual(['asha@example.com', 'priya@nvimmigrationpvtltd.com']);

    // The agent's copy is addressed to the agent, the applicant's to the
    // applicant — not one message BCC'd to both with the wrong name on it.
    expect(sent.find((m) => m.to === 'asha@example.com').html).toContain('Asha Menon');
    expect(sent.find((m) => m.to === 'priya@nvimmigrationpvtltd.com').html).toContain('Priya');
  });

  it('does not link the applicant to a portal they have no account for', async () => {
    withOwner({ id: 'u1', name: 'Priya', email: 'priya@nvimmigrationpvtltd.com', role: 'AGENT' });
    await runStageChange(agentFiled);

    // A "view application" button would land them on a sign-in wall.
    expect(sent.find((m) => m.to === 'asha@example.com').html).not.toContain('/my-applications/');
  });

  it('sends ONE email when the applicant filed it themselves', async () => {
    // Self-submitted: the owner and the applicant are the same person, and the
    // same message arriving twice is how an applicant learns to ignore them.
    withOwner({ id: 'u1', name: 'Asha Menon', email: 'asha@example.com', role: 'STUDENT' });
    await runStageChange(agentFiled);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('asha@example.com');
    // A student DOES have somewhere to click through to.
    expect(sent[0].html).toContain('/my-applications/');
  });

  it('still tells the agent about an application filed before contact details existed', async () => {
    withOwner({ id: 'u1', name: 'Priya', email: 'priya@nvimmigrationpvtltd.com', role: 'AGENT' });
    await runStageChange({ ...agentFiled, studentEmail: null, studentPhone: null });

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('priya@nvimmigrationpvtltd.com');
  });
});

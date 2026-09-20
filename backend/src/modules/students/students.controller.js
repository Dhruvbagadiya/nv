import * as studentsService from './students.service.js';
import { prisma } from '../../utils/prisma.js';
import { config } from '../../config.js';
import { sendMail, applicationReceivedEmail } from '../../utils/mailer.js';
// Shared with the agent-filed path rather than duplicated — one alert template.
import { notifyTeamOfNewApplication } from '../applications/applications.controller.js';

export async function getProfileHandler(req, res) {
  res.json(await studentsService.getProfile(req.user.sub));
}

export async function updateProfileHandler(req, res) {
  res.json(await studentsService.upsertProfile(req.user.sub, req.body));
}

export async function listApplicationsHandler(req, res) {
  res.json(await studentsService.listStudentApplications({
    studentId: req.user.sub,
    ...req.query,
  }));
}

export async function createApplicationHandler(req, res) {
  const app = await studentsService.createStudentApplication({
    studentId: req.user.sub,
    ...req.body,
  });

  /*
   * Emails B and C, after the application is safely written.
   *
   * Sequenced this way on purpose: the response the student is waiting on does
   * not depend on either send, and both helpers swallow their own failures, so a
   * mail provider having a bad minute cannot turn a successful submission into
   * an error. The student already has their application either way.
   *
   * notifyTeamOfNewApplication is imported from the applications controller
   * rather than copied — the agent-filed path sends the identical alert, and two
   * copies of an email template drift.
   */
  await sendReceipt(app, req.user.sub);
  await notifyTeamOfNewApplication(app);

  res.status(201).json(app);
}

// Email B — the receipt. Best-effort; never blocks the submission.
async function sendReceipt(app, studentId) {
  try {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { name: true, email: true },
    });
    if (!student?.email) return;
    const { subject, html } = applicationReceivedEmail({
      name: student.name,
      reference: app.reference,
      program: app.course?.title,
      institution: app.course?.institution?.name,
      url: `${config.appUrl}/my-applications/${app.id}`,
    });
    await sendMail({ to: student.email, subject, html });
  } catch (err) {
    console.error('[notify] receipt failed:', err?.message ?? err);
  }
}

export async function getApplicationHandler(req, res) {
  res.json(await studentsService.getStudentApplication({
    id:        req.params.id,
    studentId: req.user.sub,
  }));
}

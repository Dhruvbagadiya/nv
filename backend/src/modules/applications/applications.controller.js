import * as applicationsService from './applications.service.js';
import { agentScopeFor } from '../../utils/scope.js';
import { prisma } from '../../utils/prisma.js';
import { putObject } from '../../utils/storage.js';
import { BadRequestError } from '../../utils/httpErrors.js';
import { config } from '../../config.js';
import {
  sendMail,
  applicationStageEmail,
  // The submission receipt is NOT sent from here. It goes to the student, and
  // an application filed by an agent has a studentName and a passportNo but no
  // student account — so there is no address to send one to. The student path
  // sends it, in students.controller.js.
  newApplicationAlertEmail,
} from '../../utils/mailer.js';

const scopeFor = agentScopeFor;

// ── Notification helpers ─────────────────────────────────────────────────────
// Create a notification for the agent who owns the application.
// Silently no-ops on error so a notification failure never blocks the main action.
async function notifyAgent(agentId, applicationId, kind, title, body) {
  try {
    await prisma.notification.create({
      data: { userId: agentId, applicationId, kind, title, body },
    });
  } catch (err) {
    // Log but don't rethrow — notifications are best-effort.
    console.error('[notify] failed to create notification:', err?.message ?? err);
  }
}

/*
 * Email, beside the in-app notification and under the same rule: best-effort,
 * never blocks the action that triggered it. sendMail already swallows its own
 * failures; this adds the lookup and the try/catch around building the message.
 *
 * WHY THE EXTRA QUERY. APPLICATION_INCLUDE selects the agent as { id, name } —
 * no address. Widening it would put an email on every application in every list
 * response for every caller, to serve one write path. One lookup here is cheaper
 * and leaks nothing.
 *
 * WHO GETS IT. `agentId` owns the application: for a self-submitted one that IS
 * the student, for an agency-filed one it is the agent. An agency-filed
 * application has a studentName and a passportNo but no student account and
 * therefore no address, so the agent is the only person who can be told.
 */
async function ownerOf(agentId) {
  try {
    return await prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, email: true, role: true },
    });
  } catch (err) {
    console.error('[notify] owner lookup failed:', err?.message ?? err);
    return null;
  }
}

const appUrlFor = (app) => `${config.appUrl}/my-applications/${app.id}`;

// Takes the owner rather than looking it up, because the caller needs the same
// record to decide whether the applicant is a separate person worth mailing.
// Two lookups of one row, to send two halves of one notification, is a query
// this route does not need to make.
async function emailOwner(owner, build) {
  if (!owner?.email) return;
  try {
    const { subject, html } = build(owner);
    await sendMail({ to: owner.email, subject, html });
  } catch (err) {
    console.error('[notify] email failed:', err?.message ?? err);
  }
}

/*
 * The applicant, when they are not the account that filed.
 *
 * On an agency-filed application the owner is a member of staff, so everything
 * above tells the AGENT that the student's offer came through and tells the
 * student nothing. That was unavoidable while an application stored only a name
 * and a passport; now it carries studentEmail, so the person the news is
 * actually about can be told.
 *
 * Skipped when the address matches the owner's, which is the self-submitted
 * case — the student filed it themselves and emailOwner has already written to
 * them. Sending both would deliver the same message twice.
 *
 * The agent keeps their copy rather than handing it over: they have a
 * notification bell and this email, and taking the email away to give it to
 * someone else would be a regression for them. Students have no bell, which is
 * the whole reason this exists.
 */
async function emailApplicant(app, ownerEmail, build) {
  const to = app.studentEmail;
  if (!to || to.toLowerCase() === (ownerEmail ?? '').toLowerCase()) return;
  try {
    const { subject, html } = build();
    await sendMail({ to, subject, html });
  } catch (err) {
    console.error('[notify] applicant email failed:', err?.message ?? err);
  }
}

/*
 * Email C — the internal alert.
 *
 * Falls back to MAIL_FROM when MAIL_TEAM_TO is unset, because that is a
 * monitored inbox (contact@): degrading to the wrong-but-watched address beats
 * degrading to silence, which is how a self-submitted application sits unseen.
 */
export async function notifyTeamOfNewApplication(app) {
  const to = config.mail.teamTo || config.mail.from;
  if (!to) return;
  try {
    const owner = await ownerOf(app.agentId);
    const { subject, html } = newApplicationAlertEmail({
      reference: app.reference,
      studentName: app.studentName,
      program: app.course?.title,
      institution: app.course?.institution?.name,
      studentEmail: app.studentEmail,
      studentPhone: app.studentPhone,
      filedBy: owner?.email,
    });
    await sendMail({ to, subject, html });
  } catch (err) {
    console.error('[notify] team alert failed:', err?.message ?? err);
  }
}

export async function createApplicationHandler(req, res) {
  const application = await applicationsService.createApplication({
    agentId: req.user.sub,
    ...req.body,
  });

  // Notify the agent themselves — useful for sub-agents submitting under a parent,
  // and for the bell badge to reflect the new submission.
  await notifyAgent(
    application.agentId,
    application.id,
    'NEW_APPLICATION',
    `POEC #${application.reference} – ${application.course.institution.name}`,
    `New application started for ${application.studentName}. Stage: Profile Assessment.`
  );

  await notifyTeamOfNewApplication(application);

  res.status(201).json(application);
}

export async function listApplicationsHandler(req, res) {
  res.json(
    await applicationsService.listApplications({
      ...req.query,
      agentId: scopeFor(req.user),
    })
  );
}

export async function getApplicationHandler(req, res) {
  res.json(
    await applicationsService.getApplication({
      id: req.params.id,
      agentId: scopeFor(req.user),
    })
  );
}

export async function updateStageHandler(req, res) {
  const application = await applicationsService.updateApplicationStage({
    id: req.params.id,
    ...req.body,
  });

  // Notify the agent who owns this application that the stage changed.
  const stageLabel = req.body.stage.replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  await notifyAgent(
    application.agentId,
    application.id,
    'STAGE_CHANGE',
    `POEC #${application.reference} – Stage updated to ${stageLabel}`,
    req.body.stageNote
      ? `${stageLabel}: ${req.body.stageNote}`
      : `${application.studentName}'s application has moved to ${stageLabel}.`
  );

  // Email A. For a student this is the ONLY way they find out: the portal has no
  // notification UI and nothing polls, so the row notifyAgent just wrote is
  // invisible to them.
  const stageEmail = (over = {}) =>
    applicationStageEmail({
      reference: application.reference,
      program: application.course.title,
      institution: application.course.institution.name,
      stage: stageLabel,
      note: req.body.stageNote,
      ...over,
    });

  const owner = await ownerOf(application.agentId);
  await emailOwner(owner, (o) =>
    stageEmail({
      name: o.name,
      // Only a student has somewhere to click through TO. An agent's copy links
      // nowhere rather than into a portal they cannot open.
      url: o.role === 'STUDENT' ? appUrlFor(application) : undefined,
    })
  );

  // And the applicant themselves, on an agency-filed application. No url: there
  // is no account behind this address, so a link would land on a sign-in wall.
  await emailApplicant(application, owner?.email, () =>
    stageEmail({ name: application.studentName })
  );

  res.json(application);
}

// ── Documents ───────────────────────────────────────────────────────────────

export async function listDocumentsHandler(req, res) {
  // Already `{ items, meta }` from paginateQuery, so it is returned as-is rather
  // than wrapped again — the handler used to build the envelope itself, which is
  // how a second `items` key gets nested inside the first.
  res.json(
    await applicationsService.listApplicationDocuments({
      applicationId: req.params.id,
      agentId: agentScopeFor(req.user),
      page: req.query.page,
      pageSize: req.query.pageSize,
    })
  );
}

/**
 * The file and the authorisation decision happen in the same request.
 *
 * The alternative shape — upload to a generic endpoint, then POST the returned
 * URL — was rejected: it stores bytes before anyone has checked the caller may
 * write to this application, and a client that drops the second call leaves an
 * orphan file nothing references. Here the scope check runs first and a refused
 * request stores nothing.
 */
export async function addDocumentHandler(req, res) {
  if (!req.file) throw new BadRequestError('No file provided.');

  const { fileUrl } = await putObject(req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
    category: 'application-documents',
  });

  const document = await applicationsService.addApplicationDocument({
    applicationId: req.params.id,
    agentId: agentScopeFor(req.user),
    uploadedById: req.user.sub,
    file: {
      kind: req.body.kind,
      label: req.body.label ?? null,
      fileUrl,
      // From the upload, not from the client: a browser sends whatever it likes
      // for these, and they are what the list renders and what a size limit
      // would be checked against later.
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
      sizeBytes: req.file.size,
    },
  });

  res.status(201).json(document);
}

export async function archiveDocumentHandler(req, res) {
  await applicationsService.archiveApplicationDocument({
    applicationId: req.params.id,
    documentId: req.params.documentId,
    agentId: agentScopeFor(req.user),
  });
  res.status(204).end();
}

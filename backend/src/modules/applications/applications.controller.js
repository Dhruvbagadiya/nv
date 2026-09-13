import * as applicationsService from './applications.service.js';
import { agentScopeFor } from '../../utils/scope.js';
import { prisma } from '../../utils/prisma.js';
import { putObject } from '../../utils/storage.js';
import { BadRequestError } from '../../utils/httpErrors.js';

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

  res.json(application);
}

// ── Documents ───────────────────────────────────────────────────────────────

export async function listDocumentsHandler(req, res) {
  res.json({
    items: await applicationsService.listApplicationDocuments({
      applicationId: req.params.id,
      agentId: agentScopeFor(req.user),
    }),
  });
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

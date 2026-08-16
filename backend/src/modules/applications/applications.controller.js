import * as applicationsService from './applications.service.js';
import { agentScopeFor } from '../../utils/scope.js';
import { prisma } from '../../utils/prisma.js';

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

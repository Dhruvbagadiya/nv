import * as service from './entryRequirements.service.js';
import { canSeeArchived } from '../../middleware/optionalAuth.js';

export async function listEntryRequirementsHandler(req, res) {
  // This route admits AGENT, and archiving is how an admin retires a row — so
  // without the guard an agent could ask for status=archived and be handed the
  // retired ones back.
  const query = canSeeArchived(req.user) ? req.query : { ...req.query, status: 'active' };
  res.json(await service.listEntryRequirements(query));
}

export async function listEnglishTestsHandler(req, res) {
  res.json({ items: await service.listEnglishTests(req.query) });
}

export async function upsertEntryRequirementHandler(req, res) {
  res.json(await service.upsertEntryRequirement(req.body));
}

export async function archiveEntryRequirementHandler(req, res) {
  await service.archiveEntryRequirement(req.params.id);
  res.status(204).end();
}

export async function restoreEntryRequirementHandler(req, res) {
  res.json(await service.restoreEntryRequirement(req.params.id));
}

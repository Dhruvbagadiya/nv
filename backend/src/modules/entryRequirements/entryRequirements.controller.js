import * as service from './entryRequirements.service.js';

export async function listEntryRequirementsHandler(req, res) {
  res.json(await service.listEntryRequirements(req.query));
}

export async function listEnglishTestsHandler(req, res) {
  res.json({ items: await service.listEnglishTests(req.query) });
}

export async function upsertEntryRequirementHandler(req, res) {
  res.json(await service.upsertEntryRequirement(req.body));
}

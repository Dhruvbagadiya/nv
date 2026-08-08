import * as institutionsService from './institutions.service.js';

export async function listInstitutionsHandler(req, res) {
  res.json({ items: await institutionsService.listInstitutions(req.query) });
}

export async function listTrendingHandler(req, res) {
  res.json({ items: await institutionsService.listTrending() });
}

export async function createInstitutionHandler(req, res) {
  res.status(201).json(await institutionsService.createInstitution(req.body));
}

export async function updateInstitutionHandler(req, res) {
  res.json(await institutionsService.updateInstitution(req.params.id, req.body));
}

export async function setBlacklistHandler(req, res) {
  res.json(await institutionsService.setBlacklistStatus(req.params.id, req.body.isBlacklisted));
}

export async function archiveInstitutionHandler(req, res) {
  await institutionsService.archiveInstitution(req.params.id);
  res.status(204).send();
}

export async function restoreInstitutionHandler(req, res) {
  res.json(await institutionsService.restoreInstitution(req.params.id));
}

import * as service from './importantUpdates.service.js';

export async function listUpdatesHandler(req, res) {
  res.json(await service.listImportantUpdates(req.query));
}

export async function getUpdateHandler(req, res) {
  res.json(await service.getImportantUpdate(req.params.id));
}

export async function createUpdateHandler(req, res) {
  res.status(201).json(await service.createImportantUpdate(req.body));
}

export async function updateUpdateHandler(req, res) {
  res.json(await service.updateImportantUpdate(req.params.id, req.body));
}

export async function archiveUpdateHandler(req, res) {
  await service.archiveImportantUpdate(req.params.id);
  res.status(204).send();
}

export async function restoreImportantUpdateHandler(req, res) {
  res.json(await service.restoreImportantUpdate(req.params.id));
}

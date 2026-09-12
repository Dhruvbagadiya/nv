import * as service from './importantUpdates.service.js';
import { canSeeArchived } from '../../middleware/optionalAuth.js';

export async function listUpdatesHandler(req, res) {
  // Six sibling controllers wrap `status` and these two did not, so any
  // authenticated agent could ask for ?status=archived and read rows that had
  // been deliberately retired — the full body of a withdrawn update, the direct
  // number of a staff member who has left. The by-id paths were always guarded;
  // only the lists were open.
  const query = canSeeArchived(req.user) ? req.query : { ...req.query, status: 'active' };
  res.json(await service.listImportantUpdates(query));
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

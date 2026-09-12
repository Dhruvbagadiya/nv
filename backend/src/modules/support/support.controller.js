import * as service from './support.service.js';
import { canSeeArchived } from '../../middleware/optionalAuth.js';

export async function listContactsHandler(req, res) {
  // Six sibling controllers wrap `status` and these two did not, so any
  // authenticated agent could ask for ?status=archived and read rows that had
  // been deliberately retired — the full body of a withdrawn update, the direct
  // number of a staff member who has left. The by-id paths were always guarded;
  // only the lists were open.
  const query = canSeeArchived(req.user) ? req.query : { ...req.query, status: 'active' };
  res.json({ items: await service.listSupportContacts(query) });
}

export async function createContactHandler(req, res) {
  res.status(201).json(await service.createSupportContact(req.body));
}

export async function updateContactHandler(req, res) {
  res.json(await service.updateSupportContact(req.params.id, req.body));
}

export async function archiveContactHandler(req, res) {
  await service.archiveSupportContact(req.params.id);
  res.status(204).send();
}

export async function restoreContactHandler(req, res) {
  res.json(await service.restoreSupportContact(req.params.id));
}

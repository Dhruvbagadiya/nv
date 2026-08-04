import * as service from './support.service.js';

export async function listContactsHandler(req, res) {
  res.json({ items: await service.listSupportContacts() });
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

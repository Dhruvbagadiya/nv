import * as service from './usefulInformation.service.js';
import { canSeeArchived } from '../../middleware/optionalAuth.js';

export async function listUsefulInformationHandler(req, res) {
  // The list route admits AGENT, and archiving is how an admin retires a note —
  // without this an agent could ask for status=archived and be handed them back.
  const query = canSeeArchived(req.user) ? req.query : { ...req.query, status: 'active' };
  res.json(await service.listUsefulInformation(query));
}

export async function createUsefulInformationHandler(req, res) {
  res.status(201).json(await service.createUsefulInformation(req.body));
}

export async function updateUsefulInformationHandler(req, res) {
  res.json(await service.updateUsefulInformation(req.params.id, req.body));
}

export async function archiveUsefulInformationHandler(req, res) {
  await service.archiveUsefulInformation(req.params.id);
  res.status(204).end();
}

export async function restoreUsefulInformationHandler(req, res) {
  res.json(await service.restoreUsefulInformation(req.params.id));
}

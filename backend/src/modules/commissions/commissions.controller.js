import * as commissionsService from './commissions.service.js';
import { canSeeArchived } from '../../middleware/optionalAuth.js';

export async function listCommissionsHandler(req, res) {
  // Same reason as the other partner-facing lists: this route admits AGENT, and
  // status=archived would otherwise hand back rows an admin retired.
  const query = canSeeArchived(req.user) ? req.query : { ...req.query, status: 'active' };
  res.json(await commissionsService.listCommissions(query));
}

export async function upsertCommissionHandler(req, res) {
  res.json(await commissionsService.upsertCommission(req.body));
}

export async function archiveCommissionHandler(req, res) {
  await commissionsService.archiveCommission(req.params.id);
  res.status(204).end();
}

export async function restoreCommissionHandler(req, res) {
  res.json(await commissionsService.restoreCommission(req.params.id));
}

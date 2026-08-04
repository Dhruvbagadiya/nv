import * as commissionsService from './commissions.service.js';

export async function listCommissionsHandler(req, res) {
  res.json(await commissionsService.listCommissions(req.query));
}

export async function upsertCommissionHandler(req, res) {
  res.json(await commissionsService.upsertCommission(req.body));
}

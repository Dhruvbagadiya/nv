import * as reportsService from './reports.service.js';
import { agentScopeFor } from '../../utils/scope.js';

export async function summaryHandler(req, res) {
  res.json(
    await reportsService.getReportSummary({
      agentId: agentScopeFor(req.user),
      userId: req.user.sub,
    })
  );
}

export async function adminStatsHandler(req, res) {
  res.json(await reportsService.getAdminStats());
}

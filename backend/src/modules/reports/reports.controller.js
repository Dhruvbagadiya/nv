import * as reportsService from './reports.service.js';
import * as activityService from './activity.service.js';
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

// Staff-only, and unscoped on purpose: the whole point is seeing across
// agencies. `agentId` narrows it to one, and is a filter rather than a scope —
// the route's requireRole is what keeps an agent out of here entirely.
export async function activityHandler(req, res) {
  res.json(await activityService.listActivity(req.query));
}

export async function agentSummaryHandler(req, res) {
  res.json({ items: await activityService.listAgentSummary({ limit: 10 }) });
}

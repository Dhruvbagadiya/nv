import * as reportsService from './reports.service.js';

export async function summaryHandler(req, res) {
  res.json(
    await reportsService.getReportSummary({
      agentId: req.user.role === 'AGENT' ? req.user.sub : undefined,
      userId: req.user.sub,
    })
  );
}

export async function adminStatsHandler(req, res) {
  res.json(await reportsService.getAdminStats());
}

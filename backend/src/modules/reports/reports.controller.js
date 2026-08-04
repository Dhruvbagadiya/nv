import * as reportsService from './reports.service.js';

export async function summaryHandler(req, res) {
  // An agent's report is about their own book of business; staff see the whole
  // pipeline. Notifications are always the caller's own either way.
  res.json(
    await reportsService.getReportSummary({
      agentId: req.user.role === 'AGENT' ? req.user.sub : undefined,
      userId: req.user.sub,
    })
  );
}

import * as inquiriesService from './courseInquiries.service.js';
import { agentScopeFor } from '../../utils/scope.js';

const scopeFor = agentScopeFor;

export async function createInquiryHandler(req, res) {
  res.status(201).json(await inquiriesService.createInquiry({ agentId: req.user.sub, ...req.body }));
}

export async function listInquiriesHandler(req, res) {
  res.json(await inquiriesService.listInquiries({ ...req.query, agentId: scopeFor(req.user) }));
}

// Staff-only: an agent marking their own inquiry OFFERED would make the Report
// screen report on itself.
export async function updateStageHandler(req, res) {
  res.json(await inquiriesService.updateInquiryStage({ id: req.params.id, stage: req.body.stage }));
}

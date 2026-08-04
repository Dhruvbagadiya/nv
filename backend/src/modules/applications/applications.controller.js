import * as applicationsService from './applications.service.js';

// Agents only ever see their own applications; admins see all. Derived from the
// verified token here rather than trusting a query parameter.
const scopeFor = (user) => (user.role === 'AGENT' ? user.sub : undefined);

export async function createApplicationHandler(req, res) {
  const application = await applicationsService.createApplication({
    agentId: req.user.sub,
    ...req.body,
  });
  res.status(201).json(application);
}

export async function listApplicationsHandler(req, res) {
  res.json(
    await applicationsService.listApplications({
      ...req.query,
      agentId: scopeFor(req.user),
    })
  );
}

export async function getApplicationHandler(req, res) {
  res.json(
    await applicationsService.getApplication({
      id: req.params.id,
      agentId: scopeFor(req.user),
    })
  );
}

// Admin-only — see the route. An agent advancing their own application to
// VISA_APPROVAL would make the Report screen fiction.
export async function updateStageHandler(req, res) {
  res.json(await applicationsService.updateApplicationStage({ id: req.params.id, ...req.body }));
}

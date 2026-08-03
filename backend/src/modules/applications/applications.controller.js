import * as applicationsService from './applications.service.js';

export async function createApplicationHandler(req, res, next) {
  try {
    const { studentName, passportNo, courseId } = req.body;
    const application = await applicationsService.createApplication({
      agentId: req.user.sub,
      studentName,
      passportNo,
      courseId,
    });
    res.status(201).json(application);
  } catch (err) {
    next(err);
  }
}

export async function listApplicationsHandler(req, res, next) {
  try {
    const { country, institutionId, status, passportNo, studentName, page } = req.query;
    // Agents only ever see their own applications; admins see all —
    // enforce that here rather than trusting a query param.
    const scopeToAgent = req.user.role === 'AGENT' ? req.user.sub : undefined;

    const result = await applicationsService.listApplications({
      agentId: scopeToAgent,
      country,
      institutionId,
      status,
      passportNo,
      studentName,
      page: page ? Number(page) : 1,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

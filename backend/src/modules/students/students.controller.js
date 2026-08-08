import * as studentsService from './students.service.js';

export async function getProfileHandler(req, res) {
  res.json(await studentsService.getProfile(req.user.sub));
}

export async function updateProfileHandler(req, res) {
  res.json(await studentsService.upsertProfile(req.user.sub, req.body));
}

export async function listApplicationsHandler(req, res) {
  res.json(await studentsService.listStudentApplications({
    studentId: req.user.sub,
    ...req.query,
  }));
}

export async function createApplicationHandler(req, res) {
  const app = await studentsService.createStudentApplication({
    studentId: req.user.sub,
    ...req.body,
  });
  res.status(201).json(app);
}

export async function getApplicationHandler(req, res) {
  res.json(await studentsService.getStudentApplication({
    id:        req.params.id,
    studentId: req.user.sub,
  }));
}

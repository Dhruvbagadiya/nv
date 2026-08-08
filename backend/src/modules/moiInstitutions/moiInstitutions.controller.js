import * as moiService from './moiInstitutions.service.js';

export async function listMoiHandler(req, res) {
  res.json(await moiService.listMoiAcceptances(req.query));
}

export async function listCourseTypesHandler(req, res) {
  res.json({ items: await moiService.listCourseTypes() });
}

export async function createMoiHandler(req, res) {
  res.status(201).json(await moiService.createMoiAcceptance(req.body));
}

export async function updateMoiHandler(req, res) {
  res.json(await moiService.updateMoiAcceptance(req.params.id, req.body));
}

export async function deleteMoiHandler(req, res) {
  await moiService.deleteMoiAcceptance(req.params.id);
  res.status(204).send();
}

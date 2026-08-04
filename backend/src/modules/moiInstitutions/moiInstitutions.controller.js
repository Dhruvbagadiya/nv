import * as moiService from './moiInstitutions.service.js';

export async function listMoiHandler(req, res) {
  res.json(await moiService.listMoiAcceptances(req.query));
}

// Feeds the "Course type" dropdown, which was an empty <select> because there was
// nothing to populate it from.
export async function listCourseTypesHandler(req, res) {
  res.json({ items: await moiService.listCourseTypes() });
}

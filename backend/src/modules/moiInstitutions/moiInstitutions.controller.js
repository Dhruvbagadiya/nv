import * as moiService from './moiInstitutions.service.js';

export async function listMoiHandler(req, res, next) {
  try {
    const { country, institutionId, courseType, page } = req.query;
    const result = await moiService.listMoiAcceptances({
      country,
      institutionId,
      courseType,
      page: page ? Number(page) : 1,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

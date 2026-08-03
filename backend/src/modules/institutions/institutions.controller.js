import * as institutionsService from './institutions.service.js';

export async function listInstitutionsHandler(req, res, next) {
  try {
    const { country, search } = req.query;
    const items = await institutionsService.listInstitutions({ country, search });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function createInstitutionHandler(req, res, next) {
  try {
    const { name, countryId, logoUrl } = req.body;
    const institution = await institutionsService.createInstitution({ name, countryId, logoUrl });
    res.status(201).json(institution);
  } catch (err) {
    next(err);
  }
}

export async function setBlacklistHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { isBlacklisted } = req.body;
    const institution = await institutionsService.setBlacklistStatus(id, isBlacklisted);
    res.json(institution);
  } catch (err) {
    next(err);
  }
}

import * as institutionsService from './institutions.service.js';
import { canSeeArchived } from '../../middleware/optionalAuth.js';

export async function listInstitutionsHandler(req, res) {
  const { page, pageSize, ...rest } = req.query;

  // Public endpoint, so `includeArchived` cannot be taken on trust: it let any
  // unauthenticated caller list institutions that had been archived.
  const filters = canSeeArchived(req.user) ? rest : { ...rest, includeArchived: false };

  // Asking for a page opts into the paged shape, { items, meta }. Callers that
  // do not — every dropdown in the app — keep getting the bare { items } they
  // already expect.
  if (page === undefined) {
    return res.json({ items: await institutionsService.listInstitutions(filters) });
  }
  res.json(await institutionsService.listInstitutionsPage(filters, { page, pageSize }));
}

export async function listTrendingHandler(req, res) {
  res.json({ items: await institutionsService.listTrending() });
}

export async function createInstitutionHandler(req, res) {
  res.status(201).json(await institutionsService.createInstitution(req.body));
}

export async function updateInstitutionHandler(req, res) {
  res.json(await institutionsService.updateInstitution(req.params.id, req.body));
}

export async function setBlacklistHandler(req, res) {
  res.json(await institutionsService.setBlacklistStatus(req.params.id, req.body.isBlacklisted));
}

export async function archiveInstitutionHandler(req, res) {
  await institutionsService.archiveInstitution(req.params.id);
  res.status(204).send();
}

export async function restoreInstitutionHandler(req, res) {
  res.json(await institutionsService.restoreInstitution(req.params.id));
}

export async function listPhotosHandler(req, res) {
  res.json(await institutionsService.listPhotos(req.params.id));
}

export async function addPhotoHandler(req, res) {
  res.status(201).json(await institutionsService.addPhoto(req.params.id, req.body));
}

export async function deletePhotoHandler(req, res) {
  await institutionsService.deletePhoto(req.params.id, req.params.photoId);
  res.status(204).send();
}

export async function reorderPhotosHandler(req, res) {
  res.json(await institutionsService.reorderPhotos(req.params.id, req.body.ids));
}

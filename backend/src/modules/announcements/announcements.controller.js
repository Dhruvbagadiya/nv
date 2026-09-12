import * as service from './announcements.service.js';
import { canSeeArchived } from '../../middleware/optionalAuth.js';

// Agents get only the active banners; admins can ask for all of them in order to
// manage the inactive ones.
export async function listAnnouncementsHandler(req, res) {
  // An allow-list, not `role !== 'AGENT'`. utils/scope.js documents that exact
  // negation as the cause of an earlier leak: it is correct only for as long as
  // AGENT is the only non-staff role the route admits, so adding a role to this
  // route's requireRole would silently grant it the unpublished banners.
  const isStaff = canSeeArchived(req.user);
  const items =
    isStaff && req.query.all === 'true'
      ? await service.listAllAnnouncements()
      : await service.listActiveAnnouncements();
  res.json({ items });
}

export async function createAnnouncementHandler(req, res) {
  res.status(201).json(await service.createAnnouncement(req.body));
}

export async function updateAnnouncementHandler(req, res) {
  res.json(await service.updateAnnouncement(req.params.id, req.body));
}

export async function deleteAnnouncementHandler(req, res) {
  await service.deleteAnnouncement(req.params.id);
  res.status(204).send();
}

import * as service from './announcements.service.js';

// Agents get only the active banners; admins can ask for all of them in order to
// manage the inactive ones.
export async function listAnnouncementsHandler(req, res) {
  const isStaff = req.user.role !== 'AGENT';
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

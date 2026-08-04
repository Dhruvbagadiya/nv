import { prisma } from '../../utils/prisma.js';

// The two banners pinned above every screen in the reference portal: a red
// blacklist warning with a "Click for list" action, and a blue declaration-form
// notice with a download. Modelled rather than hardcoded into the shell so ops can
// change the wording, or take one down, without a deploy.
export async function listActiveAnnouncements() {
  return prisma.announcement.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function listAllAnnouncements() {
  return prisma.announcement.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
}

export async function createAnnouncement(data) {
  return prisma.announcement.create({ data });
}

export async function updateAnnouncement(id, data) {
  return prisma.announcement.update({ where: { id }, data });
}

export async function deleteAnnouncement(id) {
  // A genuine delete: nothing references an announcement, and an operator taking
  // a banner down permanently should not leave a row behind. Temporary removal is
  // what isActive is for.
  return prisma.announcement.delete({ where: { id } });
}

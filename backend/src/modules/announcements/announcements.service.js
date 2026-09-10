import { prisma } from '../../utils/prisma.js';

// The two banners pinned above every screen in the reference portal: a red
// blacklist warning with a "Click for list" action, and a blue declaration-form
// notice with a download. Modelled rather than hardcoded into the shell so ops can
// change the wording, or take one down, without a deploy.
export async function listActiveAnnouncements() {
  return prisma.announcement.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    // Every one of these renders as a banner across the top of the app. A
    // hundred active banners is a mistake, not a use case, and it should not be
    // able to make the shell unusable on every screen at once.
    take: 20,
  });
}

export async function listAllAnnouncements() {
  // Admin list. Capped for the same reason as everything else here: a table
  // anyone can add to must not return an unbounded response.
  return prisma.announcement.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    take: 200,
  });
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

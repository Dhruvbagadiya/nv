import { prisma } from '../../utils/prisma.js';
import { archiveWhere } from '../../utils/softDelete.js';

// Help & Support screen (image 21): a grid of contact cards.
export async function listSupportContacts({ status } = {}) {
  return prisma.supportContact.findMany({
    where: archiveWhere(status),
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    // Capped: this feeds a grid of contact cards, not a paged list, and an
    // uncapped findMany on a table anyone can add to is an unbounded response.
    take: 200,
  });
}

export async function createSupportContact(data) {
  return prisma.supportContact.create({ data });
}

export async function updateSupportContact(id, data) {
  return prisma.supportContact.update({ where: { id }, data });
}

export async function archiveSupportContact(id) {
  return prisma.supportContact.update({ where: { id }, data: { archivedAt: new Date() } });
}

// Archiving used to be a one-way door here: the row stayed in the table and no
// endpoint could reach it again.
export async function restoreSupportContact(id) {
  return prisma.supportContact.update({ where: { id }, data: { archivedAt: null } });
}

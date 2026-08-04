import { prisma } from '../../utils/prisma.js';

// Help & Support screen (image 21): a grid of contact cards.
export async function listSupportContacts() {
  return prisma.supportContact.findMany({
    where: { archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
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

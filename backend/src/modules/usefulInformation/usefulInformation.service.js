import { prisma } from '../../utils/prisma.js';
import { paginateQuery } from '../../utils/pagination.js';
import { archiveWhere } from '../../utils/softDelete.js';

/**
 * The "Useful Information" panel on the Report screen.
 *
 * The model, the index and the panel that renders it have existed all along —
 * reports.service.js reads five rows straight off the table. What never existed
 * was any way to put a row there, so the panel has always said "No useful
 * information found."
 */
export async function listUsefulInformation({ search, status, page, pageSize } = {}) {
  const where = {
    ...archiveWhere(status),
    ...(search && { title: { contains: search, mode: 'insensitive' } }),
  };

  return paginateQuery(
    prisma.usefulInformation,
    { where, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] },
    { page, pageSize }
  );
}

export async function createUsefulInformation(data) {
  return prisma.usefulInformation.create({ data });
}

export async function updateUsefulInformation(id, data) {
  return prisma.usefulInformation.update({ where: { id }, data });
}

export async function archiveUsefulInformation(id) {
  return prisma.usefulInformation.update({ where: { id }, data: { archivedAt: new Date() } });
}

// Archiving without this is a one-way door: the row stays in the table and no
// endpoint can reach it again.
export async function restoreUsefulInformation(id) {
  return prisma.usefulInformation.update({ where: { id }, data: { archivedAt: null } });
}

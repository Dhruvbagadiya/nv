import { prisma } from '../../utils/prisma.js';
import { paginateQuery } from '../../utils/pagination.js';
import { NotFoundError } from '../../utils/httpErrors.js';

const UPDATE_INCLUDE = {
  country: { select: { id: true, code: true, name: true, flagEmoji: true } },
  institution: { select: { id: true, name: true } },
};

// Reference images 5-6: filtered by publish-date range, country and institution.
export async function listImportantUpdates({ from, to, countryId, institutionId, page, pageSize }) {
  const where = {
    archivedAt: null,
    ...((from || to) && {
      publishDate: {
        ...(from && { gte: from }),
        // `to` arrives as a date with no time, i.e. midnight, so `lte: to` would
        // exclude everything published on the end date itself. Push to the end of
        // that day.
        ...(to && { lte: endOfDay(to) }),
      },
    }),
    ...(countryId && { countryId }),
    ...(institutionId && { institutionId }),
  };

  return paginateQuery(
    prisma.importantUpdate,
    { where, include: UPDATE_INCLUDE, orderBy: [{ publishDate: 'desc' }, { id: 'asc' }] },
    { page, pageSize }
  );
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Behind the eye icon in the Details column.
export async function getImportantUpdate(id) {
  const update = await prisma.importantUpdate.findFirst({
    where: { id, archivedAt: null },
    include: UPDATE_INCLUDE,
  });
  if (!update) throw new NotFoundError('Update not found');
  return update;
}

export async function createImportantUpdate(data) {
  return prisma.importantUpdate.create({ data, include: UPDATE_INCLUDE });
}

export async function updateImportantUpdate(id, data) {
  return prisma.importantUpdate.update({ where: { id }, data, include: UPDATE_INCLUDE });
}

export async function archiveImportantUpdate(id) {
  return prisma.importantUpdate.update({ where: { id }, data: { archivedAt: new Date() } });
}

import { prisma } from '../../utils/prisma.js';
import { paginateQuery } from '../../utils/pagination.js';
import { NotFoundError } from '../../utils/httpErrors.js';

// This module used to synthesise a single fake item from a count of blacklisted
// institutions — there was no Notification table at all. It could not express
// per-item read state, could not be tied to an application, and the bell badge
// showed "1 new" forever. Now backed by the real model.

const NOTIFICATION_INCLUDE = {
  application: {
    select: {
      id: true,
      reference: true,
      intakeLabel: true,
      course: { select: { title: true, institution: { select: { name: true } } } },
    },
  },
};

export async function listNotifications({ userId, unreadOnly, page, pageSize }) {
  return paginateQuery(
    prisma.notification,
    {
      where: { userId, ...(unreadOnly && { readAt: null }) },
      include: NOTIFICATION_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    },
    { page, pageSize }
  );
}

// Separate from the list so the header badge does not have to fetch a page of
// rows just to display a number.
export async function countUnread({ userId }) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead({ id, userId }) {
  // updateMany scoped by userId, not update by id: `update` would let anyone mark
  // another user's notification read by guessing its id, and would 404 rather
  // than 403 in a way that confirms the id exists.
  const result = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    // Either it does not exist, belongs to someone else, or was already read.
    // Distinguish the last case so a double-click is not an error.
    const exists = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) throw new NotFoundError('Notification not found');
  }
  return { id, readAt: new Date() };
}

export async function markAllRead({ userId }) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

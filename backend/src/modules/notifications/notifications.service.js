import { prisma } from '../../utils/prisma.js';

// Notifications aren't a full CRUD-backed model yet — this generates
// them from live data (e.g. blacklisted institutions) so the dropdown
// has something real to show without needing a separate notifications
// table on day one. Swap for a proper Notification model once you have
// more triggers (application status changes, etc.) to track.
export async function listNotifications() {
  const blacklisted = await prisma.institution.count({ where: { isBlacklisted: true } });

  const items = [];
  if (blacklisted > 0) {
    items.push({
      id: 'blacklist-alert',
      type: 'warning',
      message: `${blacklisted} partner institution${blacklisted > 1 ? 's are' : ' is'} on hold for new submissions.`,
    });
  }
  return items;
}

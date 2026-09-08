/**
 * The `where` fragment for a soft-delete status filter.
 *
 * Archiving sets `archivedAt` and lists filter on it being null. That works, but
 * it was written once per module and only two of seven — Course and Institution —
 * ever added a way to see or restore an archived row. On the other five,
 * archiving was a one-way door: the row still existed, and no endpoint could
 * reach it, so from an operator's point of view a mis-click destroyed the record.
 *
 *   active   (default)  only live rows — what every public and agent-facing
 *                       caller must ever see
 *   archived            only soft-deleted rows, for an admin looking for
 *                       something to restore
 *   all                 both, for an admin auditing
 *
 * Default is 'active' on purpose: a caller that forgets to pass a status gets
 * the safe answer rather than leaking hidden rows.
 */
export function archiveWhere(status = 'active') {
  if (status === 'archived') return { archivedAt: { not: null } };
  if (status === 'all') return {};
  return { archivedAt: null };
}

/** The zod fragment that goes with it. Import into any list query schema. */
export const STATUS_VALUES = ['active', 'archived', 'all'];

/*
 * Recurring intake months, and the dates they land on next.
 *
 * Most courses run on a fixed yearly cycle — "every February and September" —
 * so the months are stored without a year and the actual dates are derived at
 * read time. Storing dated rows per year instead means someone has to re-enter
 * them every intake season, and the moment nobody does, the catalogue quietly
 * starts advertising intakes that have already passed.
 */

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "Feb, Sep" from [2, 9]. Sorted, so the order does not depend on the feed. */
export function monthLabels(months) {
  return (months ?? [])
    .filter((m) => m >= 1 && m <= 12)
    .sort((a, b) => a - b)
    .map((m) => MONTH_NAMES[m - 1]);
}

/**
 * The next `count` times this course starts, as { month, year }.
 *
 * A month that has already passed this year rolls to next year — that rolling
 * is the whole point, and it is why the year is not stored. `from` is injectable
 * so this is testable without freezing the clock.
 */
export function nextIntakes(months, count = 3, from = new Date()) {
  const valid = (months ?? []).filter((m) => m >= 1 && m <= 12);
  if (!valid.length) return [];

  const thisMonth = from.getMonth() + 1;
  const thisYear = from.getFullYear();
  const out = [];

  // Two years is always enough: with at least one valid month, the first year
  // yields one and the second guarantees the rest of a 12-month cycle.
  for (let yearOffset = 0; yearOffset <= 2 && out.length < count; yearOffset++) {
    for (const m of [...valid].sort((a, b) => a - b)) {
      if (yearOffset === 0 && m < thisMonth) continue;
      out.push({ month: m, year: thisYear + yearOffset });
      if (out.length === count) break;
    }
  }
  return out;
}

/** "Feb 2027" — how an intake is written on a card. */
export const formatIntake = ({ month, year }) => `${MONTH_NAMES[month - 1]} ${year}`;

import { prisma } from '../../utils/prisma.js';

// The endpoint that did not exist, and whose absence was the single root cause of
// every dead dropdown in the app: the header strip had 15 country chips hardcoded
// in a React component while every <select> elsewhere held one static
// placeholder <option>, because there was nothing to populate them from.
//
// Not paginated. There are 15 rows and every consumer wants all of them, so
// pagination would be pure ceremony.
export async function listCountries({ withInstitutionsOnly = false } = {}) {
  return prisma.country.findMany({
    where: withInstitutionsOnly
      ? { institutions: { some: { archivedAt: null } } }
      : undefined,
    select: {
      id: true,
      code: true,
      name: true,
      flagEmoji: true,
      currencyCode: true,
      // Lets a filter show "United Kingdom (30)" and lets the UI grey out
      // destinations with nothing behind them, instead of the current behaviour
      // where picking one silently returns an empty grid.
      _count: { select: { institutions: { where: { archivedAt: null } } } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

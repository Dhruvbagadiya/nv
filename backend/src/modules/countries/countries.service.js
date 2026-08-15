import { prisma } from '../../utils/prisma.js';
import { ConflictError, NotFoundError } from '../../utils/httpErrors.js';

// The endpoint that did not exist, and whose absence was the single root cause of
// every dead dropdown in the app: the header strip had 15 country chips hardcoded
// in a React component while every <select> elsewhere held one static
// placeholder <option>, because there was nothing to populate them from.
//
// Not paginated. There are 15 rows and every consumer wants all of them, so
// pagination would be pure ceremony.
export async function listCountries({ withInstitutionsOnly = false } = {}) {
  const rows = await prisma.country.findMany({
    where: withInstitutionsOnly
      ? { institutions: { some: { archivedAt: null } } }
      : undefined,
    select: {
      id: true,
      code: true,
      name: true,
      flagEmoji: true,
      isoCode: true,
      currencyCode: true,
      sortOrder: true,
      _count: { select: { institutions: { where: { archivedAt: null } } } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  // Flatten _count so callers read `country.institutionCount` directly.
  // Also keep isoCode in the response for flag rendering on the frontend.
  return rows.map(({ _count, ...c }) => ({
    ...c,
    institutionCount: _count.institutions,
  }));
}


// Countries are reference data that everything else hangs off: institutions,
// inquiries, updates and documents all point at them, and `code` is load-bearing
// in URLs (?country=UK), the header strip and currency display.

export async function createCountry(data) {
  const existing = await prisma.country.findUnique({ where: { code: data.code } });
  if (existing) throw new ConflictError(`Country code "${data.code}" is already in use`);
  return prisma.country.create({ data });
}

export async function updateCountry(id, data) {
  const country = await prisma.country.findUnique({ where: { id } });
  if (!country) throw new NotFoundError('Country not found');

  // `code` is immutable. It is embedded in saved filter URLs (?country=UK), the
  // header strip's selection state and every bookmark an agent has made, and
  // changing it would silently break all of them with no error anywhere.
  if (data.code && data.code !== country.code) {
    throw new ConflictError(
      `A country's code cannot be changed after creation — "${country.code}" is referenced by saved links and filters. Create a new country instead.`
    );
  }

  const { code: _ignored, ...rest } = data;
  return prisma.country.update({ where: { id }, data: rest });
}

export async function deleteCountry(id) {
  const country = await prisma.country.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: {
        select: { institutions: true, courseInquiries: true, importantUpdates: true, documents: true },
      },
    },
  });
  if (!country) throw new NotFoundError('Country not found');

  // Refuse rather than cascade. Deleting a country with institutions would either
  // fail on the foreign key as a 500, or — worse, if it cascaded — silently take
  // their courses and applications with it.
  const refs = country._count;
  const blocking = Object.entries(refs).filter(([, n]) => n > 0);
  if (blocking.length) {
    const detail = blocking.map(([k, n]) => `${n} ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join(', ');
    throw new ConflictError(
      `${country.name} still has ${detail}. Reassign or remove those first.`
    );
  }

  return prisma.country.delete({ where: { id } });
}

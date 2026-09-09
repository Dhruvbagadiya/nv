import { prisma } from '../../utils/prisma.js';
import { paginateQuery } from '../../utils/pagination.js';
import { archiveWhere } from '../../utils/softDelete.js';

// Reference images 3-4. /entry-requirements/ug and /pg are the same screen with a
// different `level`, so this is one query with a required level parameter rather
// than two endpoints.
export async function listEntryRequirements({
  level,
  country,
  institutionId,
  englishRequirement,
  credibilityInterview,
  status,
  page,
  pageSize,
}) {
  const where = {
    level,
    ...archiveWhere(status),
    institution: {
      archivedAt: null,
      ...(institutionId && { id: institutionId }),
      ...(country && { country: { code: country } }),
    },
    // The screenshot's "English Requirement" filter is a dropdown, but the column
    // is long free text ("IELTS 6.5 overall no less than 6.0, IELTS waiver…"), so
    // an exact match would never hit. Substring match instead, which is what the
    // filter is actually for — narrowing to "IELTS" or "PTE".
    ...(englishRequirement && {
      englishRequirement: { contains: englishRequirement, mode: 'insensitive' },
    }),
    ...(credibilityInterview !== undefined && { credibilityInterview }),
  };

  return paginateQuery(
    prisma.entryRequirement,
    {
      where,
      include: {
        institution: {
          include: { country: { select: { code: true, name: true, flagEmoji: true } } },
        },
      },
      orderBy: [{ institution: { name: 'asc' } }],
    },
    { page, pageSize }
  );
}

// Feeds the "English Requirement" dropdown with the test names actually present,
// rather than a hardcoded list that could offer options matching nothing.
export async function listEnglishTests({ level }) {
  const rows = await prisma.entryRequirement.findMany({
    where: { level, archivedAt: null },
    select: { englishRequirement: true },
  });

  const KNOWN_TESTS = ['IELTS', 'PTE', 'TOEFL', 'UKVI', 'Duolingo'];
  const present = new Set();
  for (const row of rows) {
    for (const test of KNOWN_TESTS) {
      if (row.englishRequirement.toUpperCase().includes(test.toUpperCase())) present.add(test);
    }
  }
  return KNOWN_TESTS.filter((t) => present.has(t));
}

export async function upsertEntryRequirement({ institutionId, level, ...rest }) {
  return prisma.entryRequirement.upsert({
    where: { institutionId_level: { institutionId, level } },
    update: { ...rest, archivedAt: null },
    create: { institutionId, level, ...rest },
    include: { institution: { include: { country: true } } },
  });
}

export async function archiveEntryRequirement(id) {
  return prisma.entryRequirement.update({ where: { id }, data: { archivedAt: new Date() } });
}

// Archiving without this is a one-way door: the row stays in the table and no
// endpoint can reach it again.
export async function restoreEntryRequirement(id) {
  return prisma.entryRequirement.update({ where: { id }, data: { archivedAt: null } });
}

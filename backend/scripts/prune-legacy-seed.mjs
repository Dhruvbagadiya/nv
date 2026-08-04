// One-off cleanup of the placeholder rows created by the PREVIOUS version of
// prisma/seed.js, which was not idempotent and used throwaway names:
//
//   Institution A … Institution L   (12 rows, city "Sample City")
//   their 12 courses
//   the "Sample Student" application
//
// The current seed writes realistic data with deterministic ids, so these rows
// are pure noise — they would show up in every list and filter as
// "Institution A / Sample City".
//
// Deliberately a separate script rather than a step inside the seed: a permanent
// `deleteMany({ name: { startsWith: 'Institution ' } })` would eventually delete
// someone's legitimately-named institution. Run it once, then forget it.
//
//   node scripts/prune-legacy-seed.mjs --dry-run
//   node scripts/prune-legacy-seed.mjs
//
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

// Narrow, literal signature. Not a pattern that could match real data by accident.
const LEGACY_INSTITUTION_NAMES = Array.from({ length: 12 }, (_, i) => `Institution ${String.fromCharCode(65 + i)}`);

async function main() {
  const institutions = await prisma.institution.findMany({
    where: { name: { in: LEGACY_INSTITUTION_NAMES }, city: undefined },
    select: { id: true, name: true, _count: { select: { courses: true } } },
  });

  const courseIds = (
    await prisma.course.findMany({
      where: { institutionId: { in: institutions.map((i) => i.id) } },
      select: { id: true },
    })
  ).map((c) => c.id);

  const applications = await prisma.application.findMany({
    where: { OR: [{ studentName: 'Sample Student' }, { courseId: { in: courseIds } }] },
    select: { id: true, reference: true, studentName: true },
  });

  console.log('Would delete:' + (dryRun ? ' (dry run)' : ''));
  console.log(`  institutions : ${institutions.length} — ${institutions.map((i) => i.name).join(', ') || '(none)'}`);
  console.log(`  courses      : ${courseIds.length}`);
  console.log(
    `  applications : ${applications.length} — ${applications.map((a) => `#${a.reference} ${a.studentName}`).join(', ') || '(none)'}`
  );

  if (dryRun) return;
  if (!institutions.length && !applications.length) {
    console.log('\nNothing to prune.');
    return;
  }

  // Order matters: applications reference courses, courses reference institutions.
  // MoiAcceptance/EntryRequirement/Commission cascade from Institution.
  const result = await prisma.$transaction(async (tx) => {
    const apps = await tx.application.deleteMany({ where: { id: { in: applications.map((a) => a.id) } } });
    const crs = await tx.course.deleteMany({ where: { id: { in: courseIds } } });
    const inst = await tx.institution.deleteMany({ where: { id: { in: institutions.map((i) => i.id) } } });
    return { apps: apps.count, crs: crs.count, inst: inst.count };
  });

  console.log(`\nDeleted ${result.apps} applications, ${result.crs} courses, ${result.inst} institutions.`);
}

main()
  .catch((e) => {
    console.error('Prune failed:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * Give every existing MoiAcceptance a machine-readable programLevel.
 *
 *   docker compose -f deploy/docker-compose.prod.yml run --rm api \
 *     node ops/backfill-moi-program-level.mjs --dry-run
 *   ... --confirm
 *
 * courseType is free text an admin typed, so the same award arrived as
 * "Bachelor's Degree", "Bachelors", "BACHELOR DEGREE" and "UG". The new column
 * is what lets an MOI row be JOINED to a course; until this runs, every existing
 * row is invisible to the "MOI accepted" course filter.
 *
 * Reports what it could NOT map rather than guessing. An unmapped row is a blank
 * cell someone can fix; a wrongly-mapped one tells an agent a school accepts an
 * MOI letter for an award it does not, and nothing on any screen would show it.
 *
 * Resumable and idempotent: it only touches rows where programLevel is null, so
 * an interrupted run picks up where it stopped and a second run is a no-op.
 */

import { PrismaClient } from '@prisma/client';
import { programLevelFor } from '../src/utils/programLevelMatch.js';

const argv = process.argv;
const dryRun = argv.includes('--dry-run');
const confirm = argv.includes('--confirm');

if (!dryRun && !confirm) {
    console.error('Refusing to write without --confirm. Use --dry-run first.');
    process.exit(1);
}

const prisma = new PrismaClient();

const rows = await prisma.moiAcceptance.findMany({
    where: { programLevel: null },
    select: { id: true, courseType: true, institution: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
});

console.log(`${rows.length} MOI rows without a program level\n`);

const mapped = new Map();
const unmapped = [];

for (const row of rows) {
    const level = programLevelFor(row.courseType);
    if (!level) {
        unmapped.push(`${row.institution.name}: "${row.courseType}"`);
        continue;
    }
    if (!mapped.has(level)) mapped.set(level, []);
    mapped.get(level).push(row.id);
}

console.log('--- what maps where ---');
for (const [level, ids] of [...mapped].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(ids.length).padStart(4)}  ${level}`);
}

if (!dryRun) {
    // One updateMany per level rather than per row: at most twenty statements
    // regardless of how many rows there are.
    for (const [programLevel, ids] of mapped) {
        await prisma.moiAcceptance.updateMany({
            where: { id: { in: ids } },
            data: { programLevel },
        });
    }
}

const total = [...mapped.values()].reduce((n, ids) => n + ids.length, 0);
console.log(`\n${dryRun ? 'would set' : 'set'}: ${total}   could not map: ${unmapped.length}`);

if (unmapped.length) {
    console.log('\n--- needs a human ---');
    console.log('These keep their courseType and stay invisible to the MOI course filter');
    console.log('until someone picks a level for them on the MOI screen.\n');
    for (const u of unmapped) console.log(`  ${u}`);
}
if (dryRun) console.log('\nDry run. Nothing written.');

await prisma.$disconnect();

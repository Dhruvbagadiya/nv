/**
 * Merge one Institution row into another.
 *
 *   node scripts/merge-institutions.mjs --keep <id> --remove <id> --dry-run
 *   node scripts/merge-institutions.mjs --keep <id> --remove <id> --confirm-production
 *
 * The catalogue carries the same university under two rows in ~40 cases: two
 * feeds spelling a name differently, or a double-create in the admin UI. A
 * duplicate is not cosmetic — it splits courses, entry requirements and MOI
 * records across two pages, so an agent filtering by institution sees half the
 * catalogue and concludes the rest does not exist.
 *
 * Everything owned by --remove is repointed at --keep, then --remove is deleted.
 *
 * Three child tables are unique per institution and can therefore COLLIDE:
 * EntryRequirement is unique on (institutionId, level) and UniversityCommission
 * on institutionId, so if both rows carry one the move violates the constraint.
 * Those are reported and the merge refuses, rather than picking a winner
 * silently — which of two conflicting entry bars is correct is not something
 * this script can know. --drop-conflicts deletes the losing row's copy once a
 * human has decided that is right.
 *
 * The removed row's feed identity (source, externalId) is left behind as an
 * InstitutionAlias pointing at the survivor. Without it the merge does not
 * stick: the importer resolves a school by that pair and creates when it
 * misses, so the next sync of the losing feed rebuilds the duplicate and moves
 * its courses back. A row with no externalId (source "manual") needs no alias —
 * no importer owns it.
 *
 * Scalar fields are never copied automatically. Differences are printed so they
 * can be applied deliberately: the pair that prompted this script differed only
 * by a logoUrl pointing at a Wikimedia description PAGE rather than an image,
 * which would have rendered as a broken logo had it been carried across.
 */

import { PrismaClient } from '@prisma/client';

const argv = process.argv;
const flag = (n) => argv.includes('--' + n);
const val = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : undefined; };

const args = {
    keep: val('keep'),
    remove: val('remove'),
    dryRun: flag('dry-run'),
    confirmProduction: flag('confirm-production'),
    dropConflicts: flag('drop-conflicts'),
    note: val('note'),
    url: val('url') || process.env.DATABASE_URL,
};

// Every model with a non-null institutionId FK. ImportantUpdate and Document
// are nullable + SetNull, but are still moved: the row means "this update is
// about that university", and nulling it would lose that.
const CHILDREN = [
    { model: 'course', label: 'courses' },
    { model: 'schoolPhoto', label: 'photos' },
    { model: 'moiAcceptance', label: 'MOI acceptances' },
    { model: 'importantUpdate', label: 'important updates' },
    { model: 'document', label: 'documents' },
];

const FIELDS = ['name', 'slug', 'countryId', 'province', 'city', 'isBlacklisted',
    'logoUrl', 'bannerUrl', 'externalId', 'source', 'isTrending', 'archivedAt'];

async function main() {
    if (!args.keep || !args.remove) {
        console.error('Need --keep <id> and --remove <id>.');
        process.exit(1);
    }
    if (args.keep === args.remove) {
        console.error('--keep and --remove are the same row.');
        process.exit(1);
    }

    const target = args.url || '';
    const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(target);
    console.log('target : ' + target.replace(/:\/\/[^@]*@/, '://***@'));
    console.log('mode   : ' + (args.dryRun ? 'DRY RUN' : 'writing'));

    if (!args.dryRun && !isLocal && !args.confirmProduction) {
        console.error('\nRefusing to write to a non-local database without --confirm-production.');
        process.exit(1);
    }

    const prisma = new PrismaClient({ datasources: { db: { url: args.url } } });

    const counts = {
        select: {
            courses: true, photos: true, moiAcceptances: true,
            importantUpdates: true, documents: true, entryRequirements: true,
        },
    };
    const [keep, remove] = await Promise.all([
        prisma.institution.findUnique({
            where: { id: args.keep }, include: { _count: counts, commission: { select: { id: true } } },
        }),
        prisma.institution.findUnique({
            where: { id: args.remove }, include: { _count: counts, commission: { select: { id: true } } },
        }),
    ]);

    if (!keep) { console.error('No institution ' + args.keep); process.exit(1); }
    if (!remove) { console.error('No institution ' + args.remove); process.exit(1); }

    console.log('\nkeep   : ' + keep.name + '  /' + keep.slug + '  ' + keep.id);
    console.log('         ' + JSON.stringify(keep._count) + ' commission:' + !!keep.commission);
    console.log('remove : ' + remove.name + '  /' + remove.slug + '  ' + remove.id);
    console.log('         ' + JSON.stringify(remove._count) + ' commission:' + !!remove.commission);

    const differing = FIELDS.filter((f) => String(keep[f]) !== String(remove[f]));
    if (differing.length) {
        console.log('\nfields that differ (NOT copied — apply deliberately if wanted):');
        for (const f of differing) {
            console.log('  ' + f.padEnd(14) + ' keep=' + JSON.stringify(keep[f]) +
                '   remove=' + JSON.stringify(remove[f]));
        }
    }

    // Conflicts on the two per-institution-unique children.
    const conflicts = [];

    const removeReqs = await prisma.entryRequirement.findMany({
        where: { institutionId: remove.id }, select: { id: true, level: true },
    });
    const keepLevels = new Set(
        (await prisma.entryRequirement.findMany({
            where: { institutionId: keep.id }, select: { level: true },
        })).map((r) => r.level)
    );
    const clashingReqs = removeReqs.filter((r) => keepLevels.has(r.level));
    for (const r of clashingReqs) {
        conflicts.push('entry requirement ' + r.level + ' exists on both rows');
    }
    if (keep.commission && remove.commission) conflicts.push('both rows have a commission');

    if (conflicts.length) {
        console.log('\nconflicts:');
        conflicts.forEach((c) => console.log('  ' + c));
        if (!args.dropConflicts) {
            console.error('\nRefusing to merge. Decide which copy is correct, then re-run with' +
                ' --drop-conflicts to delete the --remove row\'s copy.');
            process.exit(1);
        }
        console.log('  --drop-conflicts given: the --remove row\'s copies will be deleted.');
    }

    if (args.dryRun) {
        console.log('\nDRY RUN — nothing written.');
        await prisma.$disconnect();
        return;
    }

    // One transaction: a half-merged institution is worse than either duplicate,
    // because children would be split across a row that no longer exists.
    const moved = await prisma.$transaction(async (tx) => {
        const out = {};

        if (args.dropConflicts) {
            if (clashingReqs.length) {
                await tx.entryRequirement.deleteMany({
                    where: { id: { in: clashingReqs.map((r) => r.id) } },
                });
                out['entry requirements dropped'] = clashingReqs.length;
            }
            if (keep.commission && remove.commission) {
                await tx.universityCommission.delete({ where: { id: remove.commission.id } });
                out['commission dropped'] = 1;
            }
        }

        for (const { model, label } of CHILDREN) {
            const r = await tx[model].updateMany({
                where: { institutionId: remove.id }, data: { institutionId: keep.id },
            });
            if (r.count) out[label] = r.count;
        }
        const reqs = await tx.entryRequirement.updateMany({
            where: { institutionId: remove.id }, data: { institutionId: keep.id },
        });
        if (reqs.count) out['entry requirements'] = reqs.count;

        if (remove.commission && !keep.commission) {
            await tx.universityCommission.update({
                where: { id: remove.commission.id }, data: { institutionId: keep.id },
            });
            out.commission = 1;
        }

        // Anything already forwarding to the removed row must now forward to
        // the survivor, or the cascade below would delete those addresses and
        // resurrect duplicates that were merged earlier.
        const rehomed = await tx.institutionAlias.updateMany({
            where: { institutionId: remove.id }, data: { institutionId: keep.id },
        });
        if (rehomed.count) out['aliases rehomed'] = rehomed.count;

        // The removed row's own identity becomes a forwarding address. Skipped
        // for a row with no externalId: "manual" rows are owned by no importer
        // and can never be re-created by one.
        if (remove.externalId != null) {
            await tx.institutionAlias.create({
                data: {
                    source: remove.source,
                    externalId: remove.externalId,
                    institutionId: keep.id,
                    note: args.note || ('merged into ' + keep.slug + ' on ' +
                        new Date().toISOString().slice(0, 10)),
                },
            });
            out['alias written'] = remove.source + ':' + remove.externalId;
        }

        await tx.institution.delete({ where: { id: remove.id } });
        return out;
    });

    console.log('\nmoved to ' + keep.slug + ': ' +
        (Object.keys(moved).length ? JSON.stringify(moved) : 'nothing (the removed row was empty)'));
    console.log('deleted  : ' + remove.name + '  /' + remove.slug);
    if (remove.externalId == null) {
        console.log('note     : no externalId, so no forwarding address was needed.');
    }

    await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });

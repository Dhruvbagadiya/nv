/**
 * Import scraped Catalogue A data from MongoDB into the portal's Postgres.
 *
 *   node scripts/import-catalogue_a.mjs --dry-run              report only, write nothing
 *   node scripts/import-catalogue_a.mjs --limit 30 --dry-run   first N schools
 *   node scripts/import-catalogue_a.mjs --truncate             wipe and rebuild (fast path)
 *   node scripts/import-catalogue_a.mjs                        incremental upsert
 *   node scripts/import-catalogue_a.mjs --schools-only         institutions + photos only
 *
 * Source : MongoDB `catalogue_a` (programs, schools), populated by the scrapers
 *          in ../../Scraping_Folder.
 * Target : whatever DATABASE_URL points at. Writing to a non-local database
 *          requires --confirm-production, because that one has real rows on it.
 *
 * Two write paths:
 *
 *   --truncate  Empties the tables this import owns, then bulk-inserts with
 *               client-generated ids. No lookups, so ~150k round trips collapse
 *               into a few hundred batched statements — minutes instead of
 *               hours over a remote connection. Use for a clean rebuild.
 *
 *   default     Matches each row first on externalId (the Catalogue A id), then
 *               on slug so a hand-curated row gets adopted rather than
 *               colliding with its unique constraint, then creates. Slower, but
 *               it preserves anything already in the database.
 *
 * UniversityCommission is never written: Catalogue A quotes commission per
 * programme while the portal stores it per institution, so importing it would
 * mean picking one programme's rate arbitrarily and overwriting whatever the
 * team negotiated. Left alone deliberately.
 */

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_CONNECTION_STRING || 'mongodb://root:root@localhost:27017';
// The Mongo database is still named for the original feed. Renaming it is a
// data move (dump, restore, drop), not a constant change, and is tracked
// separately — pointing this at a database that does not exist silently
// returns zero rows rather than failing.
const MONGO_DB = process.env.SCRAPE_DB || 'catalogue_scrape';

const argv = process.argv;
const flag = (name) => argv.includes('--' + name);
const value = (name, fallback) => {
    const i = argv.indexOf('--' + name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const args = {
    dryRun: flag('dry-run'),
    truncate: flag('truncate'),
    schoolsOnly: flag('schools-only'),
    confirmProduction: flag('confirm-production'),
    limit: Number(value('limit', 0)),
    source: value('source', null),
    // Soft-delete every row from a feed. Course and Institution already carry
    // archivedAt, and courses.service.js filters on it, so this hides a whole
    // provider from the catalogue without deleting anything: applications keep
    // resolving, and un-archiving is a single UPDATE.
    fast: flag('fast'),
    // Restrict the run to one country's schools, by ISO code. Useful for
    // re-syncing a subset without walking the whole feed: the fast path's
    // createMany({skipDuplicates}) never updates a row that already exists, so
    // rows imported before a later scrape enriched them keep their stale
    // values until an incremental run revisits them.
    iso: value('iso', null),
    archiveSource: value('archive-source', null),
    unarchiveSource: value('unarchive-source', null)
};

// Catalogue A publishes 25 distinct programme levels; the portal enum has 17.
const LEVELS = {
    masters_degree: 'MASTERS_DEGREE',
    post_graduate_certificate: 'POST_GRADUATE_CERTIFICATE',
    post_graduate_diploma: 'POST_GRADUATE_DIPLOMA',
    diploma: 'DIPLOMA',
    advanced_diploma: 'ADVANCED_DIPLOMA',
    certificate: 'CERTIFICATE',
    bachelors: 'BACHELORS_DEGREE',
    '3_year_bachelors': 'THREE_YEAR_BACHELORS',
    integrated_masters: 'INTEGRATED_MASTERS',
    doctoral_phd: 'DOCTORAL_PHD',
    topup_degree: 'TOPUP_DEGREE',
    english: 'ENGLISH',
    non_credential: 'NON_CREDENTIAL',
    // Catalogue B only: Foundation, Pre-master and the International Year /
    // Stage pathway products all land here.
    foundation: 'FOUNDATION'
};
// grade_1 … grade_12 all collapse to one level; the portal has no use for the
// individual year, and 25 enum values for 85 rows would be noise.
const levelFor = (raw) => LEVELS[raw] || (/^grade_\d+$/.test(raw || '') ? 'SECONDARY_SCHOOL' : 'OTHER');

const INTENTS = new Set(['positive', 'negative', 'neutral']);

// Tags worth promoting to display pills. The rest stay in `tags` for filtering.
const BADGES = {
    instant_offer: 'Instant Offer',
    instant_submission: 'Instant Submission',
    fast_loa: 'Fast LOA',
    scholarships_available: 'Scholarships Available',
    loan_available: 'Loan Available',
    no_visa_cap: 'No Visa Cap',
    pgwp_available: 'PGWP'
};

const dec = (v) => (v == null || Number.isNaN(Number(v)) ? 0 : Number(v));
const dateOrNull = (v) => (v ? new Date(v) : null);

// Both feeds, already reshaped to the same field layout by
// Scraping_Folder/scripts/Catalogue B-normalize.js. Separate Mongo
// collections because the two use overlapping integer ids.
// Rows the scrapers have marked as superseded. A school merged into another
// keeps its documents so the scrape record stays intact, but must not become a
// second institution in the portal; likewise a course marked duplicateOf is a
// repeat of one already imported under the canonical school.
const LIVE_SCHOOL = { mergedInto: { $exists: false } };
const LIVE_PROGRAM = { duplicateOf: { $exists: false } };

// `source` must match the values in the database. They were renamed away from
// the upstream vendor names, and the Mongo collection names are kept as they
// are for now: those live on one machine and renaming them is a data move, not
// a string change.
const SOURCES = [
    { source: 'catalogue_a', schools: 'schools', programs: 'programs' },
    { source: 'catalogue_b', schools: 'ia_schools', programs: 'ia_programs' }
];

const MONTH_TAG = {
    1: 'intake_jan', 2: 'intake_feb', 3: 'intake_mar', 4: 'intake_apr',
    5: 'intake_may', 6: 'intake_jun', 7: 'intake_jul', 8: 'intake_aug',
    9: 'intake_sep', 10: 'intake_oct', 11: 'intake_nov', 12: 'intake_dec'
};
const MONTH_LABEL = {
    1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
    7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'
};

/** Whichever variant this feed stored its R2 logo under. */
const logoUrlOf = (s) =>
    s.logo?.original?.r2Url || s.logo?.small?.r2Url ||
    s.logoThumbnailUrl || s.logo?.original?.url || null;

const BATCH = { institution: 500, schoolPhoto: 2000, course: 1000, courseIntake: 4000 };

function institutionRow(school, countryId, id, source) {
    const d = school.detail || {};
    return {
        ...(id ? { id } : {}),
        name: school.name,
        slug: school.slug,
        countryId,
        province: school.province ?? d.province ?? null,
        city: school.city ?? d.city ?? null,
        logoUrl: logoUrlOf(school),
        // Catalogue B publishes no banners, so NZ schools have none.
        bannerUrl: school.bannerFile?.r2Url || null,
        externalId: school._id,
        source
    };
}

function photoRows(school, institutionId, source) {
    return (school.photoFiles || [])
        .filter((p) => p.r2Url)
        .map((p, i) => ({
            institutionId,
            source,
            externalId: p.photoId ?? null,
            url: p.r2Url,
            thumbnailUrl: p.r2Url,
            fileName: p.file ?? null,
            contentType: p.contentType ?? null,
            bytes: p.bytes ?? null,
            position: i
        }));
}

function courseRow(prog, institutionId, level, id, source) {
    const tags = [...(prog.tags || [])];

    // Catalogue B publishes intake months with no year ("Feb,Jul"), so there
    // are no dates to build CourseIntake rows from. Surfacing them as tags and
    // badges keeps the information without inventing a deadline a student might
    // act on.
    for (const m of prog.intakeMonths || []) {
        if (MONTH_TAG[m]) tags.push(MONTH_TAG[m]);
    }
    // applicationFee is a non-null Decimal, so an unknown fee has to be stored
    // as 0. This tag is what keeps "unknown" distinguishable from "free".
    if (prog.applicationFee == null) tags.push('fee_unknown');

    const badges = tags.map((t) => BADGES[t]).filter(Boolean);
    for (const m of prog.intakeMonths || []) {
        if (MONTH_LABEL[m]) badges.push(MONTH_LABEL[m] + ' intake');
    }

    return {
        ...(id ? { id } : {}),
        institutionId,
        source,
        title: prog.name || 'Untitled programme',
        shortName: prog.shortName ?? null,
        slug: prog.slug,
        programLevel: level,
        minLength: prog.minLength ?? 0,
        maxLength: prog.maxLength ?? 0,
        languageOfInstruction: prog.languageOfInstructionCode || 'eng',
        tuitionFee: dec(prog.tuition),
        // Null falls back to Country.currencyCode at display time. Only
        // Catalogue B publishes a per-course currency; Catalogue A does not.
        currencyCode: prog.currencyCode ?? null,
        // dec() would turn an unpublished fee into 0, which reads as free.
        applicationFee: prog.applicationFee == null ? null : dec(prog.applicationFee),
        commissionAmount: prog.commissionAmount == null ? null : dec(prog.commissionAmount),
        abAppCreationEnabled: Boolean(prog.abAppCreationEnabled),
        successScoreIntent: INTENTS.has(prog.successScore?.intent) ? prog.successScore.intent : null,
        successScoreLabel: prog.successScore?.label ?? null,
        tags,
        badges,
        // Only Catalogue B publishes these; Catalogue A rows leave them null.
        externalUrl: prog.weblink ?? null,
        entryRequirements: prog.entryRequirements ?? undefined,
        externalId: prog._id
    };
}

function intakeRows(prog, courseId) {
    return (prog.programIntakes || [])
        .filter((i) => i.startDateAt || i.startDate)
        .map((i) => ({
            courseId,
            startDate: new Date(i.startDateAt || i.startDate),
            openDate: dateOrNull(i.openDateAt || i.openDate),
            submissionDeadline: dateOrNull(i.submissionDeadlineAt || i.submissionDeadline),
            overallScore: i.overallScore ?? null,
            scoreDetails: i.scoreDetails || []
        }));
}

async function flush(prisma, model, rows) {
    const size = BATCH[model];
    for (let i = 0; i < rows.length; i += size) {
        await prisma[model].createMany({ data: rows.slice(i, i + size), skipDuplicates: true });
    }
}

// --------------------------------------------------------------- write paths

async function bulkImport(prisma, db, schools, countryByIso, stats, levelCounts, feed) {
    const instRows = [];
    const photos = [];
    const idBySchool = new Map();

    // --fast runs the batched path without truncating, for a feed whose rows are
    // all new. Anything already present (from an interrupted run) is reused by
    // externalId, and createMany({skipDuplicates}) drops the rest. That turns
    // ~25k round trips into a few dozen batches, which matters on a connection
    // that keeps dropping.
    if (args.fast) {
        const existing = await prisma.institution.findMany({
            where: { source: feed.source },
            select: { id: true, externalId: true }
        });
        for (const e of existing) if (e.externalId != null) idBySchool.set(e.externalId, e.id);

        // Merged identities resolve to the surviving row, so --fast attaches to
        // it rather than re-creating the duplicate it was merged into.
        const aliases = await prisma.institutionAlias.findMany({
            where: { source: feed.source },
            select: { externalId: true, institutionId: true }
        });
        for (const a of aliases) idBySchool.set(a.externalId, a.institutionId);

        if (existing.length) console.log('  reusing ' + existing.length + ' institutions already present' +
            (aliases.length ? ', ' + aliases.length + ' merged into another row' : ''));
    }

    for (const school of schools) {
        const countryId = countryByIso.get(school.countryCode);
        if (!countryId) { stats.instSkipped++; continue; }
        if (idBySchool.has(school._id)) continue; // already in the database
        const id = crypto.randomUUID();
        idBySchool.set(school._id, id);
        instRows.push(institutionRow(school, countryId, id, feed.source));
        photos.push(...photoRows(school, id, feed.source));
    }

    await flush(prisma, 'institution', instRows);
    stats.instCreated = instRows.length;
    await flush(prisma, 'schoolPhoto', photos);
    stats.photos = photos.length;
    console.log('  institutions ' + instRows.length + ' + photos ' + photos.length + ' inserted');

    if (args.schoolsOnly) return;

    let courseBuf = [];
    let intakeBuf = [];

    const drain = async () => {
        // Courses must land before the intakes that reference them.
        await flush(prisma, 'course', courseBuf);
        stats.courseCreated += courseBuf.length;
        courseBuf = [];
        await flush(prisma, 'courseIntake', intakeBuf);
        stats.intakes += intakeBuf.length;
        intakeBuf = [];
    };

    const cursor = db.collection(feed.programs).find(LIVE_PROGRAM).batchSize(2000);
    for await (const prog of cursor) {
        const institutionId = idBySchool.get(prog.schoolId);
        if (!institutionId) { stats.courseSkipped++; continue; }

        const level = levelFor(prog.programLevel);
        levelCounts[level] = (levelCounts[level] || 0) + 1;

        const courseId = crypto.randomUUID();
        courseBuf.push(courseRow(prog, institutionId, level, courseId, feed.source));
        intakeBuf.push(...intakeRows(prog, courseId));

        if (courseBuf.length >= BATCH.course * 5) {
            await drain();
            console.log('  courses ' + stats.courseCreated + ', intakes ' + stats.intakes);
        }
    }
    if (courseBuf.length || intakeBuf.length) await drain();
}

async function incrementalImport(prisma, db, schools, countryByIso, stats, levelCounts, feed) {
    let done = 0;

    for (const school of schools) {
        const countryId = countryByIso.get(school.countryCode);
        if (!countryId) { stats.instSkipped++; continue; }

        const data = institutionRow(school, countryId, null, feed.source);
        let institution = await prisma.institution.findUnique({ where: { source_externalId: { source: feed.source, externalId: school._id } } });

        if (institution) {
            await prisma.institution.update({ where: { id: institution.id }, data });
            stats.instUpdated++;
        } else {
            // This feed identity may have been merged into another row. Without
            // this lookup the miss above fell straight through to create(), so
            // every institution merge was undone by the next sync: the
            // duplicate came back and its courses moved onto it.
            const alias = await prisma.institutionAlias.findUnique({
                where: { source_externalId: { source: feed.source, externalId: school._id } },
                select: { institutionId: true }
            });
            const merged = alias
                ? await prisma.institution.findUnique({ where: { id: alias.institutionId } })
                : null;

            if (merged) {
                // Deliberately NOT updated with `data`. The surviving row's
                // name, slug, source and externalId belong to the feed that
                // owns it; writing this feed's copy over them would rename the
                // row on every sync and collide on the unique slug. Only the
                // children below attach here.
                institution = merged;
                stats.instMerged++;
            } else {
                const bySlug = await prisma.institution.findUnique({ where: { slug: school.slug } });
                if (bySlug) {
                    institution = await prisma.institution.update({ where: { id: bySlug.id }, data });
                    stats.instAdopted++;
                } else {
                    institution = await prisma.institution.create({ data });
                    stats.instCreated++;
                }
            }
        }

        // Photos are wholly owned by the import, so replace rather than merge.
        const photos = photoRows(school, institution.id, feed.source);
        // Scoped by source. After a merge one institution carries photos from
        // both feeds, and an unscoped delete meant each sync wiped the other
        // feed's gallery and the two fought on every run.
        await prisma.schoolPhoto.deleteMany({ where: { institutionId: institution.id, source: feed.source } });
        if (photos.length) {
            await flush(prisma, 'schoolPhoto', photos);
            stats.photos += photos.length;
        }

        if (!args.schoolsOnly) {
            const programs = await db.collection(feed.programs).find({ schoolId: school._id, ...LIVE_PROGRAM }).toArray();
            for (const prog of programs) {
                const level = levelFor(prog.programLevel);
                levelCounts[level] = (levelCounts[level] || 0) + 1;
                const cdata = courseRow(prog, institution.id, level, null, feed.source);

                let course = await prisma.course.findUnique({ where: { source_externalId: { source: feed.source, externalId: prog._id } } });
                if (course) {
                    await prisma.course.update({ where: { id: course.id }, data: cdata });
                    stats.courseUpdated++;
                } else {
                    const bySlug = await prisma.course.findUnique({ where: { slug: prog.slug } });
                    if (bySlug) {
                        course = await prisma.course.update({ where: { id: bySlug.id }, data: cdata });
                        stats.courseAdopted++;
                    } else {
                        course = await prisma.course.create({ data: cdata });
                        stats.courseCreated++;
                    }
                }

                const intakes = intakeRows(prog, course.id);
                await prisma.courseIntake.deleteMany({ where: { courseId: course.id } });
                if (intakes.length) {
                    await flush(prisma, 'courseIntake', intakes);
                    stats.intakes += intakes.length;
                }
            }
        }

        if (++done % 25 === 0) {
            console.log('  ' + done + '/' + schools.length + ' schools, courses ' +
                (stats.courseCreated + stats.courseAdopted + stats.courseUpdated) +
                ', intakes ' + stats.intakes);
        }
    }
}

/**
 * Soft-delete the portal rows for anything the scrapers have since marked as
 * superseded. Without this a school merged into another stays in the catalogue
 * as a live institution with no courses, because the import simply stops
 * visiting it -- absence from the feed is not itself a signal to remove
 * anything, since a failed scrape looks identical.
 *
 * archivedAt rather than delete: applications must keep resolving their course,
 * and a merge decision should be reversible.
 */
async function archiveSuperseded(prisma, db, feeds) {
    const now = new Date();
    for (const feed of feeds) {
        const merged = await db.collection(feed.schools)
            .find({ mergedInto: { $exists: true } }, { projection: { _id: 1 } }).toArray();
        const dupes = await db.collection(feed.programs)
            .find({ duplicateOf: { $exists: true } }, { projection: { _id: 1 } }).toArray();
        if (!merged.length && !dupes.length) continue;

        const i = merged.length ? await prisma.institution.updateMany({
            where: { source: feed.source, externalId: { in: merged.map((d) => d._id) }, archivedAt: null },
            data: { archivedAt: now }
        }) : { count: 0 };

        const c = dupes.length ? await prisma.course.updateMany({
            where: { source: feed.source, externalId: { in: dupes.map((d) => d._id) }, archivedAt: null },
            data: { archivedAt: now }
        }) : { count: 0 };

        if (i.count || c.count) {
            console.log('  archived superseded: ' + i.count + ' institution(s), ' + c.count + ' course(s)');
        }
    }
}

async function planOnly(db, schools, countryByIso, stats, levelCounts, feed) {
    for (const school of schools) {
        if (!countryByIso.has(school.countryCode)) { stats.instSkipped++; continue; }
        stats.instCreated++;
        stats.photos += (school.photoFiles || []).filter((p) => p.r2Url).length;

        if (args.schoolsOnly) continue;
        const programs = await db.collection(feed.programs)
            .find({ schoolId: school._id, ...LIVE_PROGRAM }, { projection: { programLevel: 1, programIntakes: 1 } }).toArray();
        for (const prog of programs) {
            const level = levelFor(prog.programLevel);
            levelCounts[level] = (levelCounts[level] || 0) + 1;
            stats.courseCreated++;
            stats.intakes += intakeRows(prog, 'x').length;
        }
    }
}

// -------------------------------------------------------------------- report

async function report(prisma, stats, levelCounts) {
    console.log('\n--- institutions ---');
    console.log('  created  : ' + stats.instCreated);
    console.log('  adopted  : ' + stats.instAdopted + '   (matched a curated row by slug)');
    console.log('  merged   : ' + stats.instMerged + '   (forwarded to a surviving row via InstitutionAlias)');
    console.log('  updated  : ' + stats.instUpdated);
    console.log('  skipped  : ' + stats.instSkipped + '   (no Country row for their ISO code)');
    console.log('  photos   : ' + stats.photos);
    console.log('--- courses ---');
    console.log('  created  : ' + stats.courseCreated);
    console.log('  adopted  : ' + stats.courseAdopted);
    console.log('  updated  : ' + stats.courseUpdated);
    console.log('  skipped  : ' + stats.courseSkipped);
    console.log('  intakes  : ' + stats.intakes);
    console.log('--- programme levels ---');
    for (const [k, v] of Object.entries(levelCounts).sort((a, b) => b[1] - a[1])) {
        console.log('  ' + k.padEnd(26) + v);
    }

    if (!args.dryRun) {
        console.log('\n--- database now holds ---');
        console.log('  institutions : ' + (await prisma.institution.count()));
        console.log('  courses      : ' + (await prisma.course.count()));
        console.log('  intakes      : ' + (await prisma.courseIntake.count()));
        console.log('  photos       : ' + (await prisma.schoolPhoto.count()));
        console.log('  with a logo  : ' + (await prisma.institution.count({ where: { logoUrl: { not: null } } })));
        console.log('  with a banner: ' + (await prisma.institution.count({ where: { bannerUrl: { not: null } } })));
    }
}

// ---------------------------------------------------------------------- main

async function main() {
    const target = process.env.DATABASE_URL || '';
    const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(target);

    console.log('target   : ' + target.replace(/:\/\/[^@]*@/, '://***@'));
    console.log('mode     : ' + (args.dryRun ? 'DRY RUN (no writes)' : args.truncate ? 'TRUNCATE + BULK INSERT' : 'incremental upsert'));

    if (!args.dryRun && !isLocal && !args.confirmProduction) {
        console.error('\nRefusing to write to a non-local database without --confirm-production.');
        console.error('Run --dry-run first, read the plan, then re-run with the flag if it looks right.');
        process.exit(1);
    }

    const prisma = new PrismaClient();

    // Archive / un-archive a whole feed, then stop. No Mongo needed.
    if (args.archiveSource || args.unarchiveSource) {
        const src = args.archiveSource || args.unarchiveSource;
        const archivedAt = args.archiveSource ? new Date() : null;
        const verb = args.archiveSource ? 'Archiving' : 'Un-archiving';
        console.log('\n' + verb + ' everything from source "' + src + '"');

        const c = await prisma.course.updateMany({ where: { source: src }, data: { archivedAt } });
        const i = await prisma.institution.updateMany({ where: { source: src }, data: { archivedAt } });
        console.log('  courses      : ' + c.count);
        console.log('  institutions : ' + i.count);

        const liveCourses = await prisma.course.count({ where: { archivedAt: null } });
        const liveInst = await prisma.institution.count({ where: { archivedAt: null } });
        console.log('\nstill visible in the catalogue: ' + liveCourses + ' courses, ' + liveInst + ' institutions');
        await prisma.$disconnect();
        return;
    }

    const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    await mongo.connect();
    const db = mongo.db(MONGO_DB);

    // Countries are keyed on ISO: the portal's own `code` is a shorthand
    // (UK, GR, SP, UAE, IR) that does not match the scraped country codes.
    const countries = await prisma.country.findMany();
    const countryByIso = new Map(countries.filter((c) => c.isoCode).map((c) => [c.isoCode, c.id]));
    console.log('countries: ' + countryByIso.size + ' usable (' + [...countryByIso.keys()].join(', ') + ')');

    // One entry per feed, each with its own Mongo collections.
    const feeds = args.source ? SOURCES.filter((f) => f.source === args.source) : SOURCES;
    if (!feeds.length) {
        console.error('Unknown --source. Known: ' + SOURCES.map((f) => f.source).join(', '));
        process.exit(1);
    }

    const schoolsByFeed = new Map();
    for (const feed of feeds) {
        let list = await db.collection(feed.schools).find(LIVE_SCHOOL).sort({ _id: 1 }).toArray();
        if (args.iso) list = list.filter((s2) => s2.countryCode === args.iso);
        if (args.limit) list = list.slice(0, args.limit);
        schoolsByFeed.set(feed.source, list);
        console.log('  ' + feed.source.padEnd(13) + list.length + ' schools from ' + feed.schools);

        const missing = new Set(list.filter((s) => !countryByIso.has(s.countryCode)).map((s) => s.countryCode));
        if (missing.size) {
            console.log('    WARNING: no Country row for ISO code(s): ' + [...missing].join(', ') +
                ' — those schools and their programmes will be SKIPPED');
        }
    }

    if (args.truncate && !args.dryRun) {
        const before = {
            applications: await prisma.application.count(),
            intakes: await prisma.courseIntake.count(),
            courses: await prisma.course.count(),
            photos: await prisma.schoolPhoto.count(),
            commissions: await prisma.universityCommission.count(),
            institutions: await prisma.institution.count()
        };
        console.log('\nTRUNCATE — deleting ' + JSON.stringify(before));
        // Order matters: children before parents.
        await prisma.application.deleteMany({});
        await prisma.courseIntake.deleteMany({});
        await prisma.course.deleteMany({});
        await prisma.schoolPhoto.deleteMany({});
        await prisma.universityCommission.deleteMany({});
        await prisma.institution.deleteMany({});
        console.log('cleared (countries kept)\n');
    }

    const stats = {
        instCreated: 0, instAdopted: 0, instUpdated: 0, instSkipped: 0, instMerged: 0, photos: 0,
        courseCreated: 0, courseAdopted: 0, courseUpdated: 0, courseSkipped: 0, intakes: 0
    };
    const levelCounts = {};

    const started = Date.now();
    for (const feed of feeds) {
        const schools = schoolsByFeed.get(feed.source);
        console.log('\n[' + feed.source + '] ' + schools.length + ' schools');
        if (args.dryRun) await planOnly(db, schools, countryByIso, stats, levelCounts, feed);
        else if (args.truncate || args.fast) await bulkImport(prisma, db, schools, countryByIso, stats, levelCounts, feed);
        else await incrementalImport(prisma, db, schools, countryByIso, stats, levelCounts, feed);
    }

    if (!args.dryRun) await archiveSuperseded(prisma, db, feeds);

    await report(prisma, stats, levelCounts);
    console.log('\nelapsed: ' + ((Date.now() - started) / 1000).toFixed(1) + 's');

    await mongo.close();
    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error(err);
    process.exit(1);
});

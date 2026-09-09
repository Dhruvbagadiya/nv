/**
 * Scraped UG/PG entry requirements -> the portal's EntryRequirement table.
 *
 *   node scripts/import-requirements.mjs --dry-run
 *   node scripts/import-requirements.mjs --confirm-production
 *
 * The model and the admin screen for this have existed since the schema was
 * written; the table was empty.
 *
 * Matching is the whole difficulty. Unlike the MOI feed, the requirements pages
 * publish a bare institution NAME with no id, so there is no (source, externalId)
 * pair to join on. Names are matched exactly after normalisation, plus a small
 * table of aliases that were each checked by hand against the portal's row.
 * Nothing is matched fuzzily: an entry requirement filed against the wrong
 * university is worse than one that is missing, because it reads as authoritative
 * and an agent would act on it. Anything unmatched is printed, not guessed.
 */

import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_CONNECTION_STRING || 'mongodb://localhost:27017';
const MONGO_DB = process.env.SCRAPE_DB || 'catalogue_scrape';

const argv = process.argv;
const flag = (n) => argv.includes('--' + n);
const val = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : undefined; };
// .env points at the cluster's VPC-private host, which only resolves from the
// droplet. Run from a workstation, pass the public hostname for the same
// cluster with --url; on the server, omit it and .env is used.
const args = {
    dryRun: flag('dry-run'),
    confirmProduction: flag('confirm-production'),
    url: val('url') || process.env.DATABASE_URL,
    // Create an Institution for a name the portal does not have. Off by default:
    // it adds a row to the public catalogue, which is a product decision, not a
    // data repair.
    createMissing: flag('create-missing'),
    // Required alongside --create-missing. The requirements tables carry no
    // country column, and every row scraped so far is UK — but defaulting to UK
    // would silently misfile the first row that is not.
    country: val('country'),
};

/** URL-safe slug, matching backend/src/utils/slug.js exactly. */
const slugify = (str) => String(str ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Must stay identical to the scraper's, or nothing joins. */
const nameKey = (s) => String(s == null ? '' : s)
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Source name -> the portal's name for the same institution. Every pair here
 * was confirmed by looking up the portal row, not inferred from string
 * similarity. Add to it rather than loosening the matcher.
 */
const ALIASES = new Map(Object.entries({
    // The portal carries the campus in the name; the source does not. Verified
    // as the only "University of Derby" row in the portal.
    'University of Derby': 'University of Derby - Derby',
}).map(([k, v]) => [nameKey(k), nameKey(v)]));

async function main() {
    const target = args.url || '';
    const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(target);
    console.log('target : ' + target.replace(/:\/\/[^@]*@/, '://***@'));
    console.log('mode   : ' + (args.dryRun ? 'DRY RUN' : 'writing'));

    if (!args.dryRun && !isLocal && !args.confirmProduction) {
        console.error('\nRefusing to write to a non-local database without --confirm-production.');
        process.exit(1);
    }

    if (args.createMissing && !args.country) {
        console.error('\n--create-missing needs --country <code> (e.g. --country UK).');
        process.exit(1);
    }

    const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    await mongo.connect();
    const rows = await mongo.db(MONGO_DB).collection('ia_requirements').find({}).toArray();
    console.log('scraped records : ' + rows.length);

    const prisma = new PrismaClient({ datasources: { db: { url: args.url } } });
    const institutions = await prisma.institution.findMany({
        select: { id: true, name: true, source: true },
    });

    // A name can repeat across the two feeds. The requirements come from
    // catalogue_b, so its row wins; otherwise the first is used and the
    // collision is reported, because picking silently is how the wrong
    // university ends up with the wrong entry bar.
    const byName = new Map();
    const ambiguous = new Set();
    for (const inst of institutions) {
        const key = nameKey(inst.name);
        const seen = byName.get(key);
        if (!seen) { byName.set(key, inst); continue; }
        ambiguous.add(inst.name);
        if (inst.source === 'catalogue_b' && seen.source !== 'catalogue_b') byName.set(key, inst);
    }
    console.log('institutions    : ' + byName.size + ' distinct names of ' + institutions.length);

    const resolve = (row) => byName.get(ALIASES.get(row.nameKey) ?? row.nameKey) ?? null;

    let country = null;
    if (args.createMissing) {
        country = await prisma.country.findFirst({
            where: { code: args.country },
            select: { id: true, name: true, code: true },
        });
        if (!country) {
            console.error('\nNo country with code ' + args.country + '.');
            process.exit(1);
        }
        console.log('new rows go to : ' + country.name + ' (' + country.code + '), source "manual"');
    }

    const takenSlugs = new Set(
        (await prisma.institution.findMany({ select: { slug: true } })).map((i) => i.slug)
    );

    /**
     * source "manual" is what the schema documents for a hand-created row, and
     * it is the truth here: these have no id in any feed, so no importer should
     * later claim or overwrite them.
     */
    async function createInstitution(row) {
        let slug = slugify(row.institution);
        for (let n = 2; takenSlugs.has(slug); n++) slug = slugify(row.institution) + '-' + n;
        takenSlugs.add(slug);

        const inst = await prisma.institution.create({
            data: { name: row.institution, slug, countryId: country.id, source: 'manual' },
            select: { id: true, name: true, source: true, slug: true },
        });
        // So the row's other level resolves to the institution just created
        // rather than creating a second copy of it.
        byName.set(row.nameKey, inst);
        return inst;
    }

    const stats = { created: 0, updated: 0, unmatched: 0, institutionsCreated: 0 };
    const missing = new Map();
    const born = [];

    for (const row of rows) {
        let inst = resolve(row);

        if (!inst && args.createMissing) {
            if (args.dryRun) {
                // Not created, so nothing to resolve the second level against;
                // count the institution once and the row as importable.
                if (!born.includes(row.institution)) {
                    born.push(row.institution);
                    stats.institutionsCreated++;
                }
                stats.created++;
                continue;
            }
            inst = await createInstitution(row);
            stats.institutionsCreated++;
            born.push(inst.name + '  ->  /' + inst.slug);
        }

        if (!inst) {
            stats.unmatched++;
            missing.set(row.institution, (missing.get(row.institution) || []).concat(row.level));
            continue;
        }

        const data = {
            institutionId: inst.id,
            level: row.level,
            englishRequirement: row.englishRequirement,
            academicRequirement: row.academicRequirement,
            offerTimeline: row.offerTimeline,
            // Non-null with a default. The scraper leaves it null only when the
            // cell said something other than Yes/No, which it never has.
            credibilityInterview: row.credibilityInterview ?? false,
            financialInformation: row.financialInformation,
        };

        if (args.dryRun) { stats.created++; continue; }

        // (institutionId, level) is unique, so this is a plain upsert and a
        // re-run after a re-scrape refreshes rather than duplicates.
        const existing = await prisma.entryRequirement.findUnique({
            where: { institutionId_level: { institutionId: inst.id, level: row.level } },
            select: { id: true },
        });
        if (existing) {
            await prisma.entryRequirement.update({ where: { id: existing.id }, data });
            stats.updated++;
        } else {
            await prisma.entryRequirement.create({ data });
            stats.created++;
        }
    }

    if (born.length) {
        console.log('\ninstitutions created (' + stats.institutionsCreated + '):');
        born.forEach((b) => console.log('  ' + b));
    }
    console.log('\ncreated   : ' + stats.created);
    console.log('updated   : ' + stats.updated);
    console.log('unmatched : ' + stats.unmatched);

    if (missing.size) {
        console.log('\nno institution in the portal matches these names:');
        for (const [name, levels] of [...missing].sort()) {
            console.log('  ' + name + '  [' + levels.join(', ') + ']');
        }
    }
    if (ambiguous.size) {
        console.log('\nduplicate institution names in the portal (catalogue_b preferred): ' +
            [...ambiguous].join(', '));
    }

    await mongo.close();
    await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });

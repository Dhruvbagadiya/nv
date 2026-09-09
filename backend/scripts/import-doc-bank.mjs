/**
 * Scraped Document Bank -> the portal's Document table.
 *
 *   node scripts/import-doc-bank.mjs --dry-run --url <public db url>
 *   node scripts/import-doc-bank.mjs --confirm-production --url <public db url>
 *
 * The Document model, its five categories, five routed agent screens and the
 * admin editor have all existed since the schema was written. Every one of them
 * rendered empty because no row was ever loaded.
 *
 * Files are re-hosted by the scraper
 * (Scraping_Folder/scripts/catalogue-b-docbank.js --upload), which puts them in
 * our own bucket and records the public URL as `r2Url` — the same shape school
 * logos and photos already use. This reads that URL. A record without one is
 * reported and skipped rather than imported pointing at the source's server:
 * these are the templates an agent sends to a student, and they must not depend
 * on someone else's host.
 *
 * Rows are matched on fileUrl, NOT on (category, title). Two different SOP
 * files are both titled "Project Management", so a title match would collapse
 * them into a single row and lose one.
 */

import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_CONNECTION_STRING || 'mongodb://localhost:27017';
const MONGO_DB = process.env.SCRAPE_DB || 'catalogue_scrape';

const argv = process.argv;
const flag = (n) => argv.includes('--' + n);
const val = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : undefined; };
const args = {
    dryRun: flag('dry-run'),
    confirmProduction: flag('confirm-production'),
    url: val('url') || process.env.DATABASE_URL,
};

async function main() {
    const target = args.url || '';
    const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(target);
    console.log('target : ' + target.replace(/:\/\/[^@]*@/, '://***@'));
    console.log('mode   : ' + (args.dryRun ? 'DRY RUN' : 'writing'));

    if (!args.dryRun && !isLocal && !args.confirmProduction) {
        console.error('\nRefusing to write to a non-local database without --confirm-production.');
        process.exit(1);
    }

    const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    await mongo.connect();
    const rows = await mongo.db(MONGO_DB).collection('ia_docbank')
        .find({}).sort({ category: 1, _id: 1 }).toArray();
    console.log('scraped records : ' + rows.length);

    const prisma = new PrismaClient({ datasources: { db: { url: args.url } } });

    const stats = { created: 0, updated: 0, notHosted: 0 };
    const order = {};
    const missing = [];

    for (const row of rows) {
        if (!row.r2Url) {
            stats.notHosted++;
            missing.push(row.category + ': ' + row.title);
            continue;
        }

        // sortOrder preserves the source's own ordering within a category, which
        // is the order an agent is used to seeing these in.
        order[row.category] = (order[row.category] || 0) + 1;

        const data = {
            category: row.category,
            title: row.title,
            fileUrl: row.r2Url,
            sortOrder: order[row.category],
            // The listing is unfiltered and has no country or institution
            // column, so there is nothing to attribute. Left null rather than
            // guessed; the admin screen can set them later.
            countryId: null,
            institutionId: null,
            archivedAt: null,
        };

        if (args.dryRun) { stats.created++; continue; }

        const existing = await prisma.document.findFirst({
            where: { fileUrl: row.r2Url }, select: { id: true },
        });
        if (existing) {
            await prisma.document.update({ where: { id: existing.id }, data });
            stats.updated++;
        } else {
            await prisma.document.create({ data });
            stats.created++;
        }
    }

    console.log('\ncreated    : ' + stats.created);
    console.log('updated    : ' + stats.updated);
    console.log('not hosted : ' + stats.notHosted);
    if (missing.length) {
        console.log('\nno r2Url — run the scraper with --upload first:');
        missing.slice(0, 10).forEach((m) => console.log('  ' + m));
        if (missing.length > 10) console.log('  ... and ' + (missing.length - 10) + ' more');
    }

    await mongo.close();
    await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });

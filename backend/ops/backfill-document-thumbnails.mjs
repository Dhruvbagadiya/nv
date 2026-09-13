/**
 * Render a thumbnail for every Document Bank PDF that does not have one.
 *
 *   docker compose -f deploy/docker-compose.prod.yml run --rm api \
 *     node ops/backfill-document-thumbnails.mjs --dry-run
 *   ... --confirm
 *
 * MUST run inside the api container, for the same two reasons the uploads
 * migration does: pdftoppm is installed there and nowhere else, and this is the
 * only place holding the storage credentials.
 *
 * New uploads get a thumbnail at upload time. This is for the 87 that were
 * already in the bucket when that started.
 *
 * Resumable by construction: it only looks at rows where thumbnailUrl is null,
 * so an interrupted run picks up where it stopped and a second run is a no-op.
 * One document at a time rather than in parallel — poppler is a subprocess per
 * file, and eighty of them at once on a shared box is how a deploy gets blamed
 * for an unrelated outage.
 */

import { PrismaClient } from '@prisma/client';
import { config } from '../src/config.js';
import { putGeneratedObject } from '../src/utils/storage.js';
import { renderPdfThumbnail, thumbnailKeyFor } from '../src/utils/pdfThumbnail.js';

const argv = process.argv;
const dryRun = argv.includes('--dry-run');
const confirm = argv.includes('--confirm');

if (!dryRun && !confirm) {
    console.error('Refusing to write without --confirm. Use --dry-run first.');
    process.exit(1);
}

const prisma = new PrismaClient();

/** The stored key, whether the URL is a CDN one or a local /uploads/ path. */
function keyFromUrl(url) {
    const base = config.storage.publicBaseUrl;
    if (base && url.startsWith(`${base}/`)) return url.slice(base.length + 1);
    if (url.startsWith('/uploads/')) return url.slice('/uploads/'.length);
    return null;
}

const docs = await prisma.document.findMany({
    where: { archivedAt: null, thumbnailUrl: null },
    select: { id: true, title: true, fileUrl: true },
    orderBy: { createdAt: 'asc' },
});

console.log(`${docs.length} documents without a thumbnail\n`);

let done = 0;
const problems = [];

for (const doc of docs) {
    const key = keyFromUrl(doc.fileUrl);
    if (!key || !key.toLowerCase().endsWith('.pdf')) {
        // Not skipped silently: a Document Bank entry that is not a PDF, or whose
        // URL points somewhere this cannot read, is worth knowing about.
        problems.push(`${doc.title}: ${!key ? 'URL is not in the bucket' : 'not a PDF'} (${doc.fileUrl})`);
        continue;
    }

    if (dryRun) {
        console.log(`  would render ${doc.title}`);
        done++;
        continue;
    }

    // Fetched over HTTPS rather than read from disk, because after the uploads
    // migration these live in the bucket and the container has no copy.
    let buffer;
    try {
        const res = await fetch(doc.fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
    } catch (e) {
        problems.push(`${doc.title}: could not fetch — ${e.message}`);
        continue;
    }

    const jpeg = await renderPdfThumbnail(buffer);
    if (!jpeg) {
        // Left null rather than retried or faked. The grid falls back to the
        // tile, which is exactly what it did before this existed.
        problems.push(`${doc.title}: poppler produced nothing`);
        continue;
    }

    const { fileUrl } = await putGeneratedObject(jpeg, {
        key: thumbnailKeyFor(key),
        contentType: 'image/jpeg',
    });
    await prisma.document.update({ where: { id: doc.id }, data: { thumbnailUrl: fileUrl } });
    done++;
    if (done % 10 === 0) console.log(`  ${done}/${docs.length}…`);
}

console.log(`\n${dryRun ? 'would render' : 'rendered'}: ${done}   skipped: ${problems.length}`);
if (problems.length) {
    console.log('\n--- needs a look ---');
    for (const p of problems) console.log(`  ${p}`);
}
if (dryRun) console.log('\nDry run. Nothing rendered, nothing written.');

await prisma.$disconnect();

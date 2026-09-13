/**
 * Move every file already written to local disk into the bucket, and repoint the
 * database at it.
 *
 *   docker compose -f deploy/docker-compose.prod.yml run --rm api \
 *     node ops/migrate-uploads-to-r2.mjs --dry-run
 *   ... --confirm
 *
 * MUST run inside the api container: the files live in the `uploads` named
 * volume, which is mounted at /app/uploads there and exists nowhere else.
 *
 * Hence backend/ops/ rather than either of the obvious homes. backend/scripts/
 * is gitignored, so it is not in the droplet's checkout and `COPY . .` never
 * sees it; deploy/ is outside the api build context, which is ../backend. This
 * directory is for operational scripts that have to ship inside the image.
 *
 * Run it AFTER the S3_* variables are in backend/.env.production, because it
 * refuses to start unless storage is configured: writing to disk while trying to
 * empty the disk would be a no-op that reported success.
 *
 * The existing key is preserved rather than a new one generated. The move is
 * then a pure prefix swap -- "/uploads/<key>" becomes "<publicBaseUrl>/<key>" --
 * which makes it idempotent (re-running overwrites the same object), trivial to
 * verify, and safe to stop halfway: every row is either fully moved or fully
 * untouched.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { config } from '../src/config.js';

const argv = process.argv;
const dryRun = argv.includes('--dry-run');
const confirm = argv.includes('--confirm');

if (!dryRun && !confirm) {
    console.error('Refusing to write without --confirm. Use --dry-run first.');
    process.exit(1);
}
if (!config.storage.enabled) {
    console.error(
        '\nStorage is not configured, so there is nowhere to move these files to.\n'
        + 'Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in\n'
        + 'backend/.env.production first, then restart the api container.\n'
    );
    process.exit(1);
}

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const PREFIX = '/uploads/';

/**
 * Every column that can hold an upload URL.
 *
 * Listed explicitly rather than discovered, because a column this misses is a
 * file left behind on a disk that is about to stop being served -- and a silent
 * partial migration is the worst outcome here. Checked against the schema:
 * grep for `String` columns whose name ends in Url, plus SchoolPhoto.url.
 */
const COLUMNS = [
    ['user', 'avatarUrl'],
    ['agencyProfile', 'logoUrl'],
    ['institution', 'logoUrl'],
    ['institution', 'bannerUrl'],
    ['schoolPhoto', 'url'],
    ['schoolPhoto', 'thumbnailUrl'],
    ['document', 'fileUrl'],
    ['applicationDocument', 'fileUrl'],
    ['importantUpdate', 'attachmentUrl'],
    ['moiAcceptance', 'documentUrl'],
    ['supportContact', 'avatarUrl'],
];

// The extension decides the type on the way back out. The bytes were validated
// against ALLOWED when they were first uploaded, so this is about serving them
// with the right Content-Type, not about deciding whether to accept them.
const CONTENT_TYPES = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
};

const prisma = new PrismaClient();
const s3 = new S3Client({
    region: config.storage.region,
    ...(config.storage.endpoint && { endpoint: config.storage.endpoint, forcePathStyle: true }),
    credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
    },
});

let moved = 0;
let missing = 0;
let skipped = 0;
const problems = [];

for (const [model, column] of COLUMNS) {
    const rows = await prisma[model].findMany({
        where: { [column]: { startsWith: PREFIX } },
        select: { id: true, [column]: true },
    });
    if (!rows.length) continue;

    console.log(`\n${model}.${column}: ${rows.length} on local disk`);

    for (const row of rows) {
        const key = row[column].slice(PREFIX.length);
        const ext = path.extname(key).toLowerCase();
        const contentType = CONTENT_TYPES[ext];

        if (!contentType) {
            // Not guessed at: an object served as the wrong type is a bug that
            // only shows up in someone's browser weeks later.
            problems.push(`${model}.${column} ${row.id}: unknown extension "${ext}"`);
            skipped++;
            continue;
        }

        let body;
        try {
            body = await readFile(path.join(UPLOAD_ROOT, key));
        } catch {
            // The row points at a file that is not on this disk. Reported rather
            // than repaired: the fix depends on why, and rewriting the URL to a
            // bucket object that does not exist would hide the problem.
            problems.push(`${model}.${column} ${row.id}: no file at uploads/${key}`);
            missing++;
            continue;
        }

        const target = `${config.storage.publicBaseUrl}/${key}`;
        if (dryRun) {
            console.log(`  would move ${key}  (${(body.length / 1024).toFixed(0)} KB)`);
            moved++;
            continue;
        }

        await s3.send(new PutObjectCommand({
            Bucket: config.storage.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        }));
        // Only after the object is in the bucket. The other order would leave a
        // row pointing at nothing if the upload failed.
        await prisma[model].update({ where: { id: row.id }, data: { [column]: target } });
        moved++;
    }
}

console.log(`\n${dryRun ? 'would move' : 'moved'}: ${moved}   missing file: ${missing}   skipped: ${skipped}`);
if (problems.length) {
    console.log('\n--- needs a look ---');
    for (const p of problems) console.log(`  ${p}`);
}
if (dryRun) console.log('\nDry run. Nothing uploaded, nothing rewritten.');

await prisma.$disconnect();

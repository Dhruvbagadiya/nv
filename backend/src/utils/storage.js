import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { S3Client } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';
import { BadRequestError, HttpError } from './httpErrors.js';

// Presigned uploads: the browser sends the file straight to the bucket and the API
// only signs the request. The alternative — proxying the bytes through Express —
// makes every upload consume an API worker for the duration of the transfer and
// caps file size at whatever the body limit is.
//
// NOTE: this path is UNTESTED against a real bucket. It was written without
// credentials, gated behind config.storage.enabled so nothing breaks while it is
// unconfigured. Treat the first real upload as the actual test.

// Anything a browser could be tricked into executing, or that the five Document
// Bank categories have no use for, is refused. An allow-list, not a deny-list:
// deny-lists for upload types are how stored-XSS happens.
const ALLOWED = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  // Avatars and logos accept webp; it was missing here only because this map
  // was written for the Document Bank before those two paths existed.
  'image/webp': '.webp',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

// Avatars and logos: images only, and much smaller. Exported so the two callers
// share one definition instead of each keeping their own drifting copy.
export const IMAGE_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MAX_BYTES   = 2 * 1024 * 1024;

// backend/uploads — the directory app.js serves at /uploads.
const LOCAL_UPLOAD_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads'
);

let client;
function getClient() {
  if (!config.storage.enabled) {
    // 503, not 500: the server is fine, the feature simply is not configured, and
    // the message says which variables are missing.
    throw new HttpError(
      503,
      'File uploads are not configured. Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.'
    );
  }
  client ??= new S3Client({
    region: config.storage.region,
    ...(config.storage.endpoint && { endpoint: config.storage.endpoint }),
    credentials: {
      accessKeyId: config.storage.accessKeyId,
      secretAccessKey: config.storage.secretAccessKey,
    },
    // R2 rejects virtual-hosted addressing on the S3 API endpoint.
    ...(config.storage.endpoint && { forcePathStyle: true }),
  });
  return client;
}

// The client's filename is never used as the key. It is attacker-controlled and
// could contain path traversal, and two agents uploading "form.pdf" must not
// collide. A random key plus the validated extension avoids both; the original
// name is kept as the Document's title, where it is only ever displayed.
function buildKey({ category, contentType, allowed = ALLOWED }) {
  const ext = allowed[contentType];
  // `category` reaches here from a request body, and putObject joins the key
  // onto a filesystem path when storage is unconfigured — so an unsanitised
  // "../../.." would write outside backend/uploads entirely. Reduced to a single
  // safe path segment: anything that is not [a-z0-9_-] is dropped, and an empty
  // result falls back rather than producing a leading "/".
  const folder = String(category ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'misc';
  return `${folder}/${crypto.randomUUID()}${ext}`;
}

export async function createUploadUrl({ filename, contentType, size, category }) {
  if (!ALLOWED[contentType]) {
    throw new BadRequestError(
      `Unsupported file type "${contentType}". Allowed: ${Object.keys(ALLOWED).join(', ')}`
    );
  }
  if (size != null && size > MAX_BYTES) {
    throw new BadRequestError(`File is too large. Maximum is ${MAX_BYTES / 1024 / 1024} MB.`);
  }
  // Defence in depth — the extension is derived from the validated contentType, so
  // a mismatched filename cannot smuggle one through.
  const declaredExt = path.extname(filename ?? '').toLowerCase();
  if (declaredExt && declaredExt !== ALLOWED[contentType]) {
    throw new BadRequestError(
      `File extension "${declaredExt}" does not match its type "${contentType}".`
    );
  }

  const key = buildKey({ category, contentType });

  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: config.storage.presignTtlSeconds }
  );

  return {
    uploadUrl,
    key,
    // What gets stored in Document.fileUrl. Deliberately an opaque string in the
    // schema so this can change without a migration.
    fileUrl: `${config.storage.publicBaseUrl}/${key}`,
    expiresInSeconds: config.storage.presignTtlSeconds,
    // Echoed back so the client sends exactly the header the signature covers —
    // a mismatch makes S3 reject the PUT with an opaque 403.
    requiredHeaders: { 'Content-Type': contentType },
  };
}

// Server-side upload: the bytes arrive at the API and this decides where they
// land. Presigned uploads (above) need a configured bucket; this one works
// either way, which is what makes S3-vs-disk a deployment flag rather than a
// code change.
//
// It exists because POST /documents/upload wrote to disk with fs.writeFileSync
// directly. That bypassed the ALLOWED map, so the endpoint accepted .html, .svg
// and .exe — the stored-XSS hole the presigned path takes care to avoid — and it
// pinned documents to one box's filesystem regardless of S3 being configured.
// `allowed` and `maxBytes` are per-call because the three upload paths have
// genuinely different rules: a 25 MB PDF is a fine document and a terrible
// avatar. Defaults are the Document Bank's.
export async function putObject(
  buffer,
  { filename, contentType, category, maxBytes = MAX_BYTES, allowed = ALLOWED }
) {
  if (!allowed[contentType]) {
    throw new BadRequestError(
      `Unsupported file type "${contentType}". Allowed: ${Object.keys(allowed).join(', ')}`
    );
  }
  if (buffer.length > maxBytes) {
    throw new BadRequestError(`File is too large. Maximum is ${maxBytes / 1024 / 1024} MB.`);
  }
  const declaredExt = path.extname(filename ?? '').toLowerCase();
  if (declaredExt && declaredExt !== allowed[contentType]) {
    throw new BadRequestError(
      `File extension "${declaredExt}" does not match its type "${contentType}".`
    );
  }

  const key = buildKey({ category, contentType, allowed });

  if (config.storage.enabled) {
    await getClient().send(
      new PutObjectCommand({
        Bucket: config.storage.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return { key, fileUrl: `${config.storage.publicBaseUrl}/${key}`, storage: 's3' };
  }

  // Local disk. Served by the express.static mount on /uploads in app.js.
  // Fine for a single box; on anything containerised or multi-instance these
  // files do not survive a restart and are not shared, so configure storage.
  const dir = path.join(LOCAL_UPLOAD_ROOT, path.dirname(key));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(LOCAL_UPLOAD_ROOT, key), buffer);

  return { key, fileUrl: `/uploads/${key}`, storage: 'local' };
}

export const storageStatus = () => ({
  enabled: config.storage.enabled,
  maxBytes: MAX_BYTES,
  allowedContentTypes: Object.keys(ALLOWED),
  // Which backend a server-side upload would actually use right now.
  destination: config.storage.enabled ? 's3' : 'local-disk',
});

import crypto from 'node:crypto';
import path from 'node:path';
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
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

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
function buildKey({ category, contentType }) {
  const ext = ALLOWED[contentType];
  const folder = String(category ?? 'misc').toLowerCase();
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

export const storageStatus = () => ({
  enabled: config.storage.enabled,
  maxBytes: MAX_BYTES,
  allowedContentTypes: Object.keys(ALLOWED),
});

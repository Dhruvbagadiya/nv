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
  'image/gif': '.gif',
  'image/avif': '.avif',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

// Exported because multer has to reject an oversized upload BEFORE the bytes are
// buffered, which means every route with a file input needs this number. It was
// re-declared in uploads.routes.js under a comment saying "matches MAX_BYTES in
// storage.js" — which is the comment you write just before the two stop matching.
export const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Avatars, logos and banners. Exported so the callers share one definition
 * instead of each keeping their own drifting copy.
 *
 * GIF and AVIF are here because a logo arrives in whatever the sender's tool
 * exported, and refusing a perfectly ordinary raster format teaches people to
 * go and convert files by hand.
 *
 * SVG IS DELIBERATELY ABSENT, and will stay absent. An SVG is an XML document,
 * not an image: it can carry <script>, and these files are served from the same
 * origin as the portal, so accepting one is stored XSS with an upload form in
 * front of it. The way to allow SVG is to sanitise it server-side or to serve
 * uploads from a separate origin — not to add a line here.
 *
 * HEIC is absent for a different reason: it is what an iPhone produces by
 * default, and accepting it would work right up until the logo renders, because
 * only Safari can draw one in an <img>. It gets its own message rather than the
 * generic one, since "unsupported" is unhelpful when the user's phone chose the
 * format for them.
 */
export const IMAGE_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

/** Types worth a specific message instead of "use PNG, JPEG or WebP". */
export const IMAGE_TYPE_ADVICE = {
  'image/svg+xml':
    'SVG can carry scripts, so it is not accepted. Export the logo as PNG at 512px or larger.',
  'image/heic': 'iPhone HEIC photos will not display in a browser. Change the format to JPEG in Settings › Camera › Formats, or export as JPEG.',
  'image/heif': 'HEIF images will not display in a browser. Export as JPEG or PNG instead.',
  'image/tiff': 'TIFF images will not display in a browser. Export as PNG or JPEG instead.',
  'image/bmp': 'BMP files are very large and poorly supported. Export as PNG instead.',
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
/**
 * Cache headers for an uploaded object.
 *
 * Every key this module writes is `<folder>/<uuid>.<ext>` and nothing ever
 * overwrites one — a replacement logo is a new uuid and a new row. So the bytes
 * behind a URL genuinely never change, which is exactly what `immutable` means:
 * the browser does not even send a revalidation request.
 *
 * Without this, R2 serves no Cache-Control at all, so every logo, banner,
 * thumbnail and document is re-fetched or at best re-validated on every page
 * load — a round trip per image, for bytes the client already has.
 *
 * A year rather than forever because that is the largest value the spec defines;
 * `immutable` is what actually does the work.
 */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

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
      CacheControl: IMMUTABLE_CACHE_CONTROL,
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
    // Both, because both are covered by the signature: a client that sends one
    // and not the other gets an opaque 403.
    requiredHeaders: {
      'Content-Type': contentType,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL,
    },
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
        CacheControl: IMMUTABLE_CACHE_CONTROL,
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

/**
 * Store bytes this server generated, at a key it chose.
 *
 * putObject is for a file a USER handed us: it validates the content type,
 * checks the declared extension, and invents a random key. None of that applies
 * to a thumbnail — we produced the JPEG, we know what it is, and the key has to
 * be derivable from the original's so the pair stays together.
 *
 * Kept beside putObject rather than inlined at the call site because it has the
 * same local-disk fallback, and that branch is the thing that must not drift
 * between the two.
 */
export async function putGeneratedObject(buffer, { key, contentType }) {
  if (config.storage.enabled) {
    await getClient().send(
      new PutObjectCommand({
        Bucket: config.storage.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: IMMUTABLE_CACHE_CONTROL,
      })
    );
    return { key, fileUrl: `${config.storage.publicBaseUrl}/${key}`, storage: 's3' };
  }

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

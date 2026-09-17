import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createUploadUrl, storageStatus } from '../src/utils/storage.js';

// These run with storage UNCONFIGURED, which is the point: every validation rule
// has to fire before the code reaches the S3 client, or a misconfigured server
// would report "not configured" for requests that were invalid anyway — and,
// worse, a configured one would sign URLs for file types it should refuse.

const valid = { filename: 'form.pdf', contentType: 'application/pdf', size: 1024 };

describe('upload validation', () => {
  it('reports storage as disabled without credentials', () => {
    const status = storageStatus();
    expect(status.enabled).toBe(false);
    expect(status.allowedContentTypes).toContain('application/pdf');
  });

  // An allow-list, not a deny-list. Deny-lists for upload types are how stored-XSS
  // happens — SVG in particular executes script when served inline.
  it.each([
    ['image/svg+xml', 'svg'],
    ['text/html', 'html'],
    ['application/x-msdownload', 'exe'],
    ['application/javascript', 'js'],
  ])('refuses %s', async (contentType) => {
    await expect(createUploadUrl({ ...valid, contentType })).rejects.toMatchObject({ status: 400 });
  });

  it.each(['application/pdf', 'image/png', 'image/jpeg'])('allows %s', async (contentType) => {
    // Passes validation, then fails on the missing config — a 503, not a 400. That
    // ordering is the assertion: the type was accepted.
    await expect(
      createUploadUrl({ filename: undefined, contentType, size: 1024 })
    ).rejects.toMatchObject({ status: 503 });
  });

  it('enforces the size cap before signing anything', async () => {
    await expect(
      createUploadUrl({ ...valid, size: 200 * 1024 * 1024 })
    ).rejects.toMatchObject({ status: 400 });
  });

  // Defence in depth: the stored extension comes from the validated contentType, so
  // a mismatched filename cannot smuggle one through.
  it('refuses a filename whose extension contradicts its declared type', async () => {
    await expect(
      createUploadUrl({ filename: 'payload.exe', contentType: 'application/pdf', size: 10 })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('accepts a matching extension', async () => {
    await expect(createUploadUrl(valid)).rejects.toMatchObject({ status: 503 });
  });

  it('explains which variables are missing rather than throwing a bare 500', async () => {
    await expect(createUploadUrl(valid)).rejects.toThrow(/S3_BUCKET/);
  });
});

describe('cache headers on uploads', () => {
  /**
   * Every key this module writes is `<folder>/<uuid>.<ext>` and nothing ever
   * overwrites one — a replacement logo is a new uuid and a new row. So the
   * bytes behind a URL genuinely never change, which is exactly what
   * `immutable` means: the browser does not even send a revalidation request.
   *
   * Without it R2 serves no Cache-Control at all, so every logo, banner,
   * thumbnail and document costs a round trip on every page load for bytes the
   * client already has.
   */
  it('marks stored objects immutable for a year', async () => {
    const { IMMUTABLE_CACHE_CONTROL } = await import('../src/utils/storage.js');

    expect(IMMUTABLE_CACHE_CONTROL).toContain('immutable');
    expect(IMMUTABLE_CACHE_CONTROL).toContain('public');
    // A year is the largest value the spec defines; `immutable` does the work.
    expect(IMMUTABLE_CACHE_CONTROL).toContain('31536000');
  });

  // The signature covers the headers, so a client that sends Content-Type and
  // not Cache-Control gets an opaque 403 from the bucket.
  it('tells a presigned client every header the signature covers', async () => {
    const storage = await import('../src/utils/storage.js');
    const source = readFileSync(
      new URL('../src/utils/storage.js', import.meta.url),
      'utf8'
    );

    const presign = source.slice(source.indexOf('export async function createUploadUrl'));
    const signed = presign.slice(0, presign.indexOf('requiredHeaders'));

    // Whatever the signed command sets, requiredHeaders has to echo.
    expect(signed).toContain('CacheControl');
    expect(presign).toContain("'Cache-Control': IMMUTABLE_CACHE_CONTROL");
    expect(storage.IMMUTABLE_CACHE_CONTROL).toBeTruthy();
  });
});

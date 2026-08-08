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

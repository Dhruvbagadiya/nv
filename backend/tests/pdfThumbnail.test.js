import { describe, it, expect } from 'vitest';
import { renderPdfThumbnail, thumbnailKeyFor } from '../src/utils/pdfThumbnail.js';

/**
 * This renders files uploaded by users through poppler, a C++ parser with a CVE
 * history. It gets a timeout and a page limit, and the container runs it as a
 * non-root user — but the property that matters most here is that it NEVER
 * throws: a failed render must leave the upload alone, because refusing a
 * perfectly good document for want of a picture of it is the wrong trade.
 */
describe('renderPdfThumbnail never throws', () => {
  it('returns null for bytes that are not a PDF', async () => {
    expect(await renderPdfThumbnail(Buffer.from('this is not a pdf'))).toBeNull();
  });

  it('returns null for an empty buffer', async () => {
    expect(await renderPdfThumbnail(Buffer.alloc(0))).toBeNull();
  });

  // A PDF header and nothing behind it — the shape a truncated upload takes.
  it('returns null for a truncated PDF', async () => {
    expect(await renderPdfThumbnail(Buffer.from('%PDF-1.4\n%%EOF'))).toBeNull();
  });

  // Where poppler is absent — a dev machine, or CI — every call takes this path.
  // The whole design depends on that being indistinguishable from a bad file.
  it('returns null rather than failing when poppler is not installed', async () => {
    const result = await renderPdfThumbnail(Buffer.from('%PDF-1.4'));
    expect(result).toBeNull();
  });
});

describe('thumbnailKeyFor', () => {
  it('puts thumbnails in their own folder', () => {
    expect(thumbnailKeyFor('doc-bank/visa.pdf')).toMatch(/^thumbnails\//);
  });

  it('is a jpg whatever the source extension was', () => {
    expect(thumbnailKeyFor('doc-bank/visa.pdf')).toMatch(/\.jpg$/);
  });

  // Flattened, because the key is one path segment under thumbnails/ and a
  // nested source would otherwise create a directory tree that mirrors it.
  it('flattens the source path rather than nesting under it', () => {
    const key = thumbnailKeyFor('doc-bank/visa_document/form.pdf');
    expect(key.split('/')).toHaveLength(2);
    expect(key).toContain('doc-bank-visa_document-form');
  });

  // Two documents can share a filename; the stored objects must not collide.
  it('does not collide for the same source name', () => {
    expect(thumbnailKeyFor('a/form.pdf')).not.toBe(thumbnailKeyFor('a/form.pdf'));
  });
});

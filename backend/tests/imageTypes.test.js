import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMAGE_TYPES, IMAGE_TYPE_ADVICE } from '../src/utils/storage.js';

/**
 * What an image upload accepts, and why it is one list.
 *
 * There were three: the Document Bank's map, the agency logo's, and the avatar
 * route's own array — and they had already drifted. The avatar route was still
 * PNG/JPEG/WebP after GIF and AVIF were added elsewhere, so the same file an
 * admin could upload as a school logo was refused as their own profile picture,
 * with a message naming a different list.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'src');

function filesUnder(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) filesUnder(p, out);
    else if (entry.endsWith('.js')) out.push(p);
  }
  return out;
}

describe('image upload types', () => {
  it('accepts the ordinary raster formats a logo actually arrives in', () => {
    expect(Object.keys(IMAGE_TYPES).sort()).toEqual([
      'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp',
    ]);
  });

  /**
   * The one entry that must never be added. An SVG is an XML document, not an
   * image: it can carry <script>, and uploads are served from the portal's own
   * origin, so accepting one is stored XSS with an upload form in front of it.
   * Allowing SVG means sanitising server-side or serving uploads from a separate
   * origin — never just a line in the map.
   */
  it('refuses SVG, and says why rather than calling it "unsupported"', () => {
    expect(IMAGE_TYPES['image/svg+xml']).toBeUndefined();
    expect(IMAGE_TYPE_ADVICE['image/svg+xml']).toMatch(/script/i);
  });

  // An iPhone picks HEIC on the user's behalf, and only Safari can draw one in
  // an <img> — so it would upload cleanly and then render as a broken image.
  it('tells an iPhone user what to do about HEIC', () => {
    expect(IMAGE_TYPES['image/heic']).toBeUndefined();
    expect(IMAGE_TYPE_ADVICE['image/heic']).toMatch(/JPEG/);
  });

  it('is the only list — no route keeps its own copy', () => {
    const offenders = filesUnder(SRC)
      .filter((file) => {
        const src = readFileSync(file, 'utf8');
        if (file.endsWith(join('utils', 'storage.js'))) return false;
        // A hand-written array or object of image mime types, anywhere other
        // than the one place that defines them. A lone `contentType:
        // 'image/jpeg'` is not a list — it is one value being written, which is
        // what the PDF thumbnail renderer does with its output.
        return src.split('\n').some(
          (line) => /['"]image\/(png|jpeg|webp)['"]\s*[,:\]]/.test(line) && !/contentType/.test(line)
        );
      })
      .map((f) => relative(SRC, f));

    expect(offenders, 'these keep their own image allow-list, which is how the three drifted apart').toEqual([]);
  });
});

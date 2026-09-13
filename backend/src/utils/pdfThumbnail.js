import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * First page of a PDF, as a small JPEG.
 *
 * The Document Bank rendered 87 identical PDF glyphs, so the grid told a reader
 * nothing except the title — and the titles are things like "FD Cover Letter"
 * and "Loan Cover Letter", which are distinguishable on sight and not much by
 * name.
 *
 * WHY POPPLER RATHER THAN pdfjs-dist. The obvious alternative is rendering in
 * the browser, which needs the client to FETCH each PDF cross-origin — the CDN
 * sends no Access-Control-Allow-Origin, so every tile would be blocked, and one
 * of these files is 2.5 MB, so twenty tiles would be 50 MB of downloads to draw
 * twenty small pictures. Rendering once on the server turns that into a 15 KB
 * image per tile, cached at the edge, that works on a phone.
 *
 * The Node-side alternative is pdfjs-dist plus a canvas implementation, which
 * means native bindings in the image and a build that breaks whenever the base
 * image moves. `pdftoppm` is a 15 MB apt package and a subprocess.
 *
 * SAFETY. This renders files uploaded by users, and poppler is a C++ parser with
 * a CVE history, so it gets a hard timeout and a page limit, and the container
 * already runs it as a non-root user. A render that fails, hangs or produces
 * nothing returns null: a missing thumbnail is a tile that looks like today's,
 * and refusing the upload because a preview could not be drawn would be the
 * wrong trade entirely.
 */

const TIMEOUT_MS = 15_000;
// 40 DPI puts an A4 page at roughly 330x470, which is more than a 150px tile
// needs and leaves room for a retina one.
const DPI = 40;
const MAX_OUTPUT_BYTES = 400 * 1024;

export async function renderPdfThumbnail(buffer) {
  let dir;
  try {
    dir = await mkdtemp(path.join(tmpdir(), 'pdfthumb-'));
    const input = path.join(dir, 'in.pdf');
    // A fixed name inside a directory this process just created, so nothing the
    // caller supplies reaches a path.
    const outRoot = path.join(dir, 'out');

    await writeFile(input, buffer);

    await run(
      'pdftoppm',
      [
        '-jpeg', '-jpegopt', 'quality=72',
        '-r', String(DPI),
        // First page only. Without -f/-l a 200-page prospectus renders 200
        // images before anyone notices.
        '-f', '1', '-l', '1',
        // Writes exactly <outRoot>.jpg rather than <outRoot>-1.jpg, so the name
        // does not depend on how poppler zero-pads the page number.
        '-singlefile',
        input, outRoot,
      ],
      { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 }
    );

    const jpeg = await readFile(`${outRoot}.jpg`);
    if (!jpeg.length || jpeg.length > MAX_OUTPUT_BYTES) return null;
    return jpeg;
  } catch {
    // Deliberately quiet about the reason. The three causes — poppler absent, a
    // PDF it cannot parse, a render that ran past the timeout — all lead to the
    // same place, and the caller's only sensible response to any of them is to
    // carry on without a thumbnail.
    return null;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** A stored object key for the thumbnail of `key`, in its own folder. */
export function thumbnailKeyFor(key) {
  const base = key.replace(/\.[^./]+$/, '').replace(/\//g, '-');
  return `thumbnails/${base}-${crypto.randomBytes(4).toString('hex')}.jpg`;
}

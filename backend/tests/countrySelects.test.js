import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A country select that names `flagEmoji` must also name `isoCode`.
 *
 * `isoCode` was added to Country as a column, but the seven older selects that
 * list their country fields explicitly were never updated — so those endpoints
 * returned a country object with no ISO code in it, and the flag component fell
 * back to a grey text chip. Singapore rendered as "SG" in the applications table
 * while the country strip on the same page showed the flag, because the strip
 * reads the countries endpoint, whose select was written later and has it.
 *
 * `flagEmoji` is the marker rather than the word "country", because it is the
 * field that says "this select is feeding a flag". A select that asks for the
 * emoji and not the ISO code is asking for the fallback that does not work on
 * Windows and skipping the one that does.
 *
 * Silent in every direction: a missing select field is `undefined`, and
 * `undefined` renders as a tidy chip that looks deliberate.
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

describe('country selects carry the ISO code', () => {
  const lines = filesUnder(SRC).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .map((text, i) => ({ text, file: relative(SRC, file), line: i + 1 }))
      .filter(({ text }) => text.includes('flagEmoji'))
  );

  it('found the selects, so a rename cannot silently empty this test', () => {
    expect(lines.length).toBeGreaterThan(5);
  });

  it('every one of them also selects isoCode', () => {
    const missing = lines
      // countries.service.js writes its select across several lines, and has
      // isoCode on its own; this scan is line-by-line, so that one is matched
      // by the file rather than the line.
      .filter(({ text, file }) => !text.includes('isoCode') && !readFileSync(join(SRC, file), 'utf8').includes('isoCode: true,\n'))
      .map(({ file, line }) => `${file}:${line}`);

    expect(
      missing,
      'these endpoints return a country with no ISO code, so every flag drawn '
        + 'from them falls back to a grey text chip'
    ).toEqual([]);
  });
});

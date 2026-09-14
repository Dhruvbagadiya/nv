import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every <Flag> must be given `isoCode`.
 *
 * Singapore rendered as a grey "SG" chip in the applications table while the
 * country strip three inches above it showed the flag correctly. Same component,
 * same country, same page.
 *
 * The cause was two halves of one omission. `isoCode` was added to Country as a
 * column, but the older `select`s that name their country fields explicitly were
 * never updated — so seven endpoints returned a country object without it. And
 * nine call sites compensated by passing `emoji` instead, which Flag decodes
 * back into an ISO code. That works only for countries whose `flagEmoji` is
 * populated; Singapore's is not, so it fell through to the code chip.
 *
 * Neither half fails loudly. A missing `select` field is `undefined`, a missing
 * prop is `undefined`, and Flag's fallback is a tidy grey chip that looks
 * deliberate. This is the frontend half; countrySelects.test.js is the other.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..');

function filesUnder(dir, test, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) filesUnder(p, test, out);
    else if (test(entry)) out.push(p);
  }
  return out;
}

/** Each `<Flag … />` element, as the text between the tag name and its close. */
function flagElements(src) {
  const out = [];
  // `<Flag\s`, not `<Flag\b`: CountryStrip's docblock contains the literal text
  // "<Flag>" and a word-boundary match picks the prose up as a call site.
  for (const m of src.matchAll(/<Flag\s/g)) {
    // Scan forward to the matching `/>`, which for this component is always
    // self-closing. Nothing inside a Flag contains one, so the first wins.
    const end = src.indexOf('/>', m.index);
    if (end > 0) out.push(src.slice(m.index, end));
  }
  return out;
}

describe('every Flag gets an isoCode', () => {
  const elements = filesUnder(SRC, (f) => /\.jsx$/.test(f) && !/\.test\./.test(f))
    .flatMap((file) => flagElements(readFileSync(file, 'utf8')).map((el) => ({ el, file: relative(SRC, file) })));

  it('found the call sites, so a broken regex cannot pass this file', () => {
    expect(elements.length).toBeGreaterThan(10);
  });

  it('passes isoCode everywhere, not emoji alone', () => {
    const missing = elements
      .filter(({ el }) => !/\bisoCode=/.test(el))
      .map(({ el, file }) => `${file}: ${el.replace(/\s+/g, ' ').trim()}`);

    expect(
      missing,
      'these render a grey code chip instead of a flag for any country whose '
        + 'flagEmoji is null — which is not visible until you look at that one country'
    ).toEqual([]);
  });
});

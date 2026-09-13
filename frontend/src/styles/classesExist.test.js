import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Does every class the JSX asks for actually exist in a stylesheet?
 *
 * `.chip` was deleted along with the dashboard filter block it happened to sit
 * inside, and three screens lost their styling with nothing to show for it: an
 * unstyled <button> still works, it just renders as a grey OS button in the
 * middle of a designed page. Nothing failed, no test broke, and it reached
 * production — the quick filters, the Document Bank's category tabs and the
 * UG/PG switch all shipped looking like a 1998 form.
 *
 * This is the same shape as the earlier cardAlignment and relatedKeys guards: a
 * relationship between two files that nothing checks at build time, whose
 * failure mode is silence.
 *
 * Deliberately one-directional. It asserts every class USED has a definition; it
 * does NOT assert every class defined is used, because an unused rule is dead
 * weight rather than a broken screen, and that direction is full of false
 * positives from state classes applied by JS.
 *
 * And it flags an ELEMENT, not a class. `className="form-field file-field"` is
 * fine with no `.file-field` rule — the element is styled, and the second name
 * is a BEM hook for rules that may come later. What broke was different and
 * worse: `.chip` was the ONLY class on those buttons, so losing it left nothing
 * at all and the browser drew its own. An element where NOTHING resolves is the
 * failure this catches; a spare hook beside a real class is not.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..');

function filesUnder(dir, test, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) filesUnder(p, test, out);
    else if (test(entry)) out.push(p);
  }
  return out;
}

/**
 * Every class selector defined anywhere in the stylesheets.
 *
 * All of src/, not just src/styles/: BoardingAnimation keeps its CSS beside the
 * component, and scanning only the shared directory reported its whole class
 * family as undefined.
 */
const defined = (() => {
  const set = new Set();
  for (const file of filesUnder(SRC, (f) => f.endsWith('.css'))) {
    const css = readFileSync(file, 'utf8');
    for (const [, cls] of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) set.add(cls);
  }
  return set;
})();

/**
 * Classes that come from somewhere other than our stylesheets, or are built at
 * runtime from data. Each needs a reason: the value of this test is that the
 * list stays short.
 */
const SVG_STRUCTURE = new Set(['g', 'defs', 'svg', 'symbol', 'use', 'clipPath', 'mask', 'pattern']);

const NOT_OURS = new Set([
  // Applied by react-day-picker / third-party widgets, styled by their own CSS.
  'rdp',
  // Utility names kept for markup clarity that intentionally carry no rule.
  'sr-only',
]);

/**
 * Static className attributes on DOM elements, as the SETS they are written in.
 *
 * Only lowercase tags. A className passed to a COMPONENT is a prop, and the
 * component is free to compose it with classes of its own — `<Reveal
 * className="lp-section-note">` renders with `lp-reveal` beside it, so judging
 * that element on the prop alone reports a styled element as orphaned. A
 * lowercase tag is a real DOM element and what is written is all it gets.
 *
 * The tag is found by scanning BACK to the opening `<`, not by matching forward
 * from it: JSX attributes routinely contain `>` inside arrow functions, so
 * `<div[^>]*className` stops in the wrong place on any element with a handler.
 */
const elements = (() => {
  const out = [];
  const files = filesUnder(SRC, (f) => /\.jsx?$/.test(f) && !/\.test\./.test(f));

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
      const openedAt = src.lastIndexOf('<', m.index);
      if (openedAt < 0) continue;
      const tag = src.slice(openedAt + 1).match(/^([A-Za-z][\w.-]*)/)?.[1];
      // Uppercase (or dotted, like Foo.Bar) means a component, not an element.
      if (!tag || tag[0] !== tag[0].toLowerCase()) continue;
      // SVG structure carries classes for grouping and for JS to hang events on,
      // and needs no rule to look right — a <g> draws nothing of its own.
      if (SVG_STRUCTURE.has(tag)) continue;

      const classes = (m[1] ?? m[2] ?? m[3] ?? '')
        .split(/\$\{[^}]*\}|\s+/)
        .map((x) => x.trim())
        .filter((x) => /^[a-zA-Z][\w-]*$/.test(x));
      if (classes.length) out.push({ classes, file: relative(SRC, file), tag });
    }
  }
  return out;
})();

describe('no element falls back to browser defaults', () => {
  it('parsed both sides, so a silent regex failure cannot pass this file', () => {
    expect(defined.size).toBeGreaterThan(200);
    expect(elements.length).toBeGreaterThan(200);
    // The one this was written for.
    expect(defined.has('chip')).toBe(true);
  });

  it('every element resolves at least one of its classes', () => {
    const orphans = elements
      .filter(({ classes }) => classes.every((c) => !defined.has(c) && !NOT_OURS.has(c)))
      .map(({ classes, file }) => `${file}: className="${classes.join(' ')}"`);

    expect(
      [...new Set(orphans)],
      'these elements have no rule behind any of their classes, so they render as '
        + 'browser defaults in the middle of a designed page'
    ).toEqual([]);
  });
});

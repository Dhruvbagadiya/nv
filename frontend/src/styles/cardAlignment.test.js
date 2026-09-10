import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = (f) => readFileSync(join(here, f), 'utf8');

// jsdom has no layout engine, so visual alignment cannot be asserted by rendering.
// What CAN be asserted is the invariant that produces it: a card is a flex column
// whose last block is pushed down with margin-top:auto, inside a grid whose rows
// stretch. Break any one of those and the buttons drift apart again — which is
// exactly the bug this guards.

function rule(text, selector) {
  const m = text.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
}

describe('card action alignment', () => {
  const components = css('components.css');
  const student = css('student.css');

  it('the course card is a flex column that fills its grid cell', () => {
    const card = rule(components, '.pcard');
    expect(card).toMatch(/flex-direction:\s*column/);
    // height:100% is what makes the card take the whole stretched grid cell;
    // without it the card is only as tall as its content and there is no spare
    // room for margin-top:auto to distribute.
    expect(card).toMatch(/height:\s*100%/);
  });

  // The actual fix: without this the price block and everything under it simply
  // follow the content, so a card with fewer highlights puts its button higher
  // than its neighbours.
  it('pins the course card cost block, and so its buttons, to the bottom', () => {
    expect(rule(components, '.pcard__price')).toMatch(/margin-top:\s*auto/);
  });

  // Two auto margins in the same column split the slack between them, which
  // leaves a gap above the price block and undoes the alignment above.
  it('uses exactly one auto top margin inside the card', () => {
    const inCard = components.match(/\.pcard[\w-]*[^{]*\{[^}]*margin-top:\s*auto[^}]*\}/g) ?? [];
    expect(inCard).toHaveLength(1);
  });

  it('pins the student card meta row to the bottom', () => {
    expect(rule(student, '.student-card-meta')).toMatch(/margin-top:\s*auto/);
  });

  // margin-top:auto only aligns anything if the cards are the same height, which
  // comes from the grid stretching its rows. `display: grid` defaults to
  // align-items: stretch — switching it to `start` would silently undo all of this.
  it.each([
    ['.grid', components],
    ['.student-programs-grid', student],
  ])('%s is a grid that does not opt out of stretching', (selector, sheet) => {
    const r = rule(sheet, selector);
    expect(r).toMatch(/display:\s*grid/);
    expect(r).not.toMatch(/align-items:\s*(start|flex-start|center|baseline)/);
  });
});

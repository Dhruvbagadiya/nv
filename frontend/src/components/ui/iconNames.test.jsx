import { describe, it, expect } from 'vitest';
import { ICON_NAMES } from './Icon.jsx';
import { navConfig } from '../layout/navConfig.js';

// The sidebar used to carry its icons as raw SVG strings. They are now keys into
// the shared registry, which is a much better trade — except for one hazard:
// <Icon> renders null for an unknown name, so a single typo silently drops an
// icon with no error anywhere. Twenty-four names moved from literal markup to
// string lookups in one commit, so this guards the whole class.

function collect(items) {
  return items.flatMap((item) => [
    ...(item.icon ? [item.icon] : []),
    ...(item.children ? collect(item.children) : []),
  ]);
}

describe('icon names', () => {
  const used = navConfig.flatMap((section) => collect(section.items));

  it('navConfig references at least one icon per top-level item', () => {
    // Guards against the opposite failure: a rename that quietly drops the
    // `icon` key everywhere would make the test above pass vacuously.
    const topLevel = navConfig.flatMap((s) => s.items);
    expect(topLevel.every((item) => typeof item.icon === 'string')).toBe(true);
    expect(used.length).toBeGreaterThan(15);
  });

  it('every icon named in navConfig exists in the registry', () => {
    const missing = [...new Set(used)].filter((name) => !ICON_NAMES.includes(name));
    expect(missing).toEqual([]);
  });
});

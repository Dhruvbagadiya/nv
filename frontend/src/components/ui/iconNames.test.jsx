import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_NAMES } from './Icon.jsx';
import { navConfig } from '../layout/navConfig.js';

// <Icon> renders null for an unknown name, so a typo drops an icon silently with
// no error anywhere. That is not hypothetical: promoting the landing page's set
// into the shared registry quietly lost `phone` and `mail`, and the header's
// "Call us now" button shipped as an empty orange circle.
//
// Two sources of names have to be checked, because they fail differently:
//   - navConfig, where names come from data
//   - literal <Icon name="..."> in JSX, which is where the regression above lived

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.jsx')) out.push(full);
  }
  return out;
}

function collectNav(items) {
  return items.flatMap((item) => [
    ...(item.icon ? [item.icon] : []),
    ...(item.children ? collectNav(item.children) : []),
  ]);
}

describe('icon names', () => {
  it('every icon named in navConfig exists in the registry', () => {
    const used = navConfig.flatMap((section) => collectNav(section.items));
    expect(used.length).toBeGreaterThan(15);
    expect([...new Set(used)].filter((n) => !ICON_NAMES.includes(n))).toEqual([]);
  });

  it('every literal <Icon name="..."> in the app exists in the registry', () => {
    const missing = new Map();
    for (const file of walk(SRC)) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/<Icon\s[^>]*name="([a-zA-Z]+)"/g)) {
        if (!ICON_NAMES.includes(m[1])) {
          missing.set(m[1], (missing.get(m[1]) ?? []).concat(file.replace(SRC, '')));
        }
      }
    }
    expect(Object.fromEntries(missing)).toEqual({});
  });
});

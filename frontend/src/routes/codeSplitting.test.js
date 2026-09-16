import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * What ships in the first request.
 *
 * All 79 routes were imported eagerly, so the bundle was one 612 kB file and a
 * visitor to the marketing page downloaded the entire admin panel and student
 * portal before the hero rendered. Nobody is all three of an agent, an admin and
 * a student, and most people are none of them.
 *
 * This guards the split in BOTH directions, because both are easy to undo by
 * accident: adding a screen with a plain `import` quietly puts it back in the
 * main bundle, and making the landing page or an auth screen lazy adds a network
 * round trip to the first paint of the only pages an anonymous visitor sees.
 */

const APP = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'App.jsx'),
  'utf8'
);

/** Screens that must stay in the first bundle: the ones that decide where you go. */
const EAGER = [
  'LandingPage',
  'PartnerLoginPage',
  'AdminLoginPage',
  'StudentLoginPage',
  'ForgotPasswordPage',
  'ResetPasswordPage',
];

describe('route code splitting', () => {
  const staticFeatureImports = [...APP.matchAll(/^import (\w+) from '\.\/features\/[^']+';$/gm)]
    .map((m) => m[1]);
  const lazyImports = [...APP.matchAll(/^const (\w+) = lazy\(\(\) => import\('\.\/features\/[^']+'\)\);$/gm)]
    .map((m) => m[1]);

  it('parsed both lists, so a refactor cannot silently empty this file', () => {
    expect(lazyImports.length).toBeGreaterThan(20);
    expect(staticFeatureImports.length).toBeGreaterThan(0);
  });

  it('loads every gated screen on demand', () => {
    const stillEager = staticFeatureImports.filter((name) => !EAGER.includes(name));

    expect(
      stillEager,
      'these ship to every visitor, including the ones who will never open them'
    ).toEqual([]);
  });

  it('keeps the landing page and the auth screens in the first bundle', () => {
    const madeLazy = EAGER.filter((name) => lazyImports.includes(name));

    expect(
      madeLazy,
      'splitting these puts a network round trip in front of the first paint of '
        + 'the only pages an anonymous visitor ever sees'
    ).toEqual([]);
  });

  /**
   * React.lazy CREATES a white-screen class that eager imports do not have: a
   * chunk that 404s after a deploy throws during render, and with nothing to
   * catch it that is the blank page the boundaries were added to remove. The
   * split was held back until they existed, so the two must not drift apart.
   */
  it('keeps an error boundary and a fallback around the lazy routes', () => {
    expect(APP).toContain('ErrorBoundary');
    expect(APP.match(/<Suspense/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

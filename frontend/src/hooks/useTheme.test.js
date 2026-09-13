import { describe, it, expect } from 'vitest';
import { buildAccentScale } from './useTheme.js';

/**
 * The chart ramp.
 *
 * Charts used to be drawn from --accent-700/600/500, which are three names for
 * ONE hex — the dashboard's pipeline bar rendered as a single solid block with a
 * pale tail and nobody noticed, because a bar chart in one colour still looks
 * like a bar chart. The ramp exists so a chart has steps at all, and the
 * property worth pinning is that those steps stay distinct for ANY accent an
 * agency picks, not just for the NV orange.
 */

const CHART = (hex) => {
  const scale = buildAccentScale(hex);
  return [1, 2, 3, 4, 5].map((i) => scale[`--chart-${i}`]);
};

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// A near-black, a mid brand orange, a very light yellow and a saturated cyan.
// The pale and the near-black are the two the clamp used to collapse.
const ACCENTS = ['#E78518', '#0B0E14', '#FFF176', '#00BCD4', '#6E2C9C'];

describe('buildAccentScale chart ramp', () => {
  it.each(ACCENTS)('gets five distinct steps from %s', (hex) => {
    const steps = CHART(hex);
    expect(steps).toHaveLength(5);
    expect(new Set(steps).size).toBe(5);
  });

  it.each(ACCENTS)('runs light to dark without reversing, from %s', (hex) => {
    const l = CHART(hex).map(luminance);
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeLessThan(l[i - 1]);
  });

  // The failure the absolute anchoring is there to prevent: an additive ramp on
  // a light accent clamps at the top and the pale steps converge, which is worse
  // than no ramp because the chart still looks like it means something.
  it.each(ACCENTS)('keeps real spread between the ends, from %s', (hex) => {
    const l = CHART(hex).map(luminance);
    expect(l[0] - l[4]).toBeGreaterThan(80);
  });

  it('falls back to the NV default rather than emitting a broken ramp', () => {
    for (const bad of [null, undefined, '', 'rebeccapurple', '#12345']) {
      expect(CHART(bad)).toEqual(CHART('#E78518'));
    }
  });
});

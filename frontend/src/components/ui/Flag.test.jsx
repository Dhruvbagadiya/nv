import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import Flag, { isoFromFlagEmoji, flagUrl } from './Flag.jsx';

// A flag emoji is two Regional Indicator code points, and Windows ships no font
// that composes them — so the browser draws the letters and the country strip
// read "GB DE NZ FR…" instead of showing flags.

describe('isoFromFlagEmoji', () => {
  it.each([
    ['🇬🇧', 'gb'],
    ['🇩🇪', 'de'],
    ['🇪🇸', 'es'],
    ['🇦🇪', 'ae'],
    ['🇮🇪', 'ie'],
    ['🇳🇱', 'nl'],
  ])('decodes %s to %s', (emoji, iso) => {
    expect(isoFromFlagEmoji(emoji)).toBe(iso);
  });

  it.each([[''], [null], [undefined], ['GB'], ['🇬'], ['not an emoji']])(
    'returns null for %s rather than a broken image url',
    (input) => {
      expect(isoFromFlagEmoji(input)).toBeNull();
    }
  );
});

describe('Flag', () => {
  afterEach(cleanup);

  it('prefers the explicit isoCode over the emoji', () => {
    // Deliberately mismatched: isoCode must win, because the portal's own `code`
    // is not ISO and the emoji is only a fallback for older rows.
    render(<Flag isoCode="GB" emoji="🇩🇪" code="UK" name="United Kingdom" />);
    expect(screen.getByTitle('United Kingdom').getAttribute('src')).toContain('/gb.png');
  });

  it('falls back to decoding the emoji when isoCode is absent', () => {
    render(<Flag emoji="🇨🇦" code="CA" name="Canada" />);
    expect(screen.getByTitle('Canada').getAttribute('src')).toContain('/ca.png');
  });

  // The portal's code is NOT ISO for six countries, so using it would fetch the
  // wrong flag entirely.
  it('never derives the image from the portal code', () => {
    render(<Flag isoCode="DE" code="GR" name="Germany" />);
    const src = screen.getByTitle('Germany').getAttribute('src');
    expect(src).toContain('/de.png');
    expect(src).not.toContain('/gr.png');
  });

  it('shows the code chip, not the emoji, when there is no usable ISO code', () => {
    const { container } = render(<Flag code="XX" name="Nowhere" />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('XX')).toBeTruthy();
  });

  // A 404 from the CDN must degrade to the chip rather than leave a broken image.
  it('falls back to the chip if the image fails to load', () => {
    render(<Flag isoCode="ZZ" code="ZZ" name="Unknown" />);
    fireEvent.error(screen.getByTitle('Unknown'));
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('ZZ')).toBeTruthy();
  });

  it('is decorative — the country name is always rendered as text beside it', () => {
    render(<Flag isoCode="FR" code="FR" name="France" />);
    const img = screen.getByTitle('France');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
  });
});

// The CDN serves a fixed set of dimensions. Requesting anything else is a 404, and
// <Flag> then falls back to the code chip — which is exactly what happened in the
// header strip: size 18 computed "18x14", which does not exist, so every flag in
// the header 404'd while the admin table (size 24 -> "24x18") worked.
describe('CDN size snapping', () => {
  const SUPPORTED = new Set([
    '16x12', '20x15', '24x18', '28x21', '32x24', '36x27', '40x30', '48x36',
    '56x42', '60x45', '64x48', '72x54', '80x60', '84x63', '96x72', '108x81',
    '112x84', '120x90', '128x96',
  ]);

  it('never requests a dimension the CDN does not serve', () => {
    for (let size = 8; size <= 128; size += 1) {
      for (const url of [flagUrl('gb', size), flagUrl('gb', size * 2)]) {
        const dims = url.match(/flagcdn\.com\/(\d+x\d+)\//)[1];
        expect(SUPPORTED.has(dims), `size ${size} produced ${dims}`).toBe(true);
      }
    }
  });

  // The exact size that was broken in the header.
  it('snaps the header strip size (18) to a real one', () => {
    expect(flagUrl('gb', 18)).toBe('https://flagcdn.com/20x15/gb.png');
  });

  it('uses an exact match when the requested size is already supported', () => {
    expect(flagUrl('gb', 24)).toBe('https://flagcdn.com/24x18/gb.png');
  });

  it('never downscales below the requested size', () => {
    for (const size of [17, 18, 19, 25, 33, 41]) {
      const w = Number(flagUrl('gb', size).match(/\/(\d+)x/)[1]);
      expect(w).toBeGreaterThanOrEqual(size);
    }
  });

  it('displays at the asked-for size even when fetching a larger asset', () => {
    render(<Flag isoCode="GB" code="UK" name="United Kingdom" size={18} />);
    const img = screen.getByTitle('United Kingdom');
    // Layout is unchanged: only the fetched asset is snapped.
    expect(img.getAttribute('width')).toBe('18');
    expect(img.getAttribute('height')).toBe('14');
    expect(img.getAttribute('src')).toContain('20x15');
  });
});

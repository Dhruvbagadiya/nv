import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import Flag, { isoFromFlagEmoji } from './Flag.jsx';

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

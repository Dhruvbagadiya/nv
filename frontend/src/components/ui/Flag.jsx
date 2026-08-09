import { useState } from 'react';

// Windows has no country-flag emoji font. A flag emoji is two Regional Indicator
// code points — 🇬🇧 is U+1F1EC U+1F1E7, i.e. "G" and "B" — and when the font cannot
// compose them into a flag the browser falls back to drawing the letters. That is
// why the country strip showed "GB DE NZ FR ES…" instead of flags on Windows
// Chrome. macOS, iOS and Android render them fine, which is how it went unnoticed.
//
// The stored emoji is correct data, so nothing needs migrating: the two code
// points decode straight back to the ISO 3166-1 alpha-2 code, which is what flag
// images are keyed on.
//
// Note the portal's own `code` column is NOT always ISO — it uses UK, GR, SP, UAE,
// IR, NE where ISO says GB, DE, ES, AE, IE, NL — so deriving from the emoji is
// more reliable than reusing `code`.
export function isoFromFlagEmoji(emoji) {
  if (!emoji) return null;
  const points = [...emoji].map((ch) => ch.codePointAt(0));
  if (points.length !== 2) return null;
  const letters = points.map((p) => p - 0x1f1e6);
  if (letters.some((n) => n < 0 || n > 25)) return null;
  return letters.map((n) => String.fromCharCode(97 + n)).join('');
}

/**
 * Renders a real flag image, falling back to the country code in a neutral chip
 * if the image cannot load (offline, blocked, or an unknown ISO code) — never to
 * the emoji, which is what fails on Windows in the first place.
 */
export default function Flag({ emoji, code, name, size = 18 }) {
  const iso = isoFromFlagEmoji(emoji);
  const [failed, setFailed] = useState(false);

  if (!iso || failed) {
    return (
      <span className="flag-fallback" style={{ width: size, height: Math.round(size * 0.75) }} aria-hidden="true">
        {code ?? ''}
      </span>
    );
  }

  const w = Math.round(size);
  const h = Math.round(size * 0.75);
  return (
    <img
      className="flag-img"
      // Fixed intrinsic size so the row height cannot shift while images load.
      width={w}
      height={h}
      src={`https://flagcdn.com/${w}x${h}/${iso}.png`}
      srcSet={`https://flagcdn.com/${w * 2}x${h * 2}/${iso}.png 2x`}
      alt=""
      // Decorative: the country name or code is always rendered as text beside it,
      // so announcing the flag again would just be noise.
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailed(true)}
      title={name}
    />
  );
}

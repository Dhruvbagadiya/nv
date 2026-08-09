import { useState } from 'react';

// Windows has no country-flag emoji font. A flag emoji is two Regional Indicator
// code points — 🇬🇧 is U+1F1EC U+1F1E7, i.e. "G" and "B" — and when the font cannot
// compose them into a flag the browser falls back to drawing the letters. That is
// why the country strip showed "GB DE NZ FR ES…" instead of flags on Windows
// Chrome. macOS, iOS and Android render them fine, which is how it went unnoticed.

export function isoFromFlagEmoji(emoji) {
  if (!emoji) return null;
  const points = [...emoji].map((ch) => ch.codePointAt(0));
  if (points.length !== 2) return null;
  const letters = points.map((p) => p - 0x1f1e6);
  if (letters.some((n) => n < 0 || n > 25)) return null;
  return letters.map((n) => String.fromCharCode(97 + n)).join('');
}

// The CDN serves a FIXED set of dimensions, not arbitrary ones — every image is
// <w>x<h> where h is three quarters of w, and only these widths exist. Asking for
// anything else is a 404.
//
// This is not academic: the header strip asked for size 18, which computed to
// "18x14", which does not exist, so every flag in the header 404'd and fell back
// to the code chip — while the admin table asked for 24 ("24x18", valid) and
// showed flags correctly. Same component, same data, different size.
const CDN_WIDTHS = [16, 20, 24, 28, 32, 36, 40, 48, 56, 60, 64, 72, 80, 84, 96, 108, 112, 120, 128];

// Smallest supported width at or above the requested one, so a flag is never
// upscaled from something smaller and blurred.
function cdnWidthFor(requested) {
  return CDN_WIDTHS.find((w) => w >= requested) ?? CDN_WIDTHS[CDN_WIDTHS.length - 1];
}

export function flagUrl(iso, requestedWidth) {
  const w = cdnWidthFor(requestedWidth);
  // The CDN's own aspect ratio for these assets.
  const h = Math.round((w * 3) / 4);
  return `https://flagcdn.com/${w}x${h}/${iso}.png`;
}

/**
 * Renders a real flag image, falling back to the country code in a neutral chip
 * if the image cannot load (offline, blocked, or an unknown ISO code) — never to
 * the emoji, which is what fails on Windows in the first place.
 */
export default function Flag({ isoCode, emoji, code, name, size = 18 }) {
  // Prefer the explicit column; decoding the emoji stays as a fallback for rows
  // written before isoCode existed.
  const iso = (isoCode || isoFromFlagEmoji(emoji) || '').toLowerCase() || null;
  const [failed, setFailed] = useState(false);

  // Displayed size is whatever the caller asked for; only the FETCHED size is
  // snapped to what the CDN actually has.
  const displayW = Math.round(size);
  const displayH = Math.round(size * 0.75);

  if (!iso || failed) {
    return (
      <span
        className="flag-fallback"
        style={{ width: displayW, height: displayH }}
        aria-hidden="true"
      >
        {code ?? ''}
      </span>
    );
  }

  return (
    <img
      className="flag-img"
      // Fixed intrinsic size so the row height cannot shift while images load.
      width={displayW}
      height={displayH}
      src={flagUrl(iso, displayW)}
      srcSet={`${flagUrl(iso, displayW * 2)} 2x`}
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

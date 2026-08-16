/**
 * useTheme.js
 *
 * Manages the runtime CSS custom-property theme for the partner portal.
 * Every accent color in the app (`--accent-800` through `--accent-50`) is
 * derived from a single hex value so an agent only has to pick one color.
 *
 * Color scale algorithm:
 *   Given a base hex H (the "700" slot):
 *   - 800  → darken by 18%   (hover states, admin login bg)
 *   - 700  → base            (buttons, active nav, links)
 *   - 600  → same as 700     (gradients that previously used 600)
 *   - 500  → same as 700     (focus rings, outlines)
 *   - 100  → mix 12% with white  (light backgrounds, chips)
 *   - 50   → mix  6% with white  (very light hover tints)
 *
 * All math is done in HSL so lightness adjustments feel perceptually uniform.
 *
 * The NV Immigration default orange (#C96E0E) is the fallback when no agency
 * color is set.
 */

export const NV_DEFAULT_ACCENT = '#C96E0E';

// ── Colour math helpers ──────────────────────────────────────────────────────

/** Parse "#RRGGBB" or "#RGB" → { r, g, b } 0-255 */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** { r, g, b } 0-255 → "#RRGGBB" */
function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b]
    .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
    .join('');
}

/** { r, g, b } → { h 0-360, s 0-100, l 0-100 } */
function rgbToHsl({ r, g, b }) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case rr: h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6; break;
    case gg: h = ((bb - rr) / d + 2) / 6; break;
    default: h = ((rr - gg) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** { h 0-360, s 0-100, l 0-100 } → { r, g, b } 0-255 */
function hslToRgb({ h, s, l }) {
  const ss = s / 100, ll = l / 100;
  if (ss === 0) { const v = Math.round(ll * 255); return { r: v, g: v, b: v }; }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hh = h / 360;
  return {
    r: Math.round(hue2rgb(p, q, hh + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, hh      ) * 255),
    b: Math.round(hue2rgb(p, q, hh - 1/3) * 255),
  };
}

/**
 * Clamp lightness to a readable range.
 * Very dark colors (l < 20) are lifted to 25 so --accent-700 is never near-black.
 * Very light colors (l > 72) are pulled to 60 so buttons stay visible on white.
 */
function clampForButton(hsl) {
  const l = Math.max(22, Math.min(68, hsl.l));
  const s = Math.max(45, Math.min(100, hsl.s)); // ensure saturation too
  return { ...hsl, l, s };
}

// Text drawn on top of an accent fill. `#fff` was hardcoded at every such call
// site, which is only correct while the accent stays dark: an agent picking
// yellow, lime or cyan got white-on-light and the label vanished. Nothing in the
// palette can be assumed readable when the agent chooses it, so the foreground
// is derived from the background instead of assumed.
const DARK_INK = '#0B0E14'; // --ink-950

/** WCAG relative luminance of an { r, g, b }. */
function relativeLuminance({ r, g, b }) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two relative luminances. */
function contrastRatio(a, b) {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Whichever of white / near-black is more readable on `hex`. */
function readableOn(hex) {
  const bg = relativeLuminance(hexToRgb(hex));
  const onWhite = contrastRatio(bg, 1);                                // #fff
  const onDark = contrastRatio(bg, relativeLuminance(hexToRgb(DARK_INK)));
  return onWhite >= onDark ? '#ffffff' : DARK_INK;
}

/**
 * Given a base hex (the "700" slot), build the full accent scale:
 * { 800, 700, 600, 500, 100, 50, contrast, contrast-800 }
 */
export function buildAccentScale(hex) {
  if (!hex || !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
    hex = NV_DEFAULT_ACCENT;
  }

  const base = clampForButton(rgbToHsl(hexToRgb(hex)));

  const slot = (deltaL, deltaS = 0) => {
    const adjusted = {
      h: base.h,
      s: Math.min(100, Math.max(0, base.s + deltaS)),
      l: Math.min(98,  Math.max(2,  base.l + deltaL)),
    };
    return rgbToHex(hslToRgb(adjusted));
  };

  const accent800 = slot(-12, +4);   // darker — hover on primary button
  const accent700 = slot(0);          // base

  return {
    '--accent-800': accent800,
    '--accent-700': accent700,
    '--accent-600': accent700,        // same (used in gradients alongside 700)
    '--accent-500': accent700,        // same (focus ring)
    '--accent-100': slot(+52, -60),  // very light tint for chip backgrounds
    '--accent-50':  slot(+58, -68),  // lightest tint for hover fills

    // Foregrounds. 600/500 are identical to 700, so one token covers all three;
    // 800 is a different fill and gets its own, since a mid-light accent can
    // want dark text at 700 and still need white once darkened.
    '--accent-contrast':     readableOn(accent700),
    '--accent-contrast-800': readableOn(accent800),
  };
}

// ── DOM application ──────────────────────────────────────────────────────────

const ROOT = () => document.documentElement;

/** Apply a hex accent color to :root CSS vars immediately. */
export function applyTheme(accentColor) {
  const scale = buildAccentScale(accentColor ?? NV_DEFAULT_ACCENT);
  for (const [prop, value] of Object.entries(scale)) {
    ROOT().style.setProperty(prop, value);
  }
}

/** Remove all overrides — revert to the stylesheet defaults. */
export function resetTheme() {
  const props = [
    '--accent-800','--accent-700','--accent-600','--accent-500','--accent-100','--accent-50',
    '--accent-contrast','--accent-contrast-800',
  ];
  for (const prop of props) {
    ROOT().style.removeProperty(prop);
  }
}

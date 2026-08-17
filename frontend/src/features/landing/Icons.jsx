/*
 * Landing-page icon set.
 *
 * Emoji were the single biggest thing making this page read as amateur: they
 * render in a different style on every OS (Apple's are glossy 3D, Windows' are
 * flat two-tone, Android's are different again), they can't take the brand
 * colour, and some — ✈️ 🛠️ — carry a variation selector that Windows renders
 * as a monochrome glyph. A stroke icon set fixes all three at once: one visual
 * language, `currentColor` so it inherits the accent, and identical everywhere.
 *
 * House rules, so the set stays coherent as it grows:
 *   · 24x24 viewBox, no exceptions
 *   · 1.7 stroke width, round caps and joins
 *   · stroke-only (fill: none) — except brand marks, which are fill-only
 *   · geometry drawn on the pixel grid at 24px so it stays crisp when small
 */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

// Every entry is the inner markup of a 24x24 icon. Kept as a map rather than
// one component per icon so a caller can drive them from data (`SERVICES` etc.)
// without a lookup table in the page.
const PATHS = {
  // ── services ──────────────────────────────────────────────────────────
  student: (
    <g {...STROKE}>
      <path d="M12 3.5 22 8.2l-10 4.7L2 8.2z" />
      <path d="M6 10.6v4.9c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.9" />
      <path d="M22 8.2v5.4" />
    </g>
  ),
  tourist: (
    <g {...STROKE}>
      <rect x="2.5" y="7.5" width="19" height="13" rx="2.5" />
      <path d="M8.5 7.5V5.2a1.7 1.7 0 0 1 1.7-1.7h3.6a1.7 1.7 0 0 1 1.7 1.7v2.3" />
      <path d="M9 11.5v5M15 11.5v5" />
    </g>
  ),
  business: (
    <g {...STROKE}>
      <rect x="2.5" y="7" width="19" height="13.5" rx="2.5" />
      <path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7" />
      <path d="M2.5 12.5c3.2 1.5 6.3 2.2 9.5 2.2s6.3-.7 9.5-2.2" />
      <path d="M11 13.8h2" />
    </g>
  ),
  working: (
    <g {...STROKE}>
      <path d="M14.6 5.1a3.6 3.6 0 0 0 4.9 4.9l2.1 2.1a1.6 1.6 0 0 1 0 2.3l-1.2 1.2a1.6 1.6 0 0 1-2.3 0l-2.1-2.1a3.6 3.6 0 0 0-4.9-4.9z" />
      <path d="m10.6 10.8-7 7a2 2 0 0 0 2.8 2.8l7-7" />
    </g>
  ),
  ticket: (
    <g {...STROKE}>
      <path d="M3 9.2V7.5a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 7.5v1.7a2.8 2.8 0 0 0 0 5.6v1.7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-1.7a2.8 2.8 0 0 0 0-5.6Z" />
      <path d="M13.5 6v1.6M13.5 11.2v1.6M13.5 16.4V18" />
    </g>
  ),
  tours: (
    <g {...STROKE}>
      <path d="M9 3.5 3 6v14.5l6-2.5 6 2.5 6-2.5V3.5L15 6z" />
      <path d="M9 3.5V18M15 6v14.5" />
    </g>
  ),
  exchange: (
    <g {...STROKE}>
      <path d="M3.5 8.5h14M14 5l3.5 3.5L14 12" />
      <path d="M20.5 15.5h-14M10 12l-3.5 3.5L10 19" />
    </g>
  ),

  // ── trust / reasons ───────────────────────────────────────────────────
  shield: (
    <g {...STROKE}>
      <path d="M12 2.8 4.5 6v6c0 4.4 3.1 8.2 7.5 9.2 4.4-1 7.5-4.8 7.5-9.2V6z" />
      <path d="m8.8 11.8 2.3 2.3 4.1-4.4" />
    </g>
  ),
  chat: (
    <g {...STROKE}>
      <path d="M20.5 11.6a7.9 7.9 0 0 1-8.5 7.9 9 9 0 0 1-2.6-.4L4 20.5l1.4-4.2a7.6 7.6 0 0 1-1.4-4.7A7.9 7.9 0 0 1 12.5 3.7a7.9 7.9 0 0 1 8 7.9Z" />
      <path d="M9 11.6h.01M12.5 11.6h.01M16 11.6h.01" />
    </g>
  ),
  pin: (
    <g {...STROKE}>
      <path d="M12 21.5s7-5.9 7-11a7 7 0 1 0-14 0c0 5.1 7 11 7 11Z" />
      <circle cx="12" cy="10.2" r="2.6" />
    </g>
  ),
  star: (
    <g {...STROKE}>
      <path d="m12 3.3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.8l6.1-.9z" />
    </g>
  ),
  globe: (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.2 9.5h17.6M3.2 14.5h17.6" />
      <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
    </g>
  ),
  document: (
    <g {...STROKE}>
      <path d="M14 2.8H7a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.8z" />
      <path d="M14 2.8v5h5" />
      <path d="m8.8 14.4 2 2 3.9-4.2" />
    </g>
  ),
  clock: (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.8V12l3.4 2" />
    </g>
  ),

  // ── contact ───────────────────────────────────────────────────────────
  phone: (
    <g {...STROKE}>
      <path d="M8.1 3.5H5a2 2 0 0 0-2 2.1C3.4 13.6 10.4 20.6 18.4 21a2 2 0 0 0 2.1-2v-3.1a1.4 1.4 0 0 0-1.2-1.4l-2.9-.4a1.4 1.4 0 0 0-1.4.7l-.8 1.4a12.6 12.6 0 0 1-5.4-5.4l1.4-.8a1.4 1.4 0 0 0 .7-1.4l-.4-2.9a1.4 1.4 0 0 0-1.4-1.2Z" />
    </g>
  ),
  mail: (
    <g {...STROKE}>
      <rect x="2.8" y="4.8" width="18.4" height="14.4" rx="2.4" />
      <path d="m3.4 7.2 7.5 5.1a2 2 0 0 0 2.2 0l7.5-5.1" />
    </g>
  ),
  whatsapp: (
    <g fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24z" />
    </g>
  ),

  // ── ui ────────────────────────────────────────────────────────────────
  arrow: (
    <g {...STROKE}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </g>
  ),
  check: (
    <g {...STROKE}>
      <path d="m4.5 12.5 5 5 10-11" />
    </g>
  ),
  plus: (
    <g {...STROKE}>
      <path d="M12 5v14M5 12h14" />
    </g>
  ),
  plane: (
    <g {...STROKE}>
      <path d="M21 15.5 3 20l1.6-4.4L12 13l-7.4-2.6L3 6l18 4.5a2.6 2.6 0 0 1 0 5Z" />
    </g>
  ),
  sparkle: (
    <g {...STROKE}>
      <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9z" />
      <path d="M18.5 16.5v3.5M16.75 18.25h3.5" />
    </g>
  ),
};

/**
 * @param {string} name  key from PATHS
 * @param {number} size  rendered px (the viewBox is always 24)
 */
export default function Icon({ name, size = 24, className = '', ...rest }) {
  const glyph = PATHS[name];
  if (!glyph) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {glyph}
    </svg>
  );
}

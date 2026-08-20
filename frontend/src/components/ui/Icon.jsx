/*
 * Shared icon registry — the single source of icons for the whole app.
 *
 * This started life on the landing page, where emoji were the biggest thing
 * making the design read as amateur: they render in a different style on every
 * OS (Apple's are glossy 3D, Windows' flat two-tone, Android's different
 * again), they cannot take the brand colour, and several — ✈️ 🛠️ ⚠️ — carry a
 * variation selector that Windows renders as a monochrome glyph. The portal had
 * the same problem in 15 files, plus three *other* icon conventions that had
 * grown up independently:
 *
 *   · navConfig.js  — 24 icons as raw SVG strings injected via
 *                     dangerouslySetInnerHTML (6 of them byte-identical dupes)
 *   · AdminDashboard.jsx — 8 more defined as local consts, 6 duplicating navConfig
 *   · assorted one-offs inline in Header, Sidebar, Modal, DocumentGrid
 *
 * One registry replaces all of it. `currentColor` means an icon inherits the
 * agency's runtime accent for free.
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
// one component per icon so callers can drive them from data (navConfig, the
// services list, a notification `type` field) without a lookup table of their
// own.
const PATHS = {
  // ── marketing / services (landing page) ───────────────────────────────
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
  sparkle: (
    <g {...STROKE}>
      <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9z" />
      <path d="M18.5 16.5v3.5M16.75 18.25h3.5" />
    </g>
  ),
  plane: (
    <g {...STROKE}>
      <path d="M21 15.5 3 20l1.6-4.4L12 13l-7.4-2.6L3 6l18 4.5a2.6 2.6 0 0 1 0 5Z" />
    </g>
  ),
  // Contact. These two were dropped when the landing page's set was promoted
  // into this shared registry, which left <Icon name="phone"> rendering null —
  // the header's "Call us now" button showed as an empty orange circle.
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

  // ── portal nav ────────────────────────────────────────────────────────
  dashboard: (
    <g {...STROKE}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </g>
  ),
  headset: (
    <g {...STROKE}>
      <path d="M4 12a8 8 0 0 1 16 0v5" />
      <rect x="3" y="12" width="4" height="6" rx="1.5" />
      <rect x="17" y="12" width="4" height="6" rx="1.5" />
      <path d="M19 18v1a3 3 0 0 1-3 3h-3" />
    </g>
  ),
  clock: (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.8V12l3.4 2" />
    </g>
  ),
  application: (
    <g {...STROKE}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <polyline points="14 3 14 8 19 8" />
      <path d="M12 12v5M9.5 14.5h5" />
    </g>
  ),
  list: (
    <g {...STROKE}>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </g>
  ),
  moi: (
    <g {...STROKE}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <polyline points="14 3 14 8 19 8" />
      <polyline points="9.5 14 11 15.5 14.5 12" />
    </g>
  ),
  commission: (
    <g {...STROKE}>
      <path d="M5 19 19 5" />
      <circle cx="7" cy="7" r="2" />
      <circle cx="17" cy="17" r="2" />
    </g>
  ),
  checklist: (
    <g {...STROKE}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <polyline points="4 6 5 7 7 5" />
      <polyline points="4 12 5 13 7 11" />
      <polyline points="4 18 5 19 7 17" />
    </g>
  ),
  megaphone: (
    <g {...STROKE}>
      <path d="M3 11v2a2 2 0 0 0 2 2h1l4 4V5l-4 4H5a2 2 0 0 0-2 2z" />
      <path d="M17 8a5 5 0 0 1 0 8" />
      <path d="M20 5a9 9 0 0 1 0 14" />
    </g>
  ),
  folder: (
    <g {...STROKE}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </g>
  ),
  chart: (
    <g {...STROKE}>
      <path d="M4 20V10M10 20V4M16 20v-6" />
      <path d="M4 20h16" />
    </g>
  ),
  help: (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 4.6 1.4c0 1.6-2.1 2-2.1 3.6" />
      <path d="M12 17h.01" />
    </g>
  ),
  settings: (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </g>
  ),
  user: (
    <g {...STROKE}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </g>
  ),
  users: (
    <g {...STROKE}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="18" cy="9" r="2.5" />
    </g>
  ),
  userPlus: (
    <g {...STROKE}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M19 8v6M16 11h6" />
    </g>
  ),
  institution: (
    <g {...STROKE}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 21v-4h6v4" />
      <path d="M9 7h1M14 7h1M9 11h1M14 11h1" />
    </g>
  ),
  course: (
    <g {...STROKE}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </g>
  ),
  globe: (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.2 9.5h17.6M3.2 14.5h17.6" />
      <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
    </g>
  ),
  banner: (
    <g {...STROKE}>
      <path d="M4 6h16v9H8l-4 4z" />
    </g>
  ),
  document: (
    <g {...STROKE}>
      <path d="M14 2.8H7a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.8z" />
      <path d="M14 2.8v5h5" />
      <path d="m8.8 14.4 2 2 3.9-4.2" />
    </g>
  ),
  building: (
    <g {...STROKE}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 21v-4h6v4" />
      <path d="M8.5 7h1M14.5 7h1M8.5 11h1M14.5 11h1" />
    </g>
  ),
  palette: (
    <g {...STROKE}>
      <path d="M12 3a9 9 0 1 0 0 18 1.9 1.9 0 0 0 1.5-3.1 1.9 1.9 0 0 1 1.5-3.1h2.2A3.8 3.8 0 0 0 21 11 9 9 0 0 0 12 3Z" />
      <path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01" />
    </g>
  ),

  // ── ui / feedback ─────────────────────────────────────────────────────
  arrow: (
    <g {...STROKE}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </g>
  ),
  arrowLeft: (
    <g {...STROKE}>
      <path d="M19.5 12h-15M10.5 6l-6 6 6 6" />
    </g>
  ),
  check: (
    <g {...STROKE}>
      <path d="m4.5 12.5 5 5 10-11" />
    </g>
  ),
  close: (
    <g {...STROKE}>
      <path d="M6 6l12 12M18 6L6 18" />
    </g>
  ),
  plus: (
    <g {...STROKE}>
      <path d="M12 5v14M5 12h14" />
    </g>
  ),
  minus: (
    <g {...STROKE}>
      <path d="M5 12h14" />
    </g>
  ),
  search: (
    <g {...STROKE}>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.2 16.2 4.3 4.3" />
    </g>
  ),
  bell: (
    <g {...STROKE}>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" />
      <path d="M13.7 19a2 2 0 0 1-3.4 0" />
    </g>
  ),
  refresh: (
    <g {...STROKE}>
      <path d="M20.5 11A8.5 8.5 0 0 0 6 6.5L3.5 9" />
      <path d="M3.5 13A8.5 8.5 0 0 0 18 17.5L20.5 15" />
      <path d="M3.5 4.5V9H8M20.5 19.5V15H16" />
    </g>
  ),
  clipboard: (
    <g {...STROKE}>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4.5v1.2H9z" />
      <path d="M9 11h6M9 15h4" />
    </g>
  ),
  info: (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </g>
  ),
  alert: (
    <g {...STROKE}>
      <path d="M12 3.8 2.5 20h19z" />
      <path d="M12 10v4M12 17.2h.01" />
    </g>
  ),
  inbox: (
    <g {...STROKE}>
      <path d="M3 13.5 5.6 5.4A2 2 0 0 1 7.5 4h9a2 2 0 0 1 1.9 1.4L21 13.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 13.5h5l1 2.5h6l1-2.5h5" />
    </g>
  ),
  eye: (
    <g {...STROKE}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.2" />
    </g>
  ),
  logout: (
    <g {...STROKE}>
      <path d="M15 4.5h2.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H15" />
      <path d="M10 8.5 6 12l4 3.5M6 12h9" />
    </g>
  ),
  chevron: (
    <g {...STROKE}>
      <path d="m7 10 5 5 5-5" />
    </g>
  ),
  upload: (
    <g {...STROKE}>
      <path d="M4 15v3.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V15" />
      <path d="M12 4v11M7.5 8.5 12 4l4.5 4.5" />
    </g>
  ),
  pdf: (
    <g {...STROKE}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <polyline points="14 3 14 8 19 8" />
      <path d="M8.5 13h1.2a1.2 1.2 0 0 1 0 2.4H8.5V13zM8.5 17.5V13" />
      <path d="M13 13v4.5h1a1.6 1.6 0 0 0 1.6-1.6v-1.3A1.6 1.6 0 0 0 14 13z" />
    </g>
  ),
};

/**
 * @param {string} name  key from PATHS
 * @param {number} size  rendered px (the viewBox is always 24)
 */
export default function Icon({ name, size = 24, className = '', ...rest }) {
  const glyph = PATHS[name];
  if (!glyph) {
    // A typo'd name used to render nothing at all, silently. With icon names now
    // coming from data (navConfig, notification types) that is a real hazard, so
    // say so in development. iconNames.test.jsx guards the config-driven ones.
    if (import.meta.env?.DEV) console.warn(`<Icon>: unknown name "${name}"`);
    return null;
  }
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

/** Every registered name — used by the test that validates navConfig. */
export const ICON_NAMES = Object.keys(PATHS);

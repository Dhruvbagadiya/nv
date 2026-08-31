/*
 * Illustrated panels that stand in for photography.
 *
 * The page previously filled its four image slots with flat two-stop gradients.
 * A flat gradient rectangle doesn't read as "art direction", it reads as a
 * broken <img> — the eye recognises a missing photo instantly. These SVG
 * scenes are the honest alternative: they never pretend to be photographs, so
 * they look deliberate at any size, they weigh nothing, they're sharp on
 * retina, and they inherit the brand accent so a theme change restyles them.
 *
 * Every scene draws into a fixed viewBox and is stretched with
 * `preserveAspectRatio="xMidYMid slice"`, so it crops like a photo rather than
 * distorting when its container's aspect ratio changes.
 *
 * Colours come from `currentColor` and the --accent-* tokens via CSS on the
 * wrapper, not from hard-coded hex, for the same reason.
 */

/** Dotted-grid world panel with routes fanning out of Surat. Used as the large
 *  "photo" in the About block.
 *
 *  The viewBox is close to square on purpose. The container is roughly 1:1 at
 *  desktop but changes shape at every breakpoint, and with `slice` a wide
 *  viewBox gets its left and right thirds cropped away — the first version was
 *  drawn 660x380 and lost both destination pins. Everything that carries
 *  meaning now lives inside the central safe area (x 90-390, y 90-350); only
 *  the dot field is allowed to run off the edges. */
export function RouteMapScene() {
  // A coarse dot field reads as a world map at a glance, and at 480x440 in a
  // hero collage that is all it needs to do. Real coastlines DO now ship on this
  // page — see WorldMap.jsx, 176 countries for 29KB gzipped, fetched from
  // public/map/world.json — but they are the point of their own section further
  // down. Here they would be detail nobody looks at.
  const dots = [];
  for (let y = 0; y < 17; y += 1) {
    for (let x = 0; x < 17; x += 1) {
      // Carve a rough landmass silhouette out of the field. The shape only has
      // to be continent-ish; at 3px dots nobody reads it as a specific map.
      const nx = x / 16;
      const ny = y / 16;
      const land =
        (nx < 0.3 && ny > 0.24 && ny < 0.78) ||
        (nx > 0.34 && nx < 0.52 && ny > 0.12 && ny < 0.9) ||
        (nx > 0.56 && nx < 0.88 && ny > 0.18 && ny < 0.72) ||
        (nx > 0.74 && ny > 0.62 && ny < 0.94);
      if (land) dots.push(<circle key={`${x}-${y}`} cx={20 + x * 28} cy={16 + y * 26} r="3" />);
    }
  }

  return (
    <svg
      className="lp-scene-svg"
      viewBox="0 0 480 440"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lp-route-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-800)" />
          <stop offset="55%" stopColor="var(--accent-700)" />
          <stop offset="100%" stopColor="var(--accent-600)" />
        </linearGradient>
        <radialGradient id="lp-route-glow" cx="0.28" cy="0.18" r="0.85">
          <stop offset="0%" stopColor="#fff" stopOpacity=".34" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="480" height="440" fill="url(#lp-route-sky)" />
      <rect width="480" height="440" fill="url(#lp-route-glow)" />

      <g fill="#fff" opacity=".24">{dots}</g>

      {/* Three routes out of one origin. Dashed arcs with a filled origin and
          hollow destination pins are the shorthand every airline uses. */}
      {/* The whole route system sits in the upper half. The About block layers
          a stamp card over this panel's bottom-right corner, and with the
          origin down at y=300 the ringed "you are here" marker disappeared
          behind it, leaving three arcs radiating from nothing. */}
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
        <path d="M240 250 C 200 176, 152 142, 100 130" strokeDasharray="7 9" opacity=".9" />
        <path d="M240 250 C 234 190, 240 120, 246 78" strokeDasharray="7 9" opacity=".65" />
        <path d="M240 250 C 296 200, 340 164, 388 148" strokeDasharray="7 9" opacity=".8" />
      </g>
      <g fill="#fff">
        <circle cx="100" cy="130" r="6" opacity=".95" />
        <circle cx="246" cy="78" r="6" opacity=".8" />
        <circle cx="388" cy="148" r="6" opacity=".9" />
      </g>

      {/* Origin, ringed so it reads as "you are here" rather than a fourth
          destination. */}
      <circle cx="240" cy="250" r="8.5" fill="#fff" />
      <circle cx="240" cy="250" r="17" fill="none" stroke="#fff" strokeWidth="2" opacity=".5" />
      <circle cx="240" cy="250" r="27" fill="none" stroke="#fff" strokeWidth="1.4" opacity=".25" />

      {/* Plane riding the right-hand route, nose along the tangent. */}
      <g transform="translate(318 182) rotate(-32)" fill="#fff">
        <path d="M24 7 -8 14 -5 7 7 5 -5 3 -8 -4 24 3a2 2 0 0 1 0 4Z" />
      </g>
    </svg>
  );
}

/** Approval stamp card. Small overlapping panel in the About block. */
export function StampScene() {
  return (
    <svg
      className="lp-scene-svg"
      viewBox="0 0 320 240"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="320" height="240" fill="var(--tint)" />
      {/* Faint guilloche, the way a real visa page is printed. */}
      <g fill="none" stroke="var(--accent-700)" strokeWidth="1" opacity=".16">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <ellipse key={i} cx="160" cy="120" rx={46 + i * 26} ry={30 + i * 17} transform={`rotate(${i * 14} 160 120)`} />
        ))}
      </g>
      <g fill="none" stroke="var(--line)" strokeWidth="1.4">
        <path d="M0 46h320M0 194h320" />
      </g>

      {/* The stamp itself, rotated the way a hand-applied stamp lands.
          Everything is centred on 160 and stacked vertically — the first
          version put a tick and the wordmark on the same baseline and they
          overlapped. */}
      <g transform="rotate(-9 160 120)" opacity=".92">
        <rect x="46" y="62" width="228" height="116" rx="10" fill="none" stroke="var(--success-700)" strokeWidth="4" />
        <rect x="55" y="71" width="210" height="98" rx="6" fill="none" stroke="var(--success-700)" strokeWidth="1.6" opacity=".6" />
        <text
          x="160" y="115" textAnchor="middle"
          fill="var(--success-700)" fontSize="30" fontWeight="800" letterSpacing="3"
        >
          APPROVED
        </text>
        <path d="M72 130h176" stroke="var(--success-700)" strokeWidth="1.4" opacity=".55" />
        <text
          x="160" y="152" textAnchor="middle"
          fill="var(--success-700)" fontSize="12.5" fontWeight="700" letterSpacing="1.8"
        >
          NV IMMIGRATION
        </text>
      </g>
    </svg>
  );
}

/** Boarding pass on a night-sky field. Used in the Why-choose block. */
export function BoardingPassScene() {
  return (
    <svg
      className="lp-scene-svg"
      viewBox="0 0 560 420"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lp-pass-night" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#1D2634" />
          <stop offset="100%" stopColor="#0E141C" />
        </linearGradient>
        <radialGradient id="lp-pass-dawn" cx="0.78" cy="0.12" r="0.75">
          <stop offset="0%" stopColor="var(--accent-700)" stopOpacity=".55" />
          <stop offset="100%" stopColor="var(--accent-700)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="560" height="420" fill="url(#lp-pass-night)" />
      <rect width="560" height="420" fill="url(#lp-pass-dawn)" />

      {/* Sparse stars, sized on a decaying scale so the field has depth. */}
      <g fill="#fff">
        {[
          [64, 58, 1.9], [128, 32, 1.2], [196, 74, 1.5], [268, 40, 1], [332, 88, 1.7],
          [412, 46, 1.2], [486, 96, 1.5], [92, 132, 1.1], [520, 168, 1.3], [36, 208, 1.4],
          [172, 122, 1], [300, 128, 1.2],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} opacity={0.25 + r * 0.25} />
        ))}
      </g>

      {/* Ticket. The notch pair plus the dashed tear line is the whole visual
          idiom — without them a rounded rect is just a card. */}
      <g transform="translate(66 150)">
        <rect x="0" y="0" width="428" height="176" rx="16" fill="#fff" />
        <rect x="0" y="0" width="428" height="176" rx="16" fill="none" stroke="var(--line)" />

        <path d="M300 0v176" stroke="var(--line)" strokeWidth="2" strokeDasharray="6 7" />
        <circle cx="300" cy="0" r="11" fill="url(#lp-pass-night)" />
        <circle cx="300" cy="176" r="11" fill="url(#lp-pass-night)" />

        {/* The airport codes sit at 34px, not 40: at 40 the two three-letter
            words plus the route line between them overran the 270px of usable
            width on the main stub and collided. */}
        <g>
          <text x="28" y="38" fill="var(--ink-3)" fontSize="11" fontWeight="700" letterSpacing="2">BOARDING PASS</text>
          <text x="28" y="88" fill="var(--ink)" fontSize="34" fontWeight="800" letterSpacing="-1">SUR</text>
          <text x="272" y="88" fill="var(--ink)" fontSize="34" fontWeight="800" letterSpacing="-1" textAnchor="end">YYZ</text>
          <text x="28" y="116" fill="var(--ink-3)" fontSize="12" fontWeight="600">Surat</text>
          <text x="272" y="116" fill="var(--ink-3)" fontSize="12" fontWeight="600" textAnchor="end">Toronto</text>

          <text x="330" y="44" fill="var(--ink-3)" fontSize="10" fontWeight="700" letterSpacing="1.6">GATE</text>
          <text x="330" y="70" fill="var(--ink)" fontSize="24" fontWeight="800">A12</text>
          <text x="330" y="102" fill="var(--ink-3)" fontSize="10" fontWeight="700" letterSpacing="1.6">SEAT</text>
          <text x="330" y="128" fill="var(--ink)" fontSize="24" fontWeight="800">14A</text>
        </g>

        {/* Route line between the two airport codes, in the gap they now leave. */}
        <g stroke="var(--accent-700)" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M104 78h68" strokeDasharray="4 6" opacity=".7" />
        </g>
        <g transform="translate(150 70)" fill="var(--accent-700)">
          <path d="M20 8 -6 14 -4 8 6 6 -4 4 -6 -2 20 4a2 2 0 0 1 0 4Z" />
        </g>

        {/* Barcode. Deterministic widths — a Math.random() barcode would
            re-shuffle on every render and flicker under React strict mode. */}
        <g fill="var(--ink)" opacity=".8">
          {[3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1].reduce(
            (acc, w, i) => {
              acc.nodes.push(<rect key={i} x={330 + acc.x} y="142" width={w} height="20" />);
              acc.x += w + 3.5;
              return acc;
            },
            { x: 0, nodes: [] },
          ).nodes}
        </g>
      </g>
    </svg>
  );
}

/** Rotating ring of text for the "Apply Now" seal.
 *
 *  The previous version was a plain string in a flex row inside a 128px
 *  circle, which simply wrapped and clipped — it rendered as a broken fragment
 *  of the sentence. Circular text needs a textPath; there is no CSS route to
 *  it. The path is a full circle drawn as two arcs (a single arc command
 *  cannot close a circle, because the start and end points would coincide and
 *  the arc becomes undefined). */
export function SealRing() {
  return (
    <svg className="lp-seal-ring" viewBox="0 0 128 128" aria-hidden="true">
      <defs>
        <path id="lp-seal-path" fill="none" d="M64 16a48 48 0 1 1 0 96 48 48 0 1 1 0-96" />
      </defs>
      <text fill="currentColor" fontSize="11" fontWeight="800" letterSpacing="3.1">
        {/* Sized to the 301px circumference: ~30 characters at ~10px each. */}
        <textPath href="#lp-seal-path">★ APPLY NOW ★ FREE CHECK </textPath>
      </text>
    </svg>
  );
}

/** Wireframe globe with an orbiting arc — the hero centrepiece. */
export function GlobeScene() {
  return (
    <svg
      className="lp-globe-svg"
      viewBox="0 0 300 300"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lp-globe-fill" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="var(--accent-600)" />
          <stop offset="100%" stopColor="var(--accent-800)" />
        </linearGradient>
        <radialGradient id="lp-globe-light" cx="0.32" cy="0.24" r="0.7">
          <stop offset="0%" stopColor="#fff" stopOpacity=".42" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id="lp-globe-clip"><circle cx="150" cy="150" r="118" /></clipPath>
      </defs>

      <circle cx="150" cy="150" r="118" fill="url(#lp-globe-fill)" />
      <circle cx="150" cy="150" r="118" fill="url(#lp-globe-light)" />

      {/* Graticule. Parallels are straight lines and meridians are ellipses
          narrowing toward the poles — the standard orthographic projection,
          which is what makes a circle read as a sphere. */}
      <g clipPath="url(#lp-globe-clip)" fill="none" stroke="#fff" strokeWidth="1.2" opacity=".38">
        <path d="M32 150h236" />
        {[46, 88].map((d) => (
          <g key={d}>
            <path d={`M${150 - Math.sqrt(118 * 118 - d * d)} ${150 - d}h${2 * Math.sqrt(118 * 118 - d * d)}`} />
            <path d={`M${150 - Math.sqrt(118 * 118 - d * d)} ${150 + d}h${2 * Math.sqrt(118 * 118 - d * d)}`} />
          </g>
        ))}
        {[26, 62, 96].map((rx) => (
          <ellipse key={rx} cx="150" cy="150" rx={rx} ry="118" />
        ))}
        <ellipse cx="150" cy="150" rx="118" ry="118" />
      </g>

      {/* Continent blobs. Loose shapes, not real geography: this globe is 300px
          across and the visible face is smaller still, so genuine coastlines
          would turn to mud. The real ones are in WorldMap.jsx, at a size that
          can carry them. */}
      <g clipPath="url(#lp-globe-clip)" fill="#fff" opacity=".28">
        <path d="M74 96c14-12 34-10 44 2s-4 26-18 30-28 8-34-2 0-22 8-30Z" />
        <path d="M96 154c16-6 30 2 32 16s-10 30-24 34-24-6-24-20 2-26 16-30Z" />
        <path d="M158 84c22-10 48-6 58 8s2 30-14 34-38 2-46-8-4-28 2-34Z" />
        <path d="M186 150c18-4 32 6 32 20s-12 28-26 28-22-12-20-26 6-20 14-22Z" />
      </g>

      <circle cx="150" cy="150" r="118" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="1.5" />

      {/* Orbiting arc + plane. Rotated by CSS on .lp-globe-orbit. */}
      <g className="lp-globe-orbit">
        <ellipse
          cx="150" cy="150" rx="140" ry="52"
          fill="none" stroke="var(--accent-700)" strokeWidth="2"
          strokeDasharray="6 8" opacity=".55" transform="rotate(-24 150 150)"
        />
        <g transform="rotate(-24 150 150) translate(290 150) rotate(96)" fill="var(--accent-700)">
          <path d="M18 7-7 13-5 7 5 5-5 3-7-3 18 3a2 2 0 0 1 0 4Z" />
        </g>
      </g>
    </svg>
  );
}

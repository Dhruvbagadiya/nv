/*
 * Generates the flight-path @keyframes for the boarding intro.
 *
 * Run by hand:  node scripts/build-boarding-path.mjs
 * Paste the output into BoardingAnimation.css between the GENERATED markers.
 *
 * WHY THIS EXISTS
 * ---------------
 * The path this replaces was maintained by hand across two different percentage
 * bases — translateX resolved against the plane's WIDTH, translateY against its
 * HEIGHT — and the 1.8 aspect correction ended up applied twice. The result was
 * a loop-the-loop that was really a 1.81:1 vertical ellipse (Rx 75px, Ry 135px)
 * while the rotation stepped a uniform 22.5° as though it were a circle, so the
 * nose never pointed along the actual direction of travel.
 *
 * Everything here is therefore in ONE unit, `u`, for both axes. Angles are true,
 * the shape is similar at every viewport, and the conversion to CSS percentages
 * happens exactly once, here, where it can be tested.
 *
 * Coordinates: origin at the plane's parked anchor (left:50%, top:--plane-top),
 * +x right, +y DOWN (screen convention, so atan2(dy, dx) is the screen angle).
 */

import { pathToFileURL } from 'node:url';

export const PLANE_U = 21;              // plane width, in u
export const ASPECT = 1.8;              // plane.svg viewBox 1440x800
const PLANE_H_U = PLANE_U / ASPECT;

/*
 * The sprite is a side view mirrored once, statically. It can only ever face
 * right, so the path must travel rightward at every instant — any leftward
 * segment would show the plane flying backwards. `assertMonotonic` enforces it
 * on the control polygon, which is sufficient: a Bézier is contained in the
 * convex hull of its control points, so an increasing polygon cannot double back.
 */
export const VARIANTS = {
  landscape: {
    // Bounding the unit by BOTH axes is the whole point. Bound it by width alone
    // and the path is too tall on a short window; by height alone and it is far
    // too wide on a phone.
    // 1.35vh, not 1.6: at 1366x768 and 1280x800 a 1.6 cap left the unit
    // width-bound, and the departure then climbed the aircraft up under the
    // sticky header. Short windows have to shrink the whole path, not just clip it.
    unit: { div: 96, vh: 1.35 },
    /*
     * The hero's own layout is px-driven — header 74 + padding 96 + content — so
     * its globe sits at roughly y 525-565 whatever the window height is. A plain
     * `46%` anchor therefore drifted DOWN onto the globe as the viewport got
     * taller: fine at 900, grazing it at 1080. The px term pins the park a fixed
     * distance above the globe on tall screens; the 46% ceiling takes over on
     * short ones, where the px anchor would push the aircraft off the bottom.
     */
    planeTop: (u, vh) => Math.min(340 + 6 * u, 0.46 * vh),
    /*
     * PARK ON THE GROUND, at y = +12.4u.
     *
     * The previous path bottomed out at +14u and then CLIMBED BACK to -6u to
     * park, so the aircraft touched down and floated two plane-heights into the
     * air — and the passengers then walked along a line a full plane-height
     * below the fuselage and vanished into seats they could not have reached.
     * The CSS said as much: "the gap between the walkers' feet and the fuselage
     * ... is 1.06 plane-heights everywhere."
     *
     * The walkers' feet are at --ground-top + person-h/2 = 14 + 4.2 = 18.2u, and
     * the plane's half-height is 21/1.8/2 = 5.83u, so a belly resting on that
     * line puts the centre at 18.2 - 5.83 = 12.37u. Portrait ALREADY does this
     * (its park at -7u puts belly and feet both at -1.17u) — landscape was the
     * odd one out, which is why only landscape read as a hovering aircraft.
     */
    segments: [
      // Approach: a shallow, steady descent out of the left. The path this
      // replaces reached 56.4deg nose-down, which is not an approach, it is a
      // dive; a landing holds a shallow attitude all the way down.
      { from: 0,  to: 12, ease: 'linear', p: [[-95, -4], [-75, 0], [-55, 6], [-40, 10]] },
      // Flare: the nose comes up to level and the wheels meet the ground. Ends
      // level by construction (the last control pair is horizontal).
      { from: 12, to: 20, ease: 'linear', p: [[-40, 10], [-34, 11.6], [-30, 12.4], [-26, 12.4]] },
      // Roll-out: level, decelerating to a stop on the park. This is the ONLY
      // deceleration in the approach, and it happens on the ground.
      { from: 20, to: 30, ease: 'out', p: [[-26, 12.4], [-16, 12.4], [-8, 12.4], [4, 12.4]] },
      // 30-74% is the boarding hold, emitted as two flat keyframes.
      // Take-off roll: level, accelerating from the standstill.
      { from: 74, to: 82, ease: 'in', p: [[4, 12.4], [10, 12.4], [16, 12.4], [22, 12.4]] },
      // Rotate: nose comes up off the ground, 0deg to the -20deg climb attitude.
      { from: 82, to: 88, ease: 'linear', p: [[22, 12.4], [29, 12.4], [35.42, 10.39], [42, 8]] },
      // Climb out and LEAVE — a straight -20deg line carried far enough right
      // that the aircraft is wholly past the edge of the widest test viewport.
      { from: 88, to: 96, ease: 'linear', p: [[42, 8], [63, 0.37], [84, -7.27], [105, -14.9]] },
    ],
    hold: [30, 74],
    exit: 96,
  },
  portrait: {
    // A phone gives the sweep almost no width, so the portrait path trades
    // horizontal reach for vertical: same idea, reproportioned, with a unit that
    // is correspondingly larger so the aircraft stays legible.
    // 0.95vh, not 1.1: the portrait park has to fit inside a 146px band and an
    // 11.67u-tall aircraft did not clear it at 834x1112.
    unit: { div: 54, vh: 0.95 },
    /*
     * Below 900px the hero restacks (.lp-hero-visual { order: -1 }), so the orbit
     * moves to the TOP and the clear band is underneath it: measured, the globe
     * bottoms out at y 465 and the H1's first line starts at y 611, both px-driven
     * and near-constant across portrait widths. 538 is the centre of that band.
     */
    planeTop: (u) => 538 + 7 * u,
    // Park stays at -7u: portrait already rested the belly on the walkers' feet.
    segments: [
      { from: 0,  to: 12, ease: 'linear', p: [[-62, -22], [-48, -18.5], [-34, -12.5], [-24, -9.4]] },
      { from: 12, to: 20, ease: 'linear', p: [[-24, -9.4], [-19, -8], [-15, -7], [-11, -7]] },
      { from: 20, to: 30, ease: 'out', p: [[-11, -7], [-6, -7], [-1, -7], [3, -7]] },
      { from: 74, to: 82, ease: 'in', p: [[3, -7], [7, -7], [11, -7], [15, -7]] },
      { from: 82, to: 88, ease: 'linear', p: [[15, -7], [19, -7], [23.24, -8.43], [27, -9.8]] },
      { from: 88, to: 96, ease: 'linear', p: [[27, -9.8], [36.67, -13.32], [46.33, -16.84], [56, -20.36]] },
    ],
    hold: [30, 74],
    exit: 96,
  },
};

// Sampling density. Raised from 12 because the portrait bank turns fast enough
// that 12 samples left an 21° gap between two frames — visible as a flick.
const SAMPLES = 15;

const bez = (p, t) => {
  const m = 1 - t;
  return [0, 1].map((i) =>
    m ** 3 * p[0][i] + 3 * m * m * t * p[1][i] + 3 * m * t * t * p[2][i] + t ** 3 * p[3][i]);
};

const dbez = (p, t) => {
  const m = 1 - t;
  return [0, 1].map((i) =>
    3 * (m * m * (p[1][i] - p[0][i]) + 2 * m * t * (p[2][i] - p[1][i]) + t * t * (p[3][i] - p[2][i])));
};

/*
 * Per-segment sampling curve.
 *
 * `smooth` slows at BOTH ends. That is right for a beat that starts and stops,
 * and wrong for one that flows into the next: the old path used it everywhere,
 * so the aircraft decelerated to nearly a standstill at 17% — mid-approach, in
 * clear air — and accelerated out again. A landing has one deceleration in it,
 * on the ground, after the wheels are down.
 *
 *   linear  constant speed, for a segment continuous with its neighbours
 *   out     decelerate to a stop (the roll-out onto the park)
 *   in      accelerate from a stop (the take-off roll)
 *   smooth  slow at both ends
 */
const EASES = {
  linear: (x) => x,
  in: (x) => x * x,
  out: (x) => 1 - (1 - x) ** 2,
  smooth: (x) => x * x * (3 - 2 * x),
};

const deg = (dx, dy) => (Math.atan2(dy, dx) * 180) / Math.PI;
const r2 = (n) => Math.round(n * 100) / 100;

function assertMonotonic(name, seg) {
  for (let i = 1; i < seg.p.length; i += 1) {
    if (seg.p[i][0] < seg.p[i - 1][0]) {
      throw new Error(
        `${name}: control polygon goes backwards at point ${i} `
        + `(${seg.p[i - 1][0]} -> ${seg.p[i][0]}). The sprite cannot fly in reverse.`);
    }
  }
}

export function build(name, v) {
  const rows = [];
  let maxStep = 0;
  let prevRot = null;

  for (const seg of v.segments) {
    assertMonotonic(name, seg);
    for (let i = 0; i <= SAMPLES; i += 1) {
      const t = (EASES[seg.ease] ?? EASES.smooth)(i / SAMPLES);
      const [x, y] = bez(seg.p, t);
      const [dx, dy] = dbez(seg.p, t);
      const rot = deg(dx, dy);
      const at = seg.from + (seg.to - seg.from) * (i / SAMPLES);
      // Skip the duplicate frame where one segment ends and the next begins.
      if (rows.length && Math.abs(rows[rows.length - 1].at - at) < 1e-9) continue;
      if (prevRot !== null) maxStep = Math.max(maxStep, Math.abs(rot - prevRot));
      prevRot = rot;
      rows.push({ at, x, y, rot });
    }
    // The hold: two flat frames pinning the parked position and attitude.
    if (seg.to === v.hold[0]) {
      const last = rows[rows.length - 1];
      rows.push({ at: v.hold[1], x: last.x, y: last.y, rot: last.rot });
      prevRot = last.rot;
    }
  }

  // The aircraft has left the frame by `exit`; this holds it out there for the
  // remaining few percent while the overlay begins to fade.
  const last = rows[rows.length - 1];
  if (last.at < 100) rows.push({ at: 100, x: last.x, y: last.y, rot: last.rot });

  /*
   * Two attitudes are not negotiable. A parked aircraft sitting nose-up reads as
   * broken, and a nose that snaps as the hold ends betrays the whole illusion.
   */
  const park = rows.find((r) => r.at === v.hold[0]);
  const leave = rows.find((r) => r.at === v.hold[1]);
  for (const [label, row] of [['park arrival', park], ['departure start', leave]]) {
    if (Math.abs(row.rot) > 0.5) {
      throw new Error(`${name}: ${label} attitude is ${r2(row.rot)}°, must be level (0°).`);
    }
  }

  return { rows, maxStep, park, exit: rows.find((r) => r.at === v.exit) };
}

export function css(name, v, built) {
  const lines = built.rows.map(({ at, x, y, rot }) => {
    const pct = `${r2(at)}%`.padEnd(8);
    // x is a length in u, so it needs no conversion. y is converted to a
    // percentage of the plane's HEIGHT because that is what translateY resolves
    // against — this single line is the only place the two bases ever meet.
    const ty = r2((y / PLANE_H_U) * 100);
    return `  ${pct}{ transform: translateX(calc(${r2(x)} * var(--u))) translateY(${ty}%)`
      + ` rotate(${r2(rot)}deg); }`;
  });
  return `@keyframes boarding-plane-${name} {\n${lines.join('\n')}\n}`;
}

/*
 * Containment report. The old path was tuned at one window size and shipped
 * broken at another, so every candidate viewport gets checked here before a
 * single line of CSS is written.
 *
 * Two different questions now, because the aircraft LEAVES:
 *   park      must be wholly on screen, and clear of the sticky header
 *   exit      must be wholly PAST the right edge, or the intro ends with a
 *             plane parked half-off the side of the window
 * `margin` is reported for the park; `clear` is how far beyond the right edge
 * the exit waypoint's trailing edge has travelled. Both must be positive.
 */
export const VIEWPORTS = [
  [1920, 1080], [1600, 900], [1440, 900], [1366, 768], [1280, 800],
  [1024, 768], [912, 1368], [834, 1112], [768, 1024],
  [430, 932], [412, 915], [390, 844], [360, 640], [844, 390],
];

export function unitPx(v, vw, vh) {
  const content = Math.min(1132, vw - 48);
  return Math.min(content / v.unit.div, (v.unit.vh / 100) * vh);
}

export function report(name, v, built, log = console.error) {
  const rows = [];
  for (const [vw, vh] of VIEWPORTS) {
    // Must match the CSS media condition exactly: narrow AND tall. Width alone
    // would send a landscape phone (844x390) down the portrait path, and aspect
    // alone would send a 912x1368 tablet there even though its hero is still the
    // two-column desktop layout.
    const portrait = vw <= 900 && vh >= vw;
    if ((name === 'portrait') !== portrait) continue;
    const u = unitPx(v, vw, vh);
    const pw = PLANE_U * u;
    const ph = pw / ASPECT;
    const check = (pt) => {
      const cx = vw / 2 + pt.x * u;
      const cy = v.planeTop(u, vh) + pt.y * u;
      // True rotated bounding box, not the circumscribing circle: the circle is
      // conservative enough to reject paths that are actually fine, and both of
      // these frames are level anyway.
      const a = (pt.rot * Math.PI) / 180;
      const hw = (Math.abs(pw * Math.cos(a)) + Math.abs(ph * Math.sin(a))) / 2;
      const hh = (Math.abs(pw * Math.sin(a)) + Math.abs(ph * Math.cos(a))) / 2;
      return { cx, cy, left: cx - hw, right: cx + hw, top: cy - hh, bottom: cy + hh };
    };
    const park = check(built.park);
    const exit = check(built.exit);
    /*
     * The top gets its own floor: the overlay sits at z-index 9999, above the
     * sticky header, so an aircraft that is merely "on screen" can still be
     * parked across the navigation. --head-h is 74px; the proportional term
     * keeps this sane on a landscape phone where 74px is a fifth of the screen.
     */
    const headroom = Math.min(78, 0.12 * vh);
    const margin = Math.min(
      park.left, vw - park.right,
      park.top - headroom,
      vh - park.bottom);
    // How far the aircraft's TRAILING edge is past the right edge of the window.
    const clear = exit.left - vw;
    rows.push({ vw, vh, u, pw, margin, clear, parkCx: park.cx, parkCy: park.cy });
  }
  log(`\n  ${name}:  vw x vh      u     planeW  %vw   park     exit-clear`);
  for (const r of rows) {
    log(
      `    ${String(r.vw).padStart(4)}x${String(r.vh).padEnd(5)}`
      + `${r.u.toFixed(2).padStart(7)}${r.pw.toFixed(0).padStart(8)}`
      + `${(100 * r.pw / r.vw).toFixed(1).padStart(6)}`
      + `${r.margin.toFixed(0).padStart(9)}${r.margin < 8 ? ' ***' : '    '}`
      + `${r.clear.toFixed(0).padStart(11)}${r.clear < 8 ? ' ***' : '    '}`);
  }
  return Math.min(...rows.map((r) => Math.min(r.margin, r.clear)));
}

/*
 * Everything above is importable so boardingPath.test.js can assert the same
 * invariants this script enforces — including that the block pasted into
 * BoardingAnimation.css is still what the current waypoints produce.
 */
export function generate(log = () => {}) {
  const blocks = [];
  let worst = Infinity;
  for (const [name, v] of Object.entries(VARIANTS)) {
    const built = build(name, v);
    blocks.push(css(name, v, built));
    worst = Math.min(worst, report(name, v, built, log));
  }
  return { css: blocks.join('\n\n'), worstMargin: worst };
}

// CLI only. Importing this module must not print anything or throw on its own.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { css: out, worstMargin } = generate(console.error);
  console.error(`\n  worst edge margin across all viewports: ${r2(worstMargin)}px`);
  if (worstMargin < 8) {
    throw new Error(
      'Either the park is off screen or the aircraft has not fully left it by `exit`. '
      + 'Fix the path, not the check.');
  }
  console.log(out);
}

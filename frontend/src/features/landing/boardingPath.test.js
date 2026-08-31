import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VARIANTS, PLANE_U, build, generate, unitPx, VIEWPORTS }
  from '../../../scripts/build-boarding-path.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cssFile = readFileSync(join(here, 'BoardingAnimation.css'), 'utf8');

// --ground-top, in u from the plane anchor, read off the CSS: `+ 14 * var(--u)`
// in the base rule and `- 5.37 * var(--u)` in the portrait media block. The
// walkers hang off these, so the park height has to agree with them.
const GROUND_U = { landscape: 14, portrait: -5.37 };

/*
 * The flight path this guards used to be maintained by hand across two different
 * percentage bases, and the 1.8 aspect correction ended up applied twice: its
 * "loop-the-loop" was really a 1.81:1 vertical ellipse while the rotation
 * stepped a uniform 22.5° as though it were a circle. These tests exist so that
 * class of mistake cannot come back silently.
 */
describe('boarding flight path', () => {
  for (const [name, v] of Object.entries(VARIANTS)) {
    describe(name, () => {
      const built = build(name, v);

      it('parks level and leaves level', () => {
        // A parked aircraft sitting nose-up reads as broken, and a nose that
        // snaps the instant the hold ends gives the whole illusion away.
        const park = built.rows.find((r) => r.at === v.hold[0]);
        const leave = built.rows.find((r) => r.at === v.hold[1]);
        expect(Math.abs(park.rot)).toBeLessThan(0.5);
        expect(Math.abs(leave.rot)).toBeLessThan(0.5);
      });

      it('never turns more than 18° between two keyframes', () => {
        // Keyframes interpolate linearly, so a large step reads as a flick
        // rather than a bank.
        expect(built.maxStep).toBeLessThan(18);
      });

      it('never flies backwards', () => {
        // The sprite is a side view mirrored once, statically — it can only face
        // right. A Bézier stays inside the hull of its control points, so a
        // monotonically increasing polygon is enough to guarantee it.
        for (const seg of v.segments) {
          const xs = seg.p.map((pt) => pt[0]);
          expect([...xs].sort((a, b) => a - b)).toEqual(xs);
        }
      });

      it('never exceeds a plausible approach attitude', () => {
        // The path this replaces reached 56.4deg nose-down on the way in, which
        // is not an approach, it is a dive. Nothing on the approach may be
        // steeper than 20deg, and the climb-out is capped at the same.
        const steepest = Math.max(...built.rows.map((r) => Math.abs(r.rot)));
        expect(steepest).toBeLessThanOrEqual(21);
      });

      it('touches down before it parks, and never climbs back to park', () => {
        // The landscape path used to bottom out at +14u and then CLIMB to -6u,
        // so the aircraft landed and floated two plane-heights into the air —
        // and the passengers walked along a line a full plane-height below the
        // fuselage. The park must be the LOWEST point of the approach.
        const approach = built.rows.filter((r) => r.at <= v.hold[0]);
        const lowest = Math.max(...approach.map((r) => r.y));
        expect(built.park.y).toBeCloseTo(lowest, 6);
      });

      it('rests the fuselage on the line the walkers stand on', () => {
        // The walkers' feet: --ground-top + person-h/2, where person-h is
        // 0.72 plane-heights. The plane's belly: park.y + plane-h/2. A door the
        // passengers cannot reach is the whole reason this animation read wrong.
        const planeH = PLANE_U / 1.8;
        const feet = GROUND_U[name] + (0.72 * planeH) / 2;
        expect(built.park.y + planeH / 2).toBeCloseTo(feet, 1);
      });

      it('holds a single position through the whole boarding beat', () => {
        const inHold = built.rows.filter((r) => r.at >= v.hold[0] && r.at <= v.hold[1]);
        expect(inHold).toHaveLength(2);
        expect(inHold[0].x).toBe(inHold[1].x);
        expect(inHold[0].y).toBe(inHold[1].y);
      });
    });
  }

  it('parks on screen and leaves it entirely, at every test viewport', () => {
    // This is the check whose absence let the previous path look correct at
    // 1440x900 and park on top of the globe at 1920x1080. It now also asserts
    // the aircraft is wholly PAST the right edge by `exit` — an intro that ends
    // with a plane half off the side of the window is not an exit.
    expect(generate().worstMargin).toBeGreaterThanOrEqual(8);
  });

  it('scales the aircraft consistently against the hero, not the window', () => {
    // The old sizing was clamp(150px, 32vw, 440px): both ends bound, so the
    // plane went from 22.9% of a 1920 screen to 41.7% of a 360 one. Measured
    // against the content it now sits in, it must be constant.
    for (const [name, v] of Object.entries(VARIANTS)) {
      const fracs = VIEWPORTS
        .filter(([vw, vh]) => (vw <= 900 && vh >= vw) === (name === 'portrait'))
        .map(([vw, vh]) => {
          const content = Math.min(1132, vw - 48);
          return (PLANE_U * unitPx(v, vw, vh)) / content;
        });
      // Only the vh ceiling can pull it below the width-derived value, never above.
      expect(Math.max(...fracs)).toBeCloseTo(PLANE_U / v.unit.div, 6);
    }
  });
});

describe('the generated CSS block', () => {
  it('is exactly what the current waypoints produce', () => {
    // BoardingAnimation.css carries a "GENERATED — DO NOT HAND-EDIT" header. This
    // is what makes that true: edit the keyframes by hand, or change the
    // waypoints without re-running the script, and this fails.
    const generated = generate().css.trim();
    const start = cssFile.indexOf('@keyframes boarding-plane-landscape');
    expect(start).toBeGreaterThan(-1);
    const end = cssFile.indexOf('/* ---- seated passengers');
    expect(end).toBeGreaterThan(start);
    expect(cssFile.slice(start, end).trim()).toBe(generated);
  });

  it('drives the animation and both anchors from the one shared unit', () => {
    // If any of these regress to a raw vw/vh percentage the path stops being
    // geometrically similar and the nose angles stop matching the travel.
    expect(cssFile).toMatch(/--u:\s*min\(calc\(var\(--stage-c\) \/ 96\), 1\.35vh\)/);
    expect(cssFile).toMatch(/--plane-w:\s*calc\(21 \* var\(--u\)\)/);
    expect(cssFile).toMatch(/--ground-top:\s*calc\(var\(--plane-top\)/);
    expect(cssFile).not.toMatch(/clamp\(150px, 32vw, 440px\)/);
    // Both conditions, mirroring the hero's own restack breakpoint.
    expect(cssFile).toMatch(/@media \(max-width: 900px\) and \(max-aspect-ratio: 1\/1\)/);
  });
});

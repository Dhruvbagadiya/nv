import { useEffect, useState } from 'react';
import './BoardingAnimation.css';

/*
 * BOARDING ANIMATION — beat sheet
 * --------------------------------
 * Everything below is percentages of a single shared duration, --dur (9s).
 * One CSS variable drives every actor's @keyframes, so nothing can drift
 * out of sync — there are no per-actor delays or durations to keep aligned.
 *
 *   0%  - 22%   Plane flies in from off-screen RIGHT, nose left, parks
 *               centre-screen.
 *  18%  - 39%   Traveller walks on from off-screen LEFT, reaches the plane.
 *        40%    Traveller vanishes from the ground; seat 1 (39% width)
 *               fades in — a child of the plane, so it now travels with it.
 *  40%  - 44%   Plane waits (nothing moves).
 *  44%  - 61%   Couple walk on from off-screen LEFT, reach the plane.
 *        62%    Couple vanish from the ground; seats 2+3 (couple art spans
 *               both, centred ~55.5% width) fade in.
 *  62%  - 74%   Plane waits, fully boarded, all three visible.
 *  74%  - 100%  Plane accelerates LEFT (same direction it arrived from —
 *               nose already points left, so it's always moving nose-first,
 *               never backwards), tilts nose-up, climbs off the left edge.
 *
 * After --dur elapses the overlay fades out over --fade-dur (600ms), then
 * the component unmounts itself. Skip jumps straight to unmounted.
 *
 * Tunable geometry lives at the top of BoardingAnimation.css:
 * --plane-w, --person-w (both actors share one scale, see comment there),
 * --seat-clip (how much of the passenger is visible above the seat back),
 * and the seat/ground anchor positions.
 */

const SOURCES = {
  plane: '/intro/plane.png',
  traveller: '/intro/traveller.png',
  couple: '/intro/couple.png',
};

const DUR_MS = 9000;
const FADE_MS = 600;

function preload(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.decode) {
        // decode() can reject in some browsers even though the image is
        // usable (e.g. animated/odd formats) — onload already fired, so
        // treat a decode failure as non-fatal.
        img.decode().then(resolve, resolve);
      } else {
        resolve();
      }
    };
    img.onerror = reject;
    img.src = src;
  });
}

export default function BoardingAnimation() {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    Promise.all(Object.values(SOURCES).map(preload))
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        // one or more images failed to load/decode — skip silently
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const fadeTimer = setTimeout(() => setFading(true), DUR_MS);
    const doneTimer = setTimeout(() => setVisible(false), DUR_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [ready]);

  if (!ready || !visible) return null;

  return (
    <div
      className={`boarding-overlay${fading ? ' boarding-overlay--fading' : ''}`}
      style={{ '--dur': `${DUR_MS}ms`, '--fade-dur': `${FADE_MS}ms` }}
      aria-hidden="true"
    >
      <button
        type="button"
        className="boarding-skip"
        aria-label="Skip intro animation"
        onClick={() => setVisible(false)}
      >
        Skip
      </button>

      <div className="boarding-plane">
        <img src={SOURCES.plane} alt="" className="boarding-plane__img" draggable="false" />

        {/* Seated passengers are children of the plane element on purpose:
            they inherit its transform for free during takeoff, so there is
            no second animation to keep in sync with the flight path. */}
        <div className="boarding-seat boarding-seat--1">
          <img src={SOURCES.traveller} alt="" className="boarding-seat__img" draggable="false" />
        </div>
        <div className="boarding-seat boarding-seat--23">
          <img src={SOURCES.couple} alt="" className="boarding-seat__img" draggable="false" />
        </div>
      </div>

      <img
        src={SOURCES.traveller}
        alt=""
        className="boarding-walker boarding-walker--traveller"
        draggable="false"
      />
      <img
        src={SOURCES.couple}
        alt=""
        className="boarding-walker boarding-walker--couple"
        draggable="false"
      />
    </div>
  );
}

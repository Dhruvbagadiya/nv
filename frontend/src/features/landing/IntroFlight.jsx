import { useEffect, useRef, useState } from 'react';

/**
 * Opening sequence: a little plane swoops in from the right, a traveller in a
 * pagdi walks on from the left and hops aboard, a couple with their bags follow
 * him on, then the plane climbs, loops once across the screen and disappears
 * off to the right.
 *
 * Three decisions worth knowing about:
 *
 * 1. It plays ONCE PER SESSION (sessionStorage). A six-second intro is
 *    delightful the first time and infuriating on every page view, and a
 *    returning visitor who came back to find a phone number should not have to
 *    sit through it. Skip is always available.
 *
 * 2. The plane is drawn TOP-DOWN, not side-on. A side view rotated through a
 *    loop spends half the loop upside down and reads as a crash; a top-down
 *    plane looks correct at every angle, which is why the flight-path motif on
 *    the rest of the site uses the same view.
 *
 * 3. Motion is `offset-path` rather than hand-authored translate keyframes.
 *    One declared curve, `offset-rotate: auto` banks the plane into its own
 *    turn for free, and the browser interpolates along the path instead of
 *    between a dozen approximated waypoints.
 */

const SESSION_KEY = 'nv-intro-played';
const TOTAL_MS = 7000;

export default function IntroFlight({ onDone }) {
  const [state, setState] = useState('checking'); // checking | playing | done
  const timer = useRef(null);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const seen = sessionStorage.getItem(SESSION_KEY);

    if (reduced || seen) {
      setState('done');
      onDone?.();
      return;
    }

    // The "seen" flag is written in finish(), NOT here. Writing it up front
    // meant StrictMode's development double-invoke read back the flag its own
    // first pass had just written, decided the intro had already played, and
    // rendered nothing — so the sequence was invisible locally while working in
    // production. Marking it only once the flight is over is also more honest:
    // an intro the visitor never actually saw has not been played.
    setState('playing');
    // Scrolling mid-flight would show the page sliding under a fixed overlay.
    document.body.style.overflow = 'hidden';

    timer.current = setTimeout(() => finish(), TOTAL_MS);
    return () => {
      clearTimeout(timer.current);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    clearTimeout(timer.current);
    document.body.style.overflow = '';
    sessionStorage.setItem(SESSION_KEY, '1');
    setState('done');
    onDone?.();
  };

  if (state !== 'playing') return null;

  return (
    <div className="intro" role="presentation">
      <button className="intro-skip" onClick={finish}>Skip intro →</button>

      <svg
        className="intro-stage"
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          {/* The flight path, drawn once and referenced by the CSS
              offset-path. Enter from the right, settle mid-stage, then a single
              loop and away off the right edge. */}
          <path id="nv-flight" d="
            M 1420 250
            C 1180 250, 1020 300, 780 320
            C 700 327, 660 330, 640 330
            C 470 330, 330 250, 360 160
            C 385 88, 520 70, 585 140
            C 655 214, 600 320, 700 372
            C 860 455, 1120 330, 1420 120
          " fill="none" />

          <linearGradient id="nv-plane-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#EDF1F7" />
          </linearGradient>
        </defs>

        {/* Dotted trail — the same visual language as the flight lines used
            elsewhere on the page. It draws itself in behind the plane. */}
        <use href="#nv-flight" className="intro-trail" />

        {/* ── Ground line + characters ─────────────────────────────── */}
        <g className="intro-ground">
          <line x1="0" y1="470" x2="1200" y2="470" />
        </g>

        {/* Traveller in a pagdi, with his suitcase. */}
        <g className="intro-char intro-pagdi">
          <g className="intro-bob">
            {/* suitcase */}
            <g className="intro-case">
              <rect x="26" y="-22" width="30" height="23" rx="4" fill="#B3650E" />
              <rect x="26" y="-15" width="30" height="4" fill="#8c4f0b" />
              <path d="M36 -22 v-5 a5 5 0 0 1 10 0 v5" fill="none" stroke="#8c4f0b" strokeWidth="3" />
            </g>
            {/* legs */}
            <g className="intro-legs" stroke="#3D4756" strokeWidth="7" strokeLinecap="round">
              <line className="intro-leg-a" x1="0" y1="-26" x2="-6" y2="0" />
              <line className="intro-leg-b" x1="0" y1="-26" x2="7" y2="0" />
            </g>
            {/* kurta */}
            <path d="M-15 -28 q0 -34 15 -34 q15 0 15 34 z" fill="#F4F6FA" stroke="#D8DEE9" strokeWidth="2" />
            {/* arm to the case */}
            <path d="M13 -52 q16 8 16 30" fill="none" stroke="#E8B98C" strokeWidth="6" strokeLinecap="round" />
            {/* head */}
            <circle cx="0" cy="-72" r="13" fill="#E8B98C" />
            {/* moustache + smile */}
            <path d="M-6 -68 q6 5 12 0" fill="none" stroke="#5B4636" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="-5" cy="-75" r="1.8" fill="#3D2B1F" />
            <circle cx="5"  cy="-75" r="1.8" fill="#3D2B1F" />
            {/* pagdi */}
            <path d="M-15 -80 q3 -18 15 -18 q12 0 15 18 q-15 -7 -30 0 z" fill="var(--accent-700)" />
            <path d="M-14 -80 q15 -6 28 0" fill="none" stroke="#B3650E" strokeWidth="2" />
            <path d="M13 -95 q12 -6 8 8" fill="none" stroke="var(--accent-700)" strokeWidth="5" strokeLinecap="round" />
          </g>
        </g>

        {/* Couple, hand in hand, bags over their shoulders. */}
        <g className="intro-char intro-couple">
          <g className="intro-bob">
            {/* her */}
            <g transform="translate(-20,0)">
              <g className="intro-legs" stroke="#3D4756" strokeWidth="6" strokeLinecap="round">
                <line className="intro-leg-a" x1="0" y1="-24" x2="-5" y2="0" />
                <line className="intro-leg-b" x1="0" y1="-24" x2="6" y2="0" />
              </g>
              <path d="M-13 -26 q0 -30 13 -30 q13 0 13 30 z" fill="#E9645F" />
              <circle cx="0" cy="-64" r="11.5" fill="#F0C49B" />
              <path d="M-12 -66 q2 -16 12 -16 q10 0 12 16 q-6 -6 -12 -6 q-6 0 -12 6z" fill="#3D2B1F" />
              <path d="M-12 -66 q-3 12 2 18" fill="none" stroke="#3D2B1F" strokeWidth="5" strokeLinecap="round" />
              <circle cx="-4" cy="-66" r="1.6" fill="#3D2B1F" />
              <circle cx="4"  cy="-66" r="1.6" fill="#3D2B1F" />
              <path d="M-4 -60 q4 4 8 0" fill="none" stroke="#B4674E" strokeWidth="2" strokeLinecap="round" />
            </g>
            {/* him */}
            <g transform="translate(20,0)">
              <g className="intro-legs" stroke="#3D4756" strokeWidth="6.5" strokeLinecap="round">
                <line className="intro-leg-b" x1="0" y1="-25" x2="-6" y2="0" />
                <line className="intro-leg-a" x1="0" y1="-25" x2="6" y2="0" />
              </g>
              <path d="M-13 -27 q0 -31 13 -31 q13 0 13 31 z" fill="#4C6EA8" />
              <circle cx="0" cy="-66" r="12" fill="#E8B98C" />
              <path d="M-12 -70 q3 -13 12 -13 q9 0 12 13 q-12 -6 -24 0z" fill="#3D2B1F" />
              <circle cx="-4" cy="-67" r="1.7" fill="#3D2B1F" />
              <circle cx="4"  cy="-67" r="1.7" fill="#3D2B1F" />
              <path d="M-4 -61 q4 4 8 0" fill="none" stroke="#8A5A3B" strokeWidth="2" strokeLinecap="round" />
              {/* backpack */}
              <rect x="12" y="-52" width="16" height="22" rx="5" fill="var(--accent-700)" />
            </g>
            {/* held hands */}
            <path d="M-8 -44 q8 6 16 0" fill="none" stroke="#E8B98C" strokeWidth="5" strokeLinecap="round" />
          </g>
        </g>

        {/* ── The plane ────────────────────────────────────────────── */}
        <g className="intro-plane">
          <g className="intro-plane-art">
            {/* shadow keeps it sitting in the scene rather than pasted on */}
            <ellipse cx="0" cy="26" rx="34" ry="7" fill="rgba(16,24,40,.16)" />
            {/* wings */}
            <path d="M-4 0 L-34 -30 L-16 -30 L10 -4 Z" fill="#D9E1EC" />
            <path d="M-4 0 L-34  30 L-16  30 L10  4 Z" fill="#C9D3E2" />
            {/* tail */}
            <path d="M-36 0 L-52 -14 L-44 -14 L-30 -3 Z" fill="#D9E1EC" />
            <path d="M-36 0 L-52  14 L-44  14 L-30  3 Z" fill="#C9D3E2" />
            {/* fuselage */}
            <path d="M46 0 q-6 -12 -22 -13 L-44 -9 q-8 1 -8 9 q0 8 8 9 L24 13 q16 -1 22 -13 Z"
                  fill="url(#nv-plane-body)" stroke="#C2CBD9" strokeWidth="1.5" />
            {/* accent stripe + windows */}
            <path d="M-40 4 L24 8 q10 -1 16 -6 L-40 -2 Z" fill="var(--accent-700)" opacity=".9" />
            <circle cx="18" cy="-3" r="3" fill="#8FB4D9" />
            <circle cx="6"  cy="-4" r="3" fill="#8FB4D9" />
            <circle cx="-6" cy="-5" r="3" fill="#8FB4D9" />
            <circle cx="-18" cy="-5" r="3" fill="#8FB4D9" />
            {/* cockpit */}
            <path d="M30 -8 q10 2 14 7 q-8 3 -14 2 z" fill="#8FB4D9" />
          </g>
        </g>
      </svg>

      <div className="intro-caption">
        <span className="intro-caption-mark">NV</span>
        <span>Your journey starts here</span>
      </div>
    </div>
  );
}

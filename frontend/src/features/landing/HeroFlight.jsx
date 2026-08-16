/**
 * The hero scene: a continuous, looping departure.
 *
 * A plane taxis in from the right and waits. A traveller in a pagdi walks on
 * from the left with his suitcase and climbs aboard. A couple follow him with
 * their bags. The plane then takes off, loops once overhead and leaves to the
 * right — and the whole thing begins again.
 *
 * This replaced a full-screen intro curtain. A curtain blocks the page, has to
 * be skippable, and is only ever seen once; living in the hero means it is on
 * the page the visitor came to, plays for as long as they look at it, and costs
 * them nothing.
 *
 * Every figure is built on the same rules so they read as one set:
 *   - origin at the feet, body drawn upward in negative Y
 *   - heads deliberately oversized (about a third of total height), which is
 *     what makes a small figure read as "cute" rather than "small adult"
 *   - limbs rotate about their own top edge via transform-box: fill-box, the
 *     only way an SVG child rotates about a point on itself rather than the
 *     origin of the whole canvas
 */

function Pagdi() {
  return (
    <g className="hf-figure hf-pagdi">
      <g className="hf-bob">
        {/* legs — behind the body */}
        <rect className="hf-leg-a" x="-7"  y="-30" width="6" height="31" rx="3" fill="#3D4756" />
        <rect className="hf-leg-b" x="1.5" y="-30" width="6" height="31" rx="3" fill="#4A5568" />

        {/* kurta */}
        <path d="M-16 -30 q-1 -30 16 -30 q17 0 16 30 z" fill="#FBFCFE" stroke="#DCE3ED" strokeWidth="1.6" />
        <path d="M0 -60 v30" stroke="#DCE3ED" strokeWidth="1.4" />

        {/* far arm, then the suitcase, then the near arm over it */}
        <rect className="hf-arm-b" x="-19" y="-56" width="6" height="26" rx="3" fill="#F0F3F8" />

        <g className="hf-case">
          <rect x="14" y="-30" width="30" height="24" rx="4" fill="#C06A0C" />
          <rect x="14" y="-22" width="30" height="4" fill="#9A5309" />
          <path d="M24 -30 v-6 a5 5 0 0 1 10 0 v6" fill="none" stroke="#9A5309" strokeWidth="3" strokeLinecap="round" />
        </g>
        <rect className="hf-arm-a" x="13" y="-56" width="6" height="28" rx="3" fill="#EDB582" />

        {/* head */}
        <circle cx="0" cy="-76" r="16" fill="#EDB582" />
        <circle cx="-14" cy="-74" r="3" fill="#E3A570" />
        <circle cx="14"  cy="-74" r="3" fill="#E3A570" />
        <circle cx="-5.5" cy="-79" r="2.1" fill="#33251A" />
        <circle cx="5.5"  cy="-79" r="2.1" fill="#33251A" />
        {/* moustache, then a smile under it */}
        <path d="M-7 -71 q7 -4 14 0" fill="none" stroke="#4A3524" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M-4 -66 q4 4 8 0" fill="none" stroke="#B9764A" strokeWidth="1.8" strokeLinecap="round" />

        {/* pagdi — a wrapped band with a fantail, in the brand orange */}
        <path d="M-17 -84 q2 -22 17 -22 q15 0 17 22 q-17 -9 -34 0 z" fill="var(--accent-700)" />
        <path d="M-16 -85 q16 -8 32 0" fill="none" stroke="#B3650E" strokeWidth="2.2" />
        <path d="M-16 -90 q16 -7 32 0" fill="none" stroke="#B3650E" strokeWidth="1.6" opacity=".7" />
        <path d="M14 -101 q16 -9 11 9" fill="none" stroke="var(--accent-700)" strokeWidth="6" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Couple() {
  return (
    <g className="hf-figure hf-couple">
      <g className="hf-bob">
        {/* she */}
        <g transform="translate(-21,0)">
          <rect className="hf-leg-a" x="-6" y="-27" width="5.5" height="28" rx="2.75" fill="#3D4756" />
          <rect className="hf-leg-b" x="1"  y="-27" width="5.5" height="28" rx="2.75" fill="#4A5568" />
          <path d="M-15 -27 q-1 -28 15 -28 q16 0 15 28 z" fill="#E9645F" />
          <rect className="hf-arm-a" x="-18" y="-52" width="5.5" height="25" rx="2.75" fill="#F0C49B" />
          <circle cx="0" cy="-68" r="14.5" fill="#F0C49B" />
          {/* hair: a bob with a side sweep */}
          <path d="M-15 -70 q1 -20 15 -20 q14 0 15 20 q-8 -8 -15 -8 q-7 0 -15 8z" fill="#33251A" />
          <path d="M-15 -70 q-4 14 3 21" fill="none" stroke="#33251A" strokeWidth="6.5" strokeLinecap="round" />
          <circle cx="-5" cy="-70" r="2" fill="#33251A" />
          <circle cx="5"  cy="-70" r="2" fill="#33251A" />
          <path d="M-4 -63 q4 4 8 0" fill="none" stroke="#B9764A" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* he */}
        <g transform="translate(21,0)">
          <rect className="hf-leg-b" x="-6" y="-28" width="6" height="29" rx="3" fill="#3D4756" />
          <rect className="hf-leg-a" x="1"  y="-28" width="6" height="29" rx="3" fill="#4A5568" />
          {/* backpack sits behind the torso */}
          <rect x="10" y="-56" width="19" height="26" rx="6" fill="var(--accent-700)" />
          <rect x="10" y="-46" width="19" height="3.5" fill="#B3650E" />
          <path d="M-15 -28 q-1 -29 15 -29 q16 0 15 29 z" fill="#4C6EA8" />
          <rect className="hf-arm-b" x="12" y="-53" width="6" height="25" rx="3" fill="#EDB582" />
          <circle cx="0" cy="-70" r="15" fill="#EDB582" />
          <path d="M-15 -74 q3 -16 15 -16 q12 0 15 16 q-15 -8 -30 0z" fill="#33251A" />
          <circle cx="-5" cy="-72" r="2" fill="#33251A" />
          <circle cx="5"  cy="-72" r="2" fill="#33251A" />
          <path d="M-4 -65 q4 4 8 0" fill="none" stroke="#B9764A" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* the held hands, drawn last so they sit above both bodies */}
        <rect x="-9" y="-46" width="18" height="5.5" rx="2.75" fill="#EDB582" />
      </g>
    </g>
  );
}

export default function HeroFlight() {
  return (
    <div className="hf">
      <svg className="hf-stage" viewBox="0 0 560 460" role="img"
           aria-label="A traveller and a couple boarding a plane, which takes off and flies away">
        <defs>
          <linearGradient id="hf-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#EAF2FB" />
            <stop offset="100%" stopColor="#F9FBFE" />
          </linearGradient>
          <linearGradient id="hf-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E7EDF6" />
          </linearGradient>
          <clipPath id="hf-clip"><rect x="0" y="0" width="560" height="460" rx="26" /></clipPath>
        </defs>

        <g clipPath="url(#hf-clip)">
          <rect width="560" height="460" fill="url(#hf-sky)" />

          {/* clouds, drifting at two speeds for a sense of depth */}
          <g className="hf-cloud hf-cloud-1" opacity=".9">
            <ellipse cx="0" cy="0" rx="34" ry="17" fill="#fff" />
            <ellipse cx="24" cy="6" rx="26" ry="13" fill="#fff" />
            <ellipse cx="-22" cy="6" rx="22" ry="11" fill="#fff" />
          </g>
          <g className="hf-cloud hf-cloud-2" opacity=".7">
            <ellipse cx="0" cy="0" rx="26" ry="13" fill="#fff" />
            <ellipse cx="20" cy="5" rx="19" ry="10" fill="#fff" />
          </g>

          {/* the flight path, drawn as a dotted trail */}
          <path className="hf-trail" fill="none" d="
            M 640 150 C 520 150, 470 190, 380 214
            C 300 236, 250 244, 236 246
            C 150 258, 96 208, 118 156
            C 136 114, 208 106, 232 150
            C 258 198, 214 250, 268 282
            C 344 326, 470 250, 640 120" />

          {/* ground */}
          <line className="hf-ground" x1="-20" y1="392" x2="580" y2="392" />

          <Pagdi />
          <Couple />

          {/* plane */}
          <g className="hf-plane">
            <g className="hf-plane-art">
              <ellipse cx="0" cy="24" rx="30" ry="6" fill="rgba(16,24,40,.13)" />
              <path d="M-3 0 L-30 -27 L-14 -27 L9 -3 Z"  fill="#D2DCEA" />
              <path d="M-3 0 L-30  27 L-14  27 L9  3 Z"  fill="#BFCCDE" />
              <path d="M-32 0 L-47 -13 L-39 -13 L-27 -3 Z" fill="#D2DCEA" />
              <path d="M-32 0 L-47  13 L-39  13 L-27  3 Z" fill="#BFCCDE" />
              <path d="M42 0 q-6 -11 -20 -12 L-40 -8 q-7 1 -7 8 q0 7 7 8 L22 12 q14 -1 20 -12 Z"
                    fill="url(#hf-body)" stroke="#B9C5D6" strokeWidth="1.4" />
              <path d="M-37 3.5 L22 7 q9 -1 14 -5 L-37 -1.5 Z" fill="var(--accent-700)" opacity=".92" />
              <circle cx="16" cy="-3" r="2.7" fill="#8FB4D9" />
              <circle cx="5"  cy="-4" r="2.7" fill="#8FB4D9" />
              <circle cx="-6" cy="-4" r="2.7" fill="#8FB4D9" />
              <circle cx="-17" cy="-4" r="2.7" fill="#8FB4D9" />
              <path d="M27 -7 q9 2 13 6 q-7 3 -13 2 z" fill="#9DC3E6" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

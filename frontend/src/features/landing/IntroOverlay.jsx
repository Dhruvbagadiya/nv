import { useEffect, useRef, useState } from 'react';

/**
 * Full-screen boarding sequence, played over the landing page on load.
 *
 * A plane flies in from off-screen right and settles. A traveller in a pagdi
 * walks on from the left and takes a seat. A couple follow and take theirs.
 * With all three aboard the plane takes off to the left — the way it came in —
 * and the curtain lifts onto the page.
 *
 * The artwork is NOT drawn here. Three earlier attempts hand-drew the figures
 * in SVG and none of them were good enough; the drawings are supplied as files
 * in /public/intro and this module only choreographs them. Everything about the
 * sequence — seating, timing, easing — is independent of what the images
 * actually look like, so replacing the art never means touching this code.
 *
 * Until those files exist the overlay does nothing at all: a missing image
 * rejects and the whole sequence is skipped, so a half-finished asset drop
 * degrades to "no intro" rather than to a screen of broken-image icons over the
 * page.
 */

// .png first, .svg second. AI image tools emit raster, and requiring a vector
// would mean tracing every asset before it could even be looked at. Whichever
// exists wins; if both do, the SVG is preferred for sharpness.
const NAMES = ['plane', 'traveller', 'couple'];

function resolve(name) {
  return [`/intro/${name}.svg`, `/intro/${name}.png`];
}

const TOTAL_MS = 9000;

/** Loads the first candidate that exists, decoded and ready to paint. */
function loadOne(candidates) {
  return candidates.reduce(
    (chain, src) =>
      chain.catch(
        () =>
          new Promise((res, rej) => {
            const img = new Image();
            img.onload = () =>
              // decode() before we start: onload fires when the bytes have
              // arrived, not when the image can be painted, so animating
              // straight away drops the opening frames of a large asset.
              (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => res(src));
            img.onerror = () => rej(new Error(`missing: ${src}`));
            img.src = src;
          })
      ),
    Promise.reject()
  );
}

export default function IntroOverlay() {
  const [state, setState] = useState('idle'); // idle | playing | done
  const [src, setSrc] = useState(null);
  const timer = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setState('done');
      return undefined;
    }

    Promise.all(NAMES.map((n) => loadOne(resolve(n))))
      .then((found) => {
        if (!alive.current) return;
        setSrc({ plane: found[0], traveller: found[1], couple: found[2] });
        setState('playing');
        document.body.style.overflow = 'hidden';
        timer.current = setTimeout(finish, TOTAL_MS);
      })
      .catch(() => {
        // Assets not in place yet. Say so once in the console — a silent
        // no-show is exactly the failure that cost several rounds here — but
        // never block the page over it.
        console.info(
          '[intro] skipped: add plane, traveller and couple (.svg or .png) to public/intro/ to enable it.'
        );
        if (alive.current) setState('done');
      });

    return () => {
      alive.current = false;
      clearTimeout(timer.current);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    clearTimeout(timer.current);
    document.body.style.overflow = '';
    setState('done');
  };

  if (state !== 'playing' || !src) return null;

  return (
    <div className="io" role="presentation">
      <button className="io-skip" onClick={finish}>Skip intro →</button>

      <div className="io-sky" aria-hidden="true">
        <span className="io-cloud io-cloud-1" />
        <span className="io-cloud io-cloud-2" />
        <span className="io-cloud io-cloud-3" />
      </div>

      <div className="io-scene" aria-hidden="true">
        {/* Ground line the figures walk along. */}
        <div className="io-ground" />

        {/* The plane, and the two seats that fill as passengers board. Seats
            are children of the plane so they travel with it for free — no
            second animation to keep in sync once it starts moving. */}
        <div className="io-plane">
          <img className="io-plane-img" src={src.plane} alt="" />
          {/* The artwork is a full-body walking figure; a whole person standing
              in a seat reads as wrong. Each seat clips its passenger to head
              and torso, which is what you would actually see over a seat back. */}
          <span className="io-seat io-seat-1"><img src={src.traveller} alt="" /></span>
          <span className="io-seat io-seat-2"><img src={src.couple} alt="" /></span>
        </div>

        {/* The same two images again, walking across the apron. Two copies
            rather than one moving element: a figure cannot both walk the ground
            and sit in a seat that is itself moving, and cross-fading between
            two positions is how this is done in animation. */}
        <img className="io-walker io-walk-traveller" src={src.traveller} alt="" />
        <img className="io-walker io-walk-couple" src={src.couple} alt="" />
      </div>

      <div className="io-caption">
        <span className="io-caption-mark">NV</span>
        <span>Your journey starts here</span>
      </div>
    </div>
  );
}

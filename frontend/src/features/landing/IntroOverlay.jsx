import { useEffect, useRef, useState } from 'react';

/**
 * Full-screen boarding sequence, played over the landing page on load.
 *
 * A plane flies in from off-screen right and settles. A traveller in a pagdi
 * walks on from the left and takes a seat. A couple follow and take theirs.
 * With all three aboard the plane accelerates away to the right, and the
 * curtain lifts onto the page.
 *
 * The artwork is NOT drawn here. Three earlier attempts hand-drew the figures
 * in SVG and none of them were good enough; the drawings are supplied as files
 * in /public/intro and this module only choreographs them. Everything about the
 * sequence — seating, timing, easing — is independent of what the images
 * actually look like, so replacing the art never means touching this code.
 *
 * Until those files exist the overlay does nothing at all. `preload()` rejects
 * on a missing image and the whole sequence is skipped, so a half-finished
 * asset drop degrades to "no intro" rather than to a screen of broken-image
 * icons over the page.
 */

const ASSETS = {
  plane:     '/intro/plane.svg',
  traveller: '/intro/traveller.svg',
  couple:    '/intro/couple.svg',
};

const TOTAL_MS = 9000;

/** Resolves only when every asset has loaded AND decoded. */
function preload(sources) {
  return Promise.all(
    sources.map(
      (src) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () =>
            // decode() before we start: onload fires when the bytes have
            // arrived, not when the image is ready to paint, so animating
            // immediately can drop the first frames of a large SVG.
            (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(resolve);
          img.onerror = () => reject(new Error(`intro asset missing: ${src}`));
          img.src = src;
        })
    )
  );
}

export default function IntroOverlay() {
  const [state, setState] = useState('idle'); // idle | playing | done
  const timer = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setState('done');
      return undefined;
    }

    preload(Object.values(ASSETS))
      .then(() => {
        if (!alive.current) return;
        setState('playing');
        document.body.style.overflow = 'hidden';
        timer.current = setTimeout(finish, TOTAL_MS);
      })
      .catch(() => {
        // Assets not in place yet. Say so once in the console — a silent
        // no-show is exactly the failure that cost several rounds here — but
        // never block the page over it.
        console.info(
          '[intro] skipped: drop plane.svg, traveller.svg and couple.svg into public/intro/ to enable it.'
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

  if (state !== 'playing') return null;

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
          <img className="io-plane-img" src={ASSETS.plane} alt="" />
          <img className="io-seat io-seat-1" src={ASSETS.traveller} alt="" />
          <img className="io-seat io-seat-2" src={ASSETS.couple} alt="" />
        </div>

        {/* The same two images again, walking across the apron. Two copies
            rather than one moving element: a figure cannot both walk the ground
            and sit in a seat that is itself moving, and cross-fading between
            two positions is how this is done in animation. */}
        <img className="io-walker io-walk-traveller" src={ASSETS.traveller} alt="" />
        <img className="io-walker io-walk-couple" src={ASSETS.couple} alt="" />
      </div>

      <div className="io-caption">
        <span className="io-caption-mark">NV</span>
        <span>Your journey starts here</span>
      </div>
    </div>
  );
}

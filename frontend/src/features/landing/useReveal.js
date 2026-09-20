import { useEffect, useRef, useState } from 'react';

// Scroll-triggered reveal, built on IntersectionObserver rather than a scroll
// listener: the browser does the intersection maths off the main thread, so a
// page with forty animated elements still scrolls at 60fps. A scroll handler
// doing getBoundingClientRect() per element per frame is the usual reason
// marketing pages feel sticky on mid-range phones.
//
// Each element unobserves itself once shown — these animations play once, and
// leaving observers attached for the life of the page is pure overhead.
/**
 * Someone who has asked for reduced motion gets the content immediately rather
 * than a fade they did not want.
 *
 * Read once, at initial state, rather than set from inside the effect: setting
 * state synchronously in an effect renders twice, and the first of those two
 * renders paints the hidden state — a flash of missing content for exactly the
 * person who asked for less movement.
 */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export function useReveal({ threshold = 0.15, rootMargin = '0px 0px -60px 0px' } = {}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(prefersReducedMotion);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.unobserve(el);
        }
      },
      { threshold, rootMargin }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [shown, threshold, rootMargin]);

  return [ref, shown];
}

// Count-up for the stats band. Uses requestAnimationFrame with an eased curve
// rather than setInterval: setInterval drifts and fires when the tab is hidden,
// so a backgrounded page would finish its animation invisibly and show the final
// number with no motion at all.
export function useCountUp(target, { duration = 1600, start = false } = {}) {
  // Same reasoning as useReveal: reduced motion means the final number, decided
  // before the first paint rather than corrected after it.
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (!start || prefersReducedMotion()) return;

    let raf;
    const t0 = performance.now();
    // easeOutCubic — fast at first, settling at the end, which reads as
    // "counting up and landing" rather than a linear ramp.
    const ease = (t) => 1 - (1 - t) ** 3;

    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      setValue(Math.round(ease(t) * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);

  return value;
}

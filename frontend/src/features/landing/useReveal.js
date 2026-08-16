import { useEffect, useRef, useState } from 'react';

// Scroll-triggered reveal, built on IntersectionObserver rather than a scroll
// listener: the browser does the intersection maths off the main thread, so a
// page with forty animated elements still scrolls at 60fps. A scroll handler
// doing getBoundingClientRect() per element per frame is the usual reason
// marketing pages feel sticky on mid-range phones.
//
// Each element unobserves itself once shown — these animations play once, and
// leaving observers attached for the life of the page is pure overhead.
export function useReveal({ threshold = 0.15, rootMargin = '0px 0px -60px 0px' } = {}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;

    // Someone who has asked for reduced motion gets the content immediately
    // rather than a fade they did not want.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }

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
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }

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

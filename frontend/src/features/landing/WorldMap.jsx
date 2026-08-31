import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReveal } from './useReveal';
import { ORIGIN, MAP_DESTINATIONS, PLANE_PATH, projectPoint, arcPath, waveOrder }
  from './worldMapData';

/*
 * The world map section.
 *
 * 176 country outlines, drawn on west-to-east, with flight arcs sweeping out of
 * Surat to each destination and a pin at the end of every arc.
 *
 * Three decisions worth knowing before editing this:
 *
 * 1. The geometry is fetched from /map/world.json, not imported. 74 KB of path
 *    data imported as a module would be bundled into the app's single JS chunk
 *    and downloaded by every visitor to every page. Fetched, it is a separate
 *    request that only fires when this section nears the viewport.
 *
 * 2. The SVG is inline in the DOM rather than an <img>. An <img> cannot inherit
 *    var(--accent-*), and a logged-in agency user visiting / has their own brand
 *    accent written onto :root — so an <img> map would be the one element on the
 *    page that ignored white-labelling. Inline also gives per-country hover.
 *
 * 3. The whole <svg> is aria-hidden and nothing inside it is focusable. The flag
 *    grid rendered below the map by LandingPage lists exactly the same countries
 *    as real buttons, so it is already the keyboard and screen-reader path;
 *    making the pins focusable too would add twelve duplicate tab stops for no
 *    new information. The map is a pointer-only enhancement over that list.
 */
export default function WorldMap({ group = 'All', selectedIso = null, onSelect }) {
  // rootMargin starts the fetch a screenful early, so the geometry is usually
  // already parsed by the time the section is actually looked at.
  const [ref, near] = useReveal({ threshold: 0, rootMargin: '0px 0px 400px 0px' });
  const [world, setWorld] = useState(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState(null);
  const hostRef = useRef(null);

  useEffect(() => {
    if (!near || world || failed) return;
    let alive = true;
    fetch(`${import.meta.env.BASE_URL || '/'}map/world.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((j) => alive && setWorld(j))
      // A failed fetch leaves the section as a plain tinted band. The country
      // list below it still answers the visitor's question, so there is nothing
      // to apologise for on screen.
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [near, world, failed]);

  /*
   * One delegated listener on the country group rather than 176 of them, and it
   * writes the pointer position to CSS variables instead of state — same trick
   * as useSpotlight in LandingPage. Only the name change re-renders.
   */
  const onMove = useCallback((e) => {
    const host = hostRef.current;
    if (!host) return;
    const box = host.getBoundingClientRect();
    host.style.setProperty('--tx', `${e.clientX - box.left}px`);
    host.style.setProperty('--ty', `${e.clientY - box.top}px`);
    const name = e.target?.dataset?.name ?? null;
    setHover((prev) => (prev === name ? prev : name));
  }, []);

  const onLeave = useCallback(() => setHover(null), []);

  const onClick = useCallback((e) => {
    const iso = e.target?.dataset?.iso;
    if (iso && onSelect) onSelect(iso);
  }, [onSelect]);

  // Which destinations the region tabs currently emphasise. "All" emphasises
  // every one; a region tab dims the rest rather than removing them, so the map
  // never appears to lose countries.
  const inGroup = (d) => group === 'All' || d.group === group;

  const meta = world;
  const origin = meta && projectPoint(ORIGIN.lon, ORIGIN.lat, meta);
  // Both are derived purely from the fetched geometry, but hover and the region
  // tabs re-render this component — and re-sorting 176 countries on a mouse move
  // is exactly the kind of work a hover should not be doing.
  const order = useMemo(() => (meta ? waveOrder(meta.countries) : null), [meta]);
  const destById = useMemo(
    () => new Map(MAP_DESTINATIONS.filter((d) => d.id).map((d) => [d.id, d])),
    []
  );

  return (
    <div
      className={`wm ${meta ? 'is-ready' : ''} ${hover ? 'is-hovering' : ''}`}
      ref={(el) => { ref.current = el; hostRef.current = el; }}
      style={meta ? { '--wm-ratio': `${meta.w} / ${meta.h}` } : undefined}
    >
      {meta && (
        <svg
          className="wm-svg"
          viewBox={`0 0 ${meta.w} ${meta.h}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
        >
          <g className="wm-countries" onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick}>
            {meta.countries.map((c) => {
              const dest = destById.get(c.id);
              return (
                <path
                  key={c.id}
                  d={c.d}
                  data-name={c.name}
                  data-iso={dest ? dest.iso : undefined}
                  className={[
                    'wm-country',
                    c.id === ORIGIN.id ? 'is-home' : '',
                    dest ? 'is-dest' : '',
                    dest && inGroup(dest) ? 'is-lit' : '',
                    dest && dest.iso === selectedIso ? 'is-selected' : '',
                  ].filter(Boolean).join(' ')}
                  /* pathLength normalises every outline to 1 unit long, which is
                     what lets a single dasharray rule draw 176 paths of wildly
                     different real lengths in step instead of 176 rules. */
                  pathLength="1"
                  style={{ '--i': order.get(c.id) }}
                />
              );
            })}
          </g>

          <g className="wm-arcs">
            {MAP_DESTINATIONS.map((d, i) => {
              const p = projectPoint(d.lon, d.lat, meta);
              const path = arcPath(origin, p);
              const lit = inGroup(d);
              return (
                <g key={d.iso} className={`wm-arc ${lit ? 'is-lit' : ''}`} style={{ '--i': i }}>
                  <path className="wm-arc-line" d={path} pathLength="1" />
                  {/* A plane, not a dot. A dot travelling an arc is the same mark
                      as a dot marking a country, so mid-flight it reads as a
                      thirteenth destination sitting in the middle of an ocean.
                      A silhouette cannot be mistaken for a place.

                      It rides the route via CSS offset-path rather than SMIL
                      <animateMotion>: SMIL ignores prefers-reduced-motion, while
                      CSS animations are covered by the kill switch this page
                      already has. offset-rotate: auto banks it to the tangent,
                      so it always flies nose-first. The scale lives on an inner
                      <path> so it cannot interfere with the motion transform. */}
                  <g className="wm-plane" style={{ offsetPath: `path("${path}")` }}>
                    <path className="wm-plane-glyph" d={PLANE_PATH} />
                  </g>
                </g>
              );
            })}
          </g>

          <g className="wm-pins">
            {/* Surat. Drawn largest and darkest on purpose: it is the one point
                every arc leaves from, so it has to outrank both the destination
                pins and the dots travelling along the routes. */}
            <g className="wm-pin is-origin">
              <circle className="wm-pin-halo" cx={origin.x} cy={origin.y} r="13" />
              <circle className="wm-pin-ring" cx={origin.x} cy={origin.y} r="9" />
              <circle className="wm-pin-dot" cx={origin.x} cy={origin.y} r="6.5" />
            </g>
            {MAP_DESTINATIONS.map((d, i) => {
              const p = projectPoint(d.lon, d.lat, meta);
              return (
                <g
                  key={d.iso}
                  className={[
                    'wm-pin',
                    inGroup(d) ? 'is-lit' : '',
                    d.iso === selectedIso ? 'is-selected' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ '--i': i }}
                >
                  {/* The halo does not animate. It is what separates "a place we
                      serve" from "a plane passing overhead" in a still frame —
                      it matters most for Malta, Singapore and Mauritius, which
                      have no outline of their own to sit on. */}
                  <circle className="wm-pin-halo" cx={p.x} cy={p.y} r="9" />
                  <circle className="wm-pin-ring" cx={p.x} cy={p.y} r="8" />
                  <circle className="wm-pin-dot" cx={p.x} cy={p.y} r="4.5" />
                  <circle
                    className="wm-pin-hit"
                    cx={p.x} cy={p.y} r="18"
                    data-name={d.name} data-iso={d.iso}
                    onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      )}

      <span className="wm-tip" aria-hidden="true">{hover}</span>
    </div>
  );
}

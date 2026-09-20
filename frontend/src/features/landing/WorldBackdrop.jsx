import { useEffect, useRef } from 'react';
import { ORIGIN, MAP_DESTINATIONS, PLANE_PATH, projectPoint } from './worldMapData';

/*
 * The dotted-world backdrop behind the whole landing page.
 *
 * A slowly drifting map of the continents rendered as points of light, with a
 * radar sweep, expanding rings, and NV's routes drawn out of Surat with an
 * aircraft flying along each one.
 *
 * WHY CANVAS AND NOT THE EXISTING SVG MAP. WorldMap.jsx puts 176 country
 * outlines in the DOM so each one can be hovered and lit. This draws roughly
 * nine thousand dots and repaints them sixty times a second — as DOM nodes that
 * is a non-starter, and none of them needs to be hit-tested.
 *
 * The geometry is the same `/map/world.json` WorldMap fetches, so there is one
 * source of coastlines on this page and the browser serves the second request
 * from cache. Land is decided by RASTERISING those outlines once into an
 * offscreen mask and reading its pixels — not by point-in-polygon over
 * hand-drawn shapes, which is both slower and a second set of coastlines to
 * maintain.
 *
 * WHAT COSTS WHAT. Everything expensive happens once: the mask, the dot
 * scatter, and the baked texture. The frame loop only blits that texture three
 * times (for the horizontal wrap), draws a gradient and about twenty
 * primitives. The loop stops entirely when the tab is hidden and never starts
 * under prefers-reduced-motion, which gets a single static frame instead.
 */

// The world texture is built at this height in CSS pixels and scaled to fit;
// the width follows the map's own aspect. Larger looks no better once the dots
// are drawn and costs memory on phones.
const TEX_H = 900;

// Grid pitch for the dot scatter, in texture pixels. 6.5 is the number that
// reads as "made of points" rather than as a halftone screen or a sparse spray.
const SPACING = 6.5;

/*
 * The aircraft that flies each route, built once and reused for every frame of
 * every route — a Path2D is parsed on construction, so rebuilding it per frame
 * would re-parse the same string twelve times every sixteen milliseconds.
 *
 * PLANE_PATH is the same top-down silhouette the map section uses, drawn nose
 * along +x and centred on (0,0). Both of those matter here: the nose direction
 * is what lets a single rotate() aim it down the route, and the centring is
 * what keeps it ON the line rather than flying parallel to it.
 *
 * This replaces a 2.2px filled circle. A dot travelling an arc is the same mark
 * as a dot marking a city, so it read as a moving waypoint rather than as a
 * flight — and at four pixels across, mostly it read as nothing at all.
 */
const PLANE = typeof Path2D !== 'undefined' ? new Path2D(PLANE_PATH) : null;

// PLANE_PATH is 24 units nose to tail. 1.0 puts it at ~24px on screen. 0.62 was
// the first try and it vanished: this aircraft has to be picked out against a
// field of nine thousand dots, so "small enough not to compete with the copy" is
// the wrong target — it competes with the NOISE.
const PLANE_SCALE = 1.0;

// Height of one slice of the dot scatter, in texture pixels. Small enough that a
// band lands well inside a frame's budget, large enough not to spend more time
// yielding than working.
const BAND = 120;

// Dots painted per frame while the texture is baked. 1500 keeps each slice well
// inside a frame's budget on a mid-range machine.
const DOT_CHUNK = 1500;

// Hands the main thread back until the next frame. rAF rather than setTimeout(0)
// so the slices interleave with painting instead of competing with it.
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

/* Reads a CSS custom property off the page and returns it as [r,g,b].
 *
 * The accent is not hardcoded because a logged-in agency user visiting "/" has
 * their own brand colour written onto :root — the same reason WorldMap inlines
 * its SVG instead of using an <img>. A canvas cannot inherit a custom property,
 * so it is sampled once here and passed to the painter. */
function readAccent(el, fallback = [231, 133, 24]) {
  const raw = getComputedStyle(el).getPropertyValue('--accent-700').trim();
  const hex = raw.match(/^#?([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = raw.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return rgb ? [+rgb[1], +rgb[2], +rgb[3]] : fallback;
}

// Rasterise the country outlines into a 1-bit-ish land mask we can sample.
function buildMask(world, w, h) {
  const mask = document.createElement('canvas');
  mask.width = w;
  mask.height = h;
  const c = mask.getContext('2d', { willReadFrequently: true });
  c.fillStyle = '#fff';
  const scale = w / world.w;
  c.scale(scale, scale);
  for (const country of world.countries) {
    // Path2D parses the same `d` string the SVG map uses. If a browser lacks it
    // the caller falls back to no backdrop rather than a half-drawn one.
    c.fill(new Path2D(country.d));
  }
  return c.getImageData(0, 0, w, h).data;
}

/*
 * Scatters the dot field for ONE horizontal band of the mask, from gy0 up to but
 * not including gy1, appending into `dots`.
 *
 * Sliced rather than done in one pass because the whole field is ~49,000 grid
 * cells each doing eight coastline probes — around 400,000 mask lookups. As a
 * single call that is one uninterruptible task of well over a hundred
 * milliseconds, during which the browser cannot respond to anything: it is the
 * stall you feel on refresh. Split into bands with a yield between them, the
 * same total work costs the same CPU but never blocks a frame.
 */
function scatterBand(mask, w, h, accent, dots, gy0, gy1) {
  const [ar, ag, ab] = accent;
  const at = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return mask[((y | 0) * w + (x | 0)) * 4 + 3] > 128;
  };
  const R = SPACING * 1.6;
  for (let gy = gy0; gy < gy1 && gy < h; gy += SPACING) {
    for (let gx = 0; gx < w; gx += SPACING) {
      const x = gx + (Math.random() - 0.5) * SPACING * 0.85;
      const y = gy + (Math.random() - 0.5) * SPACING * 0.85;
      if (!at(x, y)) continue;
      // A dot with open sea within reach in any of eight directions is on a
      // coastline. Drawing those brighter is what makes the continents legible;
      // a uniform scatter reads as noise in the shape of a map.
      let coastal = false;
      for (let i = 0; i < 8 && !coastal; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        if (!at(x + Math.cos(a) * R, y + Math.sin(a) * R)) coastal = true;
      }
      const warmth = Math.random();
      dots.push({
        x,
        y,
        r: coastal ? 1.0 + Math.random() * 1.3 : 0.5 + Math.random() * 0.9,
        // Interior dots are cut back hardest. They carry no shape information —
        // the coastlines do that — and they are what small body text further
        // down the page has to be read against.
        a: coastal ? 0.42 + Math.random() * 0.28 : 0.10 + Math.random() * 0.16,
        // Vary toward the lighter end of the accent so the field has depth
        // instead of reading as one flat colour.
        g: Math.round(ag + warmth * 55),
        b: Math.round(ab + warmth * 45),
        r0: ar,
      });
    }
  }
}

function bakeTexture(w, h, accent) {
  const tex = document.createElement('canvas');
  tex.width = w;
  tex.height = h;
  const c = tex.getContext('2d');
  const [ar, ag, ab] = accent;

  // Graticule, well under the dots in contrast — it should be felt more than
  // seen, and only reads at all against the darkest parts of the page.
  c.strokeStyle = `rgba(${ar},${ag},${ab},0.055)`;
  c.lineWidth = 1;
  for (let i = 1; i < 12; i += 1) {
    const x = (i / 12) * w;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, h);
    c.stroke();
  }
  for (let i = 1; i < 6; i += 1) {
    const y = (i / 6) * h;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }

  return tex;
}

/*
 * Paints one slice of the dot field onto the baked texture.
 *
 * NO shadowBlur. Each dot used to be a single fill with shadowColor and
 * shadowBlur set on it, which reads well but costs enormously: canvas runs a
 * separate blur pass per draw call, so nine thousand dots meant nine thousand
 * blurs in one synchronous loop. Measured on a real GPU that pinned the page at
 * 1.8fps until it finished — the whole "stuck until the background loads" stall.
 *
 * The glow is now two ordinary fills instead: a wide, very transparent halo and
 * a solid core. Eighteen thousand plain fills are dramatically cheaper than nine
 * thousand blurred ones, and at this dot size the result is indistinguishable.
 */
function paintDots(c, dots, from, to) {
  const TAU = Math.PI * 2;
  for (let i = from; i < to && i < dots.length; i += 1) {
    const d = dots[i];
    c.fillStyle = `rgba(${d.r0},${d.g},${d.b},${d.a * 0.30})`;
    c.beginPath();
    c.arc(d.x, d.y, d.r * 2.6, 0, TAU);
    c.fill();
    c.fillStyle = `rgba(${d.r0},${d.g},${d.b},${d.a})`;
    c.beginPath();
    c.arc(d.x, d.y, d.r, 0, TAU);
    c.fill();
  }
}

export default function WorldBackdrop() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window.Path2D !== 'function') return undefined;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    // A 2d context can be refused — memory pressure, or a browser with canvas
    // disabled. Nothing below can run without it, and the page is complete
    // without the backdrop.
    if (!ctx) return undefined;
    const accent = readAccent(document.documentElement);

    let alive = true;
    let raf = 0;
    let tex = null;
    let texW = 0;
    let texH = 0;
    let cw = 0;
    let ch = 0;
    let pan = 0;
    let last = 0;
    let mouseX = 0;
    let mouseY = 0;
    let smoothX = 0;
    let smoothY = 0;
    let nodes = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      cw = window.innerWidth;
      ch = window.innerHeight;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      smoothX = mouseX = cw / 2;
      smoothY = mouseY = ch / 2;
    };
    resize();

    const onResize = () => {
      resize();
      if (reduce) draw(performance.now());
    };
    const onMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    function draw(now) {
      const dt = now - (last || now);
      last = now;
      if (!reduce) {
        pan += dt * 0.008;
        // Ease toward the cursor rather than snapping to it, or the whole map
        // twitches with every mouse event.
        smoothX += (mouseX - smoothX) * 0.045;
        smoothY += (mouseY - smoothY) * 0.045;
      }
      const t = now / 1000;
      ctx.clearRect(0, 0, cw, ch);
      if (!tex) return;

      const scale = (ch * 1.35) / texH;
      const worldW = texW * scale;
      const worldH = texH * scale;
      const parX = reduce ? 0 : (smoothX - cw / 2) * 0.012;
      const parY = reduce ? 0 : (smoothY - ch / 2) * 0.008;
      const baseY = (ch - worldH) / 2 + parY;
      const offX =
        ((((cw - worldW) / 2 + pan + parX) % worldW) + worldW) % worldW - worldW;

      /*
       * Three copies side by side give the seamless horizontal wrap, but at any
       * moment at most two of them overlap the window — often only one. Blitting
       * all three means up to a full extra screen of scaled pixel work every
       * frame, for something nobody can see. `onScreen` skips those.
       */
      const onScreen = (x) => x + worldW > 0 && x < cw;

      for (let i = -1; i <= 1; i += 1) {
        const x = offX + i * worldW;
        if (!onScreen(x)) continue;
        ctx.drawImage(tex, x, baseY, worldW, worldH);
      }

      /* Veil.
       *
       * Without it the map is not a backdrop, it is a second layer competing
       * with the page: headings survive it, but body copy in the sections that
       * have no card behind them was genuinely hard to read against moving
       * points of light. The sweep, arcs and station rings are drawn AFTER this
       * so they stay crisp — it is only the dot field that gets knocked back. */
      ctx.fillStyle = 'rgba(10,9,6,0.46)';
      ctx.fillRect(0, 0, cw, ch);

      const [ar, ag, ab] = accent;
      const cx = cw / 2;
      const cy = ch * 0.42;

      // Radar sweep. createConicGradient is unavailable on older Safari; the
      // page is complete without it, so it is simply skipped there.
      if (!reduce && typeof ctx.createConicGradient === 'function') {
        const g = ctx.createConicGradient((t * 0.22) % (Math.PI * 2), cx, cy);
        g.addColorStop(0, `rgba(${ar},${ag + 20},${ab + 25},0.16)`);
        g.addColorStop(0.05, `rgba(${ar},${ag + 20},${ab + 25},0.05)`);
        g.addColorStop(0.13, `rgba(${ar},${ag + 20},${ab + 25},0)`);
        g.addColorStop(1, `rgba(${ar},${ag + 20},${ab + 25},0)`);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.hypot(cw, ch) / 2, 0, Math.PI * 2);
        ctx.fill();

        for (let ring = 0; ring < 2; ring += 1) {
          const rt = ((t + ring * 2) % 4) / 4;
          ctx.strokeStyle = `rgba(${ar},${ag + 20},${ab + 25},${0.14 * (1 - rt)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, rt * Math.hypot(cw, ch) * 0.42, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      /*
       * Routes out of Surat, with an aircraft flying along each. Same origin and
       * destinations the map section uses, so the two agree.
       *
       * Drawn on ALL THREE copies of the world, exactly like the dot texture
       * above. They used to be drawn once, on copy 1 only — so whenever the pan
       * carried that copy off the side of the window, every route and every
       * aircraft left with it and the backdrop became a plain dot field. Surat
       * sits 70% across the texture, which is off the right-hand edge for most
       * of the drift cycle, so "most of the time" was the normal case.
       */
      for (let copy = -1; copy <= 1; copy += 1) {
      // Same culling as the blit above. Drawing routes on all three copies is
      // what made them visible at all, but two of the three are usually off
      // screen — and each carries twelve arcs, twelve aircraft and twelve
      // destination markers.
      if (!onScreen(offX + copy * worldW)) continue;
      const put = (p) => ({ x: offX + copy * worldW + p.x * scale, y: baseY + p.y * scale });
      for (const node of nodes) {
        const a = put(node.from);
        const b = put(node.to);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - Math.abs(a.x - b.x) * 0.18 - 40;
        // 0.22 and 1px read as nothing against the dot field; the routes are the
        // one element here that carries meaning rather than texture.
        ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.40)`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.stroke();

        if (!reduce && PLANE) {
          const k = (t * 0.18 + node.phase) % 1;
          const m = 1 - k;
          // Position on the quadratic, and its derivative at the same k. The
          // derivative is the heading: without it the silhouette would slide
          // along the route pointing east regardless of where it was going.
          const px = m * m * a.x + 2 * m * k * mx + k * k * b.x;
          const py = m * m * a.y + 2 * m * k * my + k * k * b.y;
          const dx = 2 * m * (mx - a.x) + 2 * k * (b.x - mx);
          const dy = 2 * m * (my - a.y) + 2 * k * (b.y - my);

          ctx.save();
          ctx.translate(px, py);

          /*
           * A soft halo under the aircraft. Without it the silhouette competes
           * with the dot field at the same brightness and disappears into it;
           * the halo darkens nothing but gives the eye a shape to lock onto,
           * which is what separates "a plane" from "another bright dot".
           */
          const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
          halo.addColorStop(0, `rgba(${ar},${ag},${ab},0.34)`);
          halo.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(0, 0, 26, 0, Math.PI * 2);
          ctx.fill();

          ctx.rotate(Math.atan2(dy, dx));
          ctx.scale(PLANE_SCALE, PLANE_SCALE);
          // Near-white at the core so it reads as lit, not tinted.
          ctx.fillStyle = `rgba(255,${Math.min(255, ag + 95)},${Math.min(255, ab + 120)},1)`;
          ctx.fill(PLANE);
          ctx.restore();
        }

        const pulse = reduce ? 0.5 : Math.sin(t * 1.6 + b.x) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(${ar},${ag},${ab},${0.5 - pulse * 0.35})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4 + pulse * 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgb(${ar},${ag},${ab})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      }
    }

    const loop = (now) => {
      if (!alive) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    // A backdrop has no business burning frames behind a tab nobody is looking
    // at, and a background tab throttles rAF unevenly, so `dt` would jump.
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (document.hidden || reduce) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };

    fetch(`${import.meta.env.BASE_URL || '/'}map/world.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(async (world) => {
        if (!alive) return;
        texH = TEX_H;
        texW = Math.round((world.w / world.h) * TEX_H);

        /*
         * Built across several frames instead of in one go.
         *
         * Rasterising the mask, scattering ~9,000 dots and baking the texture
         * used to be three calls on one line, so the browser was locked for the
         * whole of it — measured as the single worst blocking task on the page.
         * The work is unchanged; it is just handed back between slices so no
         * frame is ever held for long. The canvas simply stays empty for a few
         * extra frames, which nobody can see because it is a background.
         */
        const mask = buildMask(world, texW, texH);
        const dots = [];
        for (let gy = 0; gy < texH; gy += BAND) {
          await frame();
          if (!alive) return;
          scatterBand(mask, texW, texH, accent, dots, gy, gy + BAND);
        }
        await frame();
        if (!alive) return;

        /*
         * Painted in slices as well. Baking all nine thousand dots in one call
         * was the single longest frame on the page even after the blur came
         * out; sliced, the texture simply fills in over a few frames while the
         * rest of the page stays responsive.
         */
        const baked = bakeTexture(texW, texH, accent);
        const bc = baked.getContext('2d');
        for (let i = 0; i < dots.length; i += DOT_CHUNK) {
          await frame();
          if (!alive) return;
          paintDots(bc, dots, i, i + DOT_CHUNK);
        }
        tex = baked;

        const meta = { w: texW, latMax: world.latMax };
        const from = projectPoint(ORIGIN.lon, ORIGIN.lat, meta);
        nodes = MAP_DESTINATIONS.map((d, i) => ({
          from,
          to: projectPoint(d.lon, d.lat, meta),
          phase: (i * 0.37) % 1,
        }));

        window.addEventListener('resize', onResize);
        if (!reduce) window.addEventListener('mousemove', onMove, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);
        if (reduce) draw(performance.now());
        else raf = requestAnimationFrame(loop);
      })
      // No geometry, no backdrop. The page is a complete dark page without it,
      // which is why nothing here reports an error on screen.
      .catch(() => {});

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="lp-backdrop" aria-hidden="true" />;
}

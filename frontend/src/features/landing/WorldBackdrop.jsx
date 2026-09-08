import { useEffect, useRef } from 'react';
import { ORIGIN, MAP_DESTINATIONS, projectPoint } from './worldMapData';

/*
 * The dotted-world backdrop behind the whole landing page.
 *
 * A slowly drifting map of the continents rendered as points of light, with a
 * radar sweep, expanding rings, and NV's routes drawn out of Surat with a pulse
 * travelling along each one.
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

function buildDots(mask, w, h, accent) {
  const [ar, ag, ab] = accent;
  const at = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return mask[((y | 0) * w + (x | 0)) * 4 + 3] > 128;
  };
  const dots = [];
  const R = SPACING * 1.6;
  for (let gy = 0; gy < h; gy += SPACING) {
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
  return dots;
}

function bakeTexture(dots, w, h, accent) {
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

  for (const d of dots) {
    c.shadowColor = `rgba(${d.r0},${d.g},${d.b},0.85)`;
    c.shadowBlur = d.r > 1.1 ? 3.4 : 1.6;
    c.fillStyle = `rgba(${d.r0},${d.g},${d.b},${d.a})`;
    c.beginPath();
    c.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    c.fill();
  }
  c.shadowBlur = 0;
  return tex;
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

      for (let i = -1; i <= 1; i += 1) {
        ctx.drawImage(tex, offX + i * worldW, baseY, worldW, worldH);
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

      // Routes out of Surat, with a pulse running along each. Same origin and
      // destinations the map section below uses, so the two agree.
      const put = (p) => ({ x: offX + worldW + p.x * scale, y: baseY + p.y * scale });
      for (const node of nodes) {
        const a = put(node.from);
        const b = put(node.to);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - Math.abs(a.x - b.x) * 0.18 - 40;
        ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.22)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.stroke();

        if (!reduce) {
          const k = (t * 0.18 + node.phase) % 1;
          const m = 1 - k;
          ctx.fillStyle = `rgba(${ar},${Math.min(255, ag + 60)},${Math.min(255, ab + 78)},0.95)`;
          ctx.beginPath();
          ctx.arc(
            m * m * a.x + 2 * m * k * mx + k * k * b.x,
            m * m * a.y + 2 * m * k * my + k * k * b.y,
            2.2, 0, Math.PI * 2
          );
          ctx.fill();
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
      .then((world) => {
        if (!alive) return;
        texH = TEX_H;
        texW = Math.round((world.w / world.h) * TEX_H);
        const mask = buildMask(world, texW, texH);
        tex = bakeTexture(buildDots(mask, texW, texH, accent), texW, texH, accent);

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

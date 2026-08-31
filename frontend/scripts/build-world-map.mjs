#!/usr/bin/env node
/*
 * Generates public/map/world.json — the country outlines the landing page's
 * world map draws.
 *
 * Run by hand, not from `vite build`:
 *
 *     node scripts/build-world-map.mjs
 *
 * The output is deterministic and committed, so the build stays offline and
 * reproducible. Re-run only to change the projection, the crop or the
 * simplification tolerance — or to move to a newer upstream, which means
 * updating both SOURCE_URL and SOURCE_SHA256 together.
 *
 * Why the data is generated rather than depended on: `world-atlas` ships
 * TopoJSON, which no browser can render. Decoding it at runtime would mean
 * shipping a decoder and paying for it on every visit; decoding it here costs
 * nothing at runtime and lets us drop everything the page never draws.
 */

import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Pinned exactly. An unpinned upstream that silently changes shape is the one
// way this file can rot without anyone noticing, so the hash is asserted below.
const SOURCE_URL = 'https://unpkg.com/world-atlas@2.0.2/countries-110m.json';
const SOURCE_SHA256 = '2516c915867c7baf18ddec727aec46c315541a07cfb3d79a6559b05d5e94eee8';

// Antarctica. Dropped: in an equirectangular projection it is a hugely
// distorted band across the bottom sixth of the frame, and no visa client is
// going there. Removing it also tightens the aspect ratio from 2.05:1 to a far
// more usable 2.59:1.
const ANTARCTICA_ID = '010';

// Width of the projected coordinate space. Coordinates are rounded to whole
// units, so this is really a precision setting: at 2000 units a map rendered
// 1200px wide has 1.7 units per pixel, well past the point where rounding is
// visible on a 1px stroke.
const WIDTH = 2000;

// Douglas–Peucker tolerance, in projected units. 0.6 is 0.03% of the width —
// invisible at any realistic render size, and it removes ~8% of the points.
const EPSILON = 0.6;

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'public', 'map', 'world.json');

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchSource() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`${SOURCE_URL} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha !== SOURCE_SHA256) {
    throw new Error(
      `Upstream data changed.\n  expected ${SOURCE_SHA256}\n  received ${sha}\n` +
      'Review the new data, then update SOURCE_SHA256 if it is legitimate.',
    );
  }
  return JSON.parse(buf.toString('utf8'));
}

// ── TopoJSON ─────────────────────────────────────────────────────────────────

/*
 * TopoJSON stores each arc as a starting point followed by deltas, all in
 * quantised integers. Undoing that is the whole of the format for our purposes:
 * we never need arc *merging*, because we draw each country separately rather
 * than dissolving borders. That is why this is 15 lines instead of a dependency.
 */
function decodeArcs(topology) {
  const { scale, translate } = topology.transform;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
}

/** Every ring in a geometry, as flat arrays of arc indices. */
function ringsOf(geometry) {
  return geometry.type === 'Polygon' ? geometry.arcs : geometry.arcs.flat();
}

// ── Simplify ─────────────────────────────────────────────────────────────────

/*
 * Douglas–Peucker, iterative rather than recursive so a pathological arc cannot
 * blow the stack.
 *
 * Applied per ARC, never per ring. Arcs are shared between neighbouring
 * countries — France and Germany reference the same arc for their common
 * border, one of them reversed. Simplifying a ring instead would give the two
 * countries different point sets for the same border, cracking a hairline gap
 * between every pair of neighbours. Simplifying the arc keeps them identical,
 * and since the algorithm always keeps both endpoints, arcs still join up.
 */
function simplify(points, eps) {
  if (points.length < 3) return points;

  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b <= a + 1) continue;

    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);

    let worst = 0;
    let worstAt = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      // Perpendicular distance to the chord — or, for a closed arc where the
      // chord has no length, plain distance from the shared endpoint.
      const dist = len
        ? Math.abs(dx * (ay - py) - (ax - px) * dy) / len
        : Math.hypot(px - ax, py - ay);
      if (dist > worst) {
        worst = dist;
        worstAt = i;
      }
    }

    if (worst > eps) {
      keep[worstAt] = true;
      stack.push([a, worstAt], [worstAt, b]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

// ── Build ────────────────────────────────────────────────────────────────────

async function main() {
  const topology = await fetchSource();
  const rawArcs = decodeArcs(topology);

  const geometries = topology.objects.countries.geometries
    .filter((g) => g.id !== ANTARCTICA_ID);

  // The crop is derived from the data, not asserted: whatever is left after
  // dropping Antarctica defines the frame exactly, with no dead margin.
  let latMin = Infinity;
  let latMax = -Infinity;
  for (const g of geometries) {
    for (const ring of ringsOf(g)) {
      for (const idx of ring) {
        for (const [, lat] of rawArcs[idx < 0 ? ~idx : idx]) {
          if (lat < latMin) latMin = lat;
          if (lat > latMax) latMax = lat;
        }
      }
    }
  }
  latMin = Math.floor(latMin * 1e4) / 1e4;
  latMax = Math.ceil(latMax * 1e4) / 1e4;

  // Equirectangular. Longitude and latitude share one scale factor, which is
  // what keeps the map from looking horizontally squashed.
  const project = ([lon, lat]) => [
    ((lon + 180) / 360) * WIDTH,
    ((latMax - lat) / 360) * WIDTH,
  ];
  const height = Math.round(((latMax - latMin) / 360) * WIDTH * 10) / 10;

  const arcs = rawArcs.map((arc) => simplify(arc.map(project), EPSILON));

  /*
   * Rings that cross the antimeridian, split at the seam.
   *
   * Russia and Fiji have land on both sides of 180°, and the source stores each
   * as one ring that simply steps from lon +179 to lon -179. Projected, that is
   * a single segment from x≈2000 to x≈0 — a hard horizontal line straight across
   * the whole map. Two of them showed up as stripes over the first render.
   *
   * The fix is to cut the ring at every seam crossing, walk each piece out to
   * the edge it was heading for, and close the pieces separately. Closing with Z
   * then draws each piece's final edge down the map border, which is where the
   * boundary actually is.
   */
  const splitAtSeam = (pts) => {
    const seam = (a, b) => Math.abs(a[0] - b[0]) > WIDTH / 2;
    // Rotate so the walk starts just after a crossing; then every crossing is
    // interior and the pieces do not need stitching back together at the end.
    let cut = -1;
    for (let i = 0; i < pts.length; i++) {
      if (seam(pts[(i - 1 + pts.length) % pts.length], pts[i])) { cut = i; break; }
    }
    if (cut < 0) return [pts];

    const walk = [...pts.slice(cut), ...pts.slice(0, cut)];
    const pieces = [];
    let piece = [walk[0]];
    for (let i = 1; i <= walk.length; i++) {
      const prev = walk[i - 1];
      const next = walk[i % walk.length];
      if (!seam(prev, next)) {
        if (i < walk.length) piece.push(next);
        continue;
      }
      // Latitude where the boundary meets the seam. The two points are on
      // opposite edges, so the gap in x is (WIDTH - |dx|) going the short way
      // round, and the crossing sits proportionally along it.
      const goingEast = next[0] < prev[0];
      const gap = WIDTH - Math.abs(next[0] - prev[0]);
      const toEdge = goingEast ? WIDTH - prev[0] : prev[0];
      const y = prev[1] + (next[1] - prev[1]) * (gap === 0 ? 0 : toEdge / gap);
      piece.push([goingEast ? WIDTH : 0, y]);
      pieces.push(piece);
      piece = [[goingEast ? 0 : WIDTH, y], next];
    }
    if (piece.length > 2) pieces.push(piece);
    return pieces;
  };

  /**
   * One ring → one or more `M…L…Z` subpaths. A negative index means "this arc,
   * reversed". More than one subpath comes back only for a seam-crossing ring.
   */
  const ring = (indices) => {
    const pts = [];
    for (const idx of indices) {
      const reversed = idx < 0;
      const arc = arcs[reversed ? ~idx : idx];
      const points = reversed ? [...arc].reverse() : arc;
      for (let i = 0; i < points.length; i++) {
        // Consecutive arcs in a ring share an endpoint; skip the repeat.
        if (i === 0 && pts.length) continue;
        pts.push(points[i]);
      }
    }
    return splitAtSeam(pts)
      .map((piece) => 'M' + piece
        .map(([x, y]) => Math.round(x) + ' ' + Math.round(y))
        .join('L') + 'Z')
      .join('');
  };

  /*
   * Three geometries carry no UN M49 id: N. Cyprus, Somaliland and Kosovo, all
   * partially-recognised. They still have real coastlines, so dropping them
   * would punch visible holes in Cyprus, the Horn of Africa and the Balkans.
   * They get a synthetic id instead, prefixed so it can never collide with a
   * numeric one.
   */
  const idOf = (g) => g.id ?? `x-${g.properties.name.toLowerCase().replace(/[^a-z]+/g, '-')}`;

  const countries = geometries.map((g) => {
    const rings = g.type === 'Polygon'
      ? g.arcs.map(ring)
      : g.arcs.map((polygon) => polygon.map(ring).join(''));

    // Bounding-box centre x, used only to order the west-to-east draw-on wave.
    // Deliberately not a true centroid: Russia straddles the antimeridian, so
    // any centroid for it is meaningless — but a wave delay does not care.
    let minX = Infinity;
    let maxX = -Infinity;
    for (const r of ringsOf(g)) {
      for (const idx of r) {
        for (const [x] of arcs[idx < 0 ? ~idx : idx]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }

    return {
      id: idOf(g),
      name: g.properties.name,
      cx: Math.round((minX + maxX) / 2),
      d: rings.join(''),
    };
  });

  // Sorted by id so the output is byte-stable regardless of upstream ordering.
  countries.sort((a, b) => a.id.localeCompare(b.id));

  const doc = {
    source: SOURCE_URL,
    w: WIDTH,
    h: height,
    lonMin: -180,
    lonMax: 180,
    latMin,
    latMax,
    countries,
  };

  await writeFile(OUT, JSON.stringify(doc), 'utf8');

  const bytes = Buffer.byteLength(JSON.stringify(doc));
  const points = arcs.reduce((n, a) => n + a.length, 0);
  console.log(
    `world.json → ${countries.length} countries, ${points} points, ` +
    `${(bytes / 1024).toFixed(0)} KB, viewBox "0 0 ${WIDTH} ${height}"`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

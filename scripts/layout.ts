// Generates src/atlas/geometry.json.
//
//   node --experimental-strip-types scripts/layout.ts           fill in positions for new nodes only
//   node --experimental-strip-types scripts/layout.ts --rebuild  regenerate everything from the anchors below
//
// Positions are frozen once written: a normal run never moves an existing node. Territory
// centres, capability placement and island positions below are the hand-placed layout; the
// outlines, coastline and skill rings are derived from them.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { Delaunay } from 'd3-delaunay';
import polygonClipping from 'polygon-clipping';
import { loadAtlas, GEOMETRY_FILE } from '../src/atlas/load.ts';
import type { Geometry, Pt } from '../src/atlas/geometry.ts';
import { pointInPolygon } from '../src/atlas/geometry.ts';

const W = 2000;
const H = 1300;
const rebuild = process.argv.includes('--rebuild');

// ---- Hand-placed anchors ---------------------------------------------------------------

/** Territory centres. West to east roughly follows discover, decide, design, build, ship, grow. */
const CENTERS: Record<string, Pt> = {
  discovery: [520, 400],
  strategy: [880, 345],
  activation: [1225, 360],
  experience: [455, 700],
  measurement: [880, 660],
  retention: [1220, 650],
  distribution: [1545, 560],
  operations: [585, 965],
  engineering: [960, 960],
  shipping: [1370, 900],
};

/** Optional per-capability nudges after looking at the result. */
const NUDGE: Record<string, Pt> = {};

/** Cross-cutting capabilities sit on islands in the sea. */
const ISLANDS: Record<string, Pt> = {
  'critical-thinking': [190, 230],
  'systems-thinking': [880, 95],
  'decision-making': [1560, 175],
  communication: [1880, 820],
  collaboration: [1720, 1180],
  'leadership-ownership': [1180, 1215],
  'continuous-learning': [330, 1170],
  'responsible-product': [110, 620],
  'ai-assisted-work': [1890, 360],
};

const SPACING = 112; // between capabilities in a row
const ROW = 74; // distance of each row from the territory's name band
const RING = { rx: 40, ry: 27 };

// ---- Deterministic noise ----------------------------------------------------------------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261110);

function hash2(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function displace([x, y]: Pt, fine = 0): Pt {
  const dx = 9 * valueNoise(x / 90, y / 90, 1) + 4 * valueNoise(x / 32, y / 32, 3) + fine * valueNoise(x / 11, y / 11, 5);
  const dy = 9 * valueNoise(x / 90, y / 90, 2) + 4 * valueNoise(x / 32, y / 32, 4) + fine * valueNoise(x / 11, y / 11, 6);
  return [x + dx, y + dy];
}

// ---- Helpers ----------------------------------------------------------------------------

const round = (p: Pt): Pt => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function subdivide(ring: Pt[], step: number, closed = true): Pt[] {
  const out: Pt[] = [];
  const n = closed ? ring.length : ring.length - 1;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const k = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  if (!closed) out.push(ring[ring.length - 1]);
  return out;
}

function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return dist(p, [a[0] + t * dx, a[1] + t * dy]);
}
function ringDist(p: Pt, ring: Pt[]) {
  let d = Infinity;
  for (let i = 0; i < ring.length; i++) d = Math.min(d, segDist(p, ring[i], ring[(i + 1) % ring.length]));
  return d;
}

/**
 * Capabilities sit in two staggered rows, above and below a band where the territory's
 * name goes, so the name never covers a place. Taxonomy order runs left to right, top row
 * first.
 */
function rowOffsets(n: number): Pt[] {
  const top = Math.floor(n / 2);
  const bottom = n - top;
  const row = (count: number, y: number, shift: number): Pt[] =>
    Array.from({ length: count }, (_, i) => [(i - (count - 1) / 2) * SPACING + shift, y] as Pt);
  const stagger = top === bottom ? SPACING / 4 : 0;
  return [...row(top, -ROW, -stagger), ...row(bottom, ROW, stagger)];
}

function skillRing(center: Pt, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((-90 + (360 * (i + 0.5)) / n) * Math.PI) / 180;
    const rx = RING.rx + (n > 7 ? 6 : 0);
    const ry = RING.ry + (n > 7 ? 4 : 0);
    pts.push(round([center[0] + rx * Math.cos(a), center[1] + ry * Math.sin(a)]));
  }
  return pts;
}

// ---- Layout -----------------------------------------------------------------------------

const atlas = loadAtlas();
const previous: Geometry | undefined =
  !rebuild && existsSync(GEOMETRY_FILE) ? JSON.parse(readFileSync(GEOMETRY_FILE, 'utf8')) : undefined;

const points: Record<string, Pt> = { ...(previous?.points ?? {}) };
const land = atlas.territories.filter((t) => !t.crossCutting);

for (const t of atlas.territories) {
  t.capabilities.forEach((cid, i) => {
    if (points[cid]) return;
    let p: Pt;
    if (t.crossCutting) {
      p = ISLANDS[cid];
      if (!p) throw new Error(`no island position for ${cid}; add it to ISLANDS`);
    } else {
      const c = CENTERS[t.id];
      if (!c) throw new Error(`no centre for territory ${t.id}; add it to CENTERS`);
      const [ox, oy] = rowOffsets(t.capabilities.length)[i];
      // jitter, but only away from the name band
      p = [c[0] + ox + (rand() - 0.5) * 26, c[1] + oy + Math.sign(oy) * rand() * 16];
    }
    const nudge = NUDGE[cid] ?? [0, 0];
    points[cid] = round([p[0] + nudge[0], p[1] + nudge[1]]);
  });
}

for (const c of atlas.capabilities) {
  const missing = c.skills.filter((s) => !points[s]);
  if (!missing.length) continue;
  if (missing.length === c.skills.length) {
    skillRing(points[c.id], c.skills.length).forEach((p, i) => (points[c.skills[i]] = p));
  } else {
    // A new skill in an existing capability: place it on the ring where nothing sits yet.
    for (const sid of missing) {
      const taken = c.skills.filter((s) => points[s]).map((s) => points[s]);
      const candidates = skillRing(points[c.id], 24);
      candidates.sort((a, b) => Math.min(...taken.map((t) => dist(b, t))) - Math.min(...taken.map((t) => dist(a, t))));
      points[sid] = candidates[0];
    }
  }
}

let geometry: Geometry;
if (previous && !rebuild) {
  geometry = { ...previous, points };
} else {
  const capPoints = land.flatMap((t) => t.capabilities.map((c) => ({ id: c, t: t.id, p: points[c] })));

  // Coastline: the union of a disc around every capability, so the land hugs the
  // clusters, then smoothed. Bays form where territories meet the sea.
  const discs = capPoints.map(({ p }, i) => {
    const r = 112 + 26 * hash2(i, 3, 9);
    const ring: Pt[] = [];
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      ring.push([p[0] + r * Math.cos(a), p[1] + r * Math.sin(a) * 0.9]);
    }
    return [[...ring, ring[0]]];
  });
  const landUnion = polygonClipping.union(discs[0] as never, ...(discs.slice(1) as never[]));
  let coastRaw = (landUnion.sort((a, b) => b[0].length - a[0].length)[0][0].slice(0, -1) as Pt[]);
  // Chaikin smoothing removes the scalloped edge of the discs.
  for (let pass = 0; pass < 3; pass++) {
    const next: Pt[] = [];
    for (let i = 0; i < coastRaw.length; i++) {
      const a = coastRaw[i], b = coastRaw[(i + 1) % coastRaw.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    coastRaw = next;
  }
  // Drop points closer than 6 units to keep the file small.
  coastRaw = coastRaw.reduce<Pt[]>((kept, p) => (kept.length && dist(p, kept[kept.length - 1]) < 6 ? kept : [...kept, p]), []);

  // Territories: union of their capabilities' Voronoi cells, clipped to the coast.
  const delaunay = Delaunay.from(capPoints.map((c) => c.p));
  const voronoi = delaunay.voronoi([-400, -400, W + 400, H + 400]);
  const coastPoly = [[...coastRaw, coastRaw[0]]];
  const outlinesRaw: Record<string, Pt[]> = {};
  for (const t of land) {
    const cells = capPoints
      .map((c, i) => (c.t === t.id ? [voronoi.cellPolygon(i) as Pt[]] : null))
      .filter((x): x is Pt[][] => !!x);
    const merged = polygonClipping.union(cells[0], ...cells.slice(1));
    const clipped = polygonClipping.intersection(merged, coastPoly as never);
    const largest = clipped.sort((a, b) => b[0].length - a[0].length)[0];
    if (!largest) throw new Error(`empty territory ${t.id}: cells ${cells.length}, merged ${merged.length}, coast ${coastRaw.length} pts, union parts ${landUnion.length}`);
    outlinesRaw[t.id] = largest[0].slice(0, -1) as Pt[];
  }

  // Borders: outline edges away from the coast, each kept once.
  const borderEdges = new Map<string, [Pt, Pt]>();
  const key = (p: Pt) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  for (const ring of Object.values(outlinesRaw)) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (ringDist(mid, coastRaw) < 1.5) continue;
      const k = [key(a), key(b)].sort().join('|');
      if (!borderEdges.has(k)) borderEdges.set(k, [a, b]);
    }
  }
  // chain edges into polylines
  const adj = new Map<string, { pt: Pt; edges: string[] }>();
  for (const [k, [a, b]] of borderEdges) {
    for (const p of [a, b]) {
      const pk = key(p);
      if (!adj.has(pk)) adj.set(pk, { pt: p, edges: [] });
      adj.get(pk)!.edges.push(k);
    }
  }
  const usedEdges = new Set<string>();
  const borders: Pt[][] = [];
  const walk = (startKey: string) => {
    for (const e of adj.get(startKey)!.edges) {
      if (usedEdges.has(e)) continue;
      const line: Pt[] = [adj.get(startKey)!.pt];
      let cur = startKey;
      let edge: string | undefined = e;
      while (edge) {
        usedEdges.add(edge);
        const [a, b] = borderEdges.get(edge)!;
        const next = key(a) === cur ? key(b) : key(a);
        line.push(adj.get(next)!.pt);
        cur = next;
        const node = adj.get(cur)!;
        edge = node.edges.length === 2 ? node.edges.find((x) => !usedEdges.has(x)) : undefined;
      }
      borders.push(line);
    }
  };
  for (const [k, v] of adj) if (v.edges.length !== 2) walk(k); // start at junctions and ends
  for (const [k] of adj) walk(k); // remaining loops

  const STEP = 5;
  const coast = subdivide(coastRaw, STEP).map((p) => round(displace(p, 2.2)));
  const territories: Geometry['territories'] = {};
  for (const t of land) {
    const outline = subdivide(outlinesRaw[t.id], STEP).map((p) => {
      const onCoast = ringDist(p, coastRaw) < 1.5;
      return round(displace(p, onCoast ? 2.2 : 0));
    });
    // The name sits on the band between the two rows of capabilities.
    const best: Pt = CENTERS[t.id];
    territories[t.id] = { outline, label: round(best) };
  }

  const islands: Geometry['islands'] = {};
  for (const [id, c] of Object.entries(ISLANDS)) {
    const ring: Pt[] = [];
    const r0 = 20 + rand() * 8;
    const p1 = rand() * 6.3, p2 = rand() * 6.3;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const r = r0 * (1 + 0.18 * Math.sin(2 * a + p1) + 0.1 * Math.sin(3 * a + p2));
      ring.push([c[0] + r * Math.cos(a) * 1.25, c[1] + r * Math.sin(a)]);
    }
    islands[id] = subdivide(ring, 4).map((p) => round(displace(p, 1.5)));
  }

  geometry = {
    version: 1,
    width: W,
    height: H,
    coast,
    islands,
    territories,
    borders: borders.map((line) => subdivide(line, STEP, false).map((p) => round(displace(p)))),
    points,
  };
}

// Sanity: every capability on land sits inside its own territory.
for (const t of land) {
  for (const c of t.capabilities) {
    if (!pointInPolygon(geometry.points[c], geometry.territories[t.id].outline))
      console.warn(`warning: ${c} sits outside ${t.id}`);
  }
}

writeFileSync(GEOMETRY_FILE, JSON.stringify(geometry) + '\n');
const count = Object.keys(geometry.points).length;
console.log(`wrote ${GEOMETRY_FILE.replace(process.cwd() + '/', '')}: ${count} positions, ${geometry.borders.length} borders`);

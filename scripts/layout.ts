// Generates src/atlas/geometry.json, the hex-tile layout.
//
//   node --experimental-strip-types scripts/layout.ts            place new skills only
//   node --experimental-strip-types scripts/layout.ts --rebuild  lay everything out again
//   node --experimental-strip-types scripts/layout.ts --relocate=ai --relocate-skills=verification
//     intentionally move a territory or individual skills after a taxonomy change
//
// Cells are frozen once written: a normal run never moves an existing skill. A new skill takes
// the free cell next to its capability's cluster, closest to the cluster's centre.
//
// Hand-placed: the territory centres below, which set where each region grows. Everything
// else is derived: regions grow outward from their centre with a gap between territories,
// then each region is cut into one connected cluster per capability, in taxonomy order,
// reading from the top left.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { loadAtlas, GEOMETRY_FILE } from '../src/atlas/load.ts';
import {
  DIRS, hexCenter, hexDistance, hexKey, isConnected, pointToHex,
  type Geometry, type Hex, type Pt,
} from '../src/atlas/geometry.ts';

const rebuild = process.argv.includes('--rebuild');
const argumentIds = (flag: string) => (process.argv.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1) ?? '').split(',').filter(Boolean);
const relocate = new Set(argumentIds('--relocate'));
const relocateSkills = new Set(argumentIds('--relocate-skills'));
const SIZE = 22; // hex circumradius
const GAP = 3; // minimum hex distance between two territories
const MARGIN = 40;

/** Territory centres (world units before framing). Roughly: discover, decide and design on
 *  the left, build and ship below, grow on the right, measurement in the middle. */
const CENTERS: Record<string, Pt> = {
  discovery: [470, 330],
  strategy: [830, 300],
  activation: [1190, 330],
  experience: [430, 640],
  measurement: [820, 620],
  retention: [1180, 620],
  distribution: [1520, 500],
  operations: [520, 930],
  engineering: [900, 930],
  shipping: [1290, 900],
  ai: [1550, 930],
};

const frame0 = { size: SIZE, origin: [0, 0] as Pt };
const center = (h: Hex) => hexCenter(frame0, h);
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const readingOrder = (a: Hex, b: Hex) => a[1] - b[1] || center(a)[0] - center(b)[0];

function disc(h: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let dq = -radius; dq <= radius; dq++)
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) out.push([h[0] + dq, h[1] + dr]);
  return out;
}

/** Grows one connected cluster of `size` from `seed`, keeping the rest of the region connected. */
function grow(remaining: Map<string, Hex>, seed: Hex, size: number): Hex[] | undefined {
  const rest = new Map(remaining);
  const canTake = (h: Hex) => isConnected([...rest.values()].filter((x) => hexKey(x) !== hexKey(h)));
  if (!canTake(seed)) return undefined;
  const cluster: Hex[] = [seed];
  rest.delete(hexKey(seed));
  while (cluster.length < size) {
    const c: Pt = [0, 0];
    for (const h of cluster) {
      const p = center(h);
      c[0] += p[0] / cluster.length;
      c[1] += p[1] / cluster.length;
    }
    const frontier = new Map<string, Hex>();
    for (const [q, r] of cluster)
      for (const [dq, dr] of DIRS) {
        const k = hexKey([q + dq, r + dr]);
        if (rest.has(k)) frontier.set(k, rest.get(k)!);
      }
    const pick = [...frontier.values()]
      .sort((a, b) => dist(center(a), c) - dist(center(b), c) || readingOrder(a, b))
      .find(canTake);
    if (!pick) return undefined;
    cluster.push(pick);
    rest.delete(hexKey(pick));
  }
  return cluster;
}

/** Cuts a connected region into connected clusters of the given sizes, in order, reading
 *  from the top left. Tries later seeds when a cluster cannot grow. */
function partition(region: Hex[], sizes: number[]): Hex[][] {
  const remaining = new Map(region.map((h) => [hexKey(h), h]));
  const clusters: Hex[][] = [];
  sizes.forEach((size, i) => {
    if (i === sizes.length - 1) {
      clusters.push([...remaining.values()]);
      return;
    }
    let cluster: Hex[] | undefined;
    for (const seed of [...remaining.values()].sort(readingOrder)) {
      cluster = grow(remaining, seed, size);
      if (cluster) break;
    }
    if (!cluster) throw new Error(`could not cut a connected cluster of ${size}`);
    cluster.forEach((h) => remaining.delete(hexKey(h)));
    clusters.push(cluster);
  });
  return clusters;
}

const atlas = loadAtlas();
const land = atlas.territories.filter((t) => !t.crossCutting);
const cross = atlas.territories.find((t) => t.crossCutting);
const capsOf = (tid: string) => atlas.capabilities.filter((c) => c.territory === tid);
const skillCount = (tid: string) => capsOf(tid).reduce((n, c) => n + c.skills.length, 0);

let previous: Geometry | undefined;
if (!rebuild && existsSync(GEOMETRY_FILE)) {
  const g = JSON.parse(readFileSync(GEOMETRY_FILE, 'utf8'));
  if (g.version === 2) previous = g;
}

let cells: Record<string, Hex> = {};
if (previous) {
  cells = { ...previous.cells };
  for (const id of relocate) if (!CENTERS[id] || !land.some((t) => t.id === id)) throw new Error(`cannot relocate territory ${id}`);
  for (const id of relocateSkills) if (!atlas.skills.some((skill) => skill.id === id)) throw new Error(`unknown skill ${id}`);
  for (const skill of atlas.skills) {
    if (relocate.has(skill.territory) || relocateSkills.has(skill.id)) delete cells[skill.id];
  }
} else {
  // 1. grow territory regions from their centres, keeping a gap between territories
  const owner = new Map<string, string>();
  const regions = new Map<string, Hex[]>();
  const gap = new Map<string, number>();
  for (const t of land) {
    const c = CENTERS[t.id];
    if (!c) throw new Error(`no centre for territory ${t.id}; add it to CENTERS`);
    const seed = pointToHex(frame0, c);
    regions.set(t.id, [seed]);
    owner.set(hexKey(seed), t.id);
    gap.set(t.id, GAP);
  }
  for (;;) {
    const open = land.filter((t) => regions.get(t.id)!.length < skillCount(t.id));
    if (!open.length) break;
    const fill = (id: string) => regions.get(id)!.length / skillCount(id);
    const t = open.sort((a, b) => fill(a.id) - fill(b.id))[0];
    const g = gap.get(t.id)!;
    const ok = (h: Hex) => !owner.has(hexKey(h)) && disc(h, g - 1).every((n) => (owner.get(hexKey(n)) ?? t.id) === t.id);
    const frontier = new Map<string, Hex>();
    for (const [q, r] of regions.get(t.id)!)
      for (const [dq, dr] of DIRS) {
        const h: Hex = [q + dq, r + dr];
        if (ok(h)) frontier.set(hexKey(h), h);
      }
    if (!frontier.size) {
      if (g <= 1) throw new Error(`territory ${t.id} cannot grow`);
      gap.set(t.id, g - 1);
      continue;
    }
    const c = CENTERS[t.id];
    // slightly wider than tall, so each name sits comfortably above its region
    const score = (h: Hex) => {
      const p = center(h);
      return Math.hypot((p[0] - c[0]) * 0.85, (p[1] - c[1]) * 1.1);
    };
    const pick = [...frontier.values()].sort((a, b) => score(a) - score(b) || readingOrder(a, b))[0];
    regions.get(t.id)!.push(pick);
    owner.set(hexKey(pick), t.id);
  }

  // 2. cross-cutting capabilities: a band of three rows below the land
  if (cross) {
    const all = [...regions.values()].flat();
    const maxR = Math.max(...all.map((h) => h[1]));
    const xs = all.map((h) => center(h)[0]);
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const n = skillCount(cross.id);
    const rows = 3;
    const cols = Math.ceil(n / rows);
    const band: Hex[] = [];
    for (let row = 0; row < rows; row++) {
      const y = center([0, maxR + GAP + 2 + row])[1];
      const startX = midX - ((cols - 1) * SIZE * Math.sqrt(3)) / 2;
      for (let col = 0; col < cols; col++) band.push(pointToHex(frame0, [startX + col * SIZE * Math.sqrt(3), y]));
    }
    regions.set(cross.id, band.sort(readingOrder).slice(0, n));
  }

  // 3. cut each region into capability clusters, in taxonomy order
  for (const t of atlas.territories) {
    const region = regions.get(t.id);
    if (!region) throw new Error(`no region for ${t.id}`);
    const caps = capsOf(t.id);
    const clusters = partition(region, caps.map((c) => c.skills.length));
    caps.forEach((c, i) => {
      // skills fill their cluster in reading order, so list order reads across the map
      const hexes = clusters[i].sort(readingOrder);
      c.skills.forEach((sid, j) => (cells[sid] = hexes[j]));
    });
  }
}

// Place a new or intentionally relocated territory without disturbing the existing map.
if (previous) for (const territory of land) {
  const caps = capsOf(territory.id);
  if (caps.some((cap) => cap.skills.some((id) => cells[id]))) continue;
  const c = CENTERS[territory.id];
  if (!c) throw new Error(`no centre for territory ${territory.id}; add it to CENTERS`);
  const occupied = new Set(Object.values(cells).map(hexKey));
  const available = (h: Hex) => disc(h, GAP - 1).every((near) => !occupied.has(hexKey(near)));
  const seed = pointToHex(frame0, c);
  if (!available(seed)) throw new Error(`centre of ${territory.id} is occupied; choose another centre`);
  const region = [seed];
  const placed = new Set([hexKey(seed)]);
  while (region.length < skillCount(territory.id)) {
    const frontier = new Map<string, Hex>();
    for (const [q, r] of region) for (const [dq, dr] of DIRS) {
      const h: Hex = [q + dq, r + dr];
      if (!placed.has(hexKey(h)) && available(h)) frontier.set(hexKey(h), h);
    }
    const score = (h: Hex) => {
      const p = center(h);
      return Math.hypot((p[0] - c[0]) * 0.85, (p[1] - c[1]) * 1.1);
    };
    const next = [...frontier.values()].sort((a, b) => score(a) - score(b) || readingOrder(a, b))[0];
    if (!next) throw new Error(`no room for territory ${territory.id}`);
    region.push(next);
    placed.add(hexKey(next));
  }
  const clusters = partition(region, caps.map((cap) => cap.skills.length));
  caps.forEach((cap, i) => {
    const hexes = clusters[i].sort(readingOrder);
    cap.skills.forEach((id, j) => { cells[id] = hexes[j]; });
  });
}

// New skills on a normal run: the free cell next to their cluster, closest to its centre.
const taken = new Map(Object.entries(cells).map(([id, h]) => [hexKey(h), id]));
const territoryOfSkill = new Map(atlas.skills.map((s) => [s.id, s.territory]));
for (const c of atlas.capabilities) {
  for (const sid of c.skills) {
    if (cells[sid]) continue;
    const mine = c.skills.filter((s) => cells[s]).map((s) => cells[s]);
    if (!mine.length) throw new Error(`capability ${c.id} has no cells yet; run with --rebuild`);
    const mid = mine.map(center).reduce<Pt>((a, p) => [a[0] + p[0] / mine.length, a[1] + p[1] / mine.length], [0, 0]);
    const options: Hex[] = [];
    for (const [q, r] of mine)
      for (const [dq, dr] of DIRS) {
        const h: Hex = [q + dq, r + dr];
        const near = disc(h, 1).map((n) => taken.get(hexKey(n))).filter((x): x is string => !!x);
        if (!taken.has(hexKey(h)) && near.every((id) => territoryOfSkill.get(id) === c.territory)) options.push(h);
      }
    const pick = options.sort((a, b) => dist(center(a), mid) - dist(center(b), mid))[0];
    if (!pick) throw new Error(`no free cell next to ${c.id}`);
    cells[sid] = pick;
    taken.set(hexKey(pick), sid);
  }
}

// Points, labels and frame are derived from the cells.
const raw: Record<string, Pt> = {};
for (const s of atlas.skills) raw[s.id] = center(cells[s.id]);
for (const c of atlas.capabilities) {
  const pts = c.skills.map((s) => raw[s]);
  raw[c.id] = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}
const rawLabels: Record<string, Pt> = {};
for (const t of atlas.territories) {
  const hexes = capsOf(t.id).flatMap((c) => c.skills.map((s) => cells[s]));
  const top = Math.min(...hexes.map((h) => h[1]));
  const topRow = hexes.filter((h) => h[1] === top).map((h) => center(h)[0]);
  rawLabels[t.id] = [(Math.min(...topRow) + Math.max(...topRow)) / 2, center([0, top])[1] - SIZE * 1.8];
}

const all = Object.values(raw).concat(Object.values(rawLabels));
const x0 = Math.min(...all.map((p) => p[0])) - SIZE - MARGIN;
const y0 = Math.min(...all.map((p) => p[1])) - SIZE - MARGIN;
const x1 = Math.max(...all.map((p) => p[0])) + SIZE + MARGIN;
const y1 = Math.max(...all.map((p) => p[1])) + SIZE + MARGIN;
// keep the previous frame so existing positions do not move; grow it if needed
const origin: Pt = previous ? previous.origin : [-x0, -y0];
const width = Math.ceil(Math.max(previous?.width ?? 0, x1 + origin[0]));
const height = Math.ceil(Math.max(previous?.height ?? 0, y1 + origin[1]));
const r1 = (n: number) => Math.round(n * 10) / 10;
const move = (p: Pt): Pt => [r1(p[0] + origin[0]), r1(p[1] + origin[1])];

const geometry: Geometry = {
  version: 2,
  size: SIZE,
  width,
  height,
  origin: [r1(origin[0]), r1(origin[1])],
  cells,
  points: Object.fromEntries(Object.entries(raw).map(([id, p]) => [id, move(p)])),
  territories: Object.fromEntries(Object.entries(rawLabels).map(([id, p]) => [id, { label: move(p) }])),
};

// Sanity: no shared cells, every cluster connected, territories apart.
const seen = new Map<string, string>();
for (const [id, h] of Object.entries(cells)) {
  if (seen.has(hexKey(h))) throw new Error(`${id} and ${seen.get(hexKey(h))} share a cell`);
  seen.set(hexKey(h), id);
}
for (const c of atlas.capabilities) if (!isConnected(c.skills.map((s) => cells[s]))) console.warn(`warning: ${c.id} is not connected`);
let minGap = Infinity;
for (const a of atlas.skills)
  for (const b of atlas.skills) if (a.territory !== b.territory) minGap = Math.min(minGap, hexDistance(cells[a.id], cells[b.id]));
writeFileSync(GEOMETRY_FILE, JSON.stringify(geometry) + '\n');
console.log(`wrote geometry: ${Object.keys(cells).length} cells, ${width}x${height}, smallest gap between territories ${minGap}`);

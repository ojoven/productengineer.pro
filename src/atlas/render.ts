// (content, geometry, state) -> SVG string. Pure and synchronous, so the same function draws
// the static pre-zoomed maps on topic pages (no JavaScript), the interactive explorer in the
// browser, and exported images.
//
// Sizes are given in screen pixels and converted to world units with k (pixels per unit), so
// labels and glyphs stay the same size at every zoom level.
import { bbox, pointInPolygon, type Box, type Geometry, type Pt } from './geometry.ts';
import { glyphDefs, TERRAIN, type GlyphName } from './glyphs.ts';
import type { MapStyle } from './map-css.ts';

export interface MapAtlas {
  territories: { id: string; name: string; crossCutting: boolean; capabilities: string[] }[];
  capabilities: { id: string; name: string; territory: string; skills: string[] }[];
  skills: { id: string; name: string; capability: string; territory: string }[];
}

export type Status = 'learning' | 'comfortable';

export interface MapState {
  /** Self-reported status per skill id. */
  progress?: Record<string, Status>;
  /** Lit node ids, in route order. Separate from progress, so both can show at once. */
  lit?: string[];
  /** Join lit nodes with a route, in the order given. */
  route?: boolean;
  /** Highlighted node. */
  selected?: string | null;
}

export interface RenderOptions {
  /** Node id to zoom to: a territory, a capability, or a skill (zooms to its capability). Empty = world. */
  focus?: string | null;
  /** Intended display size in CSS pixels. */
  width?: number;
  height?: number;
  style?: MapStyle;
  state?: MapState;
  /** Wrap nodes in links to their pages. */
  links?: boolean;
  /** Prefix for link URLs. */
  base?: string;
  /** Prefix for ids inside the SVG, needed when several maps share a page. */
  idPrefix?: string;
  /** Multiplier for text and glyph sizes; below 1 for thumbnails. */
  scale?: number;
  labels?: boolean;
  terrain?: boolean;
  /** Embed this stylesheet in the SVG (for standalone files). */
  css?: string;
  /** Extra class names on the root element. */
  className?: string;
}

export type ZoomLevel = 'world' | 'territory' | 'capability';

export interface MapView {
  level: ZoomLevel;
  territory?: string;
  capability?: string;
  selected?: string;
  box: Box;
  /** Pixels per world unit. */
  k: number;
}

interface Index {
  terr: Map<string, MapAtlas['territories'][number]>;
  cap: Map<string, MapAtlas['capabilities'][number]>;
  skill: Map<string, MapAtlas['skills'][number]>;
  terrBoxes: [string, Box][];
  coastBox: Box;
}
const indexCache = new WeakMap<object, Index>();
function indexOf(atlas: MapAtlas, g: Geometry): Index {
  let idx = indexCache.get(atlas);
  if (!idx) {
    idx = {
      terr: new Map(atlas.territories.map((t) => [t.id, t])),
      cap: new Map(atlas.capabilities.map((c) => [c.id, c])),
      skill: new Map(atlas.skills.map((s) => [s.id, s])),
      terrBoxes: Object.entries(g.territories).map(([id, t]) => [id, bbox(t.outline)]),
      coastBox: bbox(g.coast),
    };
    indexCache.set(atlas, idx);
  }
  return idx;
}

// ---- small helpers --------------------------------------------------------------------

const f = (n: number) => (Math.round(n * 100) / 100).toString();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inBox = ([x, y]: Pt, b: Box) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
const grow = (b: Box, m: number): Box => ({ x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m });
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function hash(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fitAspect(b: Box, aspect: number): Box {
  if (b.w / b.h > aspect) {
    const h = b.w / aspect;
    return { x: b.x, y: b.y - (h - b.h) / 2, w: b.w, h };
  }
  const w = b.h * aspect;
  return { x: b.x - (w - b.w) / 2, y: b.y, w, h: b.h };
}

/** Sutherland-Hodgman clip of a closed polygon to a rectangle. */
function clipPolygon(poly: Pt[], b: Box): Pt[] {
  const edges: [(p: Pt) => boolean, (a: Pt, c: Pt) => Pt][] = [
    [(p) => p[0] >= b.x, (a, c) => [b.x, a[1] + ((c[1] - a[1]) * (b.x - a[0])) / (c[0] - a[0])]],
    [(p) => p[0] <= b.x + b.w, (a, c) => [b.x + b.w, a[1] + ((c[1] - a[1]) * (b.x + b.w - a[0])) / (c[0] - a[0])]],
    [(p) => p[1] >= b.y, (a, c) => [a[0] + ((c[0] - a[0]) * (b.y - a[1])) / (c[1] - a[1]), b.y]],
    [(p) => p[1] <= b.y + b.h, (a, c) => [a[0] + ((c[0] - a[0]) * (b.y + b.h - a[1])) / (c[1] - a[1]), b.y + b.h]],
  ];
  let out = poly;
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (!out.length) break;
  }
  return out;
}

/** Splits a polyline into the runs that touch the rectangle. */
function clipPolyline(line: Pt[], b: Box): Pt[][] {
  const runs: Pt[][] = [];
  let run: Pt[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], c = line[i + 1];
    const seg = { x: Math.min(a[0], c[0]), y: Math.min(a[1], c[1]), w: Math.abs(a[0] - c[0]), h: Math.abs(a[1] - c[1]) };
    if (overlaps(grow(seg, 0.01), b)) {
      if (!run.length) run.push(a);
      run.push(c);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

/** Drops points closer than `min` to the previous kept point. */
function thin(pts: Pt[], min: number): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) >= min) out.push(p);
  }
  return out;
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const pathOf = (pts: Pt[], close: boolean) =>
  pts.length ? 'M' + pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join('L') + (close ? 'Z' : '') : '';

/** Catmull-Rom spline through points, as cubic Beziers. */
function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    // tension below the classic 1/6 keeps the curve from looping between distant points
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 9, p1[1] + (p2[1] - p0[1]) / 9];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 9, p2[1] - (p3[1] - p1[1]) / 9];
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function nearLine(p: Pt, line: Pt[], d: number, closed: boolean): boolean {
  const n = closed ? line.length : line.length - 1;
  for (let i = 0; i < n; i++) {
    const a = line[i], b = line[(i + 1) % line.length];
    if (Math.abs(a[0] - p[0]) > d + 12 && Math.abs(b[0] - p[0]) > d + 12) continue;
    if (Math.abs(a[1] - p[1]) > d + 12 && Math.abs(b[1] - p[1]) > d + 12) continue;
    if (segDist(p, a, b) < d) return true;
  }
  return false;
}

const CHAR_W: Record<MapStyle, number> = { ink: 0.5, illustrated: 0.47 };
const textWidth = (s: string, px: number, style: MapStyle, caps = false) =>
  s.length * px * (caps ? CHAR_W[style] * 1.35 + 0.06 : CHAR_W[style]);

/** Splits a label into two lines near the middle when it is long. */
function wrap(s: string, max = 17): string[] {
  if (s.length <= max) return [s];
  const mid = s.length / 2;
  let best = -1;
  for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best < 0 ? [s] : [s.slice(0, best), s.slice(best + 1)];
}

// ---- view -----------------------------------------------------------------------------

export function computeView(atlas: MapAtlas, g: Geometry, opts: RenderOptions = {}): MapView {
  const idx = indexOf(atlas, g);
  const width = opts.width ?? 1200;
  const height = opts.height ?? Math.round((width * g.height) / g.width);
  const aspect = width / height;
  const style = opts.style ?? 'ink';
  const scale = opts.scale ?? 1;
  const world: Box = { x: 0, y: 0, w: g.width, h: g.height };
  let focus = opts.focus ?? '';
  let selected = opts.state?.selected ?? undefined;

  const skill = idx.skill.get(focus);
  if (skill) {
    selected = selected ?? skill.id;
    focus = skill.capability;
  }

  const cap = idx.cap.get(focus);
  if (cap) {
    const centre = g.points[cap.id];
    const ring = bbox(cap.skills.map((s) => g.points[s]).concat([centre]));
    // The ring of skills takes a bit under half the width, leaving room for labels beside it.
    const ringPx = Math.min(width * 0.4, height * 0.75, 430 * scale);
    const k = ringPx / Math.max(ring.w, ring.h * 1.4);
    const w = width / k;
    const h = height / k;
    const cx = ring.x + ring.w / 2;
    const cy = ring.y + ring.h / 2;
    const box: Box = { x: cx - w / 2, y: cy - h / 2, w, h };
    return { level: 'capability', territory: cap.territory, capability: cap.id, selected, box, k };
  }

  const terr = idx.terr.get(focus);
  if (terr && !terr.crossCutting && g.territories[terr.id]) {
    const b = bbox(g.territories[terr.id].outline);
    const box = fitAspect(grow(b, Math.max(b.w, b.h) * 0.06), aspect);
    return { level: 'territory', territory: terr.id, selected, box, k: width / box.w };
  }

  const box = fitAspect(world, aspect);
  return { level: terr?.crossCutting ? 'territory' : 'world', territory: terr?.id, selected, box, k: width / box.w };
}

// ---- render ---------------------------------------------------------------------------

export function renderMap(atlas: MapAtlas, g: Geometry, opts: RenderOptions = {}): string {
  const idx = indexOf(atlas, g);
  const style: MapStyle = opts.style ?? 'ink';
  const width = opts.width ?? 1200;
  const height = opts.height ?? Math.round((width * g.height) / g.width);
  const scale = opts.scale ?? 1;
  const labels = opts.labels ?? true;
  const links = opts.links ?? true;
  const base = opts.base ?? '';
  const pre = opts.idPrefix ?? 'pm';
  const state = opts.state ?? {};
  const progress = state.progress ?? {};
  const view = computeView(atlas, g, { ...opts, width, height });
  const { box, k, level } = view;
  const u = (px: number) => (px * scale) / k; // screen px -> world units
  const clip = grow(box, Math.max(box.w, box.h) * 0.08);
  const ox = (p: Pt) => `${f(p[0])}`;
  const oy = (p: Pt) => `${f(p[1])}`;
  const out: string[] = [];
  const avoid: Box[] = []; // label boxes, in units, that terrain should keep clear of
  const avoidPts: [Pt, number][] = []; // node points and their clearance radius in units

  const isCross = (tid: string) => idx.terr.get(tid)?.crossCutting ?? false;
  const focusTerr = view.territory;
  const href = (id: string) => {
    const s = idx.skill.get(id);
    if (s) return `${base}/atlas/${s.territory}/${s.capability}/${s.id}/`;
    const c = idx.cap.get(id);
    if (c) return `${base}/atlas/${c.territory}/${c.id}/`;
    return `${base}/atlas/${id}/`;
  };

  // Lit nodes are drawn at the level that is visible: a lit skill lights its capability
  // unless we are zoomed into that capability.
  const litSkillsByCap = new Map<string, string[]>();
  const litCaps = new Set<string>();
  const litSkills = new Set<string>();
  const litTerrs = new Set<string>();
  const routeIds: string[] = [];
  for (const id of state.lit ?? []) {
    const s = idx.skill.get(id);
    if (s) {
      if (level === 'capability' && view.capability === s.capability) {
        litSkills.add(s.id);
        routeIds.push(s.id);
      } else {
        litCaps.add(s.capability);
        litSkillsByCap.set(s.capability, [...(litSkillsByCap.get(s.capability) ?? []), s.name]);
        routeIds.push(s.capability);
      }
      continue;
    }
    if (idx.cap.has(id)) {
      litCaps.add(id);
      routeIds.push(id);
      continue;
    }
    if (idx.terr.has(id)) litTerrs.add(id);
  }

  // ---- sea and land
  out.push(`<rect class="sea" x="${f(clip.x)}" y="${f(clip.y)}" width="${f(clip.w)}" height="${f(clip.h)}"/>`);
  const minStep = Math.max(0.5, 3 / k);
  const coast = thin(clipPolygon(g.coast, clip), minStep);
  const coastD = pathOf(coast, true);
  const islands = Object.entries(g.islands).filter(([, ring]) => overlaps(bbox(ring), clip));
  const islandD = islands.map(([, ring]) => pathOf(thin(ring, minStep), true)).join('');
  const shores = coastD + islandD;
  if (style === 'ink') {
    for (const d of [17, 11, 5.5]) {
      out.push(`<use href="#${pre}-shore" class="ripple-o" stroke-width="${f(u(2 * d + 1.1))}" opacity="${f(0.35 + (17 - d) / 40)}"/>`);
      out.push(`<use href="#${pre}-shore" class="ripple-i" stroke-width="${f(u(2 * d - 1.1))}"/>`);
    }
  } else {
    out.push(`<use href="#${pre}-shore" class="shallow" stroke-width="${f(u(26))}" opacity=".5"/>`);
    out.push(`<use href="#${pre}-shore" class="shallow" stroke-width="${f(u(12))}"/>`);
  }
  out.push(`<path class="land" d="${coastD}"/>`);

  for (const t of atlas.territories) {
    const geo = g.territories[t.id];
    if (!geo) continue;
    const poly = thin(clipPolygon(geo.outline, clip), minStep);
    if (poly.length < 3) continue;
    if (style === 'illustrated') out.push(`<path class="terr terr--${t.id}" d="${pathOf(poly, true)}"/>`);
    if (litTerrs.has(t.id)) out.push(`<path class="lit-terr" d="${pathOf(poly, true)}"/>`);
  }
  const dash = style === 'ink' ? `${f(u(0.5))} ${f(u(4.5))}` : `${f(u(5))} ${f(u(4))}`;
  for (const line of g.borders) {
    for (const run of clipPolyline(line, clip)) {
      const pts = thin(run, minStep);
      out.push(`<path class="border" d="${pathOf(pts, false)}" stroke-width="${f(u(style === 'ink' ? 1.9 : 1.3))}" stroke-dasharray="${dash}"/>`);
    }
  }
  out.push(`<path class="coast" d="${coastD}" stroke-width="${f(u(style === 'ink' ? 1.5 : 1.2))}"/>`);
  for (const [id, ring] of islands) {
    out.push(`<path class="island${litCaps.has(id) ? ' is-lit' : ''}" d="${pathOf(thin(ring, minStep), true)}" stroke-width="${f(u(1.3))}"/>`);
  }

  // ---- which nodes are visible, and where their labels go
  type NodeDraw = {
    id: string;
    level: 'capability' | 'skill';
    p: Pt;
    r: number; // px
    label?: { text: string[]; x: number; y: number; anchor: 'start' | 'middle' | 'end'; px: number; bold?: boolean };
    cls: string[];
    skills?: string[];
  };
  const nodes: NodeDraw[] = [];
  const showCapLabels = labels && level !== 'world';
  for (const c of atlas.capabilities) {
    const p = g.points[c.id];
    if (!p || !inBox(p, clip)) continue;
    const cls = ['n', 'n-c'];
    const inFocus =
      level === 'world' ||
      (level === 'territory' && (focusTerr === c.territory || (isCross(focusTerr ?? '') && false))) ||
      (level === 'capability' && view.capability === c.id);
    const dimmed = level !== 'world' && !inFocus && !(level === 'territory' && isCross(focusTerr ?? '') && c.territory === focusTerr);
    if (dimmed) cls.push('is-dim');
    if (litCaps.has(c.id)) cls.push('is-lit');
    if (view.selected === c.id) cls.push('is-sel');
    const r = level === 'world' ? 4.2 : level === 'territory' ? 6.5 : view.capability === c.id ? 8.5 : 5;
    let label: NodeDraw['label'];
    const litNames = litSkillsByCap.get(c.id);
    if (labels && (showCapLabels || litCaps.has(c.id) || view.selected === c.id)) {
      if (level === 'capability' && view.capability !== c.id) {
        label = undefined;
      } else if (level === 'capability') {
        label = { text: wrap(c.name, 22), x: p[0], y: p[1] + u(r + 19), anchor: 'middle', px: 17, bold: true };
      } else {
        const text = level === 'world' && litNames ? [litNames.join(', ')] : wrap(c.name);
        const px = level === 'world' ? 12.5 : dimmed ? 12 : 14;
        label = { text, x: p[0], y: p[1] + u(r + px + 3), anchor: 'middle', px };
      }
    }
    nodes.push({ id: c.id, level: 'capability', p, r, label, cls, skills: c.skills });
  }
  if (level === 'capability') {
    const cap = idx.cap.get(view.capability!)!;
    const centre = g.points[cap.id];
    for (const sid of cap.skills) {
      const p = g.points[sid];
      const s = idx.skill.get(sid)!;
      const cls = ['n', 'n-s'];
      if (progress[sid]) cls.push(`st-${progress[sid]}`);
      if (litSkills.has(sid)) cls.push('is-lit');
      if (view.selected === sid) cls.push('is-sel');
      const dx = p[0] - centre[0];
      const side = Math.abs(dx) < 2 ? 'middle' : dx > 0 ? 'start' : 'end';
      const r = 4.6;
      const label: NodeDraw['label'] = labels
        ? side === 'middle'
          ? { text: [s.name], x: p[0], y: p[1] + (p[1] > centre[1] ? u(r + 15) : -u(r + 6)), anchor: 'middle', px: 13 }
          : { text: [s.name], x: p[0] + (side === 'start' ? u(r + 6) : -u(r + 6)), y: p[1] + u(4.5), anchor: side, px: 13 }
        : undefined;
      nodes.push({ id: sid, level: 'skill', p, r, label, cls });
    }
  }

  // label boxes, so terrain stays clear of them
  for (const n of nodes) {
    avoidPts.push([n.p, u(n.r + 9)]);
    if (!n.label) continue;
    const L = n.label;
    const w = Math.max(...L.text.map((t) => textWidth(t, L.px * scale, style))) / k;
    const h = u(L.px * 1.25) * L.text.length;
    const x = L.anchor === 'middle' ? L.x - w / 2 : L.anchor === 'start' ? L.x : L.x - w;
    avoid.push(grow({ x, y: L.y - u(L.px), w, h }, u(4)));
  }

  // territory labels
  type TLabel = { id: string; text: string; p: Pt; px: number; dim: boolean };
  const tlabels: TLabel[] = [];
  if (labels) {
    for (const t of atlas.territories) {
      const geo = g.territories[t.id];
      if (!geo || !inBox(geo.label, clip)) continue;
      if (level === 'capability') continue;
      const dim = level === 'territory' && focusTerr !== t.id;
      // world labels shrink with the map so neighbours never touch
      const px = level === 'world' ? Math.max(13, Math.min(24, width / 62)) : dim ? 15 : 22;
      // at territory zoom the focused territory's name sits where it fits best: its label anchor
      tlabels.push({ id: t.id, text: t.name, p: geo.label, px, dim });
      const w = textWidth(t.name, px * scale, style, true) / k;
      avoid.push(grow({ x: geo.label[0] - w / 2, y: geo.label[1] - u(px * 0.8), w, h: u(px * 1.1) }, u(6)));
    }
  }

  // ---- terrain glyphs
  if (opts.terrain ?? true) {
    const spacingPx = (level === 'capability' ? 44 : level === 'territory' ? 34 : 27) * scale;
    let s = spacingPx / k;
    s = 2 ** (Math.round(Math.log2(s) * 2) / 2);
    const glyphScale = scale * (level === 'world' ? 0.8 : 0.95);
    const focusCap = level === 'capability' ? g.points[view.capability!] : undefined;
    const i0 = Math.floor(clip.x / s), i1 = Math.ceil((clip.x + clip.w) / s);
    const j0 = Math.floor(clip.y / s), j1 = Math.ceil((clip.y + clip.h) / s);
    const placed: [number, number, GlyphName, boolean][] = [];
    const coastNear = u(9);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const h = hash(i, j, s * 7);
        const p: Pt = [(i + 0.12 + 0.76 * hash(i, j, s * 7 + 1)) * s, (j + 0.12 + 0.76 * hash(i, j, s * 7 + 2)) * s];
        if (!inBox(p, clip)) continue;
        const onLand = inBox(p, idx.coastBox) && pointInPolygon(p, g.coast);
        let tid = 'sea';
        if (onLand) {
          if (h < (level === 'capability' ? 0.45 : 0.3)) continue;
          if (focusCap && ((p[0] - focusCap[0]) / 34) ** 2 + ((p[1] - focusCap[1]) / 22) ** 2 < 1) continue;
          for (const [id, b] of idx.terrBoxes) {
            if (inBox(p, b) && pointInPolygon(p, g.territories[id].outline)) {
              tid = id;
              break;
            }
          }
          if (tid === 'sea') continue;
        } else {
          if (h > 0.13) continue;
          if (islands.some(([, ring]) => pointInPolygon(p, ring) || nearLine(p, ring, u(26), true))) continue;
          if (nearLine(p, g.coast, u(48), true)) continue;
        }
        if (onLand && nearLine(p, g.coast, coastNear, true)) continue;
        if (avoidPts.some(([q, r]) => Math.abs(q[0] - p[0]) < r + u(10) && Math.abs(q[1] - p[1]) < r + u(12))) continue;
        const gb = { x: p[0] - u(12), y: p[1] - u(14), w: u(24), h: u(17) };
        if (avoid.some((b) => overlaps(b, gb))) continue;
        const mix = TERRAIN[tid] ?? TERRAIN.discovery;
        const total = mix.reduce((a, [, w]) => a + w, 0);
        let pick = hash(i, j, s * 7 + 3) * total;
        let name: GlyphName = mix[0][0];
        for (const [gname, w] of mix) {
          if ((pick -= w) <= 0) {
            name = gname;
            break;
          }
        }
        placed.push([p[0], p[1], name, !onLand]);
      }
    }
    placed.sort((a, b) => a[1] - b[1]);
    const gs = f(glyphScale / k);
    out.push(`<g class="terrain" aria-hidden="true">`);
    for (const [x, y, name, sea] of placed) {
      out.push(`<use href="#${pre}-${name}" class="${sea ? 'glyph-sea' : 'glyph'}" transform="translate(${f(x)} ${f(y)}) scale(${gs})"/>`);
    }
    out.push(`</g>`);
  }

  // ---- territory hit areas: clicking empty land opens that territory
  if (links) {
    for (const t of atlas.territories) {
      const geo = g.territories[t.id];
      if (!geo || (level === 'territory' && focusTerr === t.id)) continue;
      const poly = thin(clipPolygon(geo.outline, clip), minStep * 2);
      if (poly.length < 3) continue;
      out.push(`<a class="thit" href="${href(t.id)}" data-id="${t.id}" tabindex="-1" aria-hidden="true"><path d="${pathOf(poly, true)}"/></a>`);
    }
    if (level === 'world' || (level === 'territory' && !isCross(focusTerr ?? ''))) {
      const cross = atlas.territories.find((t) => t.crossCutting);
      if (cross) {
        for (const [, ring] of islands) {
          out.push(`<a class="thit" href="${href(cross.id)}" data-id="${cross.id}" tabindex="-1" aria-hidden="true"><path d="${pathOf(ring, true)}"/></a>`);
        }
      }
    }
  }

  // ---- focus shading: everything outside the focused territory fades back
  if (level !== 'world' && focusTerr && !isCross(focusTerr) && g.territories[focusTerr]) {
    const outline = thin(clipPolygon(g.territories[focusTerr].outline, clip), minStep);
    out.push(`<path class="shade" fill-rule="evenodd" d="M${f(clip.x)},${f(clip.y)}h${f(clip.w)}v${f(clip.h)}h${f(-clip.w)}Z${pathOf(outline, true)}"/>`);
  } else if (level === 'territory' && focusTerr && isCross(focusTerr)) {
    out.push(`<path class="shade" d="${coastD}"/>`);
  }

  // ---- route joining lit nodes, in order
  if (state.route && routeIds.length > 1) {
    const pts: Pt[] = [];
    for (const id of routeIds) {
      const p = g.points[id];
      if (p && (!pts.length || pts[pts.length - 1] !== p)) pts.push(p);
    }
    if (pts.length > 1) {
      const d = smoothPath(pts);
      out.push(`<path class="route" d="${d}" stroke-width="${f(u(style === 'ink' ? 9 : 4.5))}"/>`);
      if (style === 'ink') out.push(`<path class="route-ink" d="${d}" stroke-width="${f(u(1.4))}" style="--m-dash:${f(u(1))} ${f(u(5))}"/>`);
    }
  }

  // ---- territory labels
  const halo = (px: number) => f(u(px > 16 ? 4.5 : 3.2));
  for (const t of tlabels) {
    const w = textWidth(t.text, t.px * scale, style, true) / k;
    if (style === 'illustrated' && !t.dim) {
      out.push(`<rect class="pill" x="${f(t.p[0] - w / 2 - u(12))}" y="${f(t.p[1] - u(t.px * 0.95))}" width="${f(w + u(24))}" height="${f(u(t.px * 1.45))}" rx="${f(u(t.px * 0.7))}" stroke-width="${f(u(1))}"/>`);
    }
    const text = `<text class="tlabel${t.dim ? ' is-dim' : ''}" x="${ox(t.p)}" y="${f(t.p[1] + u(t.px * 0.32))}" text-anchor="middle" font-size="${f(u(t.px))}" stroke-width="${halo(t.px)}">${esc(t.text)}</text>`;
    out.push(links ? `<a class="tl" href="${href(t.id)}" data-id="${t.id}">${text}</a>` : text);
  }

  // ---- nodes
  const sw = (px: number) => f(u(px));
  for (const n of nodes) {
    const [x, y] = n.p;
    const attrs = [`class="${n.cls.join(' ')}"`, `data-id="${n.id}"`];
    if (n.skills) attrs.push(`data-skills="${n.skills.join(' ')}"`);
    const name = n.level === 'skill' ? idx.skill.get(n.id)!.name : idx.cap.get(n.id)!.name;
    const tag = links ? 'a' : 'g';
    if (links) attrs.push(`href="${href(n.id)}"`, `aria-label="${esc(name)}"`);
    const parts: string[] = [];
    parts.push(`<circle class="halo" cx="${f(x)}" cy="${f(y)}" r="${sw(n.r + 9)}"/>`);
    parts.push(`<circle class="hit" cx="${f(x)}" cy="${f(y)}" r="${sw(Math.max(n.r + 6, 14))}"/>`);
    if (n.level === 'capability') {
      // progress roll-up: share of skills learning (soft) and comfortable (strong)
      const total = n.skills!.length;
      const comf = n.skills!.filter((s) => progress[s] === 'comfortable').length;
      const learn = n.skills!.filter((s) => progress[s] === 'learning').length;
      const rr = sw(n.r + 3.2);
      const rot = `transform="rotate(-90 ${f(x)} ${f(y)})"`;
      parts.push(`<circle class="roll-l" cx="${f(x)}" cy="${f(y)}" r="${rr}" pathLength="100" stroke-width="${sw(3)}" stroke-dasharray="${f(((comf + learn) / total) * 100)} 100" ${rot}/>`);
      parts.push(`<circle class="roll" cx="${f(x)}" cy="${f(y)}" r="${rr}" pathLength="100" stroke-width="${sw(3)}" stroke-dasharray="${f((comf / total) * 100)} 100" ${rot}/>`);
    }
    parts.push(`<circle class="dot" cx="${f(x)}" cy="${f(y)}" r="${sw(n.r)}" stroke-width="${sw(n.level === 'capability' ? 1.6 : 1.3)}"/>`);
    if (n.level === 'capability' && level !== 'world') parts.push(`<circle class="core" cx="${f(x)}" cy="${f(y)}" r="${sw(n.r * 0.32)}"/>`);
    parts.push(`<circle class="ring" cx="${f(x)}" cy="${f(y)}" r="${sw(n.r + 6)}" stroke-width="${sw(2)}"/>`);
    if (n.label) {
      const L = n.label;
      const lines = L.text
        .map((t, i) => `<tspan x="${f(L.x)}" dy="${i === 0 ? 0 : f(u(L.px * 1.12))}">${esc(t)}</tspan>`)
        .join('');
      parts.push(
        `<text x="${f(L.x)}" y="${f(L.y)}" text-anchor="${L.anchor}" font-size="${f(u(L.px))}" stroke-width="${halo(L.px)}"${L.bold ? ' font-weight="700"' : ''}>${lines}</text>`,
      );
    }
    out.push(`<${tag} ${attrs.join(' ')}>${parts.join('')}</${tag}>`);
  }

  // ---- compass, world view only
  if (level === 'world' && labels && scale >= 0.8) {
    const c: Pt = [box.x + box.w - u(70), box.y + box.h - u(78)];
    const r = u(26);
    out.push(
      `<g class="compass" aria-hidden="true"><path d="M${f(c[0])},${f(c[1] - r)}L${f(c[0] + r * 0.22)},${f(c[1])}L${f(c[0])},${f(c[1] + r)}L${f(c[0] - r * 0.22)},${f(c[1])}ZM${f(c[0] - r)},${f(c[1])}L${f(c[0])},${f(c[1] - r * 0.22)}L${f(c[0] + r)},${f(c[1])}L${f(c[0])},${f(c[1] + r * 0.22)}Z" stroke-width="${sw(1.2)}"/><text x="${f(c[0])}" y="${f(c[1] - r - u(6))}" text-anchor="middle" font-size="${sw(13)}" stroke-width="0">N</text></g>`,
    );
  }

  const defs = glyphDefs(style, pre) + `<path id="${pre}-shore" d="${shores}"/>`;
  const label = view.capability
    ? idx.cap.get(view.capability)!.name
    : view.territory
      ? idx.terr.get(view.territory)!.name
      : 'Product engineering';
  const cls = ['pm', style === 'ink' ? 'pm--ink' : 'pm--ill', `pm-z-${level}`, opts.className ?? ''].filter(Boolean).join(' ');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="${f(box.x)} ${f(box.y)} ${f(box.w)} ${f(box.h)}" width="${width}" height="${height}" role="group" aria-label="Map: ${esc(label)}" data-level="${level}" data-focus="${view.capability ?? view.territory ?? ''}" data-k="${f(k)}" style="--m-sel-w:${sw(3)}">` +
    (opts.css ? `<style>${opts.css}</style>` : '') +
    `<defs>${defs}</defs>` +
    out.join('') +
    `</svg>`
  );
}

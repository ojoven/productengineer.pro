// (content, geometry, state) -> SVG string. Pure and synchronous: the same function draws the
// static pre-zoomed maps on topic pages (no JavaScript), the interactive explorer, and the
// social images.
//
// Every skill is one hexagon. Progress fills the tiles (outlined = learning, solid =
// comfortable); lit skills turn the accent colour and can be joined by a route. Text sizes
// are in screen pixels, converted to world units with k (pixels per unit).
import { bbox, DIRS, hexCorner, hexKey, type Box, type Geometry, type Hex, type Pt } from './geometry.ts';

export interface MapAtlas {
  territories: { id: string; name: string; crossCutting: boolean; capabilities: string[] }[];
  capabilities: { id: string; name: string; territory: string; skills: string[] }[];
  skills: { id: string; name: string; capability: string; territory: string }[];
}

import type { Status } from './status.ts';
export type { Status } from './status.ts';

export interface MapState {
  /** Self-reported status per skill id. */
  progress?: Record<string, Status>;
  /** Filter matches get a yellow background independently of saved progress and shared routes. */
  matches?: string[];
  /** Lit node ids, in route order. A separate layer from progress, so both show at once. */
  lit?: string[];
  /** Join lit nodes with a route, in the order given. */
  route?: boolean;
  /** Highlighted node. */
  selected?: string | null;
}

export interface RenderOptions {
  /** Node to zoom to: a territory, a capability, or a skill (zooms to its capability). Empty = world. */
  focus?: string | null;
  /** Intended display size in CSS pixels. */
  width?: number;
  height?: number;
  state?: MapState;
  /** Wrap nodes in links to their pages. */
  links?: boolean;
  /** Prefix for link URLs. */
  base?: string;
  /** Multiplier for text sizes; below 1 for thumbnails and phones. */
  scale?: number;
  labels?: boolean;
  /** Embed this stylesheet (for standalone files). */
  css?: string;
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
  owner: Map<string, string>; // hex key -> skill id
  codes: Map<string, string>;
}
const cache = new WeakMap<object, Index>();

/** Catalogue codes: 06 for a territory, 06.4 for its fourth capability, 06.4.5 for a skill. */
export function nodeCodes(atlas: MapAtlas): Map<string, string> {
  const codes = new Map<string, string>();
  const caps = new Map(atlas.capabilities.map((c) => [c.id, c]));
  let n = 0;
  for (const t of atlas.territories) {
    const tc = t.crossCutting ? 'X' : String(++n).padStart(2, '0');
    codes.set(t.id, tc);
    t.capabilities.forEach((cid, i) => {
      codes.set(cid, `${tc}.${i + 1}`);
      caps.get(cid)?.skills.forEach((sid, j) => codes.set(sid, `${tc}.${i + 1}.${j + 1}`));
    });
  }
  return codes;
}

function indexOf(atlas: MapAtlas, g: Geometry): Index {
  let idx = cache.get(atlas);
  if (!idx) {
    idx = {
      terr: new Map(atlas.territories.map((t) => [t.id, t])),
      cap: new Map(atlas.capabilities.map((c) => [c.id, c])),
      skill: new Map(atlas.skills.map((s) => [s.id, s])),
      owner: new Map(Object.entries(g.cells).map(([id, h]) => [hexKey(h), id])),
      codes: nodeCodes(atlas),
    };
    cache.set(atlas, idx);
  }
  return idx;
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const grow = (b: Box, m: number): Box => ({ x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m });
const inBox = ([x, y]: Pt, b: Box) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

function fitAspect(b: Box, aspect: number): Box {
  if (b.w / b.h > aspect) {
    const h = b.w / aspect;
    return { x: b.x, y: b.y - (h - b.h) / 2, w: b.w, h };
  }
  const w = b.h * aspect;
  return { x: b.x - (w - b.w) / 2, y: b.y, w, h: b.h };
}

/** Greedy word wrap to at most `maxLines` lines of about `maxChars`. */
export function wrapText(s: string, maxChars: number, maxLines = 3): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of s.split(' ')) {
    if (!line) line = w;
    else if ((line + ' ' + w).length <= maxChars) line += ' ' + w;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] += '…';
    return kept;
  }
  return lines;
}

const CHAR = 0.54; // average glyph width / font size for the UI sans

// ---- view -----------------------------------------------------------------------------

export function computeView(atlas: MapAtlas, g: Geometry, opts: RenderOptions = {}): MapView {
  const idx = indexOf(atlas, g);
  const width = opts.width ?? 1200;
  const height = opts.height ?? Math.round((width * g.height) / g.width);
  const scale = opts.scale ?? 1;
  const aspect = width / height;
  let focus = opts.focus ?? '';
  let selected = opts.state?.selected ?? undefined;
  const skill = idx.skill.get(focus);
  if (skill) {
    selected = selected ?? skill.id;
    focus = skill.capability;
  }

  const cap = idx.cap.get(focus);
  if (cap) {
    const b = grow(bbox(cap.skills.map((s) => g.points[s])), g.size);
    // tiles stay readable but never huge: a hexagon is at most ~150px wide
    const maxK = (150 * scale) / (g.size * Math.sqrt(3));
    const top = 48 * scale; // room for the capability's name above its cluster
    const k = Math.max(0.1, Math.min(width / (b.w * 1.3), (height - top) / (b.h * 1.3), maxK));
    const w = width / k;
    const h = height / k;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2 - top / k / 2;
    return { level: 'capability', territory: cap.territory, capability: cap.id, selected, box: { x: cx - w / 2, y: cy - h / 2, w, h }, k };
  }

  const terr = idx.terr.get(focus);
  if (terr) {
    const pts = terr.capabilities.flatMap((c) => idx.cap.get(c)!.skills.map((s) => g.points[s]));
    pts.push(g.territories[terr.id].label);
    const b = grow(bbox(pts), g.size * 1.6);
    const box = fitAspect(grow(b, Math.max(b.w, b.h) * 0.03), aspect);
    return { level: 'territory', territory: terr.id, selected, box, k: width / box.w };
  }

  const box = fitAspect({ x: 0, y: 0, w: g.width, h: g.height }, aspect);
  return { level: 'world', selected, box, k: width / box.w };
}

// ---- render ---------------------------------------------------------------------------

export function renderMap(atlas: MapAtlas, g: Geometry, opts: RenderOptions = {}): string {
  const idx = indexOf(atlas, g);
  const width = opts.width ?? 1200;
  const height = opts.height ?? Math.round((width * g.height) / g.width);
  const scale = opts.scale ?? 1;
  const labels = opts.labels ?? true;
  const links = opts.links ?? true;
  const base = opts.base ?? '';
  const state = opts.state ?? {};
  const progress = state.progress ?? {};
  const view = computeView(atlas, g, { ...opts, width, height });
  const { box, k, level } = view;
  const u = (px: number) => (px * scale) / k; // screen px -> world units
  const clip = grow(box, g.size * 2);
  const code = (id: string) => idx.codes.get(id) ?? '';
  const nameOf = (id: string) => idx.skill.get(id)?.name ?? idx.cap.get(id)?.name ?? idx.terr.get(id)?.name ?? id;
  const href = (id: string) => {
    const s = idx.skill.get(id);
    if (s) return `${base}/skills-map/${s.territory}/${s.capability}/${s.id}/`;
    const c = idx.cap.get(id);
    if (c) return `${base}/skills-map/${c.territory}/${c.id}/`;
    return `${base}/skills-map/${id}/`;
  };

  const lit = new Set<string>();
  const matches = new Set(state.matches ?? []);
  const litCaps = new Set<string>();
  const litTerrs = new Set<string>();
  for (const id of state.lit ?? []) {
    if (idx.skill.has(id)) lit.add(id);
    else if (idx.cap.has(id)) litCaps.add(id);
    else if (idx.terr.has(id)) litTerrs.add(id);
  }

  const inset = Math.max(g.size * 0.012, 0.9 / k); // a hairline gap between tiles
  const hexPath = (c: Pt, r: number) => {
    let d = '';
    for (let i = 0; i < 6; i++) {
      const p = hexCorner(c, r, i);
      d += `${i ? 'L' : 'M'}${f(p[0])},${f(p[1])}`;
    }
    return d + 'Z';
  };
  const stateClasses = (sid: string) => {
    const cls: string[] = [];
    if (progress[sid]) cls.push(`st-${progress[sid]}`);
    if (lit.has(sid)) cls.push('is-lit');
    if (matches.has(sid)) cls.push('is-filter-match');
    return cls;
  };
  const tile = (sid: string) =>
    `<path class="${['tile', ...stateClasses(sid)].join(' ')}" data-skill="${sid}" d="${hexPath(g.points[sid], g.size - inset)}"/>`;
  const visible = (sid: string) => inBox(g.points[sid], clip);
  // Linked maps get an invisible full-size hexagon under each group's tiles, so the hairline
  // gaps and borders between tiles still count as the tile: the hover does not flicker off.
  const hit = (ids: string[]) =>
    links ? `<path class="hit" d="${ids.map((sid) => hexPath(g.points[sid], g.size + inset)).join('')}"/>` : '';

  const out: string[] = [];
  const labelLayer: string[] = [];
  out.push(`<rect class="bg" x="${f(clip.x)}" y="${f(clip.y)}" width="${f(clip.w)}" height="${f(clip.h)}"/>`);

  // ---- tiles, grouped by what a click opens at this zoom
  const tag = links ? 'a' : 'g';
  const open = (id: string, cls: string[], focusable: boolean, extra: Record<string, string> = {}) => {
    const attrs: Record<string, string> = { class: cls.join(' '), 'data-id': id, ...extra };
    if (links) {
      attrs.href = href(id);
      attrs['aria-label'] = `${code(id)} ${nameOf(id)}`;
      if (!focusable) attrs.tabindex = '-1';
    }
    return `<${tag} ${Object.entries(attrs).map(([key, v]) => `${key}="${v}"`).join(' ')}>`;
  };

  for (const t of atlas.territories) {
    const caps = t.capabilities.map((c) => idx.cap.get(c)!);
    const tSkills = caps.flatMap((c) => c.skills).filter(visible);
    if (!tSkills.length) continue;
    if (level === 'world' || view.territory !== t.id) {
      const cls = ['n', 'n-t'];
      if (level !== 'world') cls.push('is-dim');
      if (litTerrs.has(t.id)) cls.push('is-lit');
      out.push(open(t.id, cls, level === 'world', { 'data-skills': tSkills.join(' ') }) + hit(tSkills) + tSkills.map(tile).join('') + `</${tag}>`);
      continue;
    }
    for (const c of caps) {
      const cSkills = c.skills.filter(visible);
      if (!cSkills.length) continue;
      if (level === 'territory' || view.capability !== c.id) {
        const cls = ['n', 'n-c'];
        if (level === 'capability') cls.push('is-dim');
        if (litCaps.has(c.id)) cls.push('is-lit');
        if (view.selected === c.id) cls.push('is-sel');
        out.push(open(c.id, cls, level === 'territory', { 'data-skills': c.skills.join(' ') }) + hit(cSkills) + cSkills.map(tile).join('') + `</${tag}>`);
        continue;
      }
      for (const sid of c.skills) {
        const cls = ['n', 'n-s', ...stateClasses(sid)];
        if (view.selected === sid) cls.push('is-sel');
        out.push(open(sid, cls, true, { 'data-skill': sid }) + hit([sid]) + tile(sid) + `</${tag}>`);
        if (labels) labelLayer.push(`<g class="${cls.filter((x) => x !== 'n').join(' ')} sl-g" data-skill="${sid}">${skillLabel(sid)}</g>`);
      }
    }
  }

  function skillLabel(sid: string): string {
    const [x, y] = g.points[sid];
    const hexW = g.size * Math.sqrt(3) * k; // px
    const px = Math.min(12.5, Math.max(9, hexW / 11.5));
    const maxChars = Math.max(6, Math.floor((hexW * 0.8) / (px * CHAR)));
    const lines = wrapText(nameOf(sid), maxChars, 3);
    const lh = px * 1.16;
    const showCode = hexW > 100;
    const codePx = px * 0.78;
    const block = lines.length * lh + (showCode ? codePx * 1.35 : 0);
    let ty = y + (-block / 2 + px * 0.82) / k;
    let s = '';
    if (showCode) {
      s += `<text class="mcode" x="${f(x)}" y="${f(ty)}" text-anchor="middle" font-size="${f(codePx / k)}">${code(sid)}</text>`;
      ty += (codePx * 1.35) / k;
    }
    s += `<text class="sl" x="${f(x)}" y="${f(ty)}" text-anchor="middle" font-size="${f(px / k)}">${lines
      .map((l, i) => `<tspan x="${f(x)}" dy="${i ? f(lh / k) : 0}">${esc(l)}</tspan>`)
      .join('')}</text>`;
    return s;
  }

  // ---- borders between capabilities and around territories, each edge drawn once
  let capEdges = '';
  let faintEdges = '';
  // at territory and capability zoom, outlines outside the focus fade back
  const inFocus = (sk: { territory: string; capability: string }) =>
    level === 'world' || (level === 'territory' ? sk.territory === view.territory : sk.capability === view.capability);
  let litEdges = '';
  let selEdges = '';
  const selCap = view.selected && idx.cap.has(view.selected) ? view.selected : undefined;
  for (const s of atlas.skills) {
    const h = g.cells[s.id];
    const c = g.points[s.id];
    if (!inBox(c, clip)) continue;
    for (let i = 0; i < 6; i++) {
      const nh: Hex = [h[0] + DIRS[i][0], h[1] + DIRS[i][1]];
      const other = idx.owner.get(hexKey(nh));
      const o = other ? idx.skill.get(other) : undefined;
      const a = hexCorner(c, g.size, i);
      const b = hexCorner(c, g.size, (i + 1) % 6);
      const seg = `M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}`;
      const strong = inFocus(s) || (o !== undefined && inFocus(o));
      if (!o || (o.capability !== s.capability && s.id < o.id)) {
        if (strong) capEdges += seg;
        else faintEdges += seg;
      }
      const outside = !o || o.capability !== s.capability;
      if (outside && litCaps.has(s.capability)) litEdges += seg;
      if (outside && selCap === s.capability) selEdges += seg;
      if ((!o || o.territory !== s.territory) && litTerrs.has(s.territory)) litEdges += seg;
    }
  }
  if (faintEdges) out.push(`<path class="b-cap b-faint" d="${faintEdges}"/>`);
  out.push(`<path class="b-cap" d="${capEdges}"/>`);
  if (litEdges) out.push(`<path class="b-lit" d="${litEdges}"/>`);
  if (selEdges) out.push(`<path class="b-sel" d="${selEdges}"/>`);
  if (view.selected && idx.skill.has(view.selected) && visible(view.selected)) {
    out.push(`<path class="b-sel" d="${hexPath(g.points[view.selected], g.size - inset)}"/>`);
  }

  // ---- route joining lit nodes, in order
  if (state.route) {
    const pts = (state.lit ?? []).map((id) => g.points[id]).filter((p): p is Pt => !!p);
    if (pts.length > 1) {
      const d = 'M' + pts.map((p) => `${f(p[0])},${f(p[1])}`).join('L');
      out.push(`<path class="route-halo" d="${d}"/><path class="route" d="${d}"/>`);
      out.push(pts.map((p) => `<circle class="route-dot" cx="${f(p[0])}" cy="${f(p[1])}" r="${f(u(3))}"/>`).join(''));
    }
  }

  // ---- labels, above tiles and route
  out.push(...labelLayer);
  if (labels) {
    // territory names sit above their regions
    if (level !== 'capability') {
      for (const t of atlas.territories) {
        const p = g.territories[t.id]?.label;
        if (!p || !inBox(p, clip)) continue;
        const focus = level === 'territory' && view.territory === t.id;
        const px = level === 'world' ? Math.max(9.5, Math.min(13, width / 92)) : focus ? 16 : 11;
        const cls = ['tl'];
        if (level === 'territory' && !focus) cls.push('is-dim');
        if (litTerrs.has(t.id)) cls.push('is-lit');
        const text = `<text class="${cls.join(' ')}" x="${f(p[0])}" y="${f(p[1] + u(px * 0.35))}" text-anchor="middle" font-size="${f(u(px))}"><tspan class="tc">${code(t.id)}</tspan> ${esc(t.name)}</text>`;
        out.push(links ? `<a class="tla" href="${href(t.id)}" data-id="${t.id}" tabindex="-1">${text}</a>` : text);
      }
    }
    // capability names over their clusters at territory zoom
    if (level === 'territory') {
      for (const cid of idx.terr.get(view.territory!)!.capabilities) {
        const c = idx.cap.get(cid)!;
        const p = g.points[cid];
        const px = 13 * scale;
        const across = Math.min(3, Math.ceil(Math.sqrt(c.skills.length)) + 0.5) * g.size * Math.sqrt(3) * k;
        const lines = wrapText(c.name, Math.max(9, Math.floor(across / (px * CHAR))), 3);
        const lh = px * 1.14;
        const codePx = px * 0.78;
        const block = lines.length * lh + codePx * 1.3;
        const y0 = p[1] + (-block / 2 + codePx * 0.85) / k;
        out.push(
          `<text class="cl halo${c.skills.every((id) => matches.has(id)) ? ' is-filter-match' : ''}" x="${f(p[0])}" y="${f(y0)}" text-anchor="middle" stroke-width="${f(4 / k)}"><tspan class="mcode" font-size="${f(codePx / k)}">${code(cid)}</tspan>${lines
            .map((l, i) => `<tspan x="${f(p[0])}" dy="${f((i ? lh : codePx * 1.3) / k)}" font-size="${f(px / k)}">${esc(l)}</tspan>`)
            .join('')}</text>`,
        );
      }
    }
    // the focused capability's name above its cluster; neighbours named faintly
    if (level === 'capability') {
      for (const cid of idx.terr.get(view.territory!)!.capabilities) {
        const c = idx.cap.get(cid)!;
        const p = g.points[cid];
        if (!inBox(p, clip)) continue;
        if (cid === view.capability) {
          const top = Math.min(...c.skills.map((s) => g.points[s][1])) - g.size;
          out.push(
            `<text class="ch halo" x="${f(p[0])}" y="${f(top - u(14))}" text-anchor="middle" font-size="${f(u(17))}" stroke-width="${f(u(5))}"><tspan class="mcode" font-size="${f(u(12))}">${code(cid)}</tspan> ${esc(c.name)}</text>`,
          );
        } else {
          out.push(`<text class="cl halo is-dim" x="${f(p[0])}" y="${f(p[1])}" text-anchor="middle" font-size="${f(u(11))}" stroke-width="${f(u(3))}">${esc(c.name)}</text>`);
        }
      }
    }
  }

  const label = view.capability ? nameOf(view.capability) : view.territory ? nameOf(view.territory) : 'Product engineering';
  const cls = ['pm', `pm-z-${level}`, opts.className ?? ''].filter(Boolean).join(' ');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="${f(box.x)} ${f(box.y)} ${f(box.w)} ${f(box.h)}" width="${width}" height="${height}" role="group" aria-label="Map: ${esc(label)}" data-level="${level}" data-focus="${view.capability ?? view.territory ?? ''}">` +
    (opts.css ? `<style>${opts.css}</style>` : '') +
    out.join('') +
    `</svg>`
  );
}

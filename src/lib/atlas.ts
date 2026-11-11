// Build-time access to the atlas for pages. Cached for the build. In dev the cache is rebuilt
// only when a content file changes, so edits show up on reload without re-parsing every YAML
// file on each helper call (pages call these helpers once per skill).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT, GEOMETRY_FILE, loadAtlas, loadGeometry } from '../atlas/load.ts';
import { renderMap, nodeCodes, type MapState } from '../atlas/render.ts';
import type { Atlas, AtlasNode, Capability, Skill, Territory } from '../atlas/model.ts';
import { nodePath, skillsOf } from '../atlas/model.ts';
import type { Geometry } from '../atlas/geometry.ts';

let cached: { atlas: Atlas; geometry: Geometry; codes: Map<string, string> } | undefined;
let cachedStamp = '';

/** Names and modification times of every file the atlas is loaded from. */
function contentStamp(): string {
  const files = ['atlas', 'resources', 'tools'].flatMap((d) => {
    const dir = join(CONTENT, d);
    return existsSync(dir) ? readdirSync(dir).sort().map((f) => join(dir, f)) : [];
  });
  return [...files, GEOMETRY_FILE].map((f) => `${f}:${statSync(f).mtimeMs}`).join('\n');
}

export function data() {
  const stamp = import.meta.env.DEV ? contentStamp() : cachedStamp;
  if (!cached || stamp !== cachedStamp) {
    const atlas = loadAtlas();
    cached = { atlas, geometry: loadGeometry(), codes: nodeCodes(atlas) };
    cachedStamp = stamp;
  }
  return cached;
}

export const atlas = () => data().atlas;
export const geometry = () => data().geometry;
/** Catalogue code of a node: 06, 06.4 or 06.4.5. */
export const code = (id: string) => data().codes.get(id) ?? '';

export function node(id: string): AtlasNode {
  const n = atlas().nodes.get(id);
  if (!n) throw new Error(`unknown node ${id}`);
  return n;
}
export const territory = (id: string) => node(id) as Territory;
export const capability = (id: string) => node(id) as Capability;
export const skill = (id: string) => node(id) as Skill;
export const path = (n: AtlasNode | string) => nodePath(atlas(), typeof n === 'string' ? node(n) : n);
export const skillIds = (n: AtlasNode) => skillsOf(atlas(), n).map((s) => s.id);

export interface MapOptions {
  focus?: string | null;
  width?: number;
  height?: number;
  state?: MapState;
  scale?: number;
  labels?: boolean;
  links?: boolean;
  className?: string;
}

export function mapSvg(opts: MapOptions = {}): string {
  const { atlas: a, geometry: g } = data();
  return renderMap(a, g, opts);
}

/** Compact data for the browser: what the explorer and the profile page need. */
export function clientData() {
  const { atlas: a, geometry: g } = data();
  return {
    territories: a.territories.map((t) => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline,
      question: t.question,
      crossCutting: t.crossCutting,
      capabilities: t.capabilities,
    })),
    capabilities: a.capabilities.map((c) => ({
      id: c.id,
      name: c.name,
      territory: c.territory,
      description: c.description,
      skills: c.skills,
    })),
    skills: a.skills.map((s) => ({
      id: s.id,
      name: s.name,
      summary: s.summary,
      focus: s.focus,
      capability: s.capability,
      territory: s.territory,
    })),
    aliases: Object.fromEntries(a.aliases),
    geometry: g,
  };
}
export type ClientData = ReturnType<typeof clientData>;

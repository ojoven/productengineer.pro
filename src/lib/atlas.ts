// Build-time access to the atlas for pages. Cached for the build; re-read on every request in
// dev so content edits show up on reload.
import { loadAtlas, loadGeometry } from '../atlas/load.ts';
import { renderMap, type MapState } from '../atlas/render.ts';
import type { Atlas, AtlasNode, Capability, Skill, Territory } from '../atlas/model.ts';
import { nodePath, skillsOf } from '../atlas/model.ts';
import type { Geometry } from '../atlas/geometry.ts';
import type { MapStyle } from '../atlas/map-css.ts';
import { SITE } from '../site.ts';

let cached: { atlas: Atlas; geometry: Geometry } | undefined;

export function data() {
  if (!cached || import.meta.env.DEV) cached = { atlas: loadAtlas(), geometry: loadGeometry() };
  return cached;
}

export const atlas = () => data().atlas;
export const geometry = () => data().geometry;

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
  idPrefix?: string;
  style?: MapStyle;
  scale?: number;
  labels?: boolean;
  links?: boolean;
  className?: string;
}

export function mapSvg(opts: MapOptions = {}): string {
  const { atlas: a, geometry: g } = data();
  return renderMap(a, g, { style: SITE.mapStyle, ...opts });
}

/** Compact data for the browser: what the explorer and the profile page need. */
export function clientData() {
  const { atlas: a, geometry: g } = data();
  return {
    style: SITE.mapStyle,
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
      capability: s.capability,
      territory: s.territory,
    })),
    aliases: Object.fromEntries(a.aliases),
    geometry: g,
  };
}
export type ClientData = ReturnType<typeof clientData>;

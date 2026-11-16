// The atlas as a flat, linked model. Pure: no file system access, so it runs at build
// time, in tests, in scripts and in the browser.
import type { AiLeverage, Evidence, ResourceFile, TerritoryFile, ToolFile } from './schema.ts';

import type { Focus } from './filters.ts';

export type Level = 'territory' | 'capability' | 'skill';

export interface Territory {
  level: 'territory';
  id: string;
  order: number;
  name: string;
  tagline: string;
  question: string;
  description: string;
  expected: string;
  crossCutting: boolean;
  aliases: string[];
  capabilities: string[];
}

export interface Capability {
  level: 'capability';
  id: string;
  name: string;
  description: string;
  territory: string;
  aliases: string[];
  previousPaths: string[];
  related: string[];
  resources: string[];
  tools: string[];
  skills: string[];
}

export interface Skill {
  level: 'skill';
  id: string;
  name: string;
  summary: string;
  description: string;
  capability: string;
  territory: string;
  aliases: string[];
  previousPaths: string[];
  related: string[];
  resources: string[];
  tools: string[];
  focus: Focus[];
  aiLeverage?: AiLeverage;
  technicalLeverage?: string;
  evidence?: Evidence;
}

export type AtlasNode = Territory | Capability | Skill;
export type Resource = ResourceFile & { id: string };
export type Tool = ToolFile & { id: string };

export interface Atlas {
  territories: Territory[];
  capabilities: Capability[];
  skills: Skill[];
  resources: Resource[];
  tools: Tool[];
  /** Every node by id. */
  nodes: Map<string, AtlasNode>;
  /** Old id -> current id. */
  aliases: Map<string, string>;
  resourcesById: Map<string, Resource>;
  toolsById: Map<string, Tool>;
}

export interface AtlasSources {
  territories: TerritoryFile[];
  resources: Record<string, ResourceFile>;
  tools: Record<string, ToolFile>;
}

/** Builds the linked model. Duplicate ids are kept out of the maps and reported by validateAtlas. */
export function buildAtlas(src: AtlasSources): Atlas {
  const territories: Territory[] = [];
  const capabilities: Capability[] = [];
  const skills: Skill[] = [];
  const nodes = new Map<string, AtlasNode>();
  const aliases = new Map<string, string>();
  const add = (n: AtlasNode) => {
    if (!nodes.has(n.id)) nodes.set(n.id, n);
    for (const a of n.aliases) if (!aliases.has(a)) aliases.set(a, n.id);
  };

  for (const t of [...src.territories].sort((a, b) => a.order - b.order)) {
    const territory: Territory = {
      level: 'territory',
      id: t.id,
      order: t.order,
      name: t.name,
      tagline: t.tagline,
      question: t.question,
      description: t.description,
      expected: t.expected,
      crossCutting: t.crossCutting,
      aliases: t.aliases,
      capabilities: t.capabilities.map((c) => c.id),
    };
    territories.push(territory);
    add(territory);
    for (const c of t.capabilities) {
      const capability: Capability = {
        level: 'capability',
        id: c.id,
        name: c.name,
        description: c.description,
        territory: t.id,
        aliases: c.aliases,
        previousPaths: c.previousPaths,
        related: c.related,
        resources: c.resources,
        tools: c.tools,
        skills: c.skills.map((s) => s.id),
      };
      capabilities.push(capability);
      add(capability);
      for (const s of c.skills) {
        const skill: Skill = {
          level: 'skill',
          id: s.id,
          name: s.name,
          summary: s.summary,
          description: s.description,
          capability: c.id,
          territory: t.id,
          aliases: s.aliases,
          previousPaths: s.previousPaths,
          related: s.related,
          resources: s.resources,
          tools: s.tools,
          focus: s.focus,
          aiLeverage: s.aiLeverage,
          technicalLeverage: s.technicalLeverage,
          evidence: s.evidence,
        };
        skills.push(skill);
        add(skill);
      }
    }
  }

  const resources = Object.entries(src.resources).map(([id, r]) => ({ ...r, id }));
  const tools = Object.entries(src.tools)
    .map(([id, t]) => ({ ...t, id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    territories,
    capabilities,
    skills,
    resources,
    tools,
    nodes,
    aliases,
    resourcesById: new Map(resources.map((r) => [r.id, r])),
    toolsById: new Map(tools.map((t) => [t.id, t])),
  };
}

/** Resolves an id or a retired alias to the current node. */
export function resolveNode(atlas: Atlas, id: string): AtlasNode | undefined {
  return atlas.nodes.get(id) ?? atlas.nodes.get(atlas.aliases.get(id) ?? '');
}

export function nodePath(atlas: Atlas, node: AtlasNode): string {
  if (node.level === 'territory') return `/skills-map/${node.id}/`;
  if (node.level === 'capability') return `/skills-map/${node.territory}/${node.id}/`;
  return `/skills-map/${node.territory}/${node.capability}/${node.id}/`;
}

export function territoryOf(atlas: Atlas, node: AtlasNode): Territory {
  const id = node.level === 'territory' ? node.id : node.territory;
  return atlas.nodes.get(id) as Territory;
}

export function capabilityOf(atlas: Atlas, skill: Skill): Capability {
  return atlas.nodes.get(skill.capability) as Capability;
}

export function skillsOf(atlas: Atlas, node: AtlasNode): Skill[] {
  if (node.level === 'skill') return [node];
  if (node.level === 'capability') return node.skills.map((id) => atlas.nodes.get(id) as Skill);
  return node.capabilities.flatMap((c) => skillsOf(atlas, atlas.nodes.get(c)!));
}

/** Nodes that list this node as related, plus the ones it lists itself. */
export function relatedNodes(atlas: Atlas, node: Capability | Skill): AtlasNode[] {
  const ids = new Set(node.related);
  for (const other of [...atlas.capabilities, ...atlas.skills]) {
    if (other.id !== node.id && other.related.includes(node.id)) ids.add(other.id);
  }
  return [...ids].map((id) => atlas.nodes.get(id)).filter((n): n is AtlasNode => !!n);
}

/** Skills and capabilities that use a tool or a resource. */
export function usersOf(atlas: Atlas, kind: 'tools' | 'resources', id: string): (Capability | Skill)[] {
  return [...atlas.capabilities, ...atlas.skills].filter((n) => n[kind].includes(id));
}

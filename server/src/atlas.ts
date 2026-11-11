// The atlas content, read from atlas.json (written by `npm run export:atlas` in the website).
import { readFileSync } from 'node:fs';

export interface Territory {
  id: string;
  code: string;
  name: string;
  tagline: string;
  question: string;
  description: string;
  expected: string;
  crossCutting: boolean;
  path: string;
  capabilities: string[];
}
export interface Capability {
  id: string;
  code: string;
  name: string;
  description: string;
  territory: string;
  path: string;
  related: string[];
  resources: string[];
  tools: string[];
  skills: string[];
}
export interface Skill {
  id: string;
  code: string;
  name: string;
  summary: string;
  description: string;
  capability: string;
  territory: string;
  path: string;
  related: string[];
  resources: string[];
  tools: string[];
}
export interface Resource {
  title: string;
  url: string;
  author: string;
  type: string;
  level: 'intro' | 'deep';
  length?: string;
  year?: number;
  why: string;
  paid: boolean;
}
export interface Tool {
  name: string;
  url: string;
  what: string;
  pricing: string;
}
interface AtlasFile {
  generated: string;
  territories: Territory[];
  capabilities: Capability[];
  skills: Skill[];
  resources: Record<string, Resource>;
  tools: Record<string, Tool>;
  aliases: Record<string, string>;
}

export type Node = ({ level: 'territory' } & Territory) | ({ level: 'capability' } & Capability) | ({ level: 'skill' } & Skill);

export class Atlas {
  readonly territories: Territory[];
  readonly capabilities: Capability[];
  readonly skills: Skill[];
  readonly resources: Record<string, Resource>;
  readonly tools: Record<string, Tool>;
  readonly generated: string;
  private readonly aliases: Record<string, string>;
  private readonly byId = new Map<string, Node>();
  private readonly relatedBy = new Map<string, Set<string>>();

  constructor(data: AtlasFile) {
    this.territories = data.territories;
    this.capabilities = data.capabilities;
    this.skills = data.skills;
    this.resources = data.resources;
    this.tools = data.tools;
    this.aliases = data.aliases;
    this.generated = data.generated;
    for (const t of data.territories) this.byId.set(t.id, { level: 'territory', ...t });
    for (const c of data.capabilities) this.byId.set(c.id, { level: 'capability', ...c });
    for (const s of data.skills) this.byId.set(s.id, { level: 'skill', ...s });
    for (const n of [...data.capabilities, ...data.skills]) {
      for (const r of n.related) {
        if (!this.relatedBy.has(r)) this.relatedBy.set(r, new Set());
        this.relatedBy.get(r)!.add(n.id);
      }
    }
  }

  /** Nodes this one lists as related, plus the ones that list it, as on the site. */
  related(node: Node): Node[] {
    if (node.level === 'territory') return [];
    const ids = new Set([...node.related, ...(this.relatedBy.get(node.id) ?? [])]);
    ids.delete(node.id);
    return [...ids].map((id) => this.byId.get(id)).filter((n): n is Node => !!n);
  }

  static load(path: string): Atlas {
    return new Atlas(JSON.parse(readFileSync(path, 'utf8')) as AtlasFile);
  }

  /** A node by id, code (06.4.5) or retired alias. */
  node(ref: string): Node | undefined {
    const key = ref.trim().toLowerCase();
    const direct = this.byId.get(key) ?? this.byId.get(this.aliases[key] ?? '');
    if (direct) return direct;
    const code = ref.trim().toUpperCase();
    for (const n of this.byId.values()) if (n.code === code) return n;
    return undefined;
  }

  territory(ref: string) {
    const n = this.node(ref);
    return n?.level === 'territory' ? n : undefined;
  }
  capability(ref: string) {
    const n = this.node(ref);
    return n?.level === 'capability' ? n : undefined;
  }
  skill(ref: string) {
    const n = this.node(ref);
    return n?.level === 'skill' ? n : undefined;
  }

  /** The current id of a skill, following aliases; undefined for anything that is not a skill. */
  skillId(id: string): string | undefined {
    return this.skill(id)?.id;
  }

  skillsIn(node: Territory | Capability | Skill): Skill[] {
    if ('capabilities' in node) return node.capabilities.flatMap((c) => this.skillsIn(this.byId.get(c) as Capability));
    if ('skills' in node) return node.skills.map((id) => this.byId.get(id) as Skill);
    return [node];
  }

  /** Plain word search over names, summaries and descriptions. Names weigh most. */
  search(query: string, limit = 10): { node: Node; score: number }[] {
    const words = query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1);
    if (!words.length) return [];
    const scored: { node: Node; score: number }[] = [];
    for (const node of this.byId.values()) {
      const name = node.name.toLowerCase();
      const summary = ('summary' in node ? node.summary : 'tagline' in node ? `${node.tagline} ${node.question}` : '').toLowerCase();
      const body = node.description.toLowerCase();
      let score = 0;
      let matched = 0;
      for (const w of words) {
        const inName = name.includes(w);
        const inSummary = summary.includes(w);
        const inBody = body.includes(w);
        if (inName || inSummary || inBody) matched++;
        score += (inName ? 5 : 0) + (inSummary ? 2 : 0) + (inBody ? 1 : 0);
      }
      if (!matched) continue;
      if (name === query.trim().toLowerCase()) score += 10;
      score *= matched / words.length;
      if (node.level !== 'skill') score *= 0.9;
      scored.push({ node, score });
    }
    return scored.sort((a, b) => b.score - a.score || a.node.code.localeCompare(b.node.code)).slice(0, limit);
  }
}

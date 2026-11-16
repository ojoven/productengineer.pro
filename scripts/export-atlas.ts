// Writes the atlas content as one JSON file for the API server (server/atlas.json), so the server
// reads the same territories, capabilities, skills, resources and tools as the site without
// depending on Astro. Run before starting or deploying the server.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAtlas, ROOT } from '../src/atlas/load.ts';
import { nodeCodes } from '../src/atlas/render.ts';
import { nodePath } from '../src/atlas/model.ts';

const atlas = loadAtlas();
const codes = nodeCodes(atlas);
const code = (id: string) => codes.get(id) ?? '';

const out = {
  generated: new Date().toISOString(),
  territories: atlas.territories.map((t) => ({
    id: t.id,
    code: code(t.id),
    name: t.name,
    tagline: t.tagline,
    question: t.question,
    description: t.description,
    expected: t.expected,
    crossCutting: t.crossCutting,
    path: nodePath(atlas, t),
    capabilities: t.capabilities,
  })),
  capabilities: atlas.capabilities.map((c) => ({
    id: c.id,
    code: code(c.id),
    name: c.name,
    description: c.description,
    territory: c.territory,
    path: nodePath(atlas, c),
    related: c.related,
    resources: c.resources,
    tools: c.tools,
    skills: c.skills,
  })),
  skills: atlas.skills.map((s) => ({
    id: s.id,
    code: code(s.id),
    name: s.name,
    summary: s.summary,
    description: s.description,
    capability: s.capability,
    territory: s.territory,
    path: nodePath(atlas, s),
    related: s.related,
    resources: s.resources,
    tools: s.tools,
  })),
  resources: Object.fromEntries(
    atlas.resources.map((r) => [
      r.id,
      { title: r.title, url: r.url, author: r.author, type: r.type, level: r.level, length: r.length, year: r.year, why: r.why, paid: r.paid, checked: r.checked },
    ]),
  ),
  tools: Object.fromEntries(atlas.tools.map((t) => [t.id, { name: t.name, url: t.url, what: t.what, pricing: t.pricing, checked: t.checked }])),
  aliases: Object.fromEntries(atlas.aliases),
};

const file = join(ROOT, 'server', 'atlas.json');
writeFileSync(file, JSON.stringify(out));
console.log(`wrote ${file.replace(ROOT + '/', '')}: ${out.territories.length} territories, ${out.capabilities.length} capabilities, ${out.skills.length} skills`);

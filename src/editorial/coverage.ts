// A profile's section index and map export share these resolved atlas references.
import type { Atlas } from '../atlas/model.ts';
import { nodePath } from '../atlas/model.ts';
import { nodeCodes } from '../atlas/render.ts';
import type { FieldworkEntry } from './schema.ts';
import { coverageHeading } from './validate.ts';

interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export function entryCoverage(atlas: Atlas, entry: { id: string; data: FieldworkEntry }, headings: Heading[]) {
  const codes = nodeCodes(atlas);
  const reference = (id: string) => {
    const node = atlas.nodes.get(id);
    if (!node) throw new Error(`Fieldwork coverage: unknown atlas id "${id}"`);
    return { id, name: node.name, code: codes.get(id) ?? '', url: nodePath(atlas, node) };
  };
  const sections = entry.data.coverage.map((c) => {
    const section = coverageHeading(atlas, c);
    const heading = headings.find((h) => h.depth === 2 && h.text === section);
    if (!heading) throw new Error(`Fieldwork coverage: missing heading "${section}" in ${entry.id}`);
    return {
      section,
      anchor: `#${heading.slug}`,
      scope: c.scope,
      territory: c.territory ? reference(c.territory) : null,
      note: c.note ?? null,
      skills: c.skills.map((id) => {
        const node = atlas.nodes.get(id);
        if (node?.level !== 'skill') throw new Error(`Fieldwork coverage: "${id}" is not a skill`);
        return { ...reference(id), territory: node.territory, capability: node.capability, note: c.notes?.[id] ?? null };
      }),
    };
  });
  return {
    version: 1,
    entry: { id: entry.id, title: entry.data.title, url: `/in-practice/${entry.id}/`, draft: entry.data.draft },
    skills: entry.data.skills,
    sections,
  };
}

export type EntryCoverage = ReturnType<typeof entryCoverage>;

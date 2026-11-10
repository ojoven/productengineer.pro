// Integrity checks shared by the build and the test suite. Errors fail the build;
// warnings are printed.
import type { Atlas, AtlasSources } from './model.ts';
import type { Geometry } from './geometry.ts';

export interface Report {
  errors: string[];
  warnings: string[];
}

const sentences = (text: string) => (text.trim().match(/[.!?](?=\s+[A-Z"(]|\s*$)/g) ?? []).length;

/** Fixed lengths per level, so roughly 450 pages read consistently. */
export const TEMPLATE = {
  skillSummaryMaxChars: 110,
  skillSentences: [2, 4] as const,
  capabilitySentences: [1, 3] as const,
  territorySentences: [3, 6] as const,
};

export function validateAtlas(atlas: Atlas, src: AtlasSources, geometry?: Geometry): Report {
  const errors: string[] = [];
  const warnings: string[] = [];

  // One id per node, across all three levels, so `?lit=` and progress can use bare ids.
  const seen = new Map<string, string>();
  const claim = (id: string, where: string) => {
    const prev = seen.get(id);
    if (prev) errors.push(`duplicate id "${id}" (${prev} and ${where})`);
    else seen.set(id, where);
  };
  for (const t of src.territories) {
    claim(t.id, `territory ${t.id}`);
    for (const c of t.capabilities) {
      claim(c.id, `capability in ${t.id}`);
      for (const s of c.skills) claim(s.id, `skill in ${c.id}`);
    }
  }

  const allNodes = [...atlas.territories, ...atlas.capabilities, ...atlas.skills];
  const aliasSeen = new Set<string>();
  for (const n of allNodes) {
    for (const a of n.aliases) {
      if (atlas.nodes.has(a)) errors.push(`alias "${a}" of ${n.id} is also a current id`);
      if (aliasSeen.has(a)) errors.push(`alias "${a}" is used twice`);
      aliasSeen.add(a);
    }
  }

  for (const n of [...atlas.capabilities, ...atlas.skills]) {
    for (const r of n.related) {
      if (r === n.id) errors.push(`${n.id} lists itself as related`);
      else if (!atlas.nodes.has(r)) errors.push(`${n.id}: related "${r}" does not exist`);
    }
    for (const r of n.resources) if (!atlas.resourcesById.has(r)) errors.push(`${n.id}: resource "${r}" does not exist`);
    for (const t of n.tools) if (!atlas.toolsById.has(t)) errors.push(`${n.id}: tool "${t}" does not exist`);
    if (new Set(n.resources).size !== n.resources.length) errors.push(`${n.id}: a resource is listed twice`);
    if (new Set(n.tools).size !== n.tools.length) errors.push(`${n.id}: a tool is listed twice`);
  }

  for (const s of atlas.skills) {
    if (s.summary.length > TEMPLATE.skillSummaryMaxChars)
      warnings.push(`${s.id}: summary is ${s.summary.length} chars (max ${TEMPLATE.skillSummaryMaxChars})`);
    const n = sentences(s.description);
    const [lo, hi] = TEMPLATE.skillSentences;
    if (n < lo || n > hi) warnings.push(`${s.id}: description has ${n} sentences (template ${lo}-${hi})`);
  }
  for (const c of atlas.capabilities) {
    const n = sentences(c.description);
    const [lo, hi] = TEMPLATE.capabilitySentences;
    if (n < lo || n > hi) warnings.push(`${c.id}: description has ${n} sentences (template ${lo}-${hi})`);
  }
  for (const t of atlas.territories) {
    const n = sentences(t.description);
    const [lo, hi] = TEMPLATE.territorySentences;
    if (n < lo || n > hi) warnings.push(`${t.id}: description has ${n} sentences (template ${lo}-${hi})`);
  }

  const used = { resources: new Set<string>(), tools: new Set<string>() };
  for (const n of [...atlas.capabilities, ...atlas.skills]) {
    n.resources.forEach((r) => used.resources.add(r));
    n.tools.forEach((t) => used.tools.add(t));
  }
  for (const r of atlas.resources) if (!used.resources.has(r.id)) warnings.push(`resource "${r.id}" is not used by any node`);
  for (const t of atlas.tools) if (!used.tools.has(t.id)) warnings.push(`tool "${t.id}" is not used by any node`);
  const urls = new Map<string, string>();
  for (const r of atlas.resources) {
    const prev = urls.get(r.url);
    if (prev) errors.push(`resources "${prev}" and "${r.id}" have the same URL`);
    urls.set(r.url, r.id);
  }

  if (geometry) {
    for (const t of atlas.territories) {
      if (!t.crossCutting && !geometry.territories[t.id]) errors.push(`territory ${t.id} has no outline`);
    }
    for (const n of [...atlas.capabilities, ...atlas.skills]) {
      if (!geometry.points[n.id]) errors.push(`${n.level} ${n.id} has no position on the map`);
    }
    for (const id of Object.keys(geometry.points)) {
      if (!atlas.nodes.has(id)) warnings.push(`geometry has a position for unknown id "${id}"`);
    }
  }

  return { errors, warnings };
}

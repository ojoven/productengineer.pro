// Checks that fieldwork entries stay connected to the atlas and to each other, and that
// each follows the structure for its kind. Errors fail the build; warnings are printed.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../atlas/load.ts';
import type { Atlas } from '../atlas/model.ts';
import type { EditorialSources } from './load.ts';
import { SECTIONS, type Coverage, type EntryKind, type FieldworkEntry } from './schema.ts';

export interface EditorialReport {
  errors: string[];
  warnings: string[];
}

/** Missing required sections, or required sections out of order. */
export function sectionProblems(kind: EntryKind, headings: string[]): string[] {
  const required = SECTIONS[kind];
  const problems: string[] = [];
  const missing = required.filter((h) => !headings.includes(h));
  if (missing.length) problems.push(`missing section(s): ${missing.map((h) => `"## ${h}"`).join(', ')}`);
  const order = required.filter((h) => headings.includes(h));
  const seen = headings.filter((h) => order.includes(h));
  if (seen.join('|') !== order.join('|')) problems.push(`sections out of order, expected: ${order.join(' > ')}`);
  return problems;
}

/** The `##` heading a coverage item points at: its own `section`, or the name of its territory. */
export const coverageHeading = (atlas: Atlas, c: Coverage): string => c.section ?? atlas.nodes.get(c.territory ?? '')?.name ?? c.territory ?? '';

/**
 * `coverage` groups the skills of an entry by the section that discusses them. It has to agree
 * with the body (every item has its heading) and with `skills` (the same ids, each once).
 */
export function coverageProblems(atlas: Atlas, d: Pick<FieldworkEntry, 'kind' | 'skills' | 'coverage'>, headings: string[]): string[] {
  const problems: string[] = [];
  if (d.kind === 'profile' && !d.coverage.length) problems.push('a profile needs `coverage`: the territories it covers, with their skills');
  if (!d.coverage.length) return problems;
  const seen = new Set<string>();
  for (const c of d.coverage) {
    const heading = coverageHeading(atlas, c);
    if (c.territory && atlas.nodes.get(c.territory)?.level !== 'territory') problems.push(`coverage: "${c.territory}" is not a territory id`);
    if (!headings.includes(heading)) problems.push(`coverage: no "## ${heading}" section in the body`);
    for (const s of c.skills) {
      const node = atlas.nodes.get(s);
      if (node?.level !== 'skill') problems.push(`coverage: "${s}" is not a skill id in the atlas`);
      else if (c.territory && node.territory !== c.territory) problems.push(`coverage: "${s}" is in ${node.territory}, not in ${c.territory}`);
      if (seen.has(s)) problems.push(`coverage: "${s}" is listed twice`);
      seen.add(s);
    }
  }
  for (const c of d.coverage) {
    for (const id of Object.keys(c.notes ?? {})) {
      if (!c.skills.includes(id)) problems.push(`coverage: a note for "${id}", which is not a skill of "${coverageHeading(atlas, c)}"`);
    }
  }
  const missing = d.skills.filter((s) => !seen.has(s));
  const extra = [...seen].filter((s) => !d.skills.includes(s));
  if (missing.length) problems.push(`coverage: in \`skills\` but in no section: ${missing.join(', ')}`);
  if (extra.length) problems.push(`coverage: in a section but not in \`skills\`: ${extra.join(', ')}`);
  return problems;
}

export function validateEditorial(atlas: Atlas, src: EditorialSources): EditorialReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isSkill = (id: string) => atlas.nodes.get(id)?.level === 'skill';
  const refs = new Set(src.fieldwork.map((e) => `fieldwork/${e.id}`));

  for (const e of src.fieldwork) {
    const where = `${e.collection}/${e.id}`;
    const d = e.data;
    for (const s of d.skills) {
      if (!isSkill(s)) errors.push(`${where}: "${s}" is not a skill id in the atlas`);
    }
    if (new Set(d.skills).size !== d.skills.length) errors.push(`${where}: a skill is listed twice`);
    for (const r of d.related) {
      if (!refs.has(r)) errors.push(`${where}: related entry "${r}" does not exist`);
      if (r === where) errors.push(`${where}: relates to itself`);
    }
    if (!d.related.length) warnings.push(`${where}: not connected to any other fieldwork entry`);
    for (const p of sectionProblems(d.kind, e.headings)) errors.push(`${where}: ${p}`);
    for (const p of coverageProblems(atlas, d, e.headings)) errors.push(`${where}: ${p}`);
  }

  for (const e of src.fieldwork) {
    const where = `fieldwork/${e.id}`;
    const d = e.data;
    if (!('subjects' in d)) continue;
    if (d.kind === 'comparison' && d.subjects.length < 2) errors.push(`${where}: a comparison needs two or more subjects`);
    const talk = d.kind === 'interview' || d.kind === 'profile';
    if (talk && !d.person) errors.push(`${where}: ${d.kind === 'profile' ? 'a profile' : 'an interview'} needs a person`);
    if (!talk && d.person) warnings.push(`${where}: person is only shown on interviews and profiles`);
    if (d.kind === 'profile' && !d.draft && !d.placeholder) {
      const bare = d.coverage.flatMap((c) => c.skills.filter((s) => !c.notes[s]));
      if (bare.length) warnings.push(`${where}: no coverage note for ${bare.join(', ')}`);
    }
    for (const img of [...d.subjects.map((s) => s.logo), d.person?.avatar]) {
      if (img && !existsSync(join(ROOT, 'public', img))) errors.push(`${where}: image "${img}" is not in public/`);
    }
  }

  for (const e of src.fieldwork) {
    const where = `fieldwork/${e.id}`;
    const d = e.data;
    if (!('product' in d)) continue;
    if (!src.products[d.product]) errors.push(`${where}: product "${d.product}" is not in products.yaml`);
    if (d.kind === 'experiment') {
      if (!d.hypothesis) errors.push(`${where}: an experiment needs a hypothesis`);
      if (!d.metric) errors.push(`${where}: an experiment needs a primary metric`);
    }
    if (d.ended && d.ended < d.started) errors.push(`${where}: ends before it starts`);
    const finished = d.status === 'concluded' || d.status === 'abandoned';
    if (finished && d.kind === 'experiment' && d.verdict === 'pending') errors.push(`${where}: a ${d.status} experiment needs a verdict`);
    if (finished && !d.ended) warnings.push(`${where}: ${d.status} without an end date`);
  }

  for (const [i, w] of src.author.work.entries()) {
    for (const s of w.skills) if (!isSkill(s)) errors.push(`author.yaml work[${i}] "${w.title}": "${s}" is not a skill id in the atlas`);
    for (const r of w.related) if (!refs.has(r)) errors.push(`author.yaml work[${i}] "${w.title}": related entry "${r}" does not exist`);
  }

  return { errors, warnings };
}

// Build-time access to Fieldwork entries for pages, plus the labels they show.
import { getCollection, type CollectionEntry } from 'astro:content';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../atlas/load.ts';
import { loadAuthor, loadProducts } from '../editorial/load.ts';
import type { EntryKind } from '../editorial/schema.ts';

export type FieldworkItem = CollectionEntry<'fieldwork'>;
export type Item = FieldworkItem;

export const KIND: Record<EntryKind, string> = {
  review: 'Review',
  comparison: 'Comparison',
  interview: 'Interview',
  profile: 'Profile',
  podcast: 'Podcast',
  observation: 'Observation',
  experiment: 'Experiment',
  improvement: 'Improvement',
  'case-study': 'Case study',
};

export const STATUS = { planned: 'Planned', running: 'Running', shipped: 'Shipped', concluded: 'Concluded', abandoned: 'Abandoned' } as const;
export const VERDICT = { pending: 'No result yet', supported: 'Supported', 'not-supported': 'Not supported', inconclusive: 'Inconclusive' } as const;
export const DECISION = { pending: 'Not decided', keep: 'Kept', iterate: 'Iterating', revert: 'Reverted', stop: 'Stopped' } as const;

export const itemPath = (e: Item) => `/in-practice/${e.id}/`;
export const itemRef = (e: Item) => `fieldwork/${e.id}`;
/** Published date for research, start date for applied work. */
export const itemDate = (e: Item) => ('date' in e.data ? e.data.date : e.data.started);

const byDateDesc = (a: Item, b: Item) => itemDate(b).localeCompare(itemDate(a)) || a.data.title.localeCompare(b.data.title);

/** Every entry, drafts too. For building pages and resolving links; lists use `fieldwork()`. */
export async function allItems(): Promise<FieldworkItem[]> {
  return (await getCollection('fieldwork')).sort(byDateDesc) as FieldworkItem[];
}

/** The entries that are out: everything but drafts. What lists, counts and skill pages show. */
export async function fieldwork(): Promise<FieldworkItem[]> {
  return (await allItems()).filter((e) => !e.data.draft);
}

/** Entries by `fieldwork/<id>`, in the order given. */
export async function resolve(refs: string[]): Promise<Item[]> {
  const all = new Map((await allItems()).map((e) => [itemRef(e), e]));
  return refs.map((r) => all.get(r)).filter((e): e is Item => !!e);
}

/** Entries this one links to, then the ones that link to it. Drafts are never linked. */
export async function connected(e: Item): Promise<Item[]> {
  const ref = itemRef(e);
  const out = (await resolve(e.data.related)).filter((o) => !o.data.draft);
  const seen = new Set(out.map(itemRef));
  for (const other of await fieldwork()) {
    if (other.data.related.includes(ref) && !seen.has(itemRef(other))) out.push(other);
  }
  return out;
}

/** Every entry that used a skill, newest first. */
export async function itemsForSkill(skillId: string): Promise<Item[]> {
  return (await fieldwork()).filter((e) => e.data.skills.includes(skillId));
}

/** Skills used across a set of entries, first use first, without repeats. */
export const skillsOf = (items: { data: { skills: string[] } }[]) => [...new Set(items.flatMap((e) => e.data.skills))];

export const products = () => loadProducts();
export const author = () => loadAuthor();

/** "2026-11-11" -> "11 Nov 2026"; "2015" stays "2015". */
export function formatDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  if (!m) return String(y);
  const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return day ? `${day} ${month} ${y}` : `${month} ${y}`;
}

/** Minutes to read the prose of an entry. Figures are read visually, so their props are not counted. */
export function readingMinutes(e: Item): number {
  const prose = (e.body ?? '').replace(/<[A-Z][\s\S]*?\/>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return Math.max(1, Math.ceil(prose.trim().split(/\s+/).length / 220));
}

/** The social image drawn for an entry by `npm run og -- fieldwork`, when it exists. */
export function entryImage(e: Item): string | undefined {
  const file = `/og/fieldwork/${e.id}.jpg`;
  return existsSync(join(ROOT, 'public', file)) ? file : undefined;
}

/** Territories an entry's coverage reaches, in order, without the wider discussion. */
export function entryTerritories(e: Item): string[] {
  return [...new Set(e.data.coverage.filter((c) => c.scope === 'product' && c.territory).map((c) => c.territory!))];
}

import type { Atlas } from '../atlas/model.ts';
import { nodePath, usersOf } from '../atlas/model.ts';
import { favicon, type CatalogEntry } from '../../server/src/catalog-model.ts';

export function catalogEntries(a: Atlas): CatalogEntry[] {
  return [...a.tools.map(t => ({
    id: `tool:${t.id}`, kind: 'tool' as const, title: t.name, url: t.url, description: t.what,
    author: '', type: 'tool', pricing: t.pricing, level: '', checked: t.checked, used: usersOf(a, 'tools', t.id),
  })), ...a.resources.map(r => ({
    id: `resource:${r.id}`, kind: 'resource' as const, title: r.title, url: r.url, description: r.why,
    author: r.author, type: r.type, pricing: r.paid ? 'paid' : 'free', level: r.level, checked: r.checked, used: usersOf(a, 'resources', r.id),
  }))].map(({ used, ...e }) => ({
    ...e, territories: [...new Set(used.map(n => n.territory))],
    skills: used.map(n => ({ id: n.id, name: n.name, path: nodePath(a, n) })),
    icon: favicon(e.url), source: 'atlas', sourceUrl: '', status: 'validated', fetchedAt: '', httpStatus: null,
    finalUrl: '', fetchError: '', note: '', reviewedAt: e.checked, updatedAt: e.checked, version: 1,
  }));
}

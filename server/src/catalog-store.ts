import { createHash } from 'node:crypto';
import type { Atlas } from './atlas.ts';
import { tx, type Db } from './db.ts';
import { canonicalUrl, favicon, type CatalogEntry } from './catalog-model.ts';

export function catalogId(kind: string, url: string): string {
  return `${kind}:${createHash('sha256').update(canonicalUrl(url)).digest('hex').slice(0, 20)}`;
}
export function seedCatalog(db: Db, atlas: Atlas) {
  const insert = db.prepare('INSERT OR IGNORE INTO catalog_entries (id, canonical_url, data) VALUES (?, ?, ?)');
  tx(db, () => {
    const rows = [
      ...Object.entries(atlas.tools).map(([id, t]) => ({ id: `tool:${id}`, kind: 'tool' as const, title: t.name, url: t.url, description: t.what, author: '', type: 'tool', pricing: t.pricing, level: '', checked: t.checked ?? '', list: 'tools' as const, ref: id })),
      ...Object.entries(atlas.resources).map(([id, r]) => ({ id: `resource:${id}`, kind: 'resource' as const, title: r.title, url: r.url, description: r.why, author: r.author, type: r.type, pricing: r.paid ? 'paid' : 'free', level: r.level, checked: r.checked ?? '', list: 'resources' as const, ref: id })),
    ];
    for (const { list, ref, ...entry } of rows) {
      const used = [...atlas.capabilities, ...atlas.skills].filter(n => n[list].includes(ref));
      const e: CatalogEntry = {
        ...entry, territories: [...new Set(used.map(n => n.territory))], skills: used.map(n => ({ id: n.id, name: n.name, path: n.path })),
        icon: favicon(entry.url), source: 'atlas', sourceUrl: '', status: 'validated', fetchedAt: '', httpStatus: null,
        finalUrl: '', fetchError: '', note: '', reviewedAt: entry.checked, updatedAt: entry.checked, version: 1,
      };
      insert.run(e.id, canonicalUrl(e.url), JSON.stringify(e));
    }
  });
}
export function allEntries(db: Db): CatalogEntry[] {
  return (db.prepare('SELECT data FROM catalog_entries').all() as { data: string }[]).map(r => JSON.parse(r.data));
}
export function getEntry(db: Db, id: string): CatalogEntry | undefined {
  const row = db.prepare('SELECT data FROM catalog_entries WHERE id = ?').get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}
export function findUrl(db: Db, url: string): CatalogEntry | undefined {
  const row = db.prepare('SELECT data FROM catalog_entries WHERE canonical_url = ?').get(canonicalUrl(url)) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}
export function saveEntry(db: Db, entry: CatalogEntry, actor: string, action: string, now: number, expectedVersion?: number) {
  return tx(db, () => {
    const current = getEntry(db, entry.id);
    if (expectedVersion !== undefined && current?.version !== expectedVersion) throw new Error('conflict');
    const next = { ...entry, version: (current?.version ?? 0) + 1, updatedAt: new Date(now).toISOString() };
    db.prepare('INSERT INTO catalog_entries (id, canonical_url, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET canonical_url = excluded.canonical_url, data = excluded.data')
      .run(next.id, canonicalUrl(next.url), JSON.stringify(next));
    db.prepare('INSERT INTO catalog_events (entry_id, actor, action, note, at) VALUES (?, ?, ?, ?, ?)')
      .run(next.id, actor, action, next.note, next.updatedAt);
    return next;
  });
}

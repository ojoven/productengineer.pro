/** Shared, browser-safe catalog types and ranked search. */
export const KINDS = ['tool', 'resource'] as const;
export const STATUSES = ['pending', 'validated', 'invalidated'] as const;
export const TYPES = ['article', 'video', 'course', 'book', 'docs', 'talk', 'podcast', 'tool-guide', 'post'] as const;
export const PRICING = ['open-source', 'free', 'freemium', 'paid', 'unknown'] as const;
export type ReviewStatus = typeof STATUSES[number];
export interface CatalogEntry {
  id: string;
  kind: 'tool' | 'resource';
  title: string;
  url: string;
  description: string;
  author: string;
  type: string;
  pricing: string;
  level: string;
  territories: string[];
  skills: { id: string; name: string; path: string }[];
  icon: string;
  source: string;
  sourceUrl: string;
  status: ReviewStatus;
  checked: string;
  fetchedAt: string;
  httpStatus: number | null;
  finalUrl: string;
  fetchError: string;
  note: string;
  reviewedAt: string;
  updatedAt: string;
  version: number;
  evidence?: { title: string; description: string; author: string; excerpt?: string };
}
export interface CatalogFilters {
  q?: string; kind?: string; type?: string; territory?: string; pricing?: string;
  level?: string; status?: string; source?: string; health?: string; sort?: string;
}
export const normalizeText = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
export function favicon(url: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(url))}&sz=64`;
}
/** URL deduplication keeps meaningful query parameters and removes tracking/fragments. */
export function canonicalUrl(value: string): string {
  const u = new URL(value);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error('Use a public http or https URL without credentials.');
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.protocol = 'https:';
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|ref$)/i.test(key)) u.searchParams.delete(key);
  if (u.hostname === 'youtu.be') { u.hostname = 'youtube.com'; u.searchParams.set('v', u.pathname.slice(1)); u.pathname = '/watch'; }
  if (u.hostname === 'twitter.com') u.hostname = 'x.com';
  if (u.hostname === 'x.com') {
    const postId = u.pathname.match(/\/status\/(\d+)/)?.[1];
    if (postId) { u.pathname = `/i/web/status/${postId}`; u.search = ''; }
  }
  if (u.hostname === 'youtube.com' && u.pathname === '/watch') {
    const id = u.searchParams.get('v'); u.search = ''; if (id) u.searchParams.set('v', id);
  }
  u.searchParams.sort();
  u.pathname = u.pathname.replace(/\/+$/, '') || '/';
  return u.href;
}
export function reviewDue(e: CatalogEntry, now = Date.now()): boolean {
  return !e.checked || Date.parse(e.checked) < now - 90 * 86400_000;
}
export function searchCatalog(entries: CatalogEntry[], filters: CatalogFilters = {}): CatalogEntry[] {
  const tokens = (normalizeText(filters.q ?? '').match(/-?"[^"]+"|\S+/g) ?? []).map(t => t.replace(/"/g, ''));
  const scored = entries.flatMap(e => {
    if (filters.kind && e.kind !== filters.kind || filters.type && e.type !== filters.type ||
        filters.territory && !e.territories.includes(filters.territory) || filters.pricing && e.pricing !== filters.pricing ||
        filters.level && e.level !== filters.level || filters.status && e.status !== filters.status ||
        filters.source && e.source !== filters.source) return [];
    if (filters.health === 'issues' && !e.fetchError && !(e.httpStatus && e.httpStatus >= 400)) return [];
    if (filters.health === 'due' && !reviewDue(e)) return [];
    if (filters.health === 'unchecked' && e.fetchedAt) return [];
    const title = normalizeText(e.title);
    const body = normalizeText([e.title, e.description, e.author, e.url, e.type, e.pricing, ...e.territories, ...e.skills.map(s => s.name)].join(' '));
    let score = 0;
    for (let token of tokens) {
      const excluded = token.startsWith('-');
      if (excluded) token = token.slice(1);
      if (!token) continue;
      const match = token.startsWith('site:')
        ? hostOf(e.url) === token.slice(5) || hostOf(e.url).endsWith('.' + token.slice(5))
        : body.includes(token);
      if (excluded ? match : !match) return [];
      if (!excluded) score += title === token ? 100 : title.startsWith(token) ? 30 : title.includes(token) ? 20 : 2;
    }
    return [{ e, score }];
  });
  return scored.sort((a, b) => {
    if (filters.sort === 'newest') return b.e.updatedAt.localeCompare(a.e.updatedAt) || a.e.title.localeCompare(b.e.title);
    if (filters.sort === 'oldest') return a.e.checked.localeCompare(b.e.checked) || a.e.title.localeCompare(b.e.title);
    return (filters.sort === 'alpha' ? 0 : b.score - a.score) || a.e.title.localeCompare(b.e.title);
  }).map(x => x.e);
}

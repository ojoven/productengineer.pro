import { atlas, path } from '../lib/atlas.ts';
import { SITE } from '../site.ts';
import { allItems, itemDate, itemPath } from '../lib/editorial.ts';

export async function GET() {
  const a = atlas();
  const pages: { path: string; lastmod?: string }[] = [
    '/',
    '/what-is-a-product-engineer/',
    '/skills-map/',
    '/in-practice/',
    '/skills/',
    '/library/',
    '/tools/',
    '/resources/',
    '/about/',
    ...a.tools.map((t) => `/tools/${t.id}/`),
  ].map((p) => ({ path: p }));
  // placeholders are structure examples, not work, and drafts are not out yet: both stay out of the sitemap and search
  for (const e of await allItems()) {
    if (e.data.placeholder || e.data.draft) continue;
    const updated = 'updated' in e.data ? e.data.updated : undefined;
    pages.push({ path: itemPath(e), lastmod: updated ?? itemDate(e) });
  }
  for (const n of [...a.territories, ...a.capabilities, ...a.skills]) pages.push({ path: path(n) });
  const body = pages
    .map((p) => `<url><loc>${new URL(p.path, SITE.url).href}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`)
    .join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, {
    headers: { 'Content-Type': 'application/xml' },
  });
}

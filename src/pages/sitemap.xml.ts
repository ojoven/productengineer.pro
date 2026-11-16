import { atlas, path } from '../lib/atlas.ts';
import { SITE } from '../site.ts';
import { allItems, itemPath } from '../lib/editorial.ts';

export async function GET() {
  const a = atlas();
  const pages = ['/', '/skills-map/', '/in-practice/', '/skills/', '/tools/', '/resources/', '/about/', ...a.tools.map((t) => `/tools/${t.id}/`)];
  // placeholders are structure examples, not work, and drafts are not out yet: both stay out of the sitemap and search
  for (const e of await allItems()) if (!e.data.placeholder && !e.data.draft) pages.push(itemPath(e));
  for (const n of [...a.territories, ...a.capabilities, ...a.skills]) pages.push(path(n));
  const body = pages.map((p) => `<url><loc>${new URL(p, SITE.url).href}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, {
    headers: { 'Content-Type': 'application/xml' },
  });
}

import { atlas, path } from '../lib/atlas.ts';
import { SITE } from '../site.ts';

export function GET() {
  const a = atlas();
  const pages = ['/', '/atlas/', '/skills/', '/tools/', '/resources/', '/about/', ...a.tools.map((t) => `/tools/${t.id}/`)];
  for (const n of [...a.territories, ...a.capabilities, ...a.skills]) pages.push(path(n));
  const body = pages.map((p) => `<url><loc>${new URL(p, SITE.url).href}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, {
    headers: { 'Content-Type': 'application/xml' },
  });
}

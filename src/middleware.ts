// Runs for every page at build time (and in `astro dev`). It adds utm_source=productengineer.pro to
// links that leave the site: see src/lib/utm.ts. Feeds, llms.txt and JSON pass through unchanged.
import { defineMiddleware } from 'astro:middleware';
import { addUtmToHtml } from './lib/utm.ts';

export const onRequest = defineMiddleware(async (_context, next) => {
  const res = await next();
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  const html = await res.text();
  return new Response(addUtmToHtml(html), { status: res.status, statusText: res.statusText, headers: res.headers });
});

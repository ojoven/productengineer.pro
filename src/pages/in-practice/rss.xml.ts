// The In practice feed: every published entry, newest first. Linked from every page's <head>.
import { KIND, author, fieldwork, itemDate, itemPath } from '../../lib/editorial.ts';
import { SITE } from '../../site.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** "2026-11-13" (or "2015") as an RFC 822 date at noon UTC. */
const rfc822 = (d: string) => new Date(`${d.length === 4 ? `${d}-01-01` : d}T12:00:00Z`).toUTCString();

export async function GET() {
  const me = author();
  const items = (await fieldwork()).filter((e) => !e.data.placeholder);
  const self = new URL('/in-practice/rss.xml', SITE.url).href;
  const entries = items.map((e) => {
    const url = new URL(itemPath(e), SITE.url).href;
    return [
      '<item>',
      `<title>${esc(e.data.title)}</title>`,
      `<link>${url}</link>`,
      `<guid isPermaLink="true">${url}</guid>`,
      `<pubDate>${rfc822(itemDate(e))}</pubDate>`,
      `<dc:creator>${esc(me.name)}</dc:creator>`,
      `<category>${esc(KIND[e.data.kind])}</category>`,
      `<description>${esc(e.data.summary)}</description>`,
      '</item>',
    ].join('');
  });
  const latest = items[0] ? rfc822(itemDate(items[0])) : new Date().toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>In practice · ${esc(SITE.name)}</title>
<link>${SITE.url}/in-practice/</link>
<atom:link href="${self}" rel="self" type="application/rss+xml" />
<description>Product engineering in practice: product profiles, maker interviews, reviews and experiments, each connected to the skills it used on the Skills Map. By ${esc(me.name)}.</description>
<language>en</language>
<lastBuildDate>${latest}</lastBuildDate>
${entries.join('\n')}
</channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}

/** Bounded retrieval. DNS is checked at the socket, including every redirect. No cookies/scripts. */
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { isIP } from 'node:net';
import { isPublicAddress, safeLookup } from './cimd.ts';
import { favicon, hostOf } from './catalog-model.ts';

export interface PageMetadata {
  title: string; description: string; author: string; icon: string; type: string;
  finalUrl: string; httpStatus: number; fetchError: string;
  excerpt?: string;
}
export type PageFetcher = (url: string) => Promise<PageMetadata>;

export function publicPageUrl(value: string): URL {
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.port && !['80', '443'].includes(u.port)) {
    throw new Error('Only public http/https URLs on standard ports can be retrieved.');
  }
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host.includes('.') && !isIP(host) || /(?:^|\.)(localhost|local|internal|test|invalid)$/.test(host) || isIP(host) && !isPublicAddress(host)) {
    throw new Error('Private and local addresses cannot be retrieved.');
  }
  u.hash = '';
  return u;
}
export function plainText(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/&#(x[\da-f]+|\d+);/gi, (_, n: string) => {
    const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }).replace(/&(amp|quot|apos|lt|gt|nbsp|rsquo|lsquo|rdquo|ldquo|mdash|ndash);/g, (_, n: string) => ({
    amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–',
  })[n] ?? '').replace(/\s+/g, ' ').trim();
}
function attrs(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
    .map(m => [m[1].toLowerCase(), plainText(m[2] ?? m[3] ?? m[4] ?? '')]));
}
export function parsePage(html: string, url: string): Pick<PageMetadata, 'title' | 'description' | 'author' | 'icon' | 'type'> {
  const meta: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const a = attrs(tag); if (a.content) meta[(a.property ?? a.name ?? '').toLowerCase()] = a.content;
  }
  let icon = favicon(url);
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const a = attrs(tag);
    if (!/(^|\s)(icon|apple-touch-icon)(\s|$)/i.test(a.rel ?? '') || !a.href) continue;
    try {
      const candidate = publicPageUrl(new URL(a.href, url).href);
      // Icons from the retrieved origin only; the favicon service covers CDN-hosted icons.
      if (candidate.origin === new URL(url).origin) { icon = candidate.href; break; }
    } catch { /* use fallback */ }
  }
  const host = hostOf(url);
  return {
    title: (meta['og:title'] || meta['twitter:title'] || plainText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')).slice(0, 500),
    description: (meta.description || meta['og:description'] || meta['twitter:description'] || '').slice(0, 4000),
    author: (meta.author || meta['article:author'] || '').slice(0, 300), icon,
    type: /youtube\.com|youtu\.be|vimeo\.com/.test(host) ? 'video' : /^(x|twitter)\.com$/.test(host) ? 'post' : 'article',
  };
}
export function pageExcerpt(html: string): string {
  const content = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';
  return plainText(content.replace(/<(script|style|nav|footer|header|form|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')).slice(0, 6000);
}
export interface PageResponse { status: number; body: string; location: string; contentType: string }
export function requestPage(url: URL, deadline = Date.now() + 12_000): Promise<PageResponse> {
  publicPageUrl(url.href);
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) { reject(new Error('Retrieval timed out.')); return; }
    const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method: 'GET', lookup: safeLookup as never, agent: false,
      headers: { 'User-Agent': 'ProductEngineer-Catalog/1.0 (+https://productengineer.pro)', Accept: 'text/html,application/json,application/pdf;q=0.8', 'Accept-Encoding': 'identity' },
    }, res => {
      const chunks: Buffer[] = []; let size = 0; let finished = false;
      const finish = () => {
        if (finished) return; finished = true; clearTimeout(timer);
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), location: res.headers.location ?? '', contentType: res.headers['content-type'] ?? '' });
      };
      res.on('data', (chunk: Buffer) => {
        const room = 2 * 1024 * 1024 - size;
        if (room > 0) { chunks.push(chunk.subarray(0, room)); size += Math.min(room, chunk.length); }
        if (size >= 2 * 1024 * 1024) { finish(); res.destroy(); }
      });
      res.on('end', finish);
      res.on('error', err => { if (!finished) reject(err); });
    });
    const timer = setTimeout(() => req.destroy(new Error('Retrieval timed out.')), remaining);
    req.on('error', err => { clearTimeout(timer); reject(err); });
    req.end();
  });
}
export const fetchPage: PageFetcher = async value => {
  let url = publicPageUrl(value);
  const original = url.href;
  const deadline = Date.now() + 15_000;
  // oEmbed avoids YouTube's consent page, and retrieves the actual video title and author.
  const host = hostOf(url.href);
  if (['x.com', 'twitter.com'].includes(host) && /\/status\/\d+/.test(url.pathname)) {
    const endpoint = new URL('https://publish.twitter.com/oembed');
    endpoint.searchParams.set('url', original); endpoint.searchParams.set('omit_script', 'true'); endpoint.searchParams.set('dnt', 'true');
    const r = await requestPage(endpoint, deadline);
    if (r.status === 200) {
      const data = JSON.parse(r.body);
      const description = plainText(String(data.html ?? '').match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '').slice(0, 4000);
      return { title: description.slice(0, 140), description, excerpt: description, author: plainText(data.author_name ?? ''), type: 'post', icon: favicon(original), finalUrl: original, httpStatus: 200, fetchError: '' };
    }
    return { title: '', description: '', author: '', type: 'post', icon: favicon(original), finalUrl: original, httpStatus: r.status, fetchError: `X oEmbed returned HTTP ${r.status}. The post may require sign-in or be unavailable; check it manually.` };
  }
  if (['youtube.com', 'youtu.be'].includes(host)) {
    const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
    if (id && /^[\w-]{11}$/.test(id)) {
      const video = `https://www.youtube.com/watch?v=${id}`;
      const r = await requestPage(new URL(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(video)}`), deadline);
      if (r.status === 200) {
        const data = JSON.parse(r.body);
        return { title: plainText(data.title ?? ''), author: plainText(data.author_name ?? ''), description: '', type: 'video', icon: favicon(video), finalUrl: video, httpStatus: 200, fetchError: '' };
      }
      return { title: '', description: '', author: '', type: 'video', icon: favicon(video), finalUrl: video, httpStatus: r.status, fetchError: `YouTube oEmbed returned HTTP ${r.status}. The video may be private or unavailable.` };
    }
  }
  for (let hop = 0; hop < 5; hop++) {
    const r = await requestPage(url, deadline);
    if ([301, 302, 303, 307, 308].includes(r.status) && r.location) {
      url = publicPageUrl(new URL(r.location, url).href); continue;
    }
    const html = /text\/html|application\/xhtml/i.test(r.contentType);
    const parsed = html ? parsePage(r.body, url.href) : { title: '', description: '', author: '', icon: favicon(url.href), type: 'article' };
    return { ...parsed, excerpt: html ? pageExcerpt(r.body) : '', finalUrl: url.href, httpStatus: r.status, fetchError: r.status >= 400 ? `HTTP ${r.status}. Open the source to check access or availability.` : !html && !/application\/pdf/i.test(r.contentType) ? `No readable page metadata (${r.contentType || 'unknown content type'}).` : '' };
  }
  throw new Error(`Too many redirects while retrieving ${hostOf(original)}.`);
};

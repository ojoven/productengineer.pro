import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Config } from './config.ts';
import { canonicalUrl, hostOf } from './catalog-model.ts';
import { plainText } from './catalog-fetch.ts';

export const SOURCES = ['web', 'youtube', 'x', 'github', 'hn'] as const;
export type DiscoverySource = typeof SOURCES[number];
export interface DiscoveryResult {
  url: string; title: string; description: string; author: string;
  kind: 'tool' | 'resource'; type: string; source: string; sourceUrl: string;
}
export interface DiscoveryResponse {
  results: DiscoveryResult[]; costUsd: number; provider: string; callId: string; warning: string;
}
export type Discoverer = (source: DiscoverySource, query: string) => Promise<DiscoveryResponse>;
const exec = promisify(execFile);

function clean(s: unknown, max = 4000): string { return typeof s === 'string' ? plainText(s).slice(0, max) : ''; }
export function normalizeResults(source: DiscoverySource, output: Record<string, unknown>): DiscoveryResult[] {
  const rows = (output.results ?? output.videos ?? output.posts ?? []) as Record<string, unknown>[];
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  return rows.flatMap(row => {
    const videoId = row.video_id ?? row.videoId;
    let url = row.url ?? row.link ?? row.video_url;
    if (source === 'youtube' && typeof videoId === 'string' && /^[\w-]{11}$/.test(videoId)) url = `https://www.youtube.com/watch?v=${videoId}`;
    const postId = row.tweet_id ?? row.id;
    if (source === 'x' && !url && /^\d+$/.test(String(postId))) url = `https://x.com/i/web/status/${postId}`;
    if (typeof url !== 'string') return [];
    let key: string;
    try { key = canonicalUrl(url); } catch { return []; }
    if (seen.has(key)) return []; seen.add(key);
    const text = clean(row.text ?? row.full_text);
    const title = clean(row.title ?? row.name, 500) || text.slice(0, 140) || hostOf(url);
    const userInfo = row.user_info as Record<string, unknown> | undefined;
    const authorValue = row.authorName ?? row.author ?? row.channel ?? row.channel_name ?? userInfo?.name ?? row.screen_name;
    const author = typeof authorValue === 'object' && authorValue ? clean((authorValue as Record<string, unknown>).name, 300) : clean(authorValue, 300);
    return [{ url, title, description: clean(row.description ?? row.snippet ?? row.text ?? row.full_text), author,
      kind: 'resource' as const, type: source === 'youtube' ? 'video' : source === 'x' ? 'post' : 'article', source, sourceUrl: url }];
  }).slice(0, 30);
}

export function discoverySources(config: Config) {
  const connected = Boolean(config.tregToken || config.tregCli);
  return [
    { id: 'web', name: 'Web & articles', enabled: connected, detail: 'Articles, documentation, courses, books and tool websites · Treg' },
    { id: 'youtube', name: 'YouTube', enabled: connected, detail: 'Videos, tutorials, talks and interviews · Treg' },
    { id: 'x', name: 'X / Twitter', enabled: connected, detail: 'Posts and threads · Treg' },
    { id: 'github', name: 'GitHub', enabled: true, detail: 'Public repositories and developer tools · public API' },
    { id: 'hn', name: 'Hacker News', enabled: true, detail: 'Articles and product launches · public Algolia API' },
  ];
}
export function createDiscoverer(config: Config): Discoverer {
  return async (source, query) => {
    const empty = { costUsd: 0, provider: source, callId: '', warning: '' };
    if (source === 'github') {
      const url = new URL('https://api.github.com/search/repositories');
      url.searchParams.set('q', `${query} archived:false`); url.searchParams.set('per_page', '20');
      const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ProductEngineer-Catalog' }, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`GitHub returned HTTP ${res.status}${res.status === 403 || res.status === 429 ? ' (public API rate limit; try again later)' : ''}.`);
      const data = await res.json() as { items?: { html_url: string; full_name: string; description: string; owner?: { login: string }; stargazers_count: number }[]; incomplete_results?: boolean };
      return { ...empty, warning: data.incomplete_results ? 'GitHub reports that these results are incomplete.' : '', results: (data.items ?? []).map(r => ({ url: r.html_url, title: r.full_name, description: r.description ?? '', author: r.owner?.login ?? '', kind: 'tool', type: 'tool', source, sourceUrl: r.html_url })) };
    }
    if (source === 'hn') {
      const url = new URL('https://hn.algolia.com/api/v1/search');
      url.searchParams.set('query', query); url.searchParams.set('tags', 'story'); url.searchParams.set('hitsPerPage', '30');
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`Hacker News returned HTTP ${res.status}.`);
      const data = await res.json() as { hits: { url: string; title: string; author: string; objectID: string; story_text: string }[] };
      const seen = new Set<string>();
      return { ...empty, results: data.hits.flatMap(r => {
        if (!r.url) return []; let key: string;
        try { key = canonicalUrl(r.url); } catch { return []; }
        if (seen.has(key)) return []; seen.add(key);
        return [{ url: r.url, title: clean(r.title, 500), description: clean(r.story_text), author: r.author ?? '', kind: r.title?.startsWith('Show HN:') ? 'tool' as const : 'resource' as const, type: 'article', source, sourceUrl: `https://news.ycombinator.com/item?id=${r.objectID}` }];
      }) };
    }
    const endpoint = { web: 'treg.web.search', youtube: 'treg.youtube.search.videos', x: 'treg.x.search.posts' }[source];
    // Exclude a route observed returning an unfiltered X timeline. Keep normal Treg failover.
    const routeHeaders = { 'X-Treg-Route-Max-Cost': '0.02', ...(source === 'x' ? { 'X-Treg-Route-Exclude': 'anyapi' } : {}) };
    let payload: Record<string, any>;
    let costUsd = 0;
    let callId = '';
    if (config.tregToken) {
      const res = await fetch(`https://treg.to/call/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Treg-Token': config.tregToken, ...(config.tregOrg ? { 'X-Treg-Org': config.tregOrg } : {}), ...routeHeaders },
        body: JSON.stringify({ q: query }), signal: AbortSignal.timeout(60_000),
      });
      costUsd = Number(res.headers.get('X-Treg-Cost-Micro') ?? 0) / 1_000_000;
      callId = res.headers.get('X-Treg-Call-Id') ?? '';
      payload = await res.json() as Record<string, any>;
      if (!res.ok) throw new Error(`Treg search returned HTTP ${res.status}: ${clean(payload.message ?? payload.detail ?? payload.error, 300)}`);
    } else if (config.tregCli) {
      const args = ['--json', 'call', endpoint, '--method', 'POST', '--data', JSON.stringify({ q: query }), ...Object.entries(routeHeaders).flatMap(([k, v]) => ['-H', `${k}: ${v}`])];
      const { stdout } = await exec(config.tregCli, args, { timeout: 65_000, maxBuffer: 4 * 1024 * 1024 });
      const envelope = JSON.parse(stdout);
      payload = envelope.result ?? envelope;
      callId = envelope._treg?.call_id ?? '';
      costUsd = Number(envelope._treg?.charged_micro ?? payload._treg?.charged_micro ?? 0) / 1_000_000;
      if (Number(envelope._treg?.http_status ?? 200) >= 400) throw new Error(`Search provider failed: ${clean(payload.message ?? payload.detail ?? payload.error, 300)}`);
    } else throw new Error('Connect Treg on the server to enable web, YouTube and X discovery.');
    const output = payload.output ?? payload.body?.output;
    if (!output) throw new Error(`The search provider returned no result set. ${clean(payload.message ?? payload.error, 200)}`);
    const results = normalizeResults(source, output);
    const rawRows = output.results ?? output.videos ?? output.posts ?? [];
    return { results, costUsd, provider: payload._treg?.served_by ?? endpoint, callId, warning: rawRows.length && !results.length ? 'The provider returned rows without usable source URLs. Try another source or a more specific query.' : '' };
  };
}

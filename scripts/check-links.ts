// Checks every resource and tool URL. Run on a schedule; exits 1 when a link is dead.
//
//   node --experimental-strip-types scripts/check-links.ts            report only
//   node --experimental-strip-types scripts/check-links.ts --update   also set `checked` to today on live links
//   node --experimental-strip-types scripts/check-links.ts --only measurement   one resources file
//
// YouTube links are checked through YouTube's oEmbed endpoint, which also confirms the
// title and channel. Sites that refuse automated requests (403/429) are reported as
// "blocked" for a manual look, not as dead.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { CONTENT } from '../src/atlas/load.ts';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const args = process.argv.slice(2);
const update = args.includes('--update');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
const today = new Date().toISOString().slice(0, 10);

type Result = { file: string; id: string; url: string; status: 'ok' | 'dead' | 'blocked'; detail: string };

function youtubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1);
    if (u.hostname.endsWith('youtube.com')) return u.searchParams.get('v') ?? (u.pathname.startsWith('/watch') ? null : undefined);
  } catch {
    return undefined;
  }
}

async function check(url: string): Promise<Pick<Result, 'status' | 'detail'>> {
  const yt = youtubeId(url);
  const target = yt ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}` : url;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(target, {
        redirect: 'follow',
        headers: { 'User-Agent': UA, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8', 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(20000),
      });
      if (yt) {
        if (!res.ok) return { status: 'dead', detail: `oEmbed ${res.status}` };
        const j = (await res.json()) as { title: string; author_name: string };
        return { status: 'ok', detail: `${j.title} (${j.author_name})` };
      }
      await res.body?.cancel();
      if (res.ok) return { status: 'ok', detail: `${res.status}${res.redirected ? ` -> ${res.url}` : ''}` };
      if ([401, 403, 429, 999].includes(res.status)) return { status: 'blocked', detail: `${res.status} (refuses automated requests)` };
      if (res.status >= 500 && attempt === 0) continue;
      return { status: 'dead', detail: String(res.status) };
    } catch (e) {
      if (attempt === 0) continue;
      return { status: 'dead', detail: (e as Error).message };
    }
  }
  return { status: 'dead', detail: 'unknown' };
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

const files = ['resources', 'tools'].flatMap((dir) =>
  readdirSync(join(CONTENT, dir))
    .filter((f) => f.endsWith('.yaml') && (!only || f.startsWith(only)))
    .map((f) => join(CONTENT, dir, f)),
);

const results: Result[] = [];
for (const file of files) {
  const doc = parseDocument(readFileSync(file, 'utf8'));
  const entries = (doc.toJS() ?? {}) as Record<string, { url: string }>;
  const checked = await pool(Object.entries(entries), 6, async ([id, e]) => ({ file, id, url: e.url, ...(await check(e.url)) }));
  results.push(...checked);
  if (update) {
    for (const r of checked) if (r.status === 'ok') doc.setIn([r.id, 'checked'], today);
    writeFileSync(file, doc.toString({ lineWidth: 0 }));
  }
}

const rel = (f: string) => f.replace(CONTENT + '/', '');
for (const r of results.filter((x) => x.status !== 'ok')) console.log(`${r.status.toUpperCase().padEnd(7)} ${rel(r.file)} ${r.id}: ${r.url} (${r.detail})`);
const dead = results.filter((r) => r.status === 'dead').length;
const blocked = results.filter((r) => r.status === 'blocked').length;
console.log(`\n${results.length} links: ${results.length - dead - blocked} ok, ${blocked} blocked, ${dead} dead`);
process.exit(dead ? 1 : 0);

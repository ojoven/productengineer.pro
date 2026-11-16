import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Browser, makeApp } from './helpers.ts';
import { canonicalUrl, searchCatalog } from '../src/catalog-model.ts';
import { allEntries } from '../src/catalog-store.ts';
import { pageExcerpt, parsePage, publicPageUrl } from '../src/catalog-fetch.ts';
import { normalizeResults } from '../src/catalog-discovery.ts';

test('discovery is cached, records actual cost, annotates duplicates and enforces the daily budget', async () => {
  let calls = 0;
  const { deps, fetch } = makeApp({ discoverCatalog: async () => {
    calls++;
    return { results: [{ url: 'https://www.growthbook.io/?utm_source=test', title: 'GrowthBook', description: 'Feature flags', author: '', kind: 'tool', type: 'tool', source: 'web', sourceUrl: '' }], costUsd: .01, provider: 'fixture', callId: 'test', warning: '' };
  } });
  try {
    const browser = new Browser(fetch); await browser.signIn();
    deps.config.discoveryDailyBudget = .03;
    const query = { source: 'web', q: 'feature flags' };
    const first = await browser.request('/api/operations/discover', { method: 'POST', json: query });
    assert.equal(first.status, 200);
    const data = await first.json(); assert.equal(data.results[0].existing, 'tool:growthbook'); assert.equal(data.costUsd, .01);
    const repeat = await (await browser.request('/api/operations/discover', { method: 'POST', json: query })).json();
    assert.equal(repeat.cached, true); assert.equal(repeat.costUsd, 0); assert.equal(calls, 1);
    deps.config.discoveryDailyBudget = .02;
    assert.equal((await browser.request('/api/operations/discover', { method: 'POST', json: { ...query, q: 'new search' } })).status, 429);
    assert.equal(calls, 1);
    const history = await (await browser.request('/api/operations/history')).json(); assert.equal(history.runs.length, 1);
    assert.equal(history.runs[0].costUsd, .01);
  } finally { deps.db.close(); }
});

test('failed link checks preserve review decisions and editorial copy; manual approval requires a note', async () => {
  const { deps, fetch } = makeApp({ fetchCatalogPage: async () => { throw new Error('Connection timed out.'); } });
  try {
    const browser = new Browser(fetch); await browser.signIn();
    const original = allEntries(deps.db).find(e => e.id === 'tool:growthbook')!;
    const path = `/api/operations/entries/${encodeURIComponent(original.id)}`;
    const checked = await browser.request(`${path}/retrieve`, { method: 'POST', json: { version: original.version } });
    const { entry } = await checked.json();
    assert.equal(entry.status, 'validated'); assert.equal(entry.description, original.description); assert.match(entry.fetchError, /timed out/);
    const missingNote = await browser.request(`${path}/review`, { method: 'POST', json: { version: entry.version, status: 'validated', manualVerified: true } });
    assert.equal(missingNote.status, 400);
    const manual = await browser.request(`${path}/review`, { method: 'POST', json: { version: entry.version, status: 'validated', manualVerified: true, note: 'Opened the official product in a browser and checked it.' } });
    assert.equal(manual.status, 200);
    const publicData = await (await browser.request('/api/catalog')).json();
    assert.ok(publicData.entries.every((e: { note: string }) => !e.note));
    const events = await (await browser.request(`${path}/history`)).json();
    assert.deepEqual(events.events.map((e: { action: string }) => e.action), ['validated', 'link-check-failed']);
  } finally { deps.db.close(); }
});

test('URL retrieval blocks local, alternate-IP, credentialed and non-web targets', () => {
  for (const value of ['http://127.0.0.1', 'http://2130706433', 'http://[::1]/', 'http://169.254.169.254/', 'http://foo.internal/', 'file:///etc/passwd', 'https://user:pass@example.com/', 'https://example.com:8790/']) assert.throws(() => publicPageUrl(value), value);
  assert.equal(publicPageUrl('https://example.com/guide').hostname, 'example.com');
});

test('metadata extraction handles attribute order, entities and same-origin icons without executing HTML', () => {
  const parsed = parsePage(`<title>Fallback</title><meta content="Real &amp; useful" property="og:title"><meta name='description' content='A practical guide'><meta content='A maker' name='author'><link href='/brand/icon.svg' rel='shortcut icon'>`, 'https://example.com/guide');
  assert.equal(parsed.title, 'Real & useful'); assert.equal(parsed.author, 'A maker'); assert.equal(parsed.icon, 'https://example.com/brand/icon.svg');
  const foreign = parsePage(`<link rel="icon" href="http://127.0.0.1/private">`, 'https://example.com');
  assert.match(foreign.icon, /google\.com/);
  assert.equal(pageExcerpt('<body><nav>Menu</nav><article><h1>Guide</h1><p>Useful evidence.</p><script>secret()</script></article><footer>Footer</footer></body>'), 'Guide Useful evidence.');
});

test('ranked search supports phrases, exclusions, domains and atlas skill associations', () => {
  const { deps } = makeApp();
  try {
    const entries = allEntries(deps.db);
    assert.equal(searchCatalog(entries, { q: '"feature flags"' }).length, 0);
    assert.equal(searchCatalog(entries, { q: 'site:growthbook.io experiments' })[0].title, 'GrowthBook');
    assert.equal(searchCatalog(entries, { q: '"Sample size" -site:evanmiller.org' })[0].id, 'tool:growthbook');
    assert.equal(searchCatalog(entries, { kind: 'resource', territory: 'measurement' }).length, 1);
  } finally { deps.db.close(); }
});

test('video and post results normalize provider-native fields and deduplicate tracking URLs', () => {
  const videos = normalizeResults('youtube', { videos: [{ video_id: 'dQw4w9WgXcQ', title: 'A talk', author: 'A maker' }] });
  assert.equal(videos[0].url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'); assert.equal(videos[0].type, 'video');
  const posts = normalizeResults('x', { posts: [{ id: '12345', text: 'A useful thread', authorName: 'A maker' }] });
  assert.equal(posts[0].url, 'https://x.com/i/web/status/12345'); assert.equal(posts[0].author, 'A maker');
  const native = normalizeResults('x', { posts: [{ tweet_id: '1711767230642635130', text: 'How companies ship code', user_info: { name: 'Alex Xu' } }] });
  assert.equal(native[0].url, 'https://x.com/i/web/status/1711767230642635130'); assert.equal(native[0].author, 'Alex Xu');
  assert.equal(canonicalUrl('https://youtu.be/dQw4w9WgXcQ?t=60'), canonicalUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share'));
  assert.equal(canonicalUrl('https://twitter.com/alexxubyte/status/1711767230642635130?s=20'), canonicalUrl(native[0].url));
});

test('an interrupted paid search retains its maximum reservation and cannot spend through the daily budget', async () => {
  const { deps, fetch } = makeApp({ discoverCatalog: async () => { throw new Error('Provider connection dropped.'); } });
  try {
    deps.config.discoveryDailyBudget = .02;
    const b = new Browser(fetch); await b.signIn();
    const result = await b.request('/api/operations/discover', { method: 'POST', json: { source: 'web', q: 'product discovery' } });
    assert.equal(result.status, 502); assert.match((await result.json()).error, /held against/);
    const session = await (await b.request('/api/operations/session')).json(); assert.equal(session.spentToday, .02);
    assert.equal((await b.request('/api/operations/discover', { method: 'POST', json: { source: 'web', q: 'product discovery' } })).status, 429);
    const history = await (await b.request('/api/operations/history')).json(); assert.equal(history.runs[0].estimated, 1); assert.equal(history.runs[0].state, 'failed');
  } finally { deps.db.close(); }
});

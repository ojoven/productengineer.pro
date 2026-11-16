import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import * as z from 'zod/v4';
import type { Deps } from './app.ts';
import { sessionUser } from './account.ts';
import { identitiesOf } from './users.ts';
import { clientIp, RateLimiter } from './http.ts';
import { allEntries, catalogId, findUrl, getEntry, saveEntry, seedCatalog } from './catalog-store.ts';
import { favicon, KINDS, PRICING, reviewDue, searchCatalog, STATUSES, TYPES, type CatalogEntry } from './catalog-model.ts';
import { fetchPage, publicPageUrl } from './catalog-fetch.ts';
import { createDiscoverer, discoverySources, SOURCES } from './catalog-discovery.ts';

const Text = z.string().trim();
const Draft = z.object({
  url: Text.min(1).max(2000), kind: z.enum(KINDS), title: Text.max(500).default(''),
  description: Text.max(4000).default(''), author: Text.max(300).default(''),
  type: z.enum(TYPES).default('article'), source: Text.max(40).default('manual'), sourceUrl: Text.max(2000).default(''),
});
const Edit = z.object({
  version: z.number().int(), title: Text.min(1).max(500), description: Text.min(1).max(4000), author: Text.max(300),
  kind: z.enum(KINDS), type: z.enum([...TYPES, 'tool']), pricing: z.enum(PRICING), level: z.enum(['', 'intro', 'deep']),
  territories: z.array(Text.max(100)).max(12), skillIds: z.array(Text.max(150)).max(100), note: Text.max(2000),
});
const Decision = z.object({ version: z.number().int(), status: z.enum(STATUSES), note: Text.max(2000).default(''), manualVerified: z.boolean().default(false) });

export function catalogRoutes(deps: Deps) {
  const { db, atlas, config, now } = deps;
  seedCatalog(db, atlas);
  const discover = deps.discoverCatalog ?? createDiscoverer(config);
  const retrieve = deps.fetchCatalogPage ?? fetchPage;
  const app = new Hono<{ Variables: { actor: string } }>();
  const writeLimit = new RateLimiter(90, 60_000);
  const searchLimit = new RateLimiter(20, 60_000);
  let discoveryBusy = false;
  const taxonomy = () => ({ territories: atlas.territories.map(t => ({ id: t.id, name: t.name, code: t.code })), skills: [...atlas.capabilities, ...atlas.skills].map(s => ({ id: s.id, name: s.name, path: s.path, territory: s.territory })) });

  app.get('/catalog', c => {
    c.header('Cache-Control', 'no-store');
    return c.json({ entries: searchCatalog(allEntries(db).filter(e => e.status === 'validated'), { q: c.req.query('q'), kind: c.req.query('kind') }).map(e => ({ ...e, note: '', evidence: undefined })), generated: atlas.generated, territories: taxonomy().territories });
  });
  app.use('/operations/*', bodyLimit({ maxSize: 32 * 1024, onError: c => c.json({ error: 'Request is too large.' }, 413) }));
  app.use('/operations/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    const user = sessionUser(deps, c);
    if (!user) return c.json({ error: 'Sign in to access catalog operations.', code: 'signed_out' }, 401);
    const allowed = config.devLogin || config.opsAdminIds?.includes(user.id) || identitiesOf(db, user.id).some(i => i.email_verified === 1 && i.email && config.opsAdminEmails?.includes(i.email.toLowerCase()));
    if (!allowed) return c.json({ error: 'This account does not have catalog operations access.', code: 'forbidden' }, 403);
    c.set('actor', user.id);
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      if (c.req.header('origin') && c.req.header('origin') !== config.publicUrl || c.req.header('sec-fetch-site') === 'cross-site') return c.json({ error: 'Cross-origin requests are not allowed.' }, 403);
      if (!c.req.header('content-type')?.startsWith('application/json')) return c.json({ error: 'JSON is required.' }, 415);
      if (!writeLimit.allow(clientIp(c, config), now())) return c.json({ error: 'Too many requests. Try again in a minute.' }, 429);
    }
    await next();
  });
  app.get('/operations/session', c => {
    const today = new Date(now()).toISOString().slice(0, 10);
    const spend = db.prepare('SELECT COALESCE(SUM(cost_usd), 0) AS total FROM discovery_runs WHERE at >= ?').get(today) as { total: number };
    return c.json({ ...taxonomy(), sources: discoverySources(config), dailyBudget: config.discoveryDailyBudget ?? 1, spentToday: spend.total, dev: config.devLogin });
  });
  app.get('/operations/entries', c => c.json({ entries: allEntries(db) }));
  app.get('/operations/history', c => c.json({ runs: db.prepare("SELECT id, source, query, cost_usd AS costUsd, json_extract(data, '$.costIsEstimate') AS estimated, json_extract(data, '$.state') AS state, at FROM discovery_runs ORDER BY id DESC LIMIT 40").all() }));
  app.get('/operations/entries/:id/history', c => c.json({ events: db.prepare('SELECT action, note, at FROM catalog_events WHERE entry_id = ? ORDER BY id DESC LIMIT 50').all(c.req.param('id')) }));

  app.post('/operations/discover', async c => {
    const parsed = z.object({ source: z.enum(SOURCES), q: Text.min(2).max(250) }).safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Choose a source and enter a query of 2–250 characters.' }, 400);
    const { source, q } = parsed.data;
    if (!discoverySources(config).find(s => s.id === source)?.enabled && !deps.discoverCatalog) return c.json({ error: 'This source needs a Treg connection on the server.', code: 'source_not_connected' }, 503);
    const cached = db.prepare("SELECT data, at FROM discovery_runs WHERE source = ? AND query = ? AND at > ? AND json_extract(data, '$.state') = 'complete' ORDER BY id DESC LIMIT 1")
      .get(source, q, new Date(now() - 15 * 60_000).toISOString()) as { data: string; at: string } | undefined;
    const withKnown = (data: Record<string, any>) => ({ ...data, results: data.results.map((r: { url: string }) => ({ ...r, existing: findUrl(db, r.url)?.id ?? null, existingStatus: findUrl(db, r.url)?.status ?? null })) });
    if (cached) return c.json(withKnown({ ...JSON.parse(cached.data), cached: true, cachedAt: cached.at, costUsd: 0 }));
    if (!searchLimit.allow(c.get('actor'), now())) return c.json({ error: 'Search limit reached. Try again in a minute.' }, 429);
    if (discoveryBusy) return c.json({ error: 'Another discovery search is running. Try again when it finishes.' }, 429);
    const paid = ['web', 'youtube', 'x'].includes(source);
    const spend = db.prepare('SELECT COALESCE(SUM(cost_usd), 0) AS total FROM discovery_runs WHERE at >= ?').get(new Date(now()).toISOString().slice(0, 10)) as { total: number };
    if (paid && spend.total + 0.02 > (config.discoveryDailyBudget ?? 1)) return c.json({ error: 'The daily discovery budget has been reached. Free GitHub and Hacker News searches remain available.' }, 429);
    discoveryBusy = true;
    // Hold the ceiling before the request, so an interrupted process cannot release a charge
    // that may already have settled upstream. Successful calls settle to actual reported cost.
    const run = db.prepare('INSERT INTO discovery_runs (actor, source, query, data, cost_usd, at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(c.get('actor'), source, q, JSON.stringify({ state: 'running', costIsEstimate: paid, results: [] }), paid ? .02 : 0, new Date(now()).toISOString());
    try {
      const data = await discover(source, q);
      db.prepare('UPDATE discovery_runs SET data = ?, cost_usd = ? WHERE id = ?')
        .run(JSON.stringify({ ...data, state: 'complete', costIsEstimate: false }), data.costUsd, run.lastInsertRowid);
      return c.json(withKnown({ ...data, cached: false }));
    } catch (err) {
      // Never return subprocess stderr: a provider error can contain account details.
      const message = err instanceof Error && !('cmd' in err) ? err.message.slice(0, 500) : 'The connected search provider failed. Check the server connection and try again.';
      db.prepare('UPDATE discovery_runs SET data = ? WHERE id = ?').run(JSON.stringify({ state: 'failed', costIsEstimate: paid, error: message, results: [] }), run.lastInsertRowid);
      return c.json({ error: message + (paid ? ' Up to $0.02 is held against today’s budget because the provider’s final charge is unknown.' : '') }, 502);
    } finally { discoveryBusy = false; }
  });

  app.post('/operations/retrieve', async c => {
    const parsed = Draft.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Provide a valid URL and item kind.' }, 400);
    const draft = parsed.data;
    try { publicPageUrl(draft.url); } catch (err) { return c.json({ error: (err as Error).message }, 400); }
    const existing = findUrl(db, draft.url);
    if (existing) return c.json({ entry: existing, duplicate: true });
    const at = new Date(now()).toISOString();
    let meta;
    try { meta = await retrieve(draft.url); } catch (err) { meta = { title: '', description: '', author: '', icon: favicon(draft.url), type: draft.type, finalUrl: draft.url, httpStatus: null, fetchError: (err as Error).message.slice(0, 500) }; }
    // Concurrent retrieval of the same URL is idempotent.
    const found = findUrl(db, draft.url);
    if (found) return c.json({ entry: found, duplicate: true });
    const entry: CatalogEntry = {
      id: catalogId(draft.kind, draft.url), ...draft, title: meta.title || draft.title || new URL(draft.url).hostname,
      description: draft.description || meta.description, author: meta.author || draft.author,
      type: draft.kind === 'tool' ? 'tool' : meta.type === 'article' ? draft.type : meta.type,
      pricing: 'unknown', level: '', territories: [], skills: [], icon: meta.icon,
      status: 'pending', fetchedAt: at, checked: '', httpStatus: meta.httpStatus, finalUrl: meta.finalUrl,
      fetchError: meta.fetchError, note: '', reviewedAt: '', updatedAt: at, version: 0,
      evidence: { title: meta.title, description: meta.description, author: meta.author, excerpt: 'excerpt' in meta ? meta.excerpt : '' },
    };
    return c.json({ entry: saveEntry(db, entry, c.get('actor'), 'retrieved', now()), duplicate: false }, 201);
  });

  app.post('/operations/entries/:id/retrieve', async c => {
    const entry = getEntry(db, c.req.param('id'));
    if (!entry) return c.json({ error: 'Entry not found.' }, 404);
    const body = z.object({ version: z.number().int() }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'An entry version is required.' }, 400);
    if (body.data.version !== entry.version) return c.json({ error: 'This entry changed. Reload before saving.' }, 409);
    try {
      const meta = await retrieve(entry.url);
      return c.json({ entry: saveEntry(db, { ...entry, evidence: meta, icon: meta.icon, httpStatus: meta.httpStatus, finalUrl: meta.finalUrl, fetchError: meta.fetchError, fetchedAt: new Date(now()).toISOString() }, c.get('actor'), 'link-checked', now(), body.data.version), metadata: meta });
    } catch (err) {
      if ((err as Error).message === 'conflict') return c.json({ error: 'This entry changed while retrieval was running. Reload it.' }, 409);
      try {
        return c.json({ entry: saveEntry(db, { ...entry, httpStatus: null, fetchError: (err as Error).message.slice(0, 500), fetchedAt: new Date(now()).toISOString() }, c.get('actor'), 'link-check-failed', now(), body.data.version) });
      } catch { return c.json({ error: 'This entry changed. Reload it.' }, 409); }
    }
  });
  app.patch('/operations/entries/:id', async c => {
    const entry = getEntry(db, c.req.param('id'));
    if (!entry) return c.json({ error: 'Entry not found.' }, 404);
    const body = Edit.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'A title and description are required. Check the form fields.' }, 400);
    const { skillIds, version, ...edit } = body.data;
    if (edit.territories.some(id => !atlas.territory(id)) || skillIds.some(id => !atlas.skill(id) && !atlas.capability(id))) return c.json({ error: 'Choose valid atlas territories and skills.' }, 400);
    const skills = skillIds.map(id => atlas.node(id)!).map(n => ({ id: n.id, name: n.name, path: n.path }));
    const territories = [...new Set([...edit.territories, ...skillIds.map(id => { const n = atlas.node(id)!; return 'territory' in n ? n.territory : n.id; })])];
    try {
      return c.json({ entry: saveEntry(db, { ...entry, ...edit, type: edit.kind === 'tool' ? 'tool' : edit.type === 'tool' ? 'article' : edit.type, skills, territories, status: 'pending' }, c.get('actor'), 'edited', now(), version) });
    } catch { return c.json({ error: 'This entry changed. Reload before saving.' }, 409); }
  });
  app.post('/operations/entries/:id/review', async c => {
    const entry = getEntry(db, c.req.param('id'));
    if (!entry) return c.json({ error: 'Entry not found.' }, 404);
    const body = Decision.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'Choose a valid decision.' }, 400);
    const { status, note, manualVerified, version } = body.data;
    if (status === 'invalidated' && !note) return c.json({ error: 'Add a reason for invalidating this entry.' }, 400);
    if (status === 'validated') {
      if (!entry.title.trim() || !entry.description.trim() || !entry.territories.length) return c.json({ error: 'Add a title, useful description and at least one atlas territory before validating.' }, 400);
      const healthy = Boolean(entry.fetchedAt && Date.parse(entry.fetchedAt) > now() - 7 * 86400_000 && entry.httpStatus && entry.httpStatus < 400 && !entry.fetchError);
      if (!healthy && !(manualVerified && note)) return c.json({ error: 'Retrieve a healthy source first, or confirm a manual check and explain it in the review note.' }, 400);
    }
    try {
      const next = saveEntry(db, { ...entry, status, note, checked: status === 'validated' ? new Date(now()).toISOString().slice(0, 10) : entry.checked, reviewedAt: new Date(now()).toISOString() }, c.get('actor'), status, now(), version);
      return c.json({ entry: next, reviewDue: reviewDue(next, now()) });
    } catch { return c.json({ error: 'This entry changed. Reload before reviewing.' }, 409); }
  });
  return app;
}

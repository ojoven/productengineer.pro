import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Browser, makeApp } from './helpers.ts';

test('catalog reads are public while operations require an authorized account and same-origin JSON', async () => {
  const { fetch, deps } = makeApp();
  const browser = new Browser(fetch);
  try {
    const publicCatalog = await (await browser.request('/api/catalog')).json();
    assert.equal(publicCatalog.entries.length, 2);
    assert.ok(publicCatalog.entries.every((entry: { status: string }) => entry.status === 'validated'));
    assert.equal((await browser.request('/api/operations/session')).status, 401);

    await browser.signIn();
    deps.config.devLogin = false;
    assert.equal((await browser.request('/api/operations/session')).status, 403);
    const { user } = await (await browser.request('/api/me')).json();
    deps.config.opsAdminIds = [user.id];
    assert.equal((await browser.request('/api/operations/session')).status, 200);
    assert.equal((await browser.request('/api/operations/retrieve', {
      method: 'POST', headers: { origin: 'https://other.example', 'content-type': 'application/json' }, body: '{}',
    })).status, 403);
    assert.equal((await browser.request('/api/operations/retrieve', { method: 'POST', body: '{}' })).status, 415);
  } finally { deps.db.close(); }
});

test('catalog retrieval deduplicates URLs and only publishes reviewed entries, with stale-edit protection', async () => {
  let retrievals = 0;
  const { fetch, deps } = makeApp({
    fetchCatalogPage: async url => {
      retrievals++;
      return { title: 'A useful guide', description: 'A practical guide to experiment design.', author: 'A practitioner',
        icon: 'https://example.com/favicon.ico', type: 'article', finalUrl: url, httpStatus: 200, fetchError: '' };
    },
  });
  const browser = new Browser(fetch);
  try {
    await browser.signIn();
    const privateUrl = await browser.request('/api/operations/retrieve', {
      method: 'POST', json: { url: 'http://169.254.169.254/latest/meta-data/', kind: 'resource' },
    });
    assert.equal(privateUrl.status, 400);
    assert.equal(retrievals, 0);

    const retrieved = await browser.request('/api/operations/retrieve', {
      method: 'POST', json: { url: 'https://example.com/guide?utm_source=test', kind: 'resource' },
    });
    assert.equal(retrieved.status, 201);
    let { entry } = await retrieved.json();
    assert.equal(entry.status, 'pending');
    const publicIds = async () => (await (await browser.request('/api/catalog')).json()).entries.map((item: { id: string }) => item.id);
    assert.ok(!(await publicIds()).includes(entry.id));

    const duplicate = await browser.request('/api/operations/retrieve', {
      method: 'POST', json: { url: 'https://www.example.com/guide#section', kind: 'resource' },
    });
    const duplicateBody = await duplicate.json();
    assert.equal(duplicateBody.duplicate, true);
    assert.equal(duplicateBody.entry.id, entry.id);
    assert.equal(retrievals, 1);

    const path = `/api/operations/entries/${encodeURIComponent(entry.id)}`;
    const edit = { version: entry.version, title: entry.title, description: entry.description, author: entry.author,
      kind: 'resource', type: 'article', pricing: 'free', level: 'intro', territories: ['measurement'], skillIds: ['sample-size'], note: '' };
    const edited = await browser.request(path, { method: 'PATCH', json: edit });
    assert.equal(edited.status, 200);
    entry = (await edited.json()).entry;
    assert.equal((await browser.request(path, { method: 'PATCH', json: edit })).status, 409);

    const reviewed = await browser.request(`${path}/review`, { method: 'POST', json: { version: entry.version, status: 'validated' } });
    assert.equal(reviewed.status, 200);
    entry = (await reviewed.json()).entry;
    assert.ok((await publicIds()).includes(entry.id));
    assert.equal((await browser.request(`${path}/review`, {
      method: 'POST', json: { version: entry.version, status: 'invalidated' },
    })).status, 400);
    assert.equal((await browser.request(`${path}/review`, {
      method: 'POST', json: { version: entry.version, status: 'invalidated', note: 'The guide is outdated.' },
    })).status, 200);
    assert.ok(!(await publicIds()).includes(entry.id));
  } finally { deps.db.close(); }
});

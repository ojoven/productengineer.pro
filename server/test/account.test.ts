import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Browser, location, makeApp, PUBLIC } from './helpers.ts';
import { safeReturn } from '../src/http.ts';

test('signing in sets an httpOnly session and a readable signed-in flag, and returns to the page', async () => {
  const { fetch } = makeApp();
  const b = new Browser(fetch);
  const res = await b.signIn('alice', { returnTo: '/atlas/measurement/' });
  assert.equal(res.status, 302);
  assert.equal(location(res).pathname, '/atlas/measurement/');
  assert.ok(b.cookies.get('pe_session'));
  assert.equal(b.cookies.get('pe_auth'), '1');
  const cookieLine = res.headers.getSetCookie().find((l) => l.startsWith('pe_session='))!;
  assert.match(cookieLine, /HttpOnly/i);
  assert.match(cookieLine, /SameSite=Lax/i);

  const me = await (await b.request('/api/me')).json();
  assert.equal(me.user.name, 'Dev alice');
  assert.deepEqual(me.user.identities, [{ provider: 'dev', handle: 'alice', email: null, emailVerified: false }]);
  assert.equal('email' in me.user, false);
});

test('a callback from another browser is refused (login CSRF)', async () => {
  const { fetch } = makeApp();
  const attacker = new Browser(fetch);
  const start = await attacker.request('/api/auth/dev/start?as=mallory');
  const victim = new Browser(fetch);
  const res = await victim.request(start.headers.get('location')!);
  assert.equal(location(res).searchParams.get('auth_error'), 'expired');
  assert.equal(victim.cookies.has('pe_session'), false);
});

test('the authenticated profile includes provider email and verification, without exposing it signed out', async () => {
  const { fetch, deps } = makeApp();
  deps.providers.set('github', {
    id: 'github', label: 'GitHub',
    authorizeUrl({ redirectUri, state }) {
      const url = new URL(redirectUri);
      url.search = new URLSearchParams({ state, code: 'test-code' }).toString();
      return url.href;
    },
    async exchange() {
      return { provider: 'github', subject: '42', handle: 'alice', name: 'Alice', avatarUrl: null, email: 'private@example.com', emailVerified: true };
    },
  });
  const b = new Browser(fetch);
  const start = await b.request('/api/auth/github/start');
  await b.request(start.headers.get('location')!);
  const me = await b.request('/api/me');
  assert.equal(me.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await me.json()).user.identities, [{ provider: 'github', handle: 'alice', email: 'private@example.com', emailVerified: true }]);
  assert.equal((await new Browser(fetch).request('/api/me')).status, 401);
  await b.request('/api/me', { method: 'DELETE' });
  assert.deepEqual(deps.db.prepare('SELECT email FROM identities').all(), []);
});

test('return paths stay on this site', () => {
  assert.equal(safeReturn('/me/'), '/me/');
  assert.equal(safeReturn('/connect/?request=abc'), '/connect/?request=abc');
  assert.equal(safeReturn('//evil.example/'), '/me/');
  assert.equal(safeReturn('/\\evil.example'), '/me/');
  assert.equal(safeReturn('https://evil.example/'), '/me/');
  assert.equal(safeReturn(undefined), '/me/');
});

test('unknown provider and signed-out calls', async () => {
  const { fetch } = makeApp();
  const b = new Browser(fetch);
  const res = await b.request('/api/auth/myspace/start?return=/me/');
  assert.equal(location(res).searchParams.get('auth_error'), 'provider');
  assert.equal((await b.request('/api/me')).status, 401);
  assert.equal((await b.request('/api/progress')).status, 401);
  const providers = await (await b.request('/api/auth/providers')).json();
  assert.deepEqual(providers.providers, [{ id: 'dev', label: 'Dev' }]);
});

test('progress merges per skill, newest change wins', async () => {
  const { fetch, clock } = makeApp();
  const b = new Browser(fetch);
  await b.signIn();
  const t = clock.now;

  let res = await b.request('/api/progress', {
    method: 'POST',
    json: {
      changes: [
        { id: 'sample-size', status: 'learning', at: t - 1000 },
        { id: 'ab-testing', status: 'comfortable', at: t - 1000 },
        { id: 'not-a-skill', status: 'learning', at: t },
        { id: 'measurement', status: 'learning', at: t },
      ],
    },
  });
  let body = await res.json();
  assert.equal(body.applied, 2);
  assert.equal(body.skipped, 2);
  assert.deepEqual(Object.keys(body.progress).sort(), ['ab-testing', 'sample-size']);

  // an older change from a stale device loses; a newer one wins; aliases resolve
  res = await b.request('/api/progress', {
    method: 'POST',
    json: {
      changes: [
        { id: 'sample-size', status: 'none', at: t - 5000 },
        { id: 'old-sample-size', status: 'comfortable', at: t - 500 },
        { id: 'ab-testing', status: 'none', at: t - 100 },
      ],
    },
  });
  body = await res.json();
  assert.equal(body.progress['sample-size'].status, 'comfortable');
  assert.equal(body.progress['ab-testing'], undefined);

  // a clock in the future is clamped to now, so it cannot pin a status forever
  await b.request('/api/progress', { method: 'POST', json: { changes: [{ id: 'funnel-analysis', status: 'learning', at: t + 86400_000 }] } });
  body = await (await b.request('/api/progress')).json();
  assert.equal(body.progress['funnel-analysis'].at, t);
});

test('writes need JSON from this origin', async () => {
  const { fetch } = makeApp();
  const b = new Browser(fetch);
  await b.signIn();
  const cross = await b.request('/api/progress', {
    method: 'POST',
    headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    body: JSON.stringify({ changes: [] }),
  });
  assert.equal(cross.status, 403);
  const form = await b.request('/api/progress', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'x=1' });
  assert.equal(form.status, 415);
  const bad = await b.request('/api/progress', { method: 'POST', json: { changes: [{ id: 'sample-size', status: 'expert', at: 1 }] } });
  assert.equal(bad.status, 400);
});

test('renaming, signing out and deleting the account', async () => {
  const { fetch } = makeApp();
  const b = new Browser(fetch);
  await b.signIn();
  const renamed = await (await b.request('/api/me', { method: 'PATCH', json: { name: '  Mikel   T  ' } })).json();
  assert.equal(renamed.user.name, 'Mikel T');

  await b.request('/api/progress', { method: 'POST', json: { changes: [{ id: 'sample-size', status: 'learning', at: 1 }] } });
  const out = await b.request('/api/auth/logout', { method: 'POST', json: {} });
  assert.equal(out.status, 200);
  assert.equal(b.cookies.has('pe_session'), false);
  assert.equal(b.cookies.has('pe_auth'), false);

  await b.signIn();
  assert.equal((await (await b.request('/api/progress')).json()).progress['sample-size'].status, 'learning');
  const del = await b.request('/api/me', { method: 'DELETE', headers: { origin: PUBLIC } });
  assert.equal(del.status, 200);
  assert.equal((await b.request('/api/me')).status, 401);

  // signing in again with the same identity starts a fresh, empty account
  await b.signIn();
  assert.deepEqual((await (await b.request('/api/progress')).json()).progress, {});
});

test('linking a second sign-in method merges the two accounts', async () => {
  const { fetch, clock } = makeApp();
  const laptop = new Browser(fetch);
  const phone = new Browser(fetch);
  await laptop.signIn('alice');
  await phone.signIn('alice-github');
  const t = clock.now;
  await laptop.request('/api/progress', { method: 'POST', json: { changes: [{ id: 'sample-size', status: 'learning', at: t - 2000 }] } });
  await phone.request('/api/progress', {
    method: 'POST',
    json: {
      changes: [
        { id: 'sample-size', status: 'comfortable', at: t - 1000 },
        { id: 'user-interviews', status: 'learning', at: t - 1000 },
      ],
    },
  });

  const res = await laptop.signIn('alice-github', { link: true });
  assert.equal(location(res).searchParams.get('auth'), 'merged');
  const me = await (await laptop.request('/api/me')).json();
  assert.deepEqual(me.user.identities.map((i: { handle: string }) => i.handle).sort(), ['alice', 'alice-github']);
  const merged = (await (await laptop.request('/api/progress')).json()).progress;
  assert.equal(merged['sample-size'].status, 'comfortable');
  assert.equal(merged['user-interviews'].status, 'learning');

  // the phone stays signed in, now to the merged account
  const phoneMe = await (await phone.request('/api/me')).json();
  assert.equal(phoneMe.user.id, me.user.id);

  // linking an identity that is already yours changes nothing
  const again = await laptop.signIn('alice', { link: true });
  assert.equal(location(again).searchParams.get('auth'), 'linked');
});

test('not interested syncs between devices and can be changed back to learning', async () => {
  const { fetch } = makeApp();
  const laptop = new Browser(fetch);
  const phone = new Browser(fetch);
  await laptop.signIn('alice');
  await phone.signIn('alice');
  let res = await laptop.request('/api/progress', {
    method: 'POST', json: { changes: [{ id: 'sample-size', status: 'not-interested', at: 1 }] },
  });
  assert.equal(res.status, 200);
  assert.equal((await (await phone.request('/api/progress')).json()).progress['sample-size'].status, 'not-interested');
  res = await phone.request('/api/progress', {
    method: 'POST', json: { changes: [{ id: 'sample-size', status: 'learning', at: 2 }] },
  });
  assert.equal(res.status, 200);
  assert.equal((await (await laptop.request('/api/progress')).json()).progress['sample-size'].status, 'learning');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { github, google, type Fetch } from '../src/providers.ts';

const credentials = { clientId: 'client', clientSecret: 'secret' };
const authorize = { state: 'state', redirectUri: 'https://productengineer.pro/api/auth/provider/callback', challenge: 'challenge', nonce: 'nonce' };
const exchange = { code: 'code', redirectUri: authorize.redirectUri, verifier: 'verifier', nonce: authorize.nonce };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function githubFetch(emails: unknown, emailStatus = 200) {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetch: Fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (url === 'https://github.com/login/oauth/access_token') return json({ access_token: 'token' });
    if (url === 'https://api.github.com/user') return json({ id: 42, login: 'alice', name: 'Alice', email: 'public@example.com' });
    if (url === 'https://api.github.com/user/emails?per_page=100') return json(emails, emailStatus);
    throw new Error(`Unexpected request: ${url}`);
  };
  return { fetch, requests };
}

test('GitHub requests email permission and reads a verified private primary address', async () => {
  const { fetch, requests } = githubFetch([
    { email: 'other@example.com', verified: true, primary: false },
    { email: 'private@example.com', verified: true, primary: true, visibility: 'private' },
  ]);
  const provider = github(credentials, fetch);
  const url = new URL(provider.authorizeUrl(authorize));
  assert.equal(url.searchParams.get('scope'), 'user:email');
  assert.equal(url.searchParams.get('code_challenge'), 'challenge');
  assert.equal(url.searchParams.get('state'), 'state');
  const profile = await provider.exchange(exchange);
  assert.equal(profile.subject, '42');
  assert.equal(profile.email, 'private@example.com');
  assert.equal(profile.emailVerified, true);
  for (const request of requests.slice(1)) assert.equal(new Headers(request.init?.headers).get('authorization'), 'Bearer token');
  const tokenBody = requests[0].init?.body as URLSearchParams;
  assert.equal(tokenBody.get('code_verifier'), 'verifier');
});

test('GitHub falls back to a verified address, records unverified addresses honestly, and permits no address', async () => {
  for (const [emails, expected, verified] of [
    [[{ email: 'primary@example.com', primary: true, verified: false }, { email: 'verified@example.com', primary: false, verified: true }], 'verified@example.com', true],
    [[{ email: 'secondary@example.com', primary: false, verified: false }, { email: 'primary@example.com', primary: true, verified: false }], 'primary@example.com', false],
    [[null, {}, { email: '' }], null, false],
    [[], null, false],
  ] as const) {
    const profile = await github(credentials, githubFetch(emails).fetch).exchange(exchange);
    assert.equal(profile.email, expected);
    assert.equal(profile.emailVerified, verified);
  }
});

test('GitHub email permission/API failures and malformed responses are surfaced', async () => {
  await assert.rejects(github(credentials, githubFetch({ message: 'Forbidden' }, 403).fetch).exchange(exchange), /GitHub emails: HTTP 403/);
  await assert.rejects(github(credentials, githubFetch({ unexpected: true }).fetch).exchange(exchange), /expected a list/);
});

const now = Date.parse('2026-11-11T12:00:00Z');
function googleFetch(overrides: Record<string, unknown> = {}): Fetch {
  return async (input) => {
    assert.equal(String(input), 'https://oauth2.googleapis.com/token');
    const claims = {
      iss: 'https://accounts.google.com', aud: credentials.clientId, exp: now / 1000 + 3600,
      nonce: authorize.nonce, sub: 'google-42', name: 'Alice', email: 'alice@example.com', email_verified: true,
      ...overrides,
    };
    return json({ id_token: `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature` });
  };
}

test('Google requests email and returns its verification claim after validating the ID token', async () => {
  const provider = google(credentials, googleFetch(), () => now);
  const url = new URL(provider.authorizeUrl(authorize));
  assert.equal(url.searchParams.get('scope'), 'openid profile email');
  assert.equal(url.searchParams.get('nonce'), 'nonce');
  const profile = await provider.exchange(exchange);
  assert.equal(profile.subject, 'google-42');
  assert.equal(profile.email, 'alice@example.com');
  assert.equal(profile.emailVerified, true);
  for (const overrides of [{ nonce: 'wrong' }, { aud: 'wrong' }, { iss: 'https://evil.example' }, { exp: now / 1000 - 1 }]) {
    await assert.rejects(google(credentials, googleFetch(overrides), () => now).exchange(exchange));
  }
});

test('Google keeps missing and unverified email claims distinct from verified email', async () => {
  for (const [claims, expected] of [
    [{ email_verified: false }, 'alice@example.com'],
    [{ email_verified: 'false' }, 'alice@example.com'],
    [{ email: undefined }, null],
    [{ email: '' }, null],
  ] as const) {
    const profile = await google(credentials, googleFetch(claims), () => now).exchange(exchange);
    assert.equal(profile.email, expected);
    assert.equal(profile.emailVerified, false);
  }
});

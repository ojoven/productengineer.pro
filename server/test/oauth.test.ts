import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport, type OAuthClientProvider } from '@modelcontextprotocol/client';
import { Browser, location, makeApp, PUBLIC } from './helpers.ts';
import { pkceChallenge, randomToken } from '../src/crypto.ts';
import { redirectMatches, validRedirectUri } from '../src/oauth.ts';

type Fetch = ReturnType<typeof makeApp>['fetch'];

/** The client side of an agent like Claude Code: keeps its registration and tokens in memory. */
class AgentProvider implements OAuthClientProvider {
  readonly redirectUrl = 'http://127.0.0.1:33418/callback';
  clientMetadataUrl?: string;
  info: unknown;
  stored: unknown;
  verifier = '';
  authUrl?: URL;
  constructor(clientMetadataUrl?: string) {
    this.clientMetadataUrl = clientMetadataUrl;
  }
  get clientMetadata() {
    return {
      client_name: 'Test agent',
      redirect_uris: [this.redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'native',
    };
  }
  clientInformation() {
    return this.info as never;
  }
  saveClientInformation(i: unknown) {
    this.info = i;
  }
  tokens() {
    return this.stored as never;
  }
  saveTokens(t: unknown) {
    this.stored = t;
  }
  redirectToAuthorization(url: URL) {
    this.authUrl = url;
  }
  saveCodeVerifier(v: string) {
    this.verifier = v;
  }
  codeVerifier() {
    return this.verifier;
  }
  discovery: unknown;
  saveDiscoveryState(d: unknown) {
    this.discovery = d;
  }
  discoveryState() {
    return this.discovery as never;
  }
}

/** Plays the person in the browser: opens the authorization URL, signs in if needed, decides. */
async function consent(browser: Browser, authUrl: URL, approve = true) {
  const res = await browser.request(authUrl.pathname + authUrl.search);
  assert.equal(res.status, 302);
  const consentPage = location(res);
  assert.equal(consentPage.pathname, '/connect/');
  const id = consentPage.searchParams.get('request')!;
  const details = await (await browser.request(`/api/oauth/requests/${id}`)).json();
  const decision = await (await browser.request(`/api/oauth/requests/${id}/decision`, { method: 'POST', json: { approve } })).json();
  return { details, redirect: new URL(decision.redirect) };
}

async function connect(fetch: Fetch, provider: AgentProvider) {
  const client = new Client({ name: 'test-agent', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${PUBLIC}/mcp`), { authProvider: provider, fetch }));
  return client;
}

const toolJson = (r: unknown) => JSON.parse((r as { content: { text: string }[] }).content[0].text);

test('metadata documents describe the resource and the authorization server', async () => {
  const { fetch } = makeApp();
  const as = await (await fetch('/.well-known/oauth-authorization-server')).json();
  assert.equal(as.issuer, PUBLIC);
  assert.deepEqual(as.code_challenge_methods_supported, ['S256']);
  assert.equal(as.client_id_metadata_document_supported, true);
  assert.equal(as.authorization_response_iss_parameter_supported, true);
  assert.equal(as.registration_endpoint, `${PUBLIC}/oauth/register`);
  const pr = await (await fetch('/.well-known/oauth-protected-resource/mcp')).json();
  assert.equal(pr.resource, `${PUBLIC}/mcp`);
  assert.deepEqual(pr.authorization_servers, [PUBLIC]);

  const unauth = await fetch('/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(unauth.status, 401);
  assert.match(unauth.headers.get('www-authenticate')!, /resource_metadata="http:\/\/localhost:4321\/\.well-known\/oauth-protected-resource\/mcp"/);
});

test('an agent registers, the person approves, and the agent reads their progress', async () => {
  const { fetch, clock } = makeApp();
  const browser = new Browser(fetch);
  await browser.signIn('alice');
  await browser.request('/api/progress', {
    method: 'POST',
    json: {
      changes: [
        { id: 'sample-size', status: 'learning', at: clock.now - 1000 },
        { id: 'user-interviews', status: 'comfortable', at: clock.now - 2000 },
        { id: 'ab-testing', status: 'not-interested', at: clock.now - 3000 },
      ],
    },
  });

  const agent = new AgentProvider();
  await assert.rejects(connect(fetch, agent));
  assert.ok(agent.authUrl, 'the client was sent to authorize');
  assert.equal(agent.authUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(agent.authUrl.searchParams.get('resource'), `${PUBLIC}/mcp`);

  const { details, redirect } = await consent(browser, agent.authUrl);
  assert.equal(details.request.client.name, 'Test agent');
  assert.equal(details.request.client.verifiedDomain, null);
  assert.deepEqual(details.request.redirect, { kind: 'local', host: '127.0.0.1:33418' });
  assert.equal(details.user.name, 'Dev alice');
  assert.equal(redirect.searchParams.get('iss'), PUBLIC);
  assert.equal(redirect.searchParams.get('state'), agent.authUrl.searchParams.get('state'));

  const transport = new StreamableHTTPClientTransport(new URL(`${PUBLIC}/mcp`), { authProvider: agent, fetch });
  await transport.finishAuth(redirect.searchParams.get('code')!, redirect.searchParams.get('iss')!);
  const client = await connect(fetch, agent);

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [
    'get_capability',
    'get_my_progress',
    'get_skill',
    'get_territory',
    'list_skills',
    'list_territories',
    'search_atlas',
  ]);
  assert.ok(tools.every((t) => t.annotations?.readOnlyHint === true));

  const mine = toolJson(await client.callTool({ name: 'get_my_progress', arguments: {} }));
  assert.deepEqual(mine.totals, { skills: 4, comfortable: 1, learning: 1, not_interested: 1, not_started: 1 });
  assert.deepEqual(mine.learning.map((s: { id: string }) => s.id), ['sample-size']);
  assert.deepEqual(mine.untouched_territories, []);
  assert.equal(mine.recent_changes[0].id, 'sample-size');

  const gaps = toolJson(await client.callTool({ name: 'list_skills', arguments: { territory: 'measurement', status: 'not_started' } }));
  assert.deepEqual(gaps.skills.map((s: { id: string }) => s.id), ['funnel-analysis']);
  const optedOut = toolJson(await client.callTool({ name: 'list_skills', arguments: { status: 'not-interested' } }));
  assert.deepEqual(optedOut.skills.map((s: { id: string }) => s.id), ['ab-testing']);

  const skill = toolJson(await client.callTool({ name: 'get_skill', arguments: { id: '06.1.1' } }));
  assert.equal(skill.status, 'learning');
  assert.equal(skill.url, `${PUBLIC}/skills-map/measurement/experiment-design/sample-size/`);

  // the connection shows on the profile page, and revoking it locks the agent out
  const { connections } = await (await browser.request('/api/connections')).json();
  assert.equal(connections.length, 1);
  assert.equal(connections[0].name, 'Test agent');
  const revoke = await browser.request(`/api/connections/${connections[0].id}`, { method: 'DELETE', headers: { origin: PUBLIC } });
  assert.equal(revoke.status, 200);
  const token = (agent.stored as { access_token: string }).access_token;
  const after = await fetch('/mcp', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  assert.equal(after.status, 401);
});

test('a Client ID Metadata Document client, with a loopback redirect on any port', async () => {
  const docUrl = 'https://agent.example/oauth/client.json';
  const fetched: string[] = [];
  const { fetch } = makeApp({
    fetchClientMetadata: async (url) => {
      fetched.push(url);
      assert.equal(url, docUrl);
      return {
        doc: { client_id: docUrl, client_name: 'Example Agent', redirect_uris: ['http://127.0.0.1/callback'] },
        maxAgeMs: 3600_000,
      };
    },
  });
  const browser = new Browser(fetch);
  await browser.signIn('bob');
  const agent = new AgentProvider(docUrl);
  await assert.rejects(connect(fetch, agent));
  assert.equal(agent.authUrl!.searchParams.get('client_id'), docUrl);
  const { details, redirect } = await consent(browser, agent.authUrl!);
  assert.equal(details.request.client.verifiedDomain, 'agent.example');
  const transport = new StreamableHTTPClientTransport(new URL(`${PUBLIC}/mcp`), { authProvider: agent, fetch });
  await transport.finishAuth(redirect.searchParams.get('code')!, redirect.searchParams.get('iss')!);
  const client = await connect(fetch, agent);
  assert.ok((await client.listTools()).tools.length > 0);
  assert.equal(fetched.length, 1, 'the document is cached');
});

/** Registers a client and gets a code by hand, to test the token endpoint's failure cases. */
async function codeFor(fetch: Fetch, browser: Browser, extra: Record<string, string> = {}) {
  const reg = await (
    await fetch('/oauth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: 'Raw', redirect_uris: ['http://localhost:9999/cb'], token_endpoint_auth_method: 'none' }),
    })
  ).json();
  const verifier = randomToken(48);
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: reg.client_id,
    redirect_uri: 'http://localhost:9999/cb',
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: 'S256',
    state: 'xyz',
    resource: `${PUBLIC}/mcp`,
    ...extra,
  });
  const res = await browser.request(`/oauth/authorize?${q}`);
  const loc = location(res);
  if (!loc.searchParams.has('request')) return { clientId: reg.client_id, verifier, error: loc };
  const id = loc.searchParams.get('request')!;
  const decision = await (await browser.request(`/api/oauth/requests/${id}/decision`, { method: 'POST', json: { approve: true } })).json();
  return { clientId: reg.client_id as string, verifier, code: new URL(decision.redirect).searchParams.get('code')! };
}

const token = (fetch: Fetch, params: Record<string, string>) =>
  fetch('/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });

test('token endpoint: PKCE, single-use codes, refresh rotation, expiry', async () => {
  const { fetch, clock } = makeApp();
  const browser = new Browser(fetch);
  await browser.signIn('carol');
  const { clientId, verifier, code } = await codeFor(fetch, browser);

  const wrong = await token(fetch, { grant_type: 'authorization_code', client_id: clientId, code: code!, code_verifier: randomToken(48) });
  assert.equal(wrong.status, 400);
  assert.equal((await wrong.json()).error, 'invalid_grant');

  const ok = await token(fetch, { grant_type: 'authorization_code', client_id: clientId, code: code!, code_verifier: verifier, redirect_uri: 'http://localhost:9999/cb' });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  const tokens = await ok.json();
  assert.equal(tokens.token_type, 'Bearer');
  assert.equal(tokens.scope, 'progress:read');

  const reuse = await token(fetch, { grant_type: 'authorization_code', client_id: clientId, code: code!, code_verifier: verifier });
  assert.equal((await reuse.json()).error, 'invalid_grant');

  const refreshed = await (await token(fetch, { grant_type: 'refresh_token', client_id: clientId, refresh_token: tokens.refresh_token })).json();
  assert.ok(refreshed.access_token && refreshed.access_token !== tokens.access_token);
  const oldRefresh = await token(fetch, { grant_type: 'refresh_token', client_id: clientId, refresh_token: tokens.refresh_token });
  assert.equal((await oldRefresh.json()).error, 'invalid_grant');

  const otherClient = await token(fetch, { grant_type: 'refresh_token', client_id: 'pe_someone_else', refresh_token: refreshed.refresh_token });
  assert.equal(otherClient.status, 401);

  const call = () =>
    fetch('/mcp', {
      method: 'POST',
      headers: { authorization: `Bearer ${refreshed.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'raw', version: '1' } },
      }),
    });
  assert.equal((await call()).status, 200);
  clock.now += 2 * 3600_000;
  assert.equal((await call()).status, 401, 'access tokens expire after an hour');
});

test('authorization errors: wrong resource, unregistered redirect, unknown client, denial', async () => {
  const { fetch } = makeApp();
  const browser = new Browser(fetch);
  await browser.signIn('dave');

  const target = await codeFor(fetch, browser, { resource: 'https://other.example/mcp' });
  assert.equal(target.error!.searchParams.get('error'), 'invalid_target');
  assert.equal(target.error!.searchParams.get('iss'), PUBLIC);
  assert.equal(target.error!.host, 'localhost:9999');

  const noPkce = await codeFor(fetch, browser, { code_challenge_method: 'plain' });
  assert.equal(noPkce.error!.searchParams.get('error'), 'invalid_request');

  const badRedirect = await codeFor(fetch, browser, { redirect_uri: 'https://evil.example/cb' });
  assert.equal(badRedirect.error!.pathname, '/connect/');
  assert.equal(badRedirect.error!.searchParams.get('error'), 'invalid_redirect_uri');

  const unknown = await browser.request('/oauth/authorize?client_id=nope&response_type=code');
  assert.equal(location(unknown).searchParams.get('error'), 'invalid_client');

  const agent = new AgentProvider();
  await assert.rejects(connect(fetch, agent));
  const { redirect } = await consent(browser, agent.authUrl!, false);
  assert.equal(redirect.searchParams.get('error'), 'access_denied');
  assert.equal(redirect.searchParams.get('iss'), PUBLIC);
});

test('the consent decision needs a signed-in person on this site', async () => {
  const { fetch } = makeApp();
  const agent = new AgentProvider();
  await assert.rejects(connect(fetch, agent));
  const anon = new Browser(fetch);
  const res = await anon.request(agent.authUrl!.pathname + agent.authUrl!.search);
  const id = location(res).searchParams.get('request')!;
  const details = await (await anon.request(`/api/oauth/requests/${id}`)).json();
  assert.equal(details.user, null);
  const decision = await anon.request(`/api/oauth/requests/${id}/decision`, { method: 'POST', json: { approve: true } });
  assert.equal(decision.status, 401);

  const signedIn = new Browser(fetch);
  await signedIn.signIn('erin');
  const cross = await signedIn.request(`/api/oauth/requests/${id}/decision`, {
    method: 'POST',
    headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    body: JSON.stringify({ approve: true }),
  });
  assert.equal(cross.status, 403);
});

test('redirect URI rules', () => {
  assert.ok(validRedirectUri('https://claude.ai/api/mcp/auth_callback'));
  assert.ok(validRedirectUri('http://localhost:33418/callback'));
  assert.ok(validRedirectUri('http://127.0.0.1/callback'));
  assert.ok(validRedirectUri('cursor://anysphere.cursor-retrieval/oauth/callback'));
  assert.ok(!validRedirectUri('http://evil.example/cb'));
  assert.ok(!validRedirectUri('javascript:alert(1)'));
  assert.ok(!validRedirectUri('data:text/html,hi'));
  assert.ok(!validRedirectUri('https://x.example/cb#frag'));
  assert.ok(redirectMatches(['http://127.0.0.1/callback'], 'http://127.0.0.1:5555/callback'));
  assert.ok(!redirectMatches(['http://127.0.0.1/callback'], 'http://127.0.0.1:5555/other'));
  assert.ok(!redirectMatches(['https://app.example/cb'], 'https://app.example/cb2'));
});

test('dynamic registration rejects unsafe redirect URIs', async () => {
  const { fetch } = makeApp();
  const reg = (uris: string[]) =>
    fetch('/oauth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ redirect_uris: uris }) });
  assert.equal((await reg(['http://evil.example/cb'])).status, 400);
  assert.equal((await reg([])).status, 400);
  const ok = await reg(['http://localhost:1234/cb']);
  assert.equal(ok.status, 201);
  const body = await ok.json();
  assert.equal(body.token_endpoint_auth_method, 'none');
  assert.equal(body.client_secret, undefined);

  const confidential = await (
    await fetch('/oauth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirect_uris: ['https://app.example/cb'], token_endpoint_auth_method: 'client_secret_basic' }),
    })
  ).json();
  assert.ok(confidential.client_secret);
});

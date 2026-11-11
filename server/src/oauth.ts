// OAuth 2.1 authorization server for MCP clients (agents), on the same origin as the site.
//
// MCP spec 2026-07-28: the MCP endpoint is a protected resource (RFC 9728 metadata), this origin
// is its authorization server (RFC 8414 metadata). Agents identify themselves with a Client ID
// Metadata Document (an https URL as client_id), or with Dynamic Client Registration, which the
// spec now deprecates but most clients still use. PKCE S256 is required, tokens are bound to the
// MCP resource (RFC 8707), and authorization responses carry `iss` (RFC 9207).
//
// People sign in with the site's GitHub or Google sign-in and approve the agent on /connect/.
// Tokens are opaque random strings, stored as hashes, revocable from the profile page.
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { OAuthError, OAuthErrorCode, type AuthInfo, type OAuthTokenVerifier } from '@modelcontextprotocol/server';
import type { Deps } from './app.ts';
import { mcpUrl } from './config.ts';
import { hash, pkceChallenge, randomId, randomToken, safeEqual } from './crypto.ts';
import { tx, type Db } from './db.ts';
import { clientIp, RateLimiter } from './http.ts';
import { sessionUser } from './account.ts';
import { fetchClientMetadata, type ClientMetadataFetcher } from './cimd.ts';

export const SCOPES = { 'progress:read': 'Read your skill statuses on the atlas' } as const;
export type Scope = keyof typeof SCOPES;
export const DEFAULT_SCOPE: Scope = 'progress:read';

const ACCESS_TTL = 3600_000;
const REFRESH_TTL = 60 * 86400_000;
const CODE_TTL = 5 * 60_000;
const REQUEST_TTL = 15 * 60_000;

type AuthMethod = 'none' | 'client_secret_post' | 'client_secret_basic';

export interface Client {
  clientId: string;
  kind: 'cimd' | 'dcr';
  name: string | null;
  uri: string | null;
  redirectUris: string[];
  authMethod: AuthMethod;
  secretHash: string | null;
}

// ---- redirect URIs -------------------------------------------------------------------------

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const BANNED_SCHEMES = new Set(['javascript:', 'data:', 'file:', 'vbscript:', 'about:', 'blob:', 'ftp:', 'ws:', 'wss:']);

/** https anywhere, http only on loopback, or a private-use scheme for native apps (cursor://). */
export function validRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === 'https:') return !!u.hostname;
  if (u.protocol === 'http:') return LOOPBACK.has(u.hostname);
  return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && !BANNED_SCHEMES.has(u.protocol);
}

/** Exact match, except that a loopback redirect may use any port (RFC 8252 7.3). */
export function redirectMatches(registered: string[], requested: string): boolean {
  if (registered.includes(requested)) return true;
  let req: URL;
  try {
    req = new URL(requested);
  } catch {
    return false;
  }
  if (req.protocol !== 'http:' || !LOOPBACK.has(req.hostname)) return false;
  return registered.some((r) => {
    try {
      const reg = new URL(r);
      return reg.protocol === 'http:' && reg.hostname === req.hostname && reg.pathname === req.pathname && reg.search === req.search;
    } catch {
      return false;
    }
  });
}

const isUrlClientId = (id: string) => id.startsWith('https://');

// ---- clients -------------------------------------------------------------------------------

function rowToClient(row: Record<string, unknown>): Client {
  return {
    clientId: row.client_id as string,
    kind: row.kind as Client['kind'],
    name: row.name as string | null,
    uri: row.uri as string | null,
    redirectUris: JSON.parse(row.redirect_uris as string),
    authMethod: row.auth_method as AuthMethod,
    secretHash: row.secret_hash as string | null,
  };
}

async function getClient(db: Db, clientId: string, fetcher: ClientMetadataFetcher, now: number): Promise<Client | undefined> {
  if (!clientId || clientId.length > 2000) return undefined;
  const row = db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').get(clientId) as Record<string, unknown> | undefined;
  if (!isUrlClientId(clientId)) return row && row.kind === 'dcr' ? rowToClient(row) : undefined;
  if (row && (row.expires_at as number) > now) return rowToClient(row);
  try {
    const { doc, maxAgeMs } = await fetcher(clientId);
    const client: Client = {
      clientId,
      kind: 'cimd',
      name: doc.client_name,
      uri: doc.client_uri ?? null,
      redirectUris: doc.redirect_uris,
      authMethod: 'none',
      secretHash: null,
    };
    db.prepare(
      `INSERT INTO oauth_clients (client_id, kind, name, uri, redirect_uris, auth_method, secret_hash, created_at, expires_at)
       VALUES (?, 'cimd', ?, ?, ?, 'none', NULL, ?, ?)
       ON CONFLICT (client_id) DO UPDATE SET name = excluded.name, uri = excluded.uri,
         redirect_uris = excluded.redirect_uris, expires_at = excluded.expires_at`,
    ).run(clientId, client.name, client.uri, JSON.stringify(client.redirectUris), now, now + maxAgeMs);
    return client;
  } catch (err) {
    console.warn(`client metadata ${clientId}: ${(err as Error).message}`);
    // a stale copy is better than locking out a client whose site is briefly down
    return row ? rowToClient(row) : undefined;
  }
}

// ---- grants and tokens ---------------------------------------------------------------------

function issueTokens(db: Db, grantId: string, now: number) {
  const access = randomToken();
  const refresh = randomToken();
  const insert = db.prepare('INSERT INTO oauth_tokens (token_hash, grant_id, kind, created_at, expires_at) VALUES (?, ?, ?, ?, ?)');
  insert.run(hash(access), grantId, 'access', now, now + ACCESS_TTL);
  insert.run(hash(refresh), grantId, 'refresh', now, now + REFRESH_TTL);
  db.prepare('UPDATE oauth_grants SET last_used_at = ? WHERE id = ?').run(now, grantId);
  const grant = db.prepare('SELECT scope FROM oauth_grants WHERE id = ?').get(grantId) as { scope: string };
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: ACCESS_TTL / 1000,
    refresh_token: refresh,
    scope: grant.scope,
  };
}

export function listGrants(db: Db, userId: string) {
  const rows = db
    .prepare(
      `SELECT g.id, g.client_id, g.client_name, g.scope, g.created_at, g.last_used_at, c.uri
         FROM oauth_grants g LEFT JOIN oauth_clients c ON c.client_id = g.client_id
        WHERE g.user_id = ? ORDER BY COALESCE(g.last_used_at, g.created_at) DESC`,
    )
    .all(userId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    name: (r.client_name as string | null) ?? 'Unnamed agent',
    verifiedDomain: isUrlClientId(r.client_id as string) ? new URL(r.client_id as string).host : null,
    uri: (r.uri as string | null) ?? null,
    scopes: (r.scope as string).split(' '),
    createdAt: new Date(r.created_at as number).toISOString(),
    lastUsedAt: r.last_used_at ? new Date(r.last_used_at as number).toISOString() : null,
  }));
}

export function revokeGrant(db: Db, userId: string, grantId: string): boolean {
  return db.prepare('DELETE FROM oauth_grants WHERE id = ? AND user_id = ?').run(grantId, userId).changes > 0;
}

/** Resolves a bearer token to the person and agent behind it. Used by the MCP endpoint. */
export function tokenVerifier(deps: Pick<Deps, 'db' | 'now'>): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      const now = deps.now();
      const row = deps.db
        .prepare(
          `SELECT t.expires_at, g.id AS grant_id, g.user_id, g.client_id, g.scope, g.resource, g.last_used_at
             FROM oauth_tokens t JOIN oauth_grants g ON g.id = t.grant_id
            WHERE t.token_hash = ? AND t.kind = 'access'`,
        )
        .get(hash(token)) as Record<string, unknown> | undefined;
      if (!row || (row.expires_at as number) < now) throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid or expired token');
      if (!row.last_used_at || (row.last_used_at as number) < now - 5 * 60_000) {
        deps.db.prepare('UPDATE oauth_grants SET last_used_at = ? WHERE id = ?').run(now, row.grant_id as string);
      }
      return {
        token,
        clientId: row.client_id as string,
        scopes: (row.scope as string).split(' '),
        expiresAt: Math.floor((row.expires_at as number) / 1000),
        resource: new URL(row.resource as string),
        extra: { userId: row.user_id },
      };
    },
  };
}

// ---- routes --------------------------------------------------------------------------------

export function oauthRoutes(deps: Deps) {
  const { config, db, now } = deps;
  const fetcher = deps.fetchClientMetadata ?? fetchClientMetadata;
  const issuer = config.publicUrl;
  const resource = mcpUrl(config);
  const app = new Hono();
  const registerLimit = new RateLimiter(20, 3600_000);
  const tokenLimit = new RateLimiter(120, 60_000);
  const authorizeLimit = new RateLimiter(60, 10 * 60_000);

  const asMetadata = {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: Object.keys(SCOPES),
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${issuer}/me/#agents`,
  };
  const prMetadata = {
    resource,
    authorization_servers: [issuer],
    scopes_supported: Object.keys(SCOPES),
    bearer_methods_supported: ['header'],
    resource_name: 'ProductEngineer.pro Skill Atlas',
    resource_documentation: `${issuer}/me/#agents`,
  };

  // Agents call these from anywhere, sometimes from a browser. No cookies are read here.
  const open = cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization', 'MCP-Protocol-Version'] });
  app.use('/.well-known/*', open);
  app.use('/oauth/token', open);
  app.use('/oauth/register', open);
  app.use('/oauth/revoke', open);

  app.get('/.well-known/oauth-authorization-server', (c) => c.json(asMetadata));
  app.get('/.well-known/oauth-protected-resource', (c) => c.json(prMetadata));
  app.get('/.well-known/oauth-protected-resource/mcp', (c) => c.json(prMetadata));

  // ---- Dynamic Client Registration (RFC 7591) --------------------------------------------

  app.post('/oauth/register', async (c) => {
    if (!registerLimit.allow(clientIp(c, config), now())) return oauthError(c, 429, 'slow_down', 'Too many registrations');
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return oauthError(c, 400, 'invalid_client_metadata', 'Expected a JSON body');
    const uris = body.redirect_uris;
    if (!Array.isArray(uris) || !uris.length || uris.length > 10 || !uris.every(validRedirectUri)) {
      return oauthError(c, 400, 'invalid_redirect_uri', 'redirect_uris must be https, http on localhost, or an app scheme');
    }
    const method = (body.token_endpoint_auth_method ?? 'none') as AuthMethod;
    if (!['none', 'client_secret_post', 'client_secret_basic'].includes(method)) {
      return oauthError(c, 400, 'invalid_client_metadata', 'Unsupported token_endpoint_auth_method');
    }
    if (Array.isArray(body.grant_types) && !body.grant_types.includes('authorization_code')) {
      return oauthError(c, 400, 'invalid_client_metadata', 'grant_types must include authorization_code');
    }
    const name = typeof body.client_name === 'string' ? body.client_name.trim().slice(0, 100) || null : null;
    const uri = typeof body.client_uri === 'string' && /^https:\/\//.test(body.client_uri) ? body.client_uri.slice(0, 500) : null;
    const clientId = `pe_${randomToken(18)}`;
    const secret = method === 'none' ? null : randomToken();
    const t = now();
    db.prepare(
      `INSERT INTO oauth_clients (client_id, kind, name, uri, redirect_uris, auth_method, secret_hash, created_at, expires_at)
       VALUES (?, 'dcr', ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(clientId, name, uri, JSON.stringify(uris), method, secret ? hash(secret) : null, t);
    return c.json(
      {
        client_id: clientId,
        client_id_issued_at: Math.floor(t / 1000),
        ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
        client_name: name ?? undefined,
        client_uri: uri ?? undefined,
        redirect_uris: uris,
        token_endpoint_auth_method: method,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: Object.keys(SCOPES).join(' '),
      },
      201,
      { 'Cache-Control': 'no-store' },
    );
  });

  // ---- authorization endpoint ------------------------------------------------------------

  app.get('/oauth/authorize', async (c) => {
    if (!authorizeLimit.allow(clientIp(c, config), now())) return c.redirect(`/connect/?error=rate_limited`, 302);
    const q = c.req.query();
    const client = await getClient(db, q.client_id ?? '', fetcher, now());
    // Without a known client and a registered redirect URI there is nowhere safe to send an
    // error, so the person sees it on the site instead.
    if (!client) return c.redirect(`/connect/?error=invalid_client`, 302);
    const redirectUri = q.redirect_uri ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : '');
    if (!redirectUri || !redirectMatches(client.redirectUris, redirectUri)) return c.redirect(`/connect/?error=invalid_redirect_uri`, 302);

    const fail = (error: string, description: string) => c.redirect(responseUrl(redirectUri, { error, error_description: description, state: q.state }), 302);
    if (q.response_type !== 'code') return fail('unsupported_response_type', 'Only response_type=code is supported');
    if (!q.code_challenge || q.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(q.code_challenge)) {
      return fail('invalid_request', 'PKCE with code_challenge_method=S256 is required');
    }
    const res = normalizeResource(q.resource);
    if (!res) return fail('invalid_target', `Unknown resource; this server issues tokens for ${resource}`);
    const scopes = (q.scope ?? '').split(' ').filter((s): s is Scope => s in SCOPES);
    const scope = (scopes.length ? [...new Set(scopes)] : [DEFAULT_SCOPE]).join(' ');

    const id = randomToken(18);
    db.prepare(
      `INSERT INTO oauth_requests (id, client_id, redirect_uri, state, code_challenge, scope, resource, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, client.clientId, redirectUri, q.state ?? null, q.code_challenge, scope, res, now() + REQUEST_TTL);
    return c.redirect(`/connect/?request=${encodeURIComponent(id)}`, 302);
  });

  /** What the consent page shows: who is asking, for what, and who is signed in. */
  app.get('/api/oauth/requests/:id', async (c) => {
    c.header('Cache-Control', 'no-store');
    const req = pendingRequest(c.req.param('id'));
    if (!req) return c.json({ error: 'expired' }, 404);
    const client = await getClient(db, req.client_id, fetcher, now());
    if (!client) return c.json({ error: 'invalid_client' }, 404);
    const user = sessionUser(deps, c);
    return c.json({
      request: {
        id: req.id,
        client: {
          name: client.name ?? 'An unnamed agent',
          uri: client.uri,
          verifiedDomain: client.kind === 'cimd' ? new URL(client.clientId).host : null,
        },
        redirect: describeRedirect(req.redirect_uri),
        scopes: req.scope.split(' ').map((s) => ({ id: s, description: SCOPES[s as Scope] ?? s })),
      },
      user: user ? { name: user.name, avatarUrl: user.avatar_url } : null,
    });
  });

  app.post('/api/oauth/requests/:id/decision', async (c) => {
    c.header('Cache-Control', 'no-store');
    const origin = c.req.header('origin');
    if ((origin && origin !== config.publicUrl) || c.req.header('sec-fetch-site') === 'cross-site') return c.json({ error: 'cross_origin' }, 403);
    if (!c.req.header('content-type')?.startsWith('application/json')) return c.json({ error: 'json_required' }, 415);
    const user = sessionUser(deps, c);
    if (!user) return c.json({ error: 'signed_out' }, 401);
    const req = pendingRequest(c.req.param('id'));
    if (!req) return c.json({ error: 'expired' }, 404);
    const body = (await c.req.json().catch(() => ({}))) as { approve?: unknown };
    db.prepare('DELETE FROM oauth_requests WHERE id = ?').run(req.id);

    if (body.approve !== true) {
      return c.json({ redirect: responseUrl(req.redirect_uri, { error: 'access_denied', error_description: 'The person declined', state: req.state }) });
    }
    const client = await getClient(db, req.client_id, fetcher, now());
    if (!client) return c.json({ error: 'invalid_client' }, 404);
    const code = randomToken();
    const t = now();
    tx(db, () => {
      const grant = db
        .prepare(
          `INSERT INTO oauth_grants (id, user_id, client_id, client_name, scope, resource, created_at, last_used_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
           ON CONFLICT (user_id, client_id) DO UPDATE SET client_name = excluded.client_name, scope = excluded.scope, resource = excluded.resource
           RETURNING id`,
        )
        .get(randomId(), user.id, client.clientId, client.name, req.scope, req.resource, t) as { id: string };
      db.prepare('INSERT INTO oauth_codes (code_hash, grant_id, redirect_uri, code_challenge, expires_at) VALUES (?, ?, ?, ?, ?)').run(
        hash(code),
        grant.id,
        req.redirect_uri,
        req.code_challenge,
        t + CODE_TTL,
      );
    });
    return c.json({ redirect: responseUrl(req.redirect_uri, { code, state: req.state }) });
  });

  // ---- token endpoint --------------------------------------------------------------------

  app.post('/oauth/token', async (c) => {
    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');
    if (!tokenLimit.allow(clientIp(c, config), now())) return oauthError(c, 429, 'slow_down', 'Too many requests');
    const p = await formParams(c);
    const auth = await authenticateClient(c, p);
    if (!auth) return oauthError(c, 401, 'invalid_client', 'Unknown client or bad credentials');
    if (p.resource !== undefined && !normalizeResource(p.resource)) return oauthError(c, 400, 'invalid_target', 'Unknown resource');
    const t = now();

    if (p.grant_type === 'authorization_code') {
      const row = db
        .prepare(
          `SELECT k.code_hash, k.grant_id, k.redirect_uri, k.code_challenge, k.expires_at, g.client_id
             FROM oauth_codes k JOIN oauth_grants g ON g.id = k.grant_id WHERE k.code_hash = ?`,
        )
        .get(hash(p.code ?? '')) as Record<string, unknown> | undefined;
      if (!row || (row.expires_at as number) < t || row.client_id !== auth.clientId) return oauthError(c, 400, 'invalid_grant', 'Invalid or expired code');
      if (p.redirect_uri !== undefined && p.redirect_uri !== row.redirect_uri) return oauthError(c, 400, 'invalid_grant', 'redirect_uri does not match');
      const verifier = p.code_verifier ?? '';
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || !safeEqual(pkceChallenge(verifier), row.code_challenge as string)) {
        return oauthError(c, 400, 'invalid_grant', 'PKCE verification failed');
      }
      const tokens = tx(db, () => {
        db.prepare('DELETE FROM oauth_codes WHERE code_hash = ?').run(row.code_hash as string);
        return issueTokens(db, row.grant_id as string, t);
      });
      return c.json(tokens);
    }

    if (p.grant_type === 'refresh_token') {
      const row = db
        .prepare(
          `SELECT t.token_hash, t.grant_id, t.expires_at, g.client_id FROM oauth_tokens t JOIN oauth_grants g ON g.id = t.grant_id
            WHERE t.token_hash = ? AND t.kind = 'refresh'`,
        )
        .get(hash(p.refresh_token ?? '')) as Record<string, unknown> | undefined;
      if (!row || (row.expires_at as number) < t || row.client_id !== auth.clientId) return oauthError(c, 400, 'invalid_grant', 'Invalid or expired refresh token');
      // rotation: the old refresh token stops working as soon as a new one is issued
      const tokens = tx(db, () => {
        db.prepare('DELETE FROM oauth_tokens WHERE token_hash = ?').run(row.token_hash as string);
        return issueTokens(db, row.grant_id as string, t);
      });
      return c.json(tokens);
    }

    return oauthError(c, 400, 'unsupported_grant_type', 'Use authorization_code or refresh_token');
  });

  // ---- revocation (RFC 7009) -------------------------------------------------------------

  app.post('/oauth/revoke', async (c) => {
    const p = await formParams(c);
    const auth = await authenticateClient(c, p);
    if (!auth) return oauthError(c, 401, 'invalid_client', 'Unknown client or bad credentials');
    const row = db
      .prepare('SELECT t.kind, t.grant_id, g.client_id FROM oauth_tokens t JOIN oauth_grants g ON g.id = t.grant_id WHERE t.token_hash = ?')
      .get(hash(p.token ?? '')) as { kind: string; grant_id: string; client_id: string } | undefined;
    if (row && row.client_id === auth.clientId) {
      if (row.kind === 'refresh') db.prepare('DELETE FROM oauth_tokens WHERE grant_id = ?').run(row.grant_id);
      else db.prepare('DELETE FROM oauth_tokens WHERE token_hash = ?').run(hash(p.token!));
    }
    return c.body(null, 200);
  });

  // ---- helpers ---------------------------------------------------------------------------

  function pendingRequest(id: string) {
    const row = db.prepare('SELECT * FROM oauth_requests WHERE id = ?').get(id) as
      | { id: string; client_id: string; redirect_uri: string; state: string | null; code_challenge: string; scope: string; resource: string; expires_at: number }
      | undefined;
    return row && row.expires_at > now() ? row : undefined;
  }

  /** The MCP endpoint, accepted with or without a trailing slash, or as the bare origin. */
  function normalizeResource(value: string | undefined): string | null {
    if (value === undefined || value === '') return resource;
    const v = value.replace(/\/+$/, '');
    return v === resource || v === issuer ? resource : null;
  }

  function responseUrl(redirectUri: string, params: Record<string, string | null | undefined>): string {
    const u = new URL(redirectUri);
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
    u.searchParams.set('iss', issuer);
    return u.href;
  }

  async function formParams(c: Context): Promise<Record<string, string | undefined>> {
    const type = c.req.header('content-type') ?? '';
    if (type.startsWith('application/json')) {
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === 'string' ? v : undefined]));
    }
    const body = await c.req.parseBody().catch(() => ({}));
    return Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === 'string' ? v : undefined]));
  }

  /** Public clients send client_id only; confidential ones add a secret (post or basic). */
  async function authenticateClient(c: Context, p: Record<string, string | undefined>): Promise<Client | undefined> {
    let clientId = p.client_id;
    let secret = p.client_secret;
    const basic = c.req.header('authorization');
    if (basic?.startsWith('Basic ')) {
      const decoded = Buffer.from(basic.slice(6), 'base64').toString('utf8');
      const i = decoded.indexOf(':');
      if (i > 0) {
        clientId = decodeURIComponent(decoded.slice(0, i));
        secret = decodeURIComponent(decoded.slice(i + 1));
      }
    }
    if (!clientId) return undefined;
    const client = await getClient(db, clientId, fetcher, now());
    if (!client) return undefined;
    if (client.authMethod === 'none') return client;
    return secret && client.secretHash && safeEqual(hash(secret), client.secretHash) ? client : undefined;
  }

  return app;
}

function oauthError(c: Context, status: 400 | 401 | 429, error: string, description: string) {
  return c.json({ error, error_description: description }, status, { 'Cache-Control': 'no-store' });
}

/** A short, honest description of where the person will be sent after approving. */
function describeRedirect(uri: string): { kind: 'web' | 'local' | 'app'; host: string } {
  const u = new URL(uri);
  if (u.protocol === 'https:') return { kind: 'web', host: u.host };
  if (u.protocol === 'http:') return { kind: 'local', host: u.host };
  return { kind: 'app', host: u.protocol.replace(/:$/, '') };
}

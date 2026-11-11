import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireBearerAuth } from '@modelcontextprotocol/server';
import type { Atlas } from './atlas.ts';
import { mcpUrl, type Config } from './config.ts';
import type { Db } from './db.ts';
import type { ClientMetadataFetcher } from './cimd.ts';
import type { Provider, ProviderId } from './providers.ts';
import { accountRoutes } from './account.ts';
import { oauthRoutes, tokenVerifier, DEFAULT_SCOPE } from './oauth.ts';
import { mcpHandlers } from './mcp.ts';

export interface Deps {
  config: Config;
  db: Db;
  atlas: Atlas;
  providers: Map<ProviderId, Provider>;
  now: () => number;
  version: string;
  /** Tests replace the network fetch of client metadata documents. */
  fetchClientMetadata?: ClientMetadataFetcher;
}

export function createApp(deps: Deps) {
  const { config } = deps;
  const app = new Hono();

  app.onError((err, c) => {
    console.error(`${c.req.method} ${c.req.path}:`, err);
    return c.json({ error: 'server_error' }, 500);
  });

  app.get('/api/health', (c) => c.json({ ok: true, version: deps.version, atlas: deps.atlas.generated }));
  app.route('/', oauthRoutes(deps));
  app.route('/api', accountRoutes(deps));

  // ---- MCP ---------------------------------------------------------------------------------
  const mcp = mcpHandlers({ atlas: deps.atlas, db: deps.db, publicUrl: config.publicUrl, version: deps.version });
  const gate = requireBearerAuth({
    verifier: tokenVerifier(deps),
    requiredScopes: [DEFAULT_SCOPE],
    resourceMetadataUrl: `${config.publicUrl}/.well-known/oauth-protected-resource/mcp`,
    expectedResource: new URL(mcpUrl(config)),
  });
  // Bearer tokens only, never cookies, so any origin may call it.
  const mcpCors = cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'Accept', 'MCP-Protocol-Version', 'Mcp-Session-Id', 'Mcp-Method', 'Mcp-Name', 'Last-Event-ID'],
    exposeHeaders: ['WWW-Authenticate', 'Mcp-Session-Id', 'MCP-Protocol-Version'],
  });
  app.use('/mcp', mcpCors);
  app.use('/mcp/public', mcpCors);
  app.all('/mcp', async (c) => {
    const auth = await gate(c.req.raw);
    if (auth instanceof Response) return auth;
    return mcp.signedIn.fetch(c.req.raw, { authInfo: auth });
  });
  app.all('/mcp/public', (c) => mcp.open.fetch(c.req.raw));

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  return app;
}

// Configuration from the environment. Production values live in server/.env on the VPS (never
// committed); see .env.example.
import { join } from 'node:path';

export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

export interface Config {
  /** Public origin of the site, without a trailing slash, e.g. https://productengineer.pro */
  publicUrl: string;
  port: number;
  host: string;
  dbPath: string;
  atlasPath: string;
  github?: ProviderCredentials;
  google?: ProviderCredentials;
  /** Local development only: a fake provider that signs you in without leaving the site. */
  devLogin: boolean;
  /** Trust X-Forwarded-For from the local reverse proxy (Apache). */
  trustProxy: boolean;
}

const SERVER_ROOT = join(import.meta.dirname, '..');

function credentials(env: NodeJS.ProcessEnv, prefix: string): ProviderCredentials | undefined {
  const clientId = env[`${prefix}_CLIENT_ID`]?.trim();
  const clientSecret = env[`${prefix}_CLIENT_SECRET`]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

export function isLocalUrl(url: string): boolean {
  const { hostname } = new URL(url);
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const publicUrl = (env.PUBLIC_URL ?? 'http://localhost:4321').replace(/\/+$/, '');
  const devLogin = env.DEV_LOGIN === '1';
  if (devLogin && !isLocalUrl(publicUrl)) {
    throw new Error('DEV_LOGIN=1 is only allowed when PUBLIC_URL is a localhost URL');
  }
  const config: Config = {
    publicUrl,
    port: Number(env.PORT ?? 8790),
    host: env.HOST ?? '127.0.0.1',
    dbPath: env.DB_PATH ?? join(SERVER_ROOT, 'data', 'productengineer.sqlite'),
    atlasPath: env.ATLAS_PATH ?? join(SERVER_ROOT, 'atlas.json'),
    github: credentials(env, 'GITHUB'),
    google: credentials(env, 'GOOGLE'),
    devLogin,
    trustProxy: env.TRUST_PROXY !== '0',
  };
  return config;
}

/** The MCP endpoint is the protected resource; its URL is the audience of every access token. */
export const mcpUrl = (c: Pick<Config, 'publicUrl'>) => `${c.publicUrl}/mcp`;
